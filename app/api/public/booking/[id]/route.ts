import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: {
        id: true,
        guestName: true,
        guestEmail: true,
        startTime: true,
        endTime: true,
        status: true,
        notes: true,
        meetingType: {
          select: {
            title: true,
            duration: true,
            location: true,
            priceInPaise: true,
            currency: true,
          },
        },
        host: {
          select: {
            name: true,
            slug: true,
            timeZone: true,
          },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, message: "Booking not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, booking },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get public booking error:", error);
    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
