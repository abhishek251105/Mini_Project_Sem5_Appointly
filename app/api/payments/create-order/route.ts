
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import razorpay from "@/lib/razorpay";

// 1. Validate request body
const createOrderSchema = z.object({
  bookingId: z.string().min(1),
  guestEmail: z.string().email(),
});

export async function POST(request: Request) {
  try {
    // 2. Validate incoming data
    const body = await request.json();
    const validation = createOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { bookingId, guestEmail } = validation.data;

    // 3. Find the booking
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        guestEmail: {
          equals: guestEmail,
          mode: "insensitive",
        },
      },
      include: {
        meetingType: true,
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

    // 4. Check booking status
    if (booking.status !== "PENDING_PAYMENT") {
      return NextResponse.json(
        {
          success: false,
          message: "This booking is not awaiting payment",
        },
        { status: 409 }
      );
    }

    // 5. Check payment expiry
    if (!booking.expiresAt || booking.expiresAt <= new Date()) {
      await prisma.booking.updateMany({
        where: {
          id: booking.id,
          status: "PENDING_PAYMENT",
          expiresAt: {
            lte: new Date(),
          },
        },
        data: {
          status: "CANCELLED",
        },
      });

      return NextResponse.json(
        {
          success: false,
          message: "Payment time has expired. Please create a new booking.",
        },
        { status: 410 }
      );
    }

    // 6. Get amount from the database — never trust client-supplied amounts.
    const amount = booking.meetingType.priceInPaise;
    const currency = booking.meetingType.currency;

    if (amount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "This booking does not require payment",
        },
        { status: 400 }
      );
    }

    // 7–9. Run the order-claim logic inside a Serializable transaction to prevent
    //       concurrent requests from each creating a separate Razorpay order for the
    //       same booking.  The pattern is:
    //         a) Re-read all payment records for this booking under lock.
    //         b) Return the first valid PENDING order if one already exists.
    //         c) Otherwise insert a placeholder row (status PENDING, no orderId) to
    //            atomically claim the creation slot before we ever call Razorpay.
    //       After the transaction we call Razorpay and patch the saved order ID.
    //       If the Razorpay call fails the placeholder row stays with no orderId and
    //       is excluded from future "reuse" checks (razorpayOrderId: { not: null }),
    //       so a subsequent request will claim a new placeholder and retry cleanly.

    for (let attempt = 1; attempt <= 3; attempt++) {
      let placeholderPaymentId: string | null = null;

      try {
        const txResult = await prisma.$transaction(
          async (tx) => {
            // a) Return an already-confirmed payment.
            const success = await tx.payment.findFirst({
              where: { bookingId: booking.id, status: "SUCCESS" },
            });
            if (success) return { type: "ALREADY_PAID" as const };

            // b) Return an existing pending Razorpay order.
            const existing = await tx.payment.findFirst({
              where: {
                bookingId: booking.id,
                status: "PENDING",
                razorpayOrderId: { not: null },
              },
              orderBy: { createdAt: "desc" },
            });
            if (existing?.razorpayOrderId) {
              return { type: "EXISTING" as const, payment: existing };
            }

            // c) Insert a placeholder to atomically claim creation.
            const placeholder = await tx.payment.create({
              data: {
                bookingId: booking.id,
                amount,
                currency,
                status: "PENDING",
                // razorpayOrderId is intentionally left null here;
                // it is patched below after the Razorpay API call.
              },
            });
            return { type: "PLACEHOLDER" as const, placeholderId: placeholder.id };
          },
          { isolationLevel: "Serializable" }
        );

        if (txResult.type === "ALREADY_PAID") {
          return NextResponse.json(
            { success: false, message: "Payment has already been completed" },
            { status: 409 }
          );
        }

        if (txResult.type === "EXISTING") {
          const p = txResult.payment;
          return NextResponse.json(
            {
              success: true,
              message: "Existing payment order retrieved",
              payment: {
                id: p.id,
                amount: p.amount,
                currency: p.currency,
                razorpayOrderId: p.razorpayOrderId,
              },
              razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            },
            { status: 200 }
          );
        }

        // txResult.type === "PLACEHOLDER"
        placeholderPaymentId = txResult.placeholderId;

        // 10. Create the Razorpay order outside the transaction.
        //     If this call fails the placeholder remains without an orderId and
        //     the next request will claim a fresh placeholder.
        const razorpayOrder = await razorpay.orders.create({
          amount,
          currency,
          receipt: booking.id,
          notes: {
            bookingId: booking.id,
            guestEmail: booking.guestEmail,
          },
        });

        // 11. Patch the placeholder with the real Razorpay order ID.
        const payment = await prisma.payment.update({
          where: { id: placeholderPaymentId },
          data: { razorpayOrderId: razorpayOrder.id },
        });

        return NextResponse.json(
          {
            success: true,
            message: "Payment order created successfully",
            payment: {
              id: payment.id,
              amount: payment.amount,
              currency: payment.currency,
              razorpayOrderId: payment.razorpayOrderId,
            },
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
          },
          { status: 201 }
        );
      } catch (error) {
        const prismaError = error as { code?: string };

        // Retry Serializable conflicts and deadlocks.
        if (prismaError.code === "P2034" && attempt < 3) {
          continue;
        }

        // If the Razorpay call succeeded but patching the placeholder failed,
        // the placeholder row will be found with razorpayOrderId still null —
        // safe for the next request to reattempt.
        console.error("Create Razorpay order error:", error);
        return NextResponse.json(
          { success: false, message: "Unable to create payment order" },
          { status: 500 }
        );
      }
    }

    // Exhausted retries on serialization conflicts.
    return NextResponse.json(
      { success: false, message: "Unable to create payment order. Please try again." },
      { status: 503 }
    );

  } catch (error) {
    console.error("Create Razorpay order error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create payment order" },
      { status: 500 }
    );
  }
}
