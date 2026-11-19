
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

export async function GET(
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

    // 2. Get booking ID from URL
    const { id } = await params;

    // 3. Cancel this booking if its payment hold has expired
    await prisma.booking.updateMany({
      where: {
        id,
        hostId: user.id,
        status: "PENDING_PAYMENT",
        expiresAt: {
          lte: new Date(),
        },
      },
      data: {
        status: "CANCELLED",
      },
    });

    // 4. Find the booking belonging to this host
    const booking = await prisma.booking.findFirst({
      where: {
        id,
        hostId: user.id,
      },
      include: {
        meetingType: {
          select: {
            title: true,
            description: true,
            duration: true,
            location: true,
            priceInPaise: true,
            currency: true,
          },
        },
      },
    });

    // 5. Handle missing booking
    if (!booking) {
      return NextResponse.json(
        {
          success: false,
          message: "Booking not found",
        },
        { status: 404 }
      );
    }

    // 6. Return booking details
    return NextResponse.json(
      {
        success: true,
        booking,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Get booking details error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}

const updateBookingSchema = z.object({
  status: z.enum(["COMPLETED", "NO_SHOW"]),
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

    // 2. Get booking ID
    const { id } = await params;

    // 3. Validate request body
    const body = await request.json();
    const validation = updateBookingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { status } = validation.data;

    // 4. Find the booking belonging to this host
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

    // 5. Only confirmed bookings can be completed or marked as no-show
    if (booking.status !== "CONFIRMED") {
      return NextResponse.json(
        {
          success: false,
          message: "Only confirmed bookings can be updated",
        },
        { status: 409 }
      );
    }

    // 6. Update booking status
    const updatedBooking = await prisma.booking.update({
      where: {
        id,
      },
      data: {
        status,
      },
    });

    // 7. Return updated booking
    return NextResponse.json(
      {
        success: true,
        message: "Booking status updated successfully",
        booking: updatedBooking,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Update booking error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}
