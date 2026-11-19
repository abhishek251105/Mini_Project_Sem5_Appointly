
import { NextResponse } from "next/server";
import { z } from "zod";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import prisma from "@/lib/prisma";
import { sendBookingConfirmationEmails } from "@/lib/booking-notifications";

const bookingSchema = z.object({
  hostSlug: z.string().min(1),
  meetingTypeId: z.string().min(1),
  guestName: z.string().trim().min(2).max(100),
  guestEmail: z.email().trim().toLowerCase(),
  startTime: z.iso.datetime(),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = bookingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      hostSlug,
      meetingTypeId,
      guestName,
      guestEmail,
      startTime,
      notes,
    } = validation.data;

    const requestedStart = new Date(startTime);

    if (requestedStart <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot book a slot in the past",
        },
        { status: 400 }
      );
    }

    let result;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            const host = await tx.user.findUnique({
              where: { slug: hostSlug },
              select: {
                id: true,
                timeZone: true,
              },
            });

            if (!host) {
              return {
                error: "HOST_NOT_FOUND",
              };
            }

            const meetingType = await tx.meetingType.findFirst({
              where: {
                id: meetingTypeId,
                hostId: host.id,
                isActive: true,
              },
              select: {
                id: true,
                duration: true,
                priceInPaise: true,
                currency: true,
              },
            });

            if (!meetingType) {
              return {
                error: "MEETING_TYPE_NOT_FOUND",
              };
            }

            const durationMs = meetingType.duration * 60 * 1000;

            const requestedEnd = new Date(
              requestedStart.getTime() + durationMs
            );

            const localDate = formatInTimeZone(
              requestedStart,
              host.timeZone,
              "yyyy-MM-dd"
            );

            const dayOfWeek = new Date(
              `${localDate}T00:00:00.000Z`
            ).getUTCDay();

            const availabilityRules =
              await tx.availabilityRule.findMany({
                where: {
                  hostId: host.id,
                  dayOfWeek,
                },
              });

            const overrides =
              await tx.availabilityOverride.findMany({
                where: {
                  hostId: host.id,
                  date: new Date(`${localDate}T00:00:00.000Z`),
                },
              });

            const fullDayBlocked = overrides.some(
              (override) =>
                override.isBlocked &&
                !override.startTime &&
                !override.endTime
            );

            if (fullDayBlocked) {
              return {
                error: "DATE_UNAVAILABLE",
              };
            }

            const specialAvailability = overrides.filter(
              (override) => !override.isBlocked
            );

            const blockedOverrides = overrides.filter(
              (override) => override.isBlocked
            );

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

            const isWithinAvailability = availabilityWindows.some(
              (window) => {
                const windowStart = fromZonedTime(
                  `${localDate}T${window.startTime}:00`,
                  host.timeZone
                );

                const windowEnd = fromZonedTime(
                  `${localDate}T${window.endTime}:00`,
                  host.timeZone
                );

                if (
                  requestedStart < windowStart ||
                  requestedEnd > windowEnd
                ) {
                  return false;
                }
                // The requested start must follow the same
                // duration-based slot intervals as the public API.
                const difference =
                  requestedStart.getTime() - windowStart.getTime();

                return difference >= 0 && difference % durationMs === 0;
              }
            );

            if (!isWithinAvailability) {
              return {
                error: "SLOT_NOT_AVAILABLE",
              };
            }

            const blockedIntervals = blockedOverrides
              .filter(
                (override) =>
                  override.startTime && override.endTime
              )
              .map((override) => ({
                start: fromZonedTime(
                  `${localDate}T${override.startTime}:00`,
                  host.timeZone
                ),
                end: fromZonedTime(
                  `${localDate}T${override.endTime}:00`,
                  host.timeZone
                ),
              }));

            const blockedConflict = blockedIntervals.some(
              (interval) =>
                requestedStart < interval.end &&
                requestedEnd > interval.start
            );

            if (blockedConflict) {
              return {
                error: "SLOT_BLOCKED",
              };
            }

            const now = new Date();

            await tx.booking.updateMany({
              where: {
                hostId: host.id,
                status: "PENDING_PAYMENT",
                expiresAt: {
                  lte: now,
                },
              },
              data: {
                status: "CANCELLED",
              },
            });

            const existingBooking = await tx.booking.findFirst({
              where: {
                hostId: host.id,
                startTime: {
                  lt: requestedEnd,
                },
                endTime: {
                  gt: requestedStart,
                },
                status: {
                  in: ["CONFIRMED", "PENDING_PAYMENT"],
                },
                OR: [
                  {
                    status: "CONFIRMED",
                  },
                  {
                    status: "PENDING_PAYMENT",
                    expiresAt: {
                      gt: now,
                    },
                  },
                ],
              },
            });

            if (existingBooking) {
              return {
                error: "SLOT_ALREADY_BOOKED",
              };
            }

            const isPaid = meetingType.priceInPaise > 0;

            const expiresAt = isPaid
              ? new Date(Date.now() + 15 * 60 * 1000)
              : null;

            const booking = await tx.booking.create({
              data: {
                guestName,
                guestEmail,
                startTime: requestedStart,
                endTime: requestedEnd,
                notes,
                hostId: host.id,
                meetingTypeId: meetingType.id,
                status: isPaid
                  ? "PENDING_PAYMENT"
                  : "CONFIRMED",
                expiresAt,
              },
              select: {
                id: true,
                guestName: true,
                guestEmail: true,
                startTime: true,
                endTime: true,
                status: true,
                notes: true,
                expiresAt: true,
                createdAt: true,
              },
            });

            return {
              booking,
              isPaid,
              priceInPaise: meetingType.priceInPaise,
              currency: meetingType.currency,
            };
          },
          {
            isolationLevel: "Serializable",
          }
        );

        break;
      } catch (error) {
        const prismaError = error as {
          code?: string;
        };

        // P2034 means a transaction conflict or deadlock
        if (prismaError.code === "P2034" && attempt < 3) {
          continue;
        }

        if (prismaError.code === "P2034") {
          return NextResponse.json(
            {
              success: false,
              message:
                "This slot is being booked by someone else. Please try again.",
            },
            { status: 409 }
          );
        }

        throw error;
      }
    }

    if (!result || "error" in result) {
      const error = result?.error;

      const errorResponses: Record<
        string,
        { message: string; status: number }
      > = {
        HOST_NOT_FOUND: {
          message: "Host not found",
          status: 404,
        },
        MEETING_TYPE_NOT_FOUND: {
          message: "Meeting type not found",
          status: 404,
        },
        DATE_UNAVAILABLE: {
          message: "The host is unavailable on this date",
          status: 409,
        },
        SLOT_NOT_AVAILABLE: {
          message: "The selected slot is outside the host's availability",
          status: 409,
        },
        SLOT_BLOCKED: {
          message: "The selected slot is blocked by the host",
          status: 409,
        },
        SLOT_ALREADY_BOOKED: {
          message: "This slot has already been booked",
          status: 409,
        },
      };

      const response = error
        ? errorResponses[error]
        : undefined;

      return NextResponse.json(
        {
          success: false,
          message: response?.message ?? "Unable to create booking",
        },
        { status: response?.status ?? 500 }
      );
    }

    // Send confirmation emails only for free bookings.
    // Paid bookings will be notified after payment confirmation.
    if (!result.isPaid && result.booking.status === "CONFIRMED") {
      try {
        const emailResult = await sendBookingConfirmationEmails(
          result.booking.id
        );

        if (!emailResult.success) {
          console.error(
            "Some booking notifications were not sent:",
            emailResult
          );
        }
      } catch (emailError) {
        // Email failure must never invalidate a confirmed booking.
        console.error(
          "Booking confirmation email error:",
          emailError
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: result.isPaid
          ? "Booking created. Complete payment to confirm your appointment."
          : "Appointment booked successfully",
        booking: result.booking,
        payment: result.isPaid
          ? {
              required: true,
              amount: result.priceInPaise,
              currency: result.currency,
              expiresAt: result.booking.expiresAt,
            }
          : {
              required: false,
            },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create booking error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while creating the booking",
      },
      { status: 500 }
    );
  }
}
