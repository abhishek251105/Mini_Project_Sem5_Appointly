import { NextResponse } from "next/server";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendBookingRescheduledEmail } from "@/lib/booking-notifications";

// 1. Validate rescheduling request
const rescheduleSchema = z.object({
  newStartTime: z.iso.datetime(),
  reason: z.string().trim().max(500).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 2. Authenticate host
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 3. Get booking ID
    const { id } = await params;

    // 4. Validate request body
    const body = await request.json().catch(() => null);
    const validation = rescheduleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const requestedStart = new Date(
      validation.data.newStartTime
    );

    if (requestedStart <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot reschedule to a past time",
        },
        { status: 400 }
      );
    }

    // 5. Perform rescheduling in a transaction
    const result = await prisma.$transaction(
      async (tx) => {
        // Find the existing booking
        const booking = await tx.booking.findFirst({
          where: {
            id,
            hostId: user.id,
          },
          include: {
            meetingType: {
              select: {
                title: true,
                duration: true,
                location: true,
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
          return { error: "BOOKING_NOT_FOUND" };
        }

        // Only confirmed appointments can be rescheduled
        if (booking.status !== "CONFIRMED") {
          return { error: "BOOKING_NOT_RESCHEDULABLE" };
        }

        // Check if the requested time is identical to the current time
        if (booking.startTime.getTime() === requestedStart.getTime()) {
          return { error: "SAME_SLOT" };
        }

        // Calculate new appointment end time
        const durationMs =
          booking.meetingType.duration * 60 * 1000;

        const requestedEnd = new Date(
          requestedStart.getTime() + durationMs
        );

        // Get the new date in the host's timezone
        const localDate = formatInTimeZone(
          requestedStart,
          booking.host.timeZone,
          "yyyy-MM-dd"
        );

        const dayOfWeek = new Date(
          `${localDate}T00:00:00.000Z`
        ).getUTCDay();

        // Retrieve weekly availability
        const availabilityRules =
          await tx.availabilityRule.findMany({
            where: {
              hostId: user.id,
              dayOfWeek,
            },
          });

        // Retrieve date-specific overrides
        const overrides =
          await tx.availabilityOverride.findMany({
            where: {
              hostId: user.id,
              date: new Date(`${localDate}T00:00:00.000Z`),
            },
          });

        // Check full-day block
        const fullDayBlocked = overrides.some(
          (override) =>
            override.isBlocked &&
            !override.startTime &&
            !override.endTime
        );

        if (fullDayBlocked) {
          return { error: "DATE_UNAVAILABLE" };
        }

        // Separate special availability and blocked periods
        const specialAvailability = overrides.filter(
          (override) => !override.isBlocked
        );

        const blockedOverrides = overrides.filter(
          (override) => override.isBlocked
        );

        // Choose availability windows
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

        // Check whether the new time fits the schedule
        const isWithinAvailability =
          availabilityWindows.some((window) => {
            const windowStart = fromZonedTime(
              `${localDate}T${window.startTime}:00`,
              booking.host.timeZone
            );

            const windowEnd = fromZonedTime(
              `${localDate}T${window.endTime}:00`,
              booking.host.timeZone
            );

            if (
              requestedStart < windowStart ||
              requestedEnd > windowEnd
            ) {
              return false;
            }

            const difference =
              requestedStart.getTime() -
              windowStart.getTime();

            return (
              difference >= 0 &&
              difference % durationMs === 0
            );
          });

        if (!isWithinAvailability) {
          return { error: "SLOT_NOT_AVAILABLE" };
        }

        // Convert blocked periods into UTC
        const blockedIntervals = blockedOverrides
          .filter(
            (override) =>
              override.startTime && override.endTime
          )
          .map((override) => ({
            start: fromZonedTime(
              `${localDate}T${override.startTime}:00`,
              booking.host.timeZone
            ),
            end: fromZonedTime(
              `${localDate}T${override.endTime}:00`,
              booking.host.timeZone
            ),
          }));

        // Check blocked-period conflicts
        const blockedConflict = blockedIntervals.some(
          (interval) =>
            requestedStart < interval.end &&
            requestedEnd > interval.start
        );

        if (blockedConflict) {
          return { error: "SLOT_BLOCKED" };
        }

        // Cancel expired payment holds for this host
        const now = new Date();

        await tx.booking.updateMany({
          where: {
            hostId: user.id,
            status: "PENDING_PAYMENT",
            expiresAt: {
              lte: now,
            },
          },
          data: {
            status: "CANCELLED",
          },
        });

        // Check for other overlapping bookings
        const conflict = await tx.booking.findFirst({
          where: {
            id: { not: id },
            hostId: user.id,
            startTime: { lt: requestedEnd },
            endTime: { gt: requestedStart },
            OR: [
              { status: "CONFIRMED" },
              {
                status: "PENDING_PAYMENT",
                expiresAt: { gt: now },
              },
            ],
          },
        });

        if (conflict) {
          return { error: "SLOT_ALREADY_BOOKED" };
        }

        const previousStartTime = booking.startTime;

        // Update the existing booking
        const updatedBooking = await tx.booking.update({
          where: { id },
          data: {
            startTime: requestedStart,
            endTime: requestedEnd,
          },
        });

        return {
          booking: updatedBooking,
          previousStartTime,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    // 6. Handle transaction validation errors
    if ("error" in result) {
      const responses: Record<
        string,
        { message: string; status: number }
      > = {
        BOOKING_NOT_FOUND: {
          message: "Booking not found",
          status: 404,
        },
        BOOKING_NOT_RESCHEDULABLE: {
          message: "Only confirmed bookings can be rescheduled",
          status: 409,
        },
        SAME_SLOT: {
          message: "Appointment is already scheduled for this time",
          status: 400,
        },
        DATE_UNAVAILABLE: {
          message: "The host is unavailable on this date",
          status: 409,
        },
        SLOT_NOT_AVAILABLE: {
          message: "The selected time is outside availability",
          status: 409,
        },
        SLOT_BLOCKED: {
          message: "The selected time is blocked",
          status: 409,
        },
        SLOT_ALREADY_BOOKED: {
          message: "This time slot is already booked",
          status: 409,
        },
      };

      const response = result.error
        ? responses[result.error]
        : undefined;

      if (!response) {
        return NextResponse.json(
          {
            success: false,
            message: "Unable to reschedule booking",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          message: response.message,
        },
        { status: response.status }
      );
    }

    // 7. Send reschedule notification email to the guest.
    //    Email failure must NEVER roll back the rescheduling or crash the response.
    try {
      await sendBookingRescheduledEmail({
        bookingId: id,
        previousStartTime: result.previousStartTime,
        reason: validation.data.reason,
      });
    } catch (notificationError) {
      console.error(
        "Booking reschedule notification error:",
        id,
        notificationError
      );
    }

    // 8. Return updated booking
    return NextResponse.json(
      {
        success: true,
        message: "Booking rescheduled successfully",
        booking: result.booking,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Reschedule booking error:", error);

    const prismaError = error as { code?: string };

    if (prismaError.code === "P2034") {
      return NextResponse.json(
        {
          success: false,
          message: "Booking conflict detected. Please try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while rescheduling",
      },
      { status: 500 }
    );
  }
}
