import prisma from "@/lib/prisma";
import { resend } from "@/lib/email";
import {
  hostBookingEmail,
  guestBookingEmail,
  guestCancellationEmail,
  guestRescheduleEmail,
  hostCancellationEmail,
  hostRescheduleEmail,
} from "@/lib/email-templates";
import type { NotificationType } from "@/app/generated/prisma/enums";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ??
  "Appointly <onboarding@resend.dev>";

function isValidEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Dynamically resolves the recipient email address from the database records
 * based on the notification type and participant role.
 *
 * - Guest-targeted notifications resolve to `booking.guestEmail`.
 * - Host-targeted notifications resolve to `booking.host.email`.
 */
export function resolveNotificationRecipient(
  type: NotificationType,
  booking: {
    guestEmail: string;
    host: { email: string };
  }
): string {
  switch (type) {
    case "BOOKING_CONFIRMED_GUEST":
    case "BOOKING_CANCELLED_GUEST":
    case "BOOKING_RESCHEDULED_GUEST":
      return booking.guestEmail.trim().toLowerCase();

    case "BOOKING_CONFIRMED_HOST":
    case "BOOKING_CANCELLED_HOST":
    case "BOOKING_RESCHEDULED_HOST":
      return booking.host.email.trim().toLowerCase();

    default:
      return booking.guestEmail.trim().toLowerCase();
  }
}

/**
 * Dispatches confirmation emails to both host and guest when a booking is confirmed.
 * Host notification goes directly to the host's registered email in PostgreSQL.
 * Guest notification goes directly to the guest's email provided in the booking record.
 */
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
      recipient: resolveNotificationRecipient("BOOKING_CONFIRMED_HOST", booking),
      ...hostBookingEmail(emailData),
    },
    {
      type: "BOOKING_CONFIRMED_GUEST",
      recipient: resolveNotificationRecipient("BOOKING_CONFIRMED_GUEST", booking),
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

    if (!isValidEmail(notification.recipient)) {
      await prisma.bookingNotification.update({
        where: { id: record.id },
        data: {
          status: "FAILED",
          lastError: `Invalid recipient email address: "${notification.recipient}"`,
        },
      }).catch(() => null);

      results.push({
        type: notification.type,
        success: false,
        message: "Invalid recipient email address",
      });
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

/**
 * Dispatches a cancellation notification email to the guest when the host cancels an appointment.
 * Recipient is dynamically resolved from the guest's email in the booking record.
 */
export async function sendBookingCancellationEmail({
  bookingId,
  reason,
  refundStatus,
}: {
  bookingId: string;
  reason?: string | null;
  refundStatus?: "REFUNDED" | "REFUND_PENDING" | "REQUIRES_REFUND" | "NONE" | null;
}) {
  // 1. Load booking information
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      host: {
        select: {
          name: true,
          email: true,
          slug: true,
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

  if (booking.status !== "CANCELLED") {
    return {
      success: false,
      message: "Booking is not cancelled",
    };
  }

  const emailData = {
    hostName: booking.host.name,
    hostSlug: booking.host.slug,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    meetingTitle: booking.meetingType.title,
    startTime: booking.startTime,
    timeZone: booking.host.timeZone,
    reason,
    refundStatus,
  };

  const emailContent = guestCancellationEmail(emailData);
  const notificationType: NotificationType = "BOOKING_CANCELLED_GUEST";
  const recipient = resolveNotificationRecipient(notificationType, booking);

  if (!isValidEmail(recipient)) {
    return {
      success: false,
      message: "Invalid recipient email address",
    };
  }

  // 2. Ensure database notification record exists
  let recordId: string | null = null;

  try {
    await prisma.bookingNotification.createMany({
      data: [{ bookingId, type: notificationType }],
      skipDuplicates: true,
    });

    const record = await prisma.bookingNotification.findUnique({
      where: {
        bookingId_type: {
          bookingId,
          type: notificationType,
        },
      },
    });

    if (record) {
      recordId = record.id;

      // Atomically claim notification
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
        return {
          success: false,
          message: "Already sent, currently sending, or retry limit reached",
        };
      }
    }
  } catch (dbError) {
    console.warn("BookingNotification DB tracking skipped (migration pending):", dbError);
  }

  // 3. Send email via Resend
  try {
    const { data, error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: recipient,
        subject: emailContent.subject,
        html: emailContent.html,
      },
      {
        idempotencyKey: `booking-cancellation/${recordId || bookingId}`,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "SENT",
          emailId: data?.id,
          sentAt: new Date(),
          lastError: null,
        },
      }).catch((err) => console.error("Failed to update notification to SENT:", err));
    }

    return {
      success: true,
      emailId: data?.id,
    };
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : "Unknown email error";
    console.error("Booking cancellation notification failed:", sendError);

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "FAILED",
          lastError: message,
        },
      }).catch((err) => console.error("Failed to update notification to FAILED:", err));
    }

    return {
      success: false,
      message,
    };
  }
}

