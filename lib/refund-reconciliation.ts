
import prisma from "@/lib/prisma";
import razorpay from "@/lib/razorpay";

type RefundRecord = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, unknown> | null;
};

type ReconciliationResult =
  | { status: "NOT_FOUND" }
  | { status: "NOT_REQUIRED" }
  | { status: "ALREADY_REFUNDED"; refundId: string | null }
  | { status: "REFUND_PENDING"; refundId: string }
  | { status: "REFUNDED"; refundId: string }
  | { status: "MANUAL_REVIEW"; reason: string };

export async function reconcilePaymentRefund(
  paymentId: string
): Promise<ReconciliationResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return { status: "NOT_FOUND" };
  }

  if (payment.status === "REFUNDED") {
    return {
      status: "ALREADY_REFUNDED",
      refundId: payment.razorpayRefundId,
    };
  }

  if (payment.status !== "REFUND_PENDING") {
    return { status: "NOT_REQUIRED" };
  }

  if (
    !payment.razorpayPaymentId ||
    !payment.refundIdempotencyKey
  ) {
    return {
      status: "MANUAL_REVIEW",
      reason: "Missing refund reconciliation identifiers",
    };
  }

  try {
    let refund: RefundRecord | undefined;

    if (payment.razorpayRefundId) {
      refund = (await razorpay.payments.fetchRefund(
        payment.razorpayPaymentId,
        payment.razorpayRefundId
      )) as RefundRecord;
    } else {
      // Retrieve refunds for this Razorpay payment.
      const response =
        await razorpay.payments.fetchMultipleRefund(
          payment.razorpayPaymentId,
          { count: 100, skip: 0 }
        );

      const records = response.items as RefundRecord[];

      // Never assume the first refund belongs to Appointly.
      const matches = records.filter(
        (item) =>
          item.payment_id === payment.razorpayPaymentId &&
          item.amount === payment.amount &&
          item.currency === payment.currency &&
          item.notes?.refundOperationKey ===
            payment.refundIdempotencyKey &&
          item.notes?.appointlyPaymentId === payment.id
      );

      if (matches.length !== 1) {
        return {
          status: "MANUAL_REVIEW",
          reason:
            matches.length === 0
              ? "No matching refund found; do not retry automatically"
              : "Multiple matching refunds found",
        };
      }

      refund = matches[0];
    }

    if (
      !refund ||
      refund.payment_id !== payment.razorpayPaymentId ||
      refund.amount !== payment.amount ||
      refund.currency !== payment.currency
    ) {
      return {
        status: "MANUAL_REVIEW",
        reason: "Refund details do not match payment",
      };
    }

    const completed = refund.status === "processed";

    // Update only the refund operation being reconciled.
    const updated = await prisma.payment.updateMany({
      where: {
        id: payment.id,
        status: "REFUND_PENDING",
        refundIdempotencyKey: payment.refundIdempotencyKey,
        razorpayRefundId: payment.razorpayRefundId,
      },
      data: {
        razorpayRefundId: refund.id,
        status: completed ? "REFUNDED" : "REFUND_PENDING",
        refundedAt: completed ? new Date() : null,
      },
    });

    if (updated.count !== 1) {
      return {
        status: "MANUAL_REVIEW",
        reason: "Payment changed during reconciliation",
      };
    }

    return {
      status: completed ? "REFUNDED" : "REFUND_PENDING",
      refundId: refund.id,
    };
  } catch (error) {
    console.error("Refund reconciliation error:", error);

    return {
      status: "MANUAL_REVIEW",
      reason: "Unable to verify refund status with Razorpay",
    };
  }
}
