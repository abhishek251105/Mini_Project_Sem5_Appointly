
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

import { finalizeCapturedPayment } from "@/lib/payment-finalization";
import { sendBookingConfirmationEmails } from "@/lib/booking-notifications";
import { reconcilePaymentRefund } from "@/lib/refund-reconciliation";
import prisma from "@/lib/prisma";
import { initiatePaymentRefund } from "@/lib/payment-refund";

type PaymentEntity = {
  id?: unknown;
  order_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
};

type RefundEntity = {
  id?: unknown;
  payment_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  status?: unknown;
};

type RazorpayEvent = {
  event?: unknown;
  payload?: {
    payment?: { entity?: PaymentEntity };
    refund?: { entity?: RefundEntity };
  };
};

export async function POST(request: Request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret) {
      console.error("Razorpay webhook secret is missing");

      return NextResponse.json(
        { success: false, message: "Webhook not configured" },
        { status: 500 }
      );
    }

    // 1. Verify the webhook signature using the raw body.
    const rawBody = await request.text();
    const signature = request.headers.get(
      "x-razorpay-signature"
    );

    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest();

    const receivedSignature = Buffer.from(
      signature,
      "hex"
    );

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // 2. Parse the authenticated event.
    let parsed: unknown;

    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid webhook event" },
        { status: 400 }
      );
    }

    const data = parsed as RazorpayEvent;

    // 3. Handle refund events.
    if (
      data.event === "refund.created" ||
      data.event === "refund.processed" ||
      data.event === "refund.failed"
    ) {
      const refund = data.payload?.refund?.entity;

      if (
        typeof refund?.id !== "string" ||
        !refund.id ||
        typeof refund.payment_id !== "string" ||
        !refund.payment_id ||
        typeof refund.amount !== "number" ||
        !Number.isSafeInteger(refund.amount) ||
        refund.amount <= 0 ||
        typeof refund.currency !== "string" ||
        typeof refund.status !== "string"
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid refund payload" },
          { status: 400 }
        );
      }

      // Find the corresponding Appointly payment.
      const payment = await prisma.payment.findUnique({
        where: {
          razorpayPaymentId: refund.payment_id,
        },
      });

      if (!payment) {
        console.warn(
          "Refund webhook received for unknown payment:",
          refund.payment_id
        );

        return NextResponse.json({
          success: true,
          message: "Refund payment not tracked by Appointly",
        });
      }

      // Verify the amount and currency before reconciliation.
      if (
        payment.amount !== refund.amount ||
        payment.currency !== refund.currency
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Refund details mismatch",
          },
          { status: 409 }
        );
      }

      if (payment.status === "REFUNDED") {
        if (payment.razorpayRefundId !== refund.id) {
          return NextResponse.json(
            {
              success: false,
              message: "Refund ID mismatch",
            },
            { status: 409 }
          );
        }

        return NextResponse.json({
          success: true,
          message: "Refund already processed",
          paymentStatus: "REFUNDED",
        });
      }

      if (payment.status !== "REFUND_PENDING") {
        return NextResponse.json({
          success: true,
          message: "Refund event requires manual review",
          paymentStatus: payment.status,
        });
      }

      if (
        payment.razorpayRefundId &&
        payment.razorpayRefundId !== refund.id
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Unexpected refund ID",
          },
          { status: 409 }
        );
      }

      // Fetch authoritative refund state from Razorpay.
      const result = await reconcilePaymentRefund(
        payment.id
      );

      if (
        result.status === "REFUNDED" ||
        result.status === "ALREADY_REFUNDED"
      ) {
        return NextResponse.json({
          success: true,
          message: "Refund confirmed",
          paymentStatus: "REFUNDED",
          refundId: result.refundId,
        });
      }

      if (result.status === "REFUND_PENDING") {
        return NextResponse.json({
          success: true,
          message: "Refund reconciliation completed",
          paymentStatus: "REFUND_PENDING",
          refundId: result.refundId,
        });
      }

      // A definitively failed refund — log it prominently for the host to action.
      if (result.status === "REFUND_FAILED") {
        console.error(
          "Razorpay refund FAILED — manual intervention required:",
          payment.id,
          result
        );
        return NextResponse.json({
          success: true,
          message: "Refund was rejected by Razorpay and requires manual intervention",
          paymentStatus: "REFUND_FAILED",
          refundId: result.refundId,
        });
      }

      console.warn(
        "Refund requires manual reconciliation:",
        payment.id,
        result
      );

      return NextResponse.json({
        success: true,
        message: "Refund requires manual review",
        reconciliation: result.status,
      });
    }

    // 4. Ignore unrelated events.
    if (data.event !== "payment.captured") {
      return NextResponse.json({
        success: true,
        message: "Event ignored",
      });
    }

    // 5. Validate the captured payment.
    const captured = data.payload?.payment?.entity;

    if (
      typeof captured?.id !== "string" ||
      !captured.id ||
      typeof captured.order_id !== "string" ||
      !captured.order_id ||
      typeof captured.amount !== "number" ||
      !Number.isSafeInteger(captured.amount) ||
      captured.amount <= 0 ||
      typeof captured.currency !== "string" ||
      captured.status !== "captured"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid captured payment payload",
        },
        { status: 400 }
      );
    }

    // 6. Use the existing shared payment finalization service.
    const result = await finalizeCapturedPayment({
      razorpayOrderId: captured.order_id,
      razorpayPaymentId: captured.id,
      amount: captured.amount,
      currency: captured.currency,
    });

    if (result.status === "NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Payment order not found",
        },
        { status: 503 }
      );
    }

    if (result.status === "MISMATCH") {
      return NextResponse.json(
        {
          success: false,
          message: "Payment details mismatch",
        },
        { status: 409 }
      );
    }

    if (result.status === "CONFLICT") {
      return NextResponse.json(
        {
          success: false,
          message: "Payment processing conflict",
        },
        { status: 503 }
      );
    }

    // 7. Handle payments that require refunds.
