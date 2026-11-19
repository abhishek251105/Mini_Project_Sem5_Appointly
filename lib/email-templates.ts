
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
