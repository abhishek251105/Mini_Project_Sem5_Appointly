
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
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
    // Cancel expired payment holds
await prisma.booking.updateMany({
  where: {
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
    // 2. Retrieve all bookings belonging to this host
    const bookings = await prisma.booking.findMany({
      where: {
        hostId: user.id,
      },
      include: {
        meetingType: {
          select: {
            title: true,
            duration: true,
            location: true,
            priceInPaise: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 3. Return bookings
    return NextResponse.json(
      {
        success: true,
        count: bookings.length,
        bookings,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Get bookings error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}
