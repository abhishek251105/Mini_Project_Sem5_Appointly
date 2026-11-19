
import prisma from "@/lib/prisma";
import { resend } from "@/lib/email";
import {
  hostBookingEmail,
  guestBookingEmail,
} from "@/lib/email-templates";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ??
  "Appointly <onboarding@resend.dev>";

const TEST_EMAIL = process.env.RESEND_TEST_EMAIL;

type NotificationType =
  | "BOOKING_CONFIRMED_HOST"
  | "BOOKING_CONFIRMED_GUEST";

export async function sendBookingConfirmationEmails(
  bookingId: string
) {
  // 1. Load booking information
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      host: {
        select: {
          name: true,
          email: true,
          timeZone: true,
        },
      },
      meetingType: {
        select: {
          title: true,
          duration: true,
          location: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status !== "CONFIRMED") {
    return {
      success: false,
      message: "Booking is not confirmed",
    };
  }

  const emailData = {
    hostName: booking.host.name,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    meetingTitle: booking.meetingType.title,
    startTime: booking.startTime,
    duration: booking.meetingType.duration,
    timeZone: booking.host.timeZone,
    location: booking.meetingType.location,
  };

  const notifications: {
    type: NotificationType;
    recipient: string;
    subject: string;
    html: string;
  }[] = [
    {
      type: "BOOKING_CONFIRMED_HOST",
      recipient: TEST_EMAIL ?? booking.host.email,
      ...hostBookingEmail(emailData),
    },
    {
      type: "BOOKING_CONFIRMED_GUEST",
      recipient: TEST_EMAIL ?? booking.guestEmail,
      ...guestBookingEmail(emailData),
    },
  ];

  // 2. Ensure one database record per booking and email type
  await prisma.bookingNotification.createMany({
    data: notifications.map(({ type }) => ({
      bookingId,
      type,
    })),
    skipDuplicates: true,
  });

  // 3. Process each notification independently
  const results = [];

  for (const notification of notifications) {
    const record = await prisma.bookingNotification.findUnique({
      where: {
        bookingId_type: {
          bookingId,
          type: notification.type,
        },
      },
    });

    if (!record) {
      continue;
    }

    // Atomically claim only notifications that are pending or failed.
    const claimed = await prisma.bookingNotification.updateMany({
      where: {
        id: record.id,
        status: { in: ["PENDING", "FAILED"] },
        attempts: { lt: 3 },
      },
      data: {
        status: "SENDING",
        attempts: { increment: 1 },
        lastError: null,
      },
    });

    if (claimed.count !== 1) {
      results.push({
        type: notification.type,
        success: false,
        message: "Already sent, currently sending, or retry limit reached",
      });
      continue;
    }

    try {
      // Use a stable idempotency key for each notification.
      const { data, error } = await resend.emails.send(
        {
          from: FROM_EMAIL,
          to: notification.recipient,
          subject: notification.subject,
          html: notification.html,
        },
        {
          idempotencyKey: `booking-confirmation/${record.id}`,
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      await prisma.bookingNotification.update({
        where: { id: record.id },
        data: {
          status: "SENT",
          emailId: data?.id,
          sentAt: new Date(),
          lastError: null,
        },
      });

      results.push({
        type: notification.type,
        success: true,
        emailId: data?.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown email error";

      console.error(
        `Booking notification ${notification.type} failed:`,
        error
      );

      await prisma.bookingNotification.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          lastError: message,
        },
      });

      results.push({
        type: notification.type,
        success: false,
        message,
      });
    }
  }

  return {
    success: results.every((result) => result.success),
    results,
  };
}
