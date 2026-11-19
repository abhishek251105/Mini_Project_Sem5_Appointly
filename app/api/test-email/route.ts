import { NextResponse } from "next/server";
import { resend } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, message: "Valid email is required" },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: "Appointly <onboarding@resend.dev>",
      to: email,
      subject: "Appointly Email Test",
      html: `
        <h2>Welcome to Appointly!</h2>
        <p>Your email integration is working successfully.</p>
        <p>This is a test email from your Appointly backend.</p>
      `,
    });

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Test email submitted successfully",
      emailId: data?.id,
    });
  } catch (error) {
    console.error("Test email error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to send test email" },
      { status: 500 }
    );
  }
}