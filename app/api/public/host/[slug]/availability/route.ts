
import { NextResponse } from "next/server";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import prisma from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // 1. Get the host slug
    const { slug } = await params;

    // 2. Read query parameters
    const { searchParams } = new URL(request.url);

    const meetingTypeId = searchParams.get("meetingTypeId");
    const date = searchParams.get("date");

    // 3. Validate query parameters
    const querySchema = z.object({
      meetingTypeId: z.string().min(1),
      date: z.iso.date(),
    });

    const result = querySchema.safeParse({
      meetingTypeId,
      date,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          errors: result.error.flatten(),
        },
        { status: 400 }
      );
    }

    // 4. Find the host
    const host = await prisma.user.findUnique({
      where: { slug },
      select: {
        id: true,
        timeZone: true,
      },
    });

    if (!host) {
      return NextResponse.json(
        { success: false, message: "Host not found" },
        { status: 404 }
      );
    }

    // 5. Find the requested meeting type
    const meetingType = await prisma.meetingType.findFirst({
      where: {
        id: result.data.meetingTypeId,
        hostId: host.id,
        isActive: true,
      },
      select: {
        id: true,
        duration: true,
      },
    });

    if (!meetingType) {
      return NextResponse.json(
        { success: false, message: "Meeting type not found" },
        { status: 404 }
      );
    }

    // 6. Calculate the selected day's boundaries
    const [year, month, day] = result.data.date.split("-").map(Number);

    const nextDate = new Date(
      Date.UTC(year, month - 1, day + 1)
    ).toISOString().slice(0, 10);

    const dayStart = fromZonedTime(
      `${result.data.date}T00:00:00`,
      host.timeZone
    );

    const dayEnd = fromZonedTime(
      `${nextDate}T00:00:00`,
      host.timeZone
    );

    // 7. Find weekly availability
    const dayOfWeek = new Date(
      `${result.data.date}T00:00:00.000Z`
    ).getUTCDay();

    const availabilityRules = await prisma.availabilityRule.findMany({
      where: {
        hostId: host.id,
        dayOfWeek,
      },
    });

    // 8. Find date-specific overrides
    const overrides = await prisma.availabilityOverride.findMany({
      where: {
        hostId: host.id,
        date: new Date(`${result.data.date}T00:00:00.000Z`),
      },
    });

    // 9. Find existing bookings that overlap this date
    const bookings = await prisma.booking.findMany({
  where: {
    hostId: host.id,
    startTime: { lt: dayEnd },
    endTime: { gt: dayStart },
    OR: [
      { status: "CONFIRMED" },
      {
        status: "PENDING_PAYMENT",
        expiresAt: { gt: new Date() },
      },
    ],
  },
  select: {
    startTime: true,
    endTime: true,
  },
});
    // Availability calculation will go here.

    // 10. Check for a full-day block
    const fullDayBlocked = overrides.some(
      (override) =>
        override.isBlocked &&
        !override.startTime &&
        !override.endTime
    );

    if (fullDayBlocked) {
      return NextResponse.json(
        {
          success: true,
          date: result.data.date,
          timeZone: host.timeZone,
          availableSlots: [],
        },
        { status: 200 }
      );
    }

    // 11. Separate special availability and blocked periods
    const specialAvailability = overrides.filter(
      (override) => !override.isBlocked
    );

    const blockedOverrides = overrides.filter(
      (override) => override.isBlocked
    );

    // 12. Choose the availability windows for this date
    const availabilityWindows =
      specialAvailability.length > 0
        ? specialAvailability.map((override) => ({
            startTime: override.startTime!,
            endTime: override.endTime!,
          }))
        : availabilityRules.map((rule) => ({
            startTime: rule.startTime,
            endTime: rule.endTime,
          }));

    // 13. Convert blocked periods into UTC timestamps
    const blockedIntervals = blockedOverrides
      .filter(
        (override) => override.startTime && override.endTime
      )
      .map((override) => ({
        start: fromZonedTime(
          `${result.data.date}T${override.startTime}:00`,
          host.timeZone
        ),
        end: fromZonedTime(
          `${result.data.date}T${override.endTime}:00`,
          host.timeZone
        ),
      }));

    // 14. Calculate appointment duration in milliseconds
    const durationMs = meetingType.duration * 60 * 1000;

    // 15. Prepare the current time and result array
    const now = new Date();

    const availableSlots: {
      startTime: string;
      endTime: string;
    }[] = [];

    const seenSlots = new Set<string>();

    // 16. Generate possible slots from each availability window
    for (const window of availabilityWindows) {
      const windowStart = fromZonedTime(
        `${result.data.date}T${window.startTime}:00`,
        host.timeZone
      );

      const windowEnd = fromZonedTime(
        `${result.data.date}T${window.endTime}:00`,
        host.timeZone
      );

      let slotStart = new Date(windowStart);

      while (slotStart.getTime() + durationMs <= windowEnd.getTime()) {
        const slotEnd = new Date(
          slotStart.getTime() + durationMs
        );

        // 17. Skip past appointment slots
        if (slotStart > now) {
          // 18. Check existing booking conflicts
          const bookingConflict = bookings.some(
            (booking) =>
              slotStart < booking.endTime &&
              slotEnd > booking.startTime
          );

          // 19. Check blocked-period conflicts
          const overrideConflict = blockedIntervals.some(
            (interval) =>
              slotStart < interval.end &&
              slotEnd > interval.start
          );

          // 20. Add only valid, unique slots
          const slotKey = slotStart.toISOString();

          if (
            !bookingConflict &&
            !overrideConflict &&
            !seenSlots.has(slotKey)
          ) {
            seenSlots.add(slotKey);

            availableSlots.push({
              startTime: slotStart.toISOString(),
              endTime: slotEnd.toISOString(),
            });
          }
        }

        // Move to the next appointment slot
        slotStart = new Date(
          slotStart.getTime() + durationMs
        );
      }
    }

    // 21. Sort slots chronologically
    availableSlots.sort(
      (a, b) =>
        new Date(a.startTime).getTime() -
        new Date(b.startTime).getTime()
    );

    // 22. Return available slots
    return NextResponse.json(
      {
        success: true,
        date: result.data.date,
        timeZone: host.timeZone,
        meetingTypeId: meetingType.id,
        duration: meetingType.duration,
        availableSlots,
      },
      { status: 200 }
    );


  } catch (error) {
    console.error("Get available slots error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}
