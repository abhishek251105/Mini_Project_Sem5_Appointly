import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processBatchRefundReconciliation } from "@/lib/refund-reconciliation";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Without a configured CRON_SECRET, scheduled endpoints are locked for security
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const expected = `Bearer ${cronSecret}`;
  const authBuffer = Buffer.from(authHeader);
  const expectedBuffer = Buffer.from(expected);

  if (authBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(authBuffer, expectedBuffer);
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const summary = await processBatchRefundReconciliation(25);

    return NextResponse.json(
      {
        success: true,
        message: "Automated refund reconciliation completed",
        timestamp: new Date().toISOString(),
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cron refund reconciliation error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