/**
 * Dispatches a rescheduling notification email to the guest when the host reschedules an appointment.
 * Recipient is dynamically resolved from the guest's email in the booking record.
 */
export async function sendBookingRescheduledEmail({
  bookingId,
  previousStartTime,
  reason,
}: {
  bookingId: string;
  previousStartTime: Date;
  reason?: string | null;
}) {
  // 1. Load booking information
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      host: {
        select: {
          name: true,
          email: true,
          slug: true,
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
    bookingId: booking.id,
    hostName: booking.host.name,
    hostSlug: booking.host.slug,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    meetingTitle: booking.meetingType.title,
    previousStartTime,
    newStartTime: booking.startTime,
    duration: booking.meetingType.duration,
    timeZone: booking.host.timeZone,
    location: booking.meetingType.location,
    reason,
  };

  const emailContent = guestRescheduleEmail(emailData);
  const notificationType: NotificationType = "BOOKING_RESCHEDULED_GUEST";
  const recipient = resolveNotificationRecipient(notificationType, booking);

  if (!isValidEmail(recipient)) {
    return {
      success: false,
      message: "Invalid recipient email address",
    };
  }

  // 2. Ensure database notification record exists
  let recordId: string | null = null;

  try {
    const record = await prisma.bookingNotification.upsert({
      where: {
        bookingId_type: {
          bookingId,
          type: notificationType,
        },
      },
      create: {
        bookingId,
        type: notificationType,
        status: "PENDING",
      },
      update: {
        status: "PENDING",
        attempts: 0,
        emailId: null,
        lastError: null,
        sentAt: null,
      },
    });

    recordId = record.id;

    // Atomically claim notification
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
      return {
        success: false,
        message: "Already sent, currently sending, or retry limit reached",
      };
    }
  } catch (dbError) {
    console.warn("BookingNotification DB tracking skipped (migration pending):", dbError);
  }

  // 3. Send email via Resend
  try {
    const { data, error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: recipient,
        subject: emailContent.subject,
        html: emailContent.html,
      },
      {
        idempotencyKey: `booking-reschedule/${recordId || bookingId}-${booking.startTime.getTime()}`,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "SENT",
          emailId: data?.id,
          sentAt: new Date(),
          lastError: null,
        },
      }).catch((err) => console.error("Failed to update notification to SENT:", err));
    }

    return {
      success: true,
      emailId: data?.id,
    };
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : "Unknown email error";
    console.error("Booking reschedule notification failed:", sendError);

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "FAILED",
          lastError: message,
        },
      }).catch((err) => console.error("Failed to update notification to FAILED:", err));
    }

    return {
      success: false,
      message,
    };
  }
}

/**
 * Dispatches a cancellation notification email to the host when a guest cancels an appointment.
 * Recipient is dynamically resolved from the host's email in the User database record.
 */