if (
  result.status === "REQUIRES_REFUND" ||
  result.status === "REFUND_PENDING" ||
  result.status === "REFUNDED"
) {
  let refundStatus = result.status;

  if (result.status === "REQUIRES_REFUND") {
    const payment = await prisma.payment.findUnique({
      where: {
        razorpayOrderId: captured.order_id,
      },
    });

    if (payment) {
      const refundResult = await initiatePaymentRefund(
        payment.id
      );

      if (
        refundResult.status === "REFUND_PENDING" ||
        refundResult.status === "REFUNDED"
      ) {
        refundStatus = refundResult.status;
      } else {
        console.error(
          "Refund initiation needs attention:",
          payment.id,
          refundResult
        );
      }
    } else {
      console.error(
        "Refund payment record not found:",
        captured.order_id
      );
    }
  }

  return NextResponse.json({
    success: true,
    message:
      refundStatus === "REFUNDED"
        ? "Payment refunded"
        : refundStatus === "REFUND_PENDING"
          ? "Refund is pending or requires reconciliation"
          : "Payment captured but refund initiation requires attention",
    paymentStatus: refundStatus,
    bookingId: result.bookingId,
  });
}
    // 8. Notify host and guest for confirmed bookings.
    if (result.status === "SUCCESS") {
      try {
        const notificationResult =
          await sendBookingConfirmationEmails(
            result.bookingId
          );

        if (!notificationResult.success) {
          console.error(
            "Some booking notifications were not sent:",
            notificationResult
          );
        }
      } catch (emailError) {
        console.error(
          "Webhook booking notification error:",
          emailError
        );
      }

      return NextResponse.json({
        success: true,
        message: result.alreadyProcessed
          ? "Payment already processed"
          : "Webhook processed and booking confirmed",
        paymentStatus: "SUCCESS",
        bookingId: result.bookingId,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unexpected payment status",
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Razorpay webhook error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}
