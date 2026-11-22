type BookingEmailData = {
  hostName: string;
  guestName: string;
  guestEmail: string;
  meetingTitle: string;
  startTime: Date;
  duration: number;
  timeZone: string;
  location?: string | null;
};

export type CancellationEmailData = {
  hostName: string;
  hostSlug: string;
  guestName: string;
  guestEmail: string;
  meetingTitle: string;
  startTime: Date;
  timeZone: string;
  reason?: string | null;
  refundStatus?: "REFUNDED" | "REFUND_PENDING" | "REQUIRES_REFUND" | "NONE" | null;
};

export type RescheduleEmailData = {
  bookingId: string;
  hostName: string;
  hostSlug: string;
  guestName: string;
  guestEmail: string;
  meetingTitle: string;
  previousStartTime: Date;
  newStartTime: Date;
  duration: number;
  timeZone: string;
  location?: string | null;
  reason?: string | null;
};

export type HostCancellationEmailData = {
  hostName: string;
  guestName: string;
  guestEmail: string;
  meetingTitle: string;
  startTime: Date;
  timeZone: string;
  reason?: string | null;
};

export type HostRescheduleEmailData = {
  bookingId: string;
  hostName: string;
  guestName: string;
  guestEmail: string;
  meetingTitle: string;
  previousStartTime: Date;
  newStartTime: Date;
  duration: number;
  timeZone: string;
  location?: string | null;
  reason?: string | null;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}

function formatDateTime(date: Date, timeZone: string) {
  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    dateStyle: "full",
  }).format(date);

  const formattedTime = new Intl.DateTimeFormat("en-IN", {
    timeZone,
    timeStyle: "short",
  }).format(date);

  return { formattedDate, formattedTime };
}

export function hostBookingEmail(data: BookingEmailData) {
  const { formattedDate, formattedTime } = formatDateTime(
    data.startTime,
    data.timeZone
  );

  return {
    subject: `New Booking Confirmed: ${data.meetingTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>New Appointment Confirmed</h2>

        <p>Hello ${escapeHtml(data.hostName)},</p>

        <p>You have received a new confirmed booking on Appointly.</p>

        <h3>Appointment Details</h3>
        <p><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle)}</p>
        <p><strong>Guest:</strong> ${escapeHtml(data.guestName)}</p>
        <p><strong>Guest Email:</strong> ${escapeHtml(data.guestEmail)}</p>
        <p><strong>Date:</strong> ${escapeHtml(formattedDate)}</p>
        <p><strong>Time:</strong> ${escapeHtml(formattedTime)}</p>
        <p><strong>Time Zone:</strong> ${escapeHtml(data.timeZone)}</p>
        <p><strong>Duration:</strong> ${data.duration} minutes</p>
        <p><strong>Location:</strong> ${escapeHtml(data.location || "Not specified")}</p>

        <p>Log in to Appointly to manage this appointment.</p>
        <hr />
        <p style="color:#777">Appointly — Smart Appointment Scheduling</p>
      </div>
    `,
  };
}

export function guestBookingEmail(data: BookingEmailData) {
  const { formattedDate, formattedTime } = formatDateTime(
    data.startTime,
    data.timeZone
  );

  return {
    subject: `Appointment Confirmed: ${data.meetingTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
        <h2>Your Appointment is Confirmed!</h2>

        <p>Hello ${escapeHtml(data.guestName)},</p>

        <p>Your appointment with ${escapeHtml(data.hostName)} has been confirmed.</p>

        <h3>Appointment Details</h3>
        <p><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle)}</p>
        <p><strong>Host:</strong> ${escapeHtml(data.hostName)}</p>
        <p><strong>Date:</strong> ${escapeHtml(formattedDate)}</p>
        <p><strong>Time:</strong> ${escapeHtml(formattedTime)}</p>
        <p><strong>Time Zone:</strong> ${escapeHtml(data.timeZone)}</p>
        <p><strong>Duration:</strong> ${data.duration} minutes</p>
        <p><strong>Location:</strong> ${escapeHtml(data.location || "Not specified")}</p>

        <p>Thank you for booking through Appointly!</p>
        <hr />
        <p style="color:#777">Appointly — Smart Appointment Scheduling</p>
      </div>
    `,
  };
}

