
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { reconcilePaymentRefund } from "@/lib/refund-reconciliation";

const schema = z.object({
  paymentId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the host
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid payment ID" },
        { status: 400 }
      );
    }

    // 3. Check payment ownership
    const payment = await prisma.payment.findFirst({
      where: {
        id: parsed.data.paymentId,
        booking: {
          hostId: user.id,
        },
      },
      select: { id: true },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, message: "Payment not found" },
        { status: 404 }
      );
    }

    // 4. Reconcile with Razorpay
    const result = await reconcilePaymentRefund(payment.id);

    // 5. Return the reconciliation result
    if (result.status === "MANUAL_REVIEW") {
      return NextResponse.json(
        {
          success: false,
          message: "Refund requires manual review",
          result,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Refund reconciliation completed",
      result,
    });
  } catch (error) {
    console.error("Refund reconciliation API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}
