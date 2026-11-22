
import prisma from "@/lib/prisma";
import razorpay from "@/lib/razorpay";
import { initiatePaymentRefund } from "@/lib/payment-refund";

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
  | { status: "REFUND_FAILED"; refundId: string; reason: string }
  | { status: "REFUND_PENDING"; refundId: string }
  | { status: "REFUNDED"; refundId: string }
  | { status: "MANUAL_REVIEW"; reason: string };

export type BatchReconciliationSummary = {
  scanned: number;
  reconciled: number;
  refundsInitiated: number;
  stillPending: number;
  failed: number;
  manualReview: number;
  errors: number;
  items: {
    paymentId: string;
    action: "RECONCILED" | "INITIATED" | "STILL_PENDING" | "FAILED" | "MANUAL_REVIEW" | "ERROR";
    status: string;
    refundId?: string;
    reason?: string;
  }[];
};

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

  // A definitively failed refund — still return for informational purposes.
  if (payment.status === "REFUND_FAILED") {
    return {
      status: "REFUND_FAILED",
      refundId: payment.razorpayRefundId ?? "",
      reason: payment.refundReason ?? "Refund was rejected by the payment gateway",
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
      // We already have a Razorpay refund ID — fetch that specific refund.
      refund = (await razorpay.payments.fetchRefund(
        payment.razorpayPaymentId,
        payment.razorpayRefundId
      )) as RefundRecord;
    } else {
      // No razorpayRefundId stored yet.  Fetch all refunds for this payment
      // and find the one created by this Appointly operation using the
      // idempotency key stored in the refund notes.
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

      if (matches.length === 0) {
        // No refund was ever received by Razorpay (e.g. network timeout before
        // the request reached them).  It is safe to reset the payment back to
        // REQUIRES_REFUND so that initiatePaymentRefund can reattempt.
        const reset = await prisma.payment.updateMany({
          where: {
            id: payment.id,
            status: "REFUND_PENDING",
            refundIdempotencyKey: payment.refundIdempotencyKey,
            razorpayRefundId: null,
          },
          data: {
            status: "REQUIRES_REFUND",
            refundIdempotencyKey: null,
            refundRequestedAt: null,
          },
        });

        if (reset.count === 1) {
          return {
            status: "MANUAL_REVIEW",
            reason:
              "No refund found at Razorpay; payment reset to REQUIRES_REFUND for retry",
          };
        }

        // Another concurrent reconciliation changed the row — safe to treat as
        // manual review to avoid a race condition.
        return {
          status: "MANUAL_REVIEW",
          reason:
            "No refund found at Razorpay; payment changed during reconciliation",
        };
      }

      if (matches.length > 1) {
        return {
          status: "MANUAL_REVIEW",
          reason: "Multiple matching refunds found",
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

    // Map Razorpay refund status to Appointly PaymentStatus.
    const isCompleted = refund.status === "processed";
    const isFailed = refund.status === "failed";

    const newStatus = isCompleted
      ? "REFUNDED"
      : isFailed
        ? "REFUND_FAILED"
        : "REFUND_PENDING";

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
        status: newStatus,
        refundedAt: isCompleted ? new Date() : null,
        // Store failure reason so the host dashboard can surface it.
        ...(isFailed
          ? { refundReason: "Refund rejected by Razorpay" }
          : {}),
      },
    });

    if (updated.count !== 1) {
      return {
        status: "MANUAL_REVIEW",
        reason: "Payment changed during reconciliation",
      };
    }

    if (isFailed) {
      return {
        status: "REFUND_FAILED",
        refundId: refund.id,
        reason: "Refund was rejected by Razorpay",
      };
    }

    return {
      status: isCompleted ? "REFUNDED" : "REFUND_PENDING",
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

/**
 * Automatically processes a batch of pending or stuck refunds.
 * - Queries payments in REFUND_PENDING and checks authoritative Razorpay status.
 * - Queries payments in REQUIRES_REFUND and triggers initiatePaymentRefund.
 * - Safe for concurrent scheduler runs; database rows are claimed atomically.
 * - Does not leak sensitive credentials or payment secrets.
 */
export async function processBatchRefundReconciliation(
  batchSize = 25
): Promise<BatchReconciliationSummary> {
  const summary: BatchReconciliationSummary = {
    scanned: 0,
    reconciled: 0,
    refundsInitiated: 0,
    stillPending: 0,
    failed: 0,
    manualReview: 0,
    errors: 0,
    items: [],
  };

  try {
    // 1. Process stuck REFUND_PENDING payments first
    const pendingPayments = await prisma.payment.findMany({
      where: {
        status: "REFUND_PENDING",
        razorpayPaymentId: { not: null },
      },
      take: batchSize,
      orderBy: { updatedAt: "asc" },
      select: { id: true },
    });

    for (const { id } of pendingPayments) {
      summary.scanned++;
      try {
        const result = await reconcilePaymentRefund(id);
        if (result.status === "REFUNDED" || result.status === "ALREADY_REFUNDED") {
          summary.reconciled++;
          summary.items.push({
            paymentId: id,
            action: "RECONCILED",
            status: "REFUNDED",
            refundId: result.refundId ?? undefined,
          });
        } else if (result.status === "REFUND_FAILED") {
          summary.failed++;
          summary.items.push({
            paymentId: id,
            action: "FAILED",
            status: "REFUND_FAILED",
            refundId: result.refundId,
            reason: result.reason,
          });
        } else if (result.status === "REFUND_PENDING") {
          summary.stillPending++;
          summary.items.push({
            paymentId: id,
            action: "STILL_PENDING",
            status: "REFUND_PENDING",
            refundId: result.refundId,
          });
        } else if (result.status === "MANUAL_REVIEW") {
          summary.manualReview++;
          summary.items.push({
            paymentId: id,
            action: "MANUAL_REVIEW",
            status: "MANUAL_REVIEW",
            reason: result.reason,
          });
        }
      } catch (itemError) {
        summary.errors++;
        console.error(`Reconciliation failed for payment ${id}:`, itemError);
        summary.items.push({
          paymentId: id,
          action: "ERROR",
          status: "ERROR",
          reason: "Unexpected exception during reconciliation",
        });
      }
    }

    // 2. If quota remains in batch, process REQUIRES_REFUND payments
    const remainingSlots = batchSize - summary.scanned;
    if (remainingSlots > 0) {
      const requiresRefundPayments = await prisma.payment.findMany({
        where: {
          status: "REQUIRES_REFUND",
          razorpayPaymentId: { not: null },
          booking: {
            status: { in: ["CANCELLED", "PENDING_PAYMENT"] },
          },
        },
        take: remainingSlots,
        orderBy: { updatedAt: "asc" },
        select: { id: true },
      });

      for (const { id } of requiresRefundPayments) {
        summary.scanned++;
        try {
          const result = await initiatePaymentRefund(id);
          if (result.status === "REFUNDED") {
            summary.reconciled++;
            summary.items.push({
              paymentId: id,
              action: "RECONCILED",
              status: "REFUNDED",
              refundId: result.refundId,
            });
          } else if (result.status === "REFUND_PENDING") {
            summary.refundsInitiated++;
            summary.items.push({
              paymentId: id,
              action: "INITIATED",
              status: "REFUND_PENDING",
              refundId: result.refundId,
            });
          } else if (result.status === "RECONCILIATION_REQUIRED") {
            summary.manualReview++;
            summary.items.push({
              paymentId: id,
              action: "MANUAL_REVIEW",
              status: "RECONCILIATION_REQUIRED",
              reason: "Refund reservation locked or gateway response pending",
            });
          }
        } catch (itemError) {
          summary.errors++;
          console.error(`Refund initiation failed for payment ${id}:`, itemError);
          summary.items.push({
            paymentId: id,
            action: "ERROR",
            status: "ERROR",
            reason: "Unexpected exception during refund initiation",
          });
        }
      }
    }
  } catch (batchError) {
    console.error("Batch refund reconciliation error:", batchError);
  }

  return summary;
}
