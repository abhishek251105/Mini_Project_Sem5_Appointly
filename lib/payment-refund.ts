
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";

type RefundResult =
  | { status: "REFUND_PENDING"; paymentId: string; refundId?: string }
  | { status: "REFUNDED"; paymentId: string; refundId?: string }
  | { status: "NOT_FOUND" }
  | { status: "NOT_ELIGIBLE" }
  | { status: "CONFIG_ERROR" }
  | { status: "RECONCILIATION_REQUIRED"; paymentId: string };

type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: string;
};

export async function initiatePaymentRefund(
  paymentId: string
): Promise<RefundResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return { status: "NOT_FOUND" };
  }

  if (payment.status === "REFUNDED") {
    return {
      status: "REFUNDED",
      paymentId,
      refundId: payment.razorpayRefundId ?? undefined,
    };
  }

  if (payment.status === "REFUND_PENDING") {
    return {
      status: "RECONCILIATION_REQUIRED",
      paymentId,
    };
  }

  if (
    payment.status !== "REQUIRES_REFUND" ||
    !payment.razorpayPaymentId
  ) {
    return { status: "NOT_ELIGIBLE" };
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return { status: "CONFIG_ERROR" };
  }

  const operationKey = randomUUID();

  // Atomically reserve this payment for refund processing.
  const claimed = await prisma.payment.updateMany({
    where: {
      id: paymentId,
      status: "REQUIRES_REFUND",
      refundIdempotencyKey: null,
      razorpayRefundId: null,
    },
    data: {
      status: "REFUND_PENDING",
      refundIdempotencyKey: operationKey,
      refundRequestedAt: new Date(),
    },
  });

  if (claimed.count !== 1) {
    return {
      status: "RECONCILIATION_REQUIRED",
      paymentId,
    };
  }

  const url =
    `https://api.razorpay.com/v1/payments/` +
    `${encodeURIComponent(payment.razorpayPaymentId)}/refund`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: payment.amount,
        speed: "normal",
        notes: {
          appointlyPaymentId: payment.id,
          refundOperationKey: operationKey,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(
        "Razorpay refund request failed:",
        response.status
      );

      // The request may have reached Razorpay.
      // Do not release the reservation or retry automatically.
      return {
        status: "RECONCILIATION_REQUIRED",
        paymentId,
      };
    }

    const refund: RazorpayRefund = await response.json();

    if (
      typeof refund.id !== "string" ||
      refund.payment_id !== payment.razorpayPaymentId ||
      refund.amount !== payment.amount ||
      refund.currency !== payment.currency
    ) {
      return {
        status: "RECONCILIATION_REQUIRED",
        paymentId,
      };
    }

    const completed = refund.status === "processed";

    await prisma.payment.update({
      where: { id: paymentId },
      data: {
        razorpayRefundId: refund.id,
        status: completed ? "REFUNDED" : "REFUND_PENDING",
        refundedAt: completed ? new Date() : null,
      },
    });

    return {
      status: completed ? "REFUNDED" : "REFUND_PENDING",
      paymentId,
      refundId: refund.id,
    };
  } catch (error) {
    console.error("Refund initiation uncertain:", error);

    return {
      status: "RECONCILIATION_REQUIRED",
      paymentId,
    };
  }
}
