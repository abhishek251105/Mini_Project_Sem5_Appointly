
import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const overrideSchema = z.object({
  date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  isBlocked: z.boolean().default(true),
  reason: z.string().max(200).nullable().optional(),
}).superRefine((data, ctx) => {
  const hasStart = !!data.startTime;
  const hasEnd = !!data.endTime;

  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: "custom",
      message: "Both startTime and endTime must be provided together",
    });
  }

  if (hasStart && hasEnd && data.startTime! >= data.endTime!) {
    ctx.addIssue({
      code: "custom",
      message: "End time must be after start time",
      path: ["endTime"],
    });
  }

  if (!data.isBlocked && (!hasStart || !hasEnd)) {
    ctx.addIssue({
      code: "custom",
      message: "Special availability requires both startTime and endTime",
    });
  }
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const result = overrideSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.error.flatten() },
        { status: 400 }
      );
    }

    const { date, ...data } = result.data;

    const override = await prisma.availabilityOverride.create({
      data: {
        ...data,
        date: new Date(`${date}T00:00:00.000Z`),
        hostId: user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Availability override created successfully",
        override,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create availability override error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const overrides = await prisma.availabilityOverride.findMany({
      where: {
        hostId: user.id,
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(
      {
        success: true,
        count: overrides.length,
        overrides,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get availability overrides error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
