import { NextResponse } from "next/server";
import { z } from "zod";
import { resend } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";

const testEmailSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  try {
    // 1. Require an authenticated host session.
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2. Validate the request body.
    const body = await request.json().catch(() => null);
    const validation = testEmailSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: "A valid email address is required" },
        { status: 400 }
      );
    }

    // 3. Restrict delivery to the authenticated host's own email address only.
    //    This prevents the endpoint from being used to send emails to arbitrary
    //    third parties.
    if (validation.data.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json(
        {
          success: false,
          message: "Test emails can only be sent to your own account email",
        },
        { status: 403 }
      );
    }

    const fromEmail =
      process.env.RESEND_FROM_EMAIL ??
      "Appointly <onboarding@resend.dev>";

    // 4. Send a single test email to the authenticated host.
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Appointly Email Integration Test",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h2>Email Integration Test</h2>
          <p>Hello ${user.name},</p>
          <p>Your Resend email integration is working correctly.</p>
          <p>This test was requested from the Appointly host dashboard.</p>
          <hr />
          <p style="color:#777">Appointly — Smart Appointment Scheduling</p>
        </div>
      `,
    });

    if (error) {
      console.error("Test email send error:", error.message);

      return NextResponse.json(
        { success: false, message: "Failed to send test email" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test email sent to your account address",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Test email error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong" },
      { status: 500 }
    );
  }
}