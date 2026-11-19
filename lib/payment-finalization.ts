
import prisma from "@/lib/prisma";

type FinalizePaymentInput = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
  amount: number;
  currency: string;
};

type FinalizationResult =
  | {
      status: "SUCCESS";
      bookingId: string;
      alreadyProcessed: boolean;
    }
  | {
      status: "REQUIRES_REFUND" | "REFUND_PENDING" | "REFUNDED";
      bookingId: string;
      alreadyProcessed: boolean;
    }
  | {
      status: "NOT_FOUND" | "MISMATCH" | "CONFLICT";
      bookingId?: string;
      alreadyProcessed: false;
    };

export async function finalizeCapturedPayment(
  input: FinalizePaymentInput
): Promise<FinalizationResult> {
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    amount,
    currency,
  } = input;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx): Promise<FinalizationResult> => {
          const payment = await tx.payment.findUnique({
            where: {
              razorpayOrderId,
            },
          });

          if (!payment) {
            return {
              status: "NOT_FOUND",
              alreadyProcessed: false,
            };
          }

          if (
            payment.amount !== amount ||
            payment.currency !== currency
          ) {
            return {
              status: "MISMATCH",
              bookingId: payment.bookingId,
              alreadyProcessed: false,
            };
          }

          // Handle payments that have already been finalized.
          if (
            payment.status === "SUCCESS" ||
            payment.status === "REQUIRES_REFUND" ||
            payment.status === "REFUND_PENDING" ||
            payment.status === "REFUNDED"
          ) {
            if (
              payment.razorpayPaymentId !== razorpayPaymentId
            ) {
              return {
                status: "MISMATCH",
                bookingId: payment.bookingId,
                alreadyProcessed: false,
              };
            }

            return {
              status: payment.status,
              bookingId: payment.bookingId,
              alreadyProcessed: true,
            };
          }

          if (payment.status !== "PENDING") {
            return {
              status: "CONFLICT",
              bookingId: payment.bookingId,
              alreadyProcessed: false,
            };
          }

          // Atomically claim the pending payment.
          const claimed = await tx.payment.updateMany({
            where: {
              id: payment.id,
              status: "PENDING",
              razorpayPaymentId: null,
            },
            data: {
              razorpayPaymentId,
              ...(razorpaySignature
                ? { razorpaySignature }
                : {}),
            },
          });

          if (claimed.count !== 1) {
            return {
              status: "CONFLICT",
              bookingId: payment.bookingId,
              alreadyProcessed: false,
            };
          }

          // Confirm the booking only if its hold is valid.
          const confirmed = await tx.booking.updateMany({
            where: {
              id: payment.bookingId,
              status: "PENDING_PAYMENT",
              expiresAt: {
                gt: new Date(),
              },
            },
            data: {
              status: "CONFIRMED",
              expiresAt: null,
            },
          });

          if (confirmed.count === 1) {
            await tx.payment.update({
              where: {
                id: payment.id,
              },
              data: {
                status: "SUCCESS",
                refundReason: null,
              },
            });

            return {
              status: "SUCCESS",
              bookingId: payment.bookingId,
              alreadyProcessed: false,
            };
          }

          // Money was captured, but the booking is no longer valid.
          await tx.payment.update({
            where: {
              id: payment.id,
            },
            data: {
              status: "REQUIRES_REFUND",
              refundReason:
                "Payment captured after booking expired or became unavailable",
            },
          });

          return {
            status: "REQUIRES_REFUND",
            bookingId: payment.bookingId,
            alreadyProcessed: false,
          };
        },
        {
          isolationLevel: "Serializable",
        }
      );
    } catch (error) {
      const prismaError = error as { code?: string };

      // Retry serialization conflicts and deadlocks.
      if (prismaError.code === "P2034" && attempt < 3) {
        continue;
      }

      throw error;
    }
  }

  return {
    status: "CONFLICT",
    alreadyProcessed: false,
  };
}
