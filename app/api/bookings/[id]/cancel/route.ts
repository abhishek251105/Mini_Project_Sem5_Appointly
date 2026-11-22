import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { initiatePaymentRefund } from "@/lib/payment-refund";
import { sendBookingCancellationEmail } from "@/lib/booking-notifications";

const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate the host
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // 2. Get booking ID and optional cancellation body
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const validation = cancelSchema.safeParse(body || {});
    const reason = validation.success ? validation.data.reason : undefined;

    // 3. Find booking belonging to this host
    const booking = await prisma.booking.findFirst({
      where: {
        id,
        hostId: user.id,
      },
    });

    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          message: "Booking not found",
        },
        { status: 404 }
      );
    }

    // 4. Check whether booking can be cancelled
    if (
      booking.status !== "CONFIRMED" &&
      booking.status !== "PENDING_PAYMENT"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "This booking cannot be cancelled",
        },
        { status: 409 }
      );
    }

    // 5. Cancel the booking atomically
    const cancellation = await prisma.booking.updateMany({
      where: {
        id,
        hostId: user.id,
        status: booking.status,
      },
      data: {
        status: "CANCELLED",
      },
    });

    if (cancellation.count === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Booking status changed. Please try again.",
        },
        { status: 409 }
      );
    }

    // 6. Retrieve updated booking
    const updatedBooking = await prisma.booking.findUnique({
      where: { id },
    });

    // 7. Initiate a refund if a captured payment exists for this booking.
    //    Only payments in REQUIRES_REFUND state are refundable. We first need
    //    to mark an eligible SUCCESS payment as REQUIRES_REFUND so that
    //    initiatePaymentRefund can process it.
    //
    //    Refund policy: a full refund is issued for any successfully captured
    //    payment whose booking is cancelled by the host, regardless of timing.
    //    PENDING_PAYMENT bookings had no money captured, so no refund is needed.
    let refundResult: { status: string } | null = null;

    if (booking.status === "CONFIRMED") {
      // Look for a successfully captured payment on this booking.
      const successPayment = await prisma.payment.findFirst({
        where: {
          bookingId: id,
          status: "SUCCESS",
        },
        select: { id: true },
      });

      if (successPayment) {
        // Atomically transition the payment from SUCCESS → REQUIRES_REFUND
        // so that initiatePaymentRefund can claim and process it.
        // Using updateMany with status guard prevents double-marking.
        const marked = await prisma.payment.updateMany({
          where: {
            id: successPayment.id,
            status: "SUCCESS",
          },
          data: {
            status: "REQUIRES_REFUND",
            refundReason: "Host cancelled the booking",
          },
        });

        if (marked.count === 1) {
          // Attempt to initiate the refund. Failures here must NOT roll back
          // the booking cancellation — the reconciliation endpoint handles
          // stuck REQUIRES_REFUND payments.
          try {
            refundResult = await initiatePaymentRefund(successPayment.id);

            if (
              refundResult.status !== "REFUND_PENDING" &&
              refundResult.status !== "REFUNDED"
            ) {
              console.error(
                "Refund initiation after cancellation requires reconciliation:",
                successPayment.id,
                refundResult
              );
            }
          } catch (refundError) {
            console.error(
              "Refund initiation error after booking cancellation:",
              id,
              refundError
            );
          }
        }
        // If marked.count === 0 the payment was already transitioned by
        // another concurrent request (e.g. webhook). No action needed.
      }
    }

    // 8. Send cancellation notification email to the guest.
    //    Email failure must NEVER roll back the cancellation or crash the response.
    let refundStatus: "REFUNDED" | "REFUND_PENDING" | "REQUIRES_REFUND" | "NONE" = "NONE";
    if (refundResult?.status === "REFUNDED") {
      refundStatus = "REFUNDED";
    } else if (refundResult?.status === "REFUND_PENDING") {
      refundStatus = "REFUND_PENDING";
    } else if (
      refundResult?.status === "REQUIRES_REFUND" ||
      refundResult?.status === "RECONCILIATION_REQUIRED"
    ) {
      // The refund was reserved or attempted but needs reconciliation.
      // Inform the guest that a refund is being investigated rather than
      // claiming no refund applies.
      refundStatus = "REFUND_PENDING";
    }

    try {
      await sendBookingCancellationEmail({
        bookingId: id,
        reason,
        refundStatus,
      });
    } catch (notificationError) {
      console.error(
        "Booking cancellation notification error:",
        id,
        notificationError
      );
    }

    // Build a human-readable refund note for the response.
    const refundNote = (() => {
      if (!refundResult) return undefined;
      if (refundResult.status === "REFUNDED") return "Refund processed.";
      if (refundResult.status === "REFUND_PENDING")
        return "Refund initiated and is being processed by Razorpay.";
      return "Refund requires reconciliation. Use the reconcile endpoint.";
    })();

    return NextResponse.json(
      {
        success: true,
        message: "Booking cancelled successfully",
        booking: updatedBooking,
        ...(refundNote ? { refund: refundNote } : {}),
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Cancel booking error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}
