
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Validation schema
const updateAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required",
});

// PATCH - Update availability
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate host
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get availability ID from URL
    const { id } = await params;

    // 3. Read and validate request body
    const body = await request.json();
    const result = updateAvailabilitySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    // 4. Check ownership
    const existingAvailability = await prisma.availabilityRule.findFirst({
      where: {
        id,
        hostId: user.id,
      },
    });

    if (!existingAvailability) {
      return NextResponse.json(
        { success: false, message: "Availability rule not found" },
        { status: 404 }
      );
    }

    // 5. Validate updated timings together
    const startTime = result.data.startTime ?? existingAvailability.startTime;
    const endTime = result.data.endTime ?? existingAvailability.endTime;

    if (startTime >= endTime) {
      return NextResponse.json(
        {
          success: false,
          message: "End time must be after start time",
        },
        { status: 400 }
      );
    }

    // 6. Update availability
    const updatedAvailability = await prisma.availabilityRule.update({
      where: { id },
      data: result.data,
    });

    // 7. Return response
    return NextResponse.json(
      {
        success: true,
        message: "Availability updated successfully",
        availability: updatedAvailability,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Update availability error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate host
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Get availability ID from URL
    const { id } = await params;

    // 3. Check ownership
    const existingAvailability = await prisma.availabilityRule.findFirst({
      where: {
        id,
        hostId: user.id,
      },
    });

    if (!existingAvailability) {
      return NextResponse.json(
        { success: false, message: "Availability rule not found" },
        { status: 404 }
      );
    }

    // 4. Delete availability rule
    await prisma.availabilityRule.delete({
      where: { id },
    });

    // 5. Return response
    return NextResponse.json(
      {
        success: true,
        message: "Availability deleted successfully",
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Delete availability error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
