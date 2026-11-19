
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

    // 6. Get amount from the database
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

    // 7. Check whether payment is already completed
    const successfulPayment = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: "SUCCESS",
      },
    });

    if (successfulPayment) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment has already been completed",
        },
        { status: 409 }
      );
    }

    // 8. Reuse an existing pending Razorpay order
    const existingPayment = await prisma.payment.findFirst({
      where: {
        bookingId: booking.id,
        status: "PENDING",
        razorpayOrderId: {
          not: null,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (existingPayment?.razorpayOrderId) {
      return NextResponse.json(
        {
          success: true,
          message: "Existing payment order retrieved",
          payment: {
            id: existingPayment.id,
            amount: existingPayment.amount,
            currency: existingPayment.currency,
            razorpayOrderId: existingPayment.razorpayOrderId,
          },
          razorpayKeyId: process.env.RAZORPAY_KEY_ID,
        },
        { status: 200 }
      );
    }

    // 9. Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount,
      currency,
      receipt: booking.id,
      notes: {
        bookingId: booking.id,
        guestEmail: booking.guestEmail,
      },
    });

    // 10. Save payment record in PostgreSQL
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        amount,
        currency,
        status: "PENDING",
        razorpayOrderId: razorpayOrder.id,
      },
    });

    // 11. Return order details
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
    console.error("Create Razorpay order error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create payment order",
      },
      { status: 500 }
    );
  }
}
