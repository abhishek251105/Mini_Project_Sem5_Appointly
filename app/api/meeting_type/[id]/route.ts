
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const updateMeetingTypeSchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  description: z.string().nullable().optional(),
  duration: z.number().int().positive().optional(),
  location: z.string().nullable().optional(),
  priceInPaise: z
    .number()
    .int()
    .refine(
      (val) => val === 0 || val >= 100,
      "Price must be either 0 (free) or at least 100 paise (₹1.00)"
    )
    .optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required",
});

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

    // 2. Get meeting type ID from URL
    const { id } = await params;

    // 3. Validate request body
    const body = await request.json();
    const result = updateMeetingTypeSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    // 4. Check ownership
    const existingMeetingType = await prisma.meetingType.findFirst({
      where: {
        id,
        hostId: user.id,
      },
    });

    if (!existingMeetingType) {
      return NextResponse.json(
        { success: false, message: "Meeting type not found" },
        { status: 404 }
      );
    }

    // 5. Update meeting type
    const updatedMeetingType = await prisma.meetingType.update({
      where: { id },
      data: result.data,
    });

    // 6. Return response
    return NextResponse.json(
      {
        success: true,
        message: "Meeting type updated successfully",
        meetingType: updatedMeetingType,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update meeting type error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
// not exactly deleting but making not active for further booking so current booking remain and no more booking
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

    // 2. Get meeting type ID from URL
    const { id } = await params;

    // 3. Check ownership
    const existingMeetingType = await prisma.meetingType.findFirst({
      where: {
        id,
        hostId: user.id,
      },
    });

    if (!existingMeetingType) {
      return NextResponse.json(
        { success: false, message: "Meeting type not found" },
        { status: 404 }
      );
    }

    // 4. Deactivate meeting type
    const meetingType = await prisma.meetingType.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    // 5. Return response
    return NextResponse.json(
      {
        success: true,
        message: "Meeting type deactivated successfully",
        meetingType,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Deactivate meeting type error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
