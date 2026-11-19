
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Validation schema
const availabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
}).refine(
  (data) => data.startTime < data.endTime,
  {
    message: "End time must be after start time",
    path: ["endTime"],
  }
);

// POST - Create weekly availability
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

    // 2. Read request body
    const body = await request.json();

    // 3. Validate request body
    const result = availabilitySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    // 4. Create availability rule
    const availability = await prisma.availabilityRule.create({
      data: {
        ...result.data,
        hostId: user.id,
      },
    });

    // 5. Return response
    return NextResponse.json(
      {
        success: true,
        message: "Availability created successfully",
        availability,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Create availability error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}

// GET - Fetch weekly availability
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

    // 2. Fetch availability rules
    const availability = await prisma.availabilityRule.findMany({
      where: {
        hostId: user.id,
      },
      orderBy: {
        dayOfWeek: "asc",
      },
    });

    // 3. Return response
    return NextResponse.json(
      {
        success: true,
        count: availability.length,
        availability,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Get availability error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