export function guestCancellationEmail(data: CancellationEmailData) {
  const { formattedDate, formattedTime } = formatDateTime(
    data.startTime,
    data.timeZone
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://appointly.com";
  const bookingPageUrl = `${appUrl}/${encodeURIComponent(data.hostSlug)}`;

  let refundNoticeHtml = "";
  if (data.refundStatus === "REFUNDED") {
    refundNoticeHtml = `
      <div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:12px 16px;border-radius:6px;color:#065f46;margin:16px 0;">
        <strong style="color:#047857;">Refund Completed:</strong> Your payment has been refunded in full.
      </div>
    `;
  } else if (data.refundStatus === "REFUND_PENDING") {
    refundNoticeHtml = `
      <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px 16px;border-radius:6px;color:#1e40af;margin:16px 0;">
        <strong style="color:#1d4ed8;">Refund Processing:</strong> A full refund has been initiated through Razorpay and is being processed. It may take 5–7 business days to reflect in your account.
      </div>
    `;
  } else if (data.refundStatus === "REQUIRES_REFUND") {
    refundNoticeHtml = `
      <div style="background:#fffbeb;border:1px solid #fde68a;padding:12px 16px;border-radius:6px;color:#92400e;margin:16px 0;">
        <strong style="color:#b45309;">Refund Notice:</strong> Your payment is marked for refund and our team is actively processing it.
      </div>
    `;
  }

  const reasonHtml = data.reason
    ? `
      <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;margin:16px 0;color:#334155;">
        <strong>Cancellation reason provided by host:</strong><br/>
        <span style="font-style:italic;">&ldquo;${escapeHtml(data.reason)}&rdquo;</span>
      </div>
    `
    : "";

  return {
    subject: `Appointment Cancelled: ${data.meetingTitle} with ${data.hostName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b;line-height:1.5;">
        <div style="border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:20px;">
          <h2 style="margin:0;color:#0f766e;font-size:24px;">Appointly</h2>
        </div>

        <h3 style="color:#e11d48;margin-top:0;">Your Appointment Has Been Cancelled</h3>

        <p>Hello ${escapeHtml(data.guestName)},</p>

        <p>We are writing to let you know that <strong>${escapeHtml(data.hostName)}</strong> has cancelled your upcoming appointment on Appointly.</p>

        ${reasonHtml}

        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
          <h4 style="margin:0 0 12px 0;color:#334155;">Original Appointment Details</h4>
          <p style="margin:4px 0;"><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle)}</p>
          <p style="margin:4px 0;"><strong>Host:</strong> ${escapeHtml(data.hostName)}</p>
          <p style="margin:4px 0;"><strong>Original Date:</strong> ${escapeHtml(formattedDate)}</p>
          <p style="margin:4px 0;"><strong>Original Time:</strong> ${escapeHtml(formattedTime)}</p>
          <p style="margin:4px 0;"><strong>Time Zone:</strong> ${escapeHtml(data.timeZone)}</p>
        </div>

        ${refundNoticeHtml}

        <p>If you would like to schedule another time with ${escapeHtml(data.hostName)}, you can view their availability and book a new appointment using the link below:</p>

        <div style="margin:24px 0;">
          <a href="${bookingPageUrl}" style="background-color:#0d9488;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:14px;">
            Book Another Slot
          </a>
        </div>

        <p style="color:#64748b;font-size:13px;">Or copy and paste this URL into your browser:<br/>
          <a href="${bookingPageUrl}" style="color:#0d9488;">${bookingPageUrl}</a>
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">Appointly — Smart Appointment Scheduling</p>
      </div>
    `,
  };
}

export function guestRescheduleEmail(data: RescheduleEmailData) {
  const previous = formatDateTime(data.previousStartTime, data.timeZone);
  const updated = formatDateTime(data.newStartTime, data.timeZone);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://appointly.com";
  const bookingDetailsUrl = `${appUrl}/booking/${encodeURIComponent(data.bookingId)}/confirmed`;

  const reasonHtml = data.reason
    ? `
      <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;margin:16px 0;color:#334155;">
        <strong>Reason for rescheduling provided by host:</strong><br/>
        <span style="font-style:italic;">&ldquo;${escapeHtml(data.reason)}&rdquo;</span>
      </div>
    `
    : "";

  return {
    subject: `Appointment Rescheduled: ${data.meetingTitle} with ${data.hostName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b;line-height:1.5;">
        <div style="border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:20px;">
          <h2 style="margin:0;color:#0f766e;font-size:24px;">Appointly</h2>
        </div>

        <h3 style="color:#0d9488;margin-top:0;">Your Appointment Has Been Rescheduled</h3>

        <p>Hello ${escapeHtml(data.guestName)},</p>

        <p>Please note that <strong>${escapeHtml(data.hostName)}</strong> has changed the scheduled time for your appointment on Appointly.</p>

        ${reasonHtml}

        <div style="margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50%;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px 0 0 8px;vertical-align:top;">
                <div style="color:#991b1b;font-size:11px;text-transform:uppercase;font-weight:bold;letter-spacing:0.05em;margin-bottom:4px;">Previous Time</div>
                <div style="color:#7f1d1d;font-size:15px;font-weight:bold;text-decoration:line-through;">${escapeHtml(previous.formattedDate)}</div>
                <div style="color:#991b1b;font-size:13px;text-decoration:line-through;margin-top:2px;">${escapeHtml(previous.formattedTime)}</div>
                <div style="color:#991b1b;font-size:11px;text-decoration:line-through;">(${escapeHtml(data.timeZone)})</div>
              </td>
              <td style="width:50%;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0 8px 8px 0;vertical-align:top;">
                <div style="color:#166534;font-size:11px;text-transform:uppercase;font-weight:bold;letter-spacing:0.05em;margin-bottom:4px;">New Time</div>
                <div style="color:#14532d;font-size:15px;font-weight:bold;">${escapeHtml(updated.formattedDate)}</div>
                <div style="color:#166534;font-size:13px;font-weight:bold;margin-top:2px;">${escapeHtml(updated.formattedTime)}</div>
                <div style="color:#166534;font-size:11px;">(${escapeHtml(data.timeZone)})</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
          <h4 style="margin:0 0 12px 0;color:#334155;">Meeting Details</h4>
          <p style="margin:4px 0;"><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle)}</p>
          <p style="margin:4px 0;"><strong>Host:</strong> ${escapeHtml(data.hostName)}</p>
          <p style="margin:4px 0;"><strong>Duration:</strong> ${data.duration} minutes</p>
          <p style="margin:4px 0;"><strong>Location:</strong> ${escapeHtml(data.location || "Not specified")}</p>
        </div>

        <div style="margin:24px 0;">
          <a href="${bookingDetailsUrl}" style="background-color:#0d9488;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:14px;">
            View Booking Details
          </a>
        </div>

        <p style="color:#64748b;font-size:13px;">Or view your booking directly at:<br/>
          <a href="${bookingDetailsUrl}" style="color:#0d9488;">${bookingDetailsUrl}</a>
        </p>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">Appointly — Smart Appointment Scheduling</p>
      </div>
    `,
  };
}

export function hostCancellationEmail(data: HostCancellationEmailData) {
  const { formattedDate, formattedTime } = formatDateTime(
    data.startTime,
    data.timeZone
  );

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://appointly.com";
  const dashboardUrl = `${appUrl}/dashboard`;

  const reasonHtml = data.reason
    ? `
      <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;margin:16px 0;color:#334155;">
        <strong>Cancellation reason provided by guest:</strong><br/>
        <span style="font-style:italic;">&ldquo;${escapeHtml(data.reason)}&rdquo;</span>
      </div>
    `
    : "";

  return {
    subject: `Booking Cancelled by Guest: ${data.meetingTitle} - ${data.guestName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b;line-height:1.5;">
        <div style="border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:20px;">
          <h2 style="margin:0;color:#0f766e;font-size:24px;">Appointly</h2>
        </div>

        <h3 style="color:#e11d48;margin-top:0;">Appointment Cancelled by Guest</h3>

        <p>Hello ${escapeHtml(data.hostName)},</p>

        <p>Your guest <strong>${escapeHtml(data.guestName)}</strong> (${escapeHtml(data.guestEmail)}) has cancelled their upcoming appointment on Appointly.</p>

        ${reasonHtml}

        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
          <h4 style="margin:0 0 12px 0;color:#334155;">Cancelled Appointment Details</h4>
          <p style="margin:4px 0;"><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle)}</p>
          <p style="margin:4px 0;"><strong>Guest:</strong> ${escapeHtml(data.guestName)}</p>
          <p style="margin:4px 0;"><strong>Guest Email:</strong> ${escapeHtml(data.guestEmail)}</p>
          <p style="margin:4px 0;"><strong>Original Date:</strong> ${escapeHtml(formattedDate)}</p>
          <p style="margin:4px 0;"><strong>Original Time:</strong> ${escapeHtml(formattedTime)}</p>
          <p style="margin:4px 0;"><strong>Time Zone:</strong> ${escapeHtml(data.timeZone)}</p>
        </div>

        <div style="margin:24px 0;">
          <a href="${dashboardUrl}" style="background-color:#0d9488;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:14px;">
            Open Dashboard
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">Appointly — Smart Appointment Scheduling</p>
      </div>
    `,
  };
}

export function hostRescheduleEmail(data: HostRescheduleEmailData) {
  const previous = formatDateTime(data.previousStartTime, data.timeZone);
  const updated = formatDateTime(data.newStartTime, data.timeZone);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://appointly.com";
  const dashboardUrl = `${appUrl}/dashboard`;

  const reasonHtml = data.reason
    ? `
      <div style="background:#f8fafc;border-left:4px solid #94a3b8;padding:10px 14px;margin:16px 0;color:#334155;">
        <strong>Reason for rescheduling provided by guest:</strong><br/>
        <span style="font-style:italic;">&ldquo;${escapeHtml(data.reason)}&rdquo;</span>
      </div>
    `
    : "";

  return {
    subject: `Booking Rescheduled by Guest: ${data.meetingTitle} - ${data.guestName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1e293b;line-height:1.5;">
        <div style="border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:20px;">
          <h2 style="margin:0;color:#0f766e;font-size:24px;">Appointly</h2>
        </div>

        <h3 style="color:#0d9488;margin-top:0;">Appointment Rescheduled by Guest</h3>

        <p>Hello ${escapeHtml(data.hostName)},</p>

        <p>Your guest <strong>${escapeHtml(data.guestName)}</strong> (${escapeHtml(data.guestEmail)}) has rescheduled their appointment on Appointly.</p>

        ${reasonHtml}

        <div style="margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="width:50%;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px 0 0 8px;vertical-align:top;">
                <div style="color:#991b1b;font-size:11px;text-transform:uppercase;font-weight:bold;letter-spacing:0.05em;margin-bottom:4px;">Previous Time</div>
                <div style="color:#7f1d1d;font-size:15px;font-weight:bold;text-decoration:line-through;">${escapeHtml(previous.formattedDate)}</div>
                <div style="color:#991b1b;font-size:13px;text-decoration:line-through;margin-top:2px;">${escapeHtml(previous.formattedTime)}</div>
                <div style="color:#991b1b;font-size:11px;text-decoration:line-through;">(${escapeHtml(data.timeZone)})</div>
              </td>
              <td style="width:50%;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:0 8px 8px 0;vertical-align:top;">
                <div style="color:#166534;font-size:11px;text-transform:uppercase;font-weight:bold;letter-spacing:0.05em;margin-bottom:4px;">New Time</div>
                <div style="color:#14532d;font-size:15px;font-weight:bold;">${escapeHtml(updated.formattedDate)}</div>
                <div style="color:#166534;font-size:13px;font-weight:bold;margin-top:2px;">${escapeHtml(updated.formattedTime)}</div>
                <div style="color:#166534;font-size:11px;">(${escapeHtml(data.timeZone)})</div>
              </td>
            </tr>
          </table>
        </div>

        <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:20px 0;">
          <h4 style="margin:0 0 12px 0;color:#334155;">Meeting Details</h4>
          <p style="margin:4px 0;"><strong>Meeting:</strong> ${escapeHtml(data.meetingTitle)}</p>
          <p style="margin:4px 0;"><strong>Guest:</strong> ${escapeHtml(data.guestName)}</p>
          <p style="margin:4px 0;"><strong>Guest Email:</strong> ${escapeHtml(data.guestEmail)}</p>
          <p style="margin:4px 0;"><strong>Duration:</strong> ${data.duration} minutes</p>
          <p style="margin:4px 0;"><strong>Location:</strong> ${escapeHtml(data.location || "Not specified")}</p>
        </div>

        <div style="margin:24px 0;">
          <a href="${dashboardUrl}" style="background-color:#0d9488;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:bold;font-size:14px;">
            Open Dashboard
          </a>
        </div>

        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
        <p style="color:#94a3b8;font-size:12px;margin:0;">Appointly — Smart Appointment Scheduling</p>
      </div>
    `,
  };
}