export async function sendGuestBookingCancellationEmail({
  bookingId,
  reason,
}: {
  bookingId: string;
  reason?: string | null;
}) {
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

  if (booking.status !== "CANCELLED") {
    return {
      success: false,
      message: "Booking is not cancelled",
    };
  }

  const emailData = {
    hostName: booking.host.name,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    meetingTitle: booking.meetingType.title,
    startTime: booking.startTime,
    timeZone: booking.host.timeZone,
    reason,
  };

  const emailContent = hostCancellationEmail(emailData);
  const notificationType: NotificationType = "BOOKING_CANCELLED_HOST";
  const recipient = resolveNotificationRecipient(notificationType, booking);

  if (!isValidEmail(recipient)) {
    return {
      success: false,
      message: "Invalid recipient email address",
    };
  }

  // 2. Ensure database notification record exists
  let recordId: string | null = null;

  try {
    await prisma.bookingNotification.createMany({
      data: [{ bookingId, type: notificationType }],
      skipDuplicates: true,
    });

    const record = await prisma.bookingNotification.findUnique({
      where: {
        bookingId_type: {
          bookingId,
          type: notificationType,
        },
      },
    });

    if (record) {
      recordId = record.id;

      // Atomically claim notification
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
        return {
          success: false,
          message: "Already sent, currently sending, or retry limit reached",
        };
      }
    }
  } catch (dbError) {
    console.warn("BookingNotification DB tracking skipped (migration pending):", dbError);
  }

  // 3. Send email via Resend
  try {
    const { data, error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: recipient,
        subject: emailContent.subject,
        html: emailContent.html,
      },
      {
        idempotencyKey: `guest-cancellation/${recordId || bookingId}`,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "SENT",
          emailId: data?.id,
          sentAt: new Date(),
          lastError: null,
        },
      }).catch((err) => console.error("Failed to update notification to SENT:", err));
    }

    return {
      success: true,
      emailId: data?.id,
    };
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : "Unknown email error";
    console.error("Guest cancellation notification failed:", sendError);

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "FAILED",
          lastError: message,
        },
      }).catch((err) => console.error("Failed to update notification to FAILED:", err));
    }

    return {
      success: false,
      message,
    };
  }
}

/**
 * Dispatches a rescheduling notification email to the host when a guest reschedules an appointment.
 * Recipient is dynamically resolved from the host's email in the User database record.
 */
export async function sendGuestBookingRescheduledEmail({
  bookingId,
  previousStartTime,
  reason,
}: {
  bookingId: string;
  previousStartTime: Date;
  reason?: string | null;
}) {
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
    bookingId: booking.id,
    hostName: booking.host.name,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    meetingTitle: booking.meetingType.title,
    previousStartTime,
    newStartTime: booking.startTime,
    duration: booking.meetingType.duration,
    timeZone: booking.host.timeZone,
    location: booking.meetingType.location,
    reason,
  };

  const emailContent = hostRescheduleEmail(emailData);
  const notificationType: NotificationType = "BOOKING_RESCHEDULED_HOST";
  const recipient = resolveNotificationRecipient(notificationType, booking);

  if (!isValidEmail(recipient)) {
    return {
      success: false,
      message: "Invalid recipient email address",
    };
  }

  // 2. Ensure database notification record exists
  let recordId: string | null = null;

  try {
    const record = await prisma.bookingNotification.upsert({
      where: {
        bookingId_type: {
          bookingId,
          type: notificationType,
        },
      },
      create: {
        bookingId,
        type: notificationType,
        status: "PENDING",
      },
      update: {
        status: "PENDING",
        attempts: 0,
        emailId: null,
        lastError: null,
        sentAt: null,
      },
    });

    recordId = record.id;

    // Atomically claim notification
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
      return {
        success: false,
        message: "Already sent, currently sending, or retry limit reached",
      };
    }
  } catch (dbError) {
    console.warn("BookingNotification DB tracking skipped (migration pending):", dbError);
  }

  // 3. Send email via Resend
  try {
    const { data, error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: recipient,
        subject: emailContent.subject,
        html: emailContent.html,
      },
      {
        idempotencyKey: `guest-reschedule/${recordId || bookingId}-${booking.startTime.getTime()}`,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "SENT",
          emailId: data?.id,
          sentAt: new Date(),
          lastError: null,
        },
      }).catch((err) => console.error("Failed to update notification to SENT:", err));
    }

    return {
      success: true,
      emailId: data?.id,
    };
  } catch (sendError) {
    const message =
      sendError instanceof Error ? sendError.message : "Unknown email error";
    console.error("Guest reschedule notification failed:", sendError);

    if (recordId) {
      await prisma.bookingNotification.update({
        where: { id: recordId },
        data: {
          status: "FAILED",
          lastError: message,
        },
      }).catch((err) => console.error("Failed to update notification to FAILED:", err));
    }

    return {
      success: false,
      message,
    };
  }
}
