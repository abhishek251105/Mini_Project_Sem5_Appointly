
import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";

import prisma from "@/lib/prisma";
import razorpay from "@/lib/razorpay";
import { finalizeCapturedPayment } from "@/lib/payment-finalization";
import { sendBookingConfirmationEmails } from "@/lib/booking-notifications";
import { initiatePaymentRefund } from "@/lib/payment-refund";

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(request: Request) {
  try {
    // 1. Validate request body
    const body = await request.json().catch(() => null);
    const validation = verifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment details",
        },
        { status: 400 }
      );
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = validation.data;

    // 2. Find the payment order
    const payment = await prisma.payment.findUnique({
      where: {
        razorpayOrderId: razorpay_order_id,
      },
    });

    if (!payment) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment order not found",
        },
        { status: 404 }
      );
    }

    // 3. Verify Razorpay Checkout signature
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      throw new Error("Razorpay secret is not configured");
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest();

    const receivedSignature = Buffer.from(
      razorpay_signature,
      "hex"
    );

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payment signature",
        },
        { status: 400 }
      );
    }

    // 4. Fetch the payment directly from Razorpay
    const razorpayPayment = await razorpay.payments.fetch(
      razorpay_payment_id
    );

    if (
      razorpayPayment.order_id !== razorpay_order_id ||
      razorpayPayment.status !== "captured" ||
      Number(razorpayPayment.amount) !== payment.amount ||
      razorpayPayment.currency !== payment.currency
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment details could not be verified",
        },
        { status: 400 }
      );
    }

    // 5. Finalize payment using shared transaction logic
    const result = await finalizeCapturedPayment({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
      amount: Number(razorpayPayment.amount),
      currency: razorpayPayment.currency,
    });

    // 6. Handle unsuccessful finalization
    if (result.status === "NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          message: "Payment order not found",
        },
        { status: 404 }
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
          message: "Payment is being processed. Please retry.",
        },
        { status: 409 }
      );
    }

  // 7. Handle payments requiring refunds
if (
  result.status === "REQUIRES_REFUND" ||
  result.status === "REFUND_PENDING" ||
  result.status === "REFUNDED"
) {
  let refundStatus:
    | "REQUIRES_REFUND"
    | "REFUND_PENDING"
    | "REFUNDED" = result.status;

  if (result.status === "REQUIRES_REFUND") {
    try {
      const refundResult = await initiatePaymentRefund(payment.id);

      if (
        refundResult.status === "REFUND_PENDING" ||
        refundResult.status === "REFUNDED"
      ) {
        refundStatus = refundResult.status;
      } else {
        console.error(
          "Payment verification refund requires attention:",
          payment.id,
          refundResult
        );

        // Refresh the state in case another request
        // initiated the refund concurrently.
        const updatedPayment = await prisma.payment.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });

        if (
          updatedPayment?.status === "REFUND_PENDING" ||
          updatedPayment?.status === "REFUNDED"
        ) {
          refundStatus = updatedPayment.status;
        }
      }
    } catch (refundError) {
      console.error(
        "Refund initiation failed during payment verification:",
        payment.id,
        refundError
      );
    }
  }

  return NextResponse.json(
    {
      success: false,
      message:
        refundStatus === "REFUNDED"
          ? "Payment has been refunded"
          : refundStatus === "REFUND_PENDING"
            ? "Refund processing or reconciliation is pending"
            : "Payment captured, but booking could not be confirmed. Refund requires attention.",
      paymentStatus: refundStatus,
      bookingId: result.bookingId,
    },
    { status: 409 }
  );
}

    // 8. Send confirmation emails after successful payment
    if (result.status !== "SUCCESS") {
      return NextResponse.json(
        {
          success: false,
          message: "Unexpected payment finalization status",
        },
        { status: 500 }
      );
    }

    try {
      const notificationResult =
        await sendBookingConfirmationEmails(result.bookingId);

      if (!notificationResult.success) {
        console.error(
          "Some booking confirmation emails were not sent:",
          notificationResult
        );
      }
    } catch (emailError) {
      console.error(
        "Payment confirmation email error:",
        emailError
      );
    }

    // 9. Return successful verification response
    return NextResponse.json({
      success: true,
      message: result.alreadyProcessed
        ? "Payment already verified"
        : "Payment verified and booking confirmed successfully",
      payment: {
        id: payment.id,
        status: "SUCCESS",
        amount: payment.amount,
        currency: payment.currency,
        razorpayPaymentId: razorpay_payment_id,
      },
      booking: {
        id: result.bookingId,
        status: "CONFIRMED",
      },
    });
  } catch (error) {
    console.error("Verify Razorpay payment error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to verify payment",
      },
      { status: 500 }
    );
  }
}
