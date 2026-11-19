
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const host = await prisma.user.findUnique({
      where: {
        slug,
      },
      select: {
        name: true,
        slug: true,
        timeZone: true,
        meetingTypes: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
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

    if (!host) {
      return NextResponse.json(
        {
          success: false,
          message: "Host not found",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        host,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get public host error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}
