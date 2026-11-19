
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const updateOverrideSchema = z.object({
  date: z.iso.date().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  isBlocked: z.boolean().optional(),
  reason: z.string().max(200).nullable().optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required",
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const result = updateOverrideSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    const existingOverride = await prisma.availabilityOverride.findFirst({
      where: {
        id,
        hostId: user.id,
      },
    });

    if (!existingOverride) {
      return NextResponse.json(
        { success: false, message: "Availability override not found" },
        { status: 404 }
      );
    }

    const startTime = result.data.startTime !== undefined
      ? result.data.startTime
      : existingOverride.startTime;

    const endTime = result.data.endTime !== undefined
      ? result.data.endTime
      : existingOverride.endTime;

    const isBlocked = result.data.isBlocked ?? existingOverride.isBlocked;

    if ((startTime === null) !== (endTime === null)) {
      return NextResponse.json(
        {
          success: false,
          message: "Both startTime and endTime must be provided together",
        },
        { status: 400 }
      );
    }

    if (startTime && endTime && startTime >= endTime) {
      return NextResponse.json(
        {
          success: false,
          message: "End time must be after start time",
        },
        { status: 400 }
      );
    }

    if (!isBlocked && (!startTime || !endTime)) {
      return NextResponse.json(
        {
          success: false,
          message: "Special availability requires both startTime and endTime",
        },
        { status: 400 }
      );
    }

    const { date, ...updateData } = result.data;

    const updatedOverride = await prisma.availabilityOverride.update({
      where: { id },
      data: {
        ...updateData,
        ...(date !== undefined
          ? { date: new Date(`${date}T00:00:00.000Z`) }
          : {}),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Availability override updated successfully",
        override: updatedOverride,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update availability override error:", error);

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
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const existingOverride = await prisma.availabilityOverride.findFirst({
      where: {
        id,
        hostId: user.id,
      },
    });

    if (!existingOverride) {
      return NextResponse.json(
        { success: false, message: "Availability override not found" },
        { status: 404 }
      );
    }

    await prisma.availabilityOverride.delete({
      where: { id },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Availability override deleted successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete availability override error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
