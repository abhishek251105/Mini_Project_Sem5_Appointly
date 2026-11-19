
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

    return NextResponse.json(
      {
        success: true,
        message: "Booking cancelled successfully",
        booking: updatedBooking,
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
