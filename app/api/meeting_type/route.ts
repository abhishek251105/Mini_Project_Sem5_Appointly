
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const meetingTypeSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().optional(),
  duration: z.number().int().positive(),
  location: z.string().optional(),
  priceInPaise: z
    .number()
    .int()
    .refine(
      (val) => val === 0 || val >= 100,
      "Price must be either 0 (free) or at least 100 paise (₹1.00)"
    )
    .default(0),
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate host
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const result = meetingTypeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Create meeting type
    const meetingType = await prisma.meetingType.create({
      data: {
        ...result.data,
        hostId: user.id,
      },
    });

    // 4. Return response
    return NextResponse.json(
      {
        success: true,
        message: "Meeting type created successfully",
        meetingType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create meeting type error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
export async function GET() {
  try {
    // 1. Authenticate host
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Fetch meeting types belonging to this host
    const meetingTypes = await prisma.meetingType.findMany({
      where: {
        hostId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 3. Return meeting types
    return NextResponse.json(
      {
        success: true,
        count: meetingTypes.length,
        meetingTypes,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get meeting types error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}