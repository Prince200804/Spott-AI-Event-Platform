import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(req) {
  try {
    const { attendeeName, attendeeEmail, event, paymentMethod, paymentStatus, amountPaid } = await req.json();

    if (!attendeeName || !attendeeEmail || !event) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const eventDate = new Date(event.startDate).toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const themeColor = event.themeColor || "#8b5cf6";
    const wasPaidOnline = paymentStatus === "paid" && paymentMethod === "online";
    const refundAmount = amountPaid || event.ticketPrice || 0;

    // Refund section for paid-online tickets
    const refundHtml = wasPaidOnline
      ? `
        <div style="background: #ecfdf5; border: 2px solid #22c55e; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
          <div style="font-size: 36px; margin-bottom: 8px;">💸</div>
          <h3 style="color: #16a34a; margin: 0 0 8px 0; font-size: 18px;">Refund Initiated</h3>
          <p style="color: #15803d; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">₹${refundAmount}</p>
          <p style="color: #166534; font-size: 14px; margin: 0; line-height: 1.6;">
            Your refund of <strong>₹${refundAmount}</strong> will be credited back to your original payment method (Stripe) within <strong>5–10 business days</strong>.
          </p>
          <p style="color: #166534; font-size: 13px; margin: 8px 0 0 0;">
            If you don't receive it within this period, please contact us.
          </p>
        </div>
      `
      : "";

    // For offline pending payments
    const offlineNote =
      paymentMethod === "offline" && paymentStatus === "pending"
        ? `
        <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0; color: #15803d; font-size: 14px;">
            ✅ Since your payment was not yet completed, no refund is needed.
          </p>
        </div>
      `
        : "";

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">❌</div>
              <h1 style="color: white; margin: 0; font-size: 24px;">Registration Cancelled</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">
                Your ticket has been cancelled
              </p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333;">
                Hi <strong>${attendeeName}</strong>,
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Your registration for <strong>${event.title}</strong> has been successfully cancelled.
              </p>

              <!-- Event Details -->
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: ${themeColor};">${event.title}</h3>
                <p style="margin: 4px 0; color: #555;">📅 ${eventDate}</p>
                <p style="margin: 4px 0; color: #555;">📍 ${event.venue || event.city || "Online"}</p>
              </div>

              ${refundHtml}
              ${offlineNote}

              <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0; color: #555; font-size: 14px;">
                  🎫 Your QR ticket is no longer valid and cannot be used for entry.
                </p>
              </div>

              <div style="text-align: center; margin-top: 24px;">
                <p style="font-size: 14px; color: #666;">
                  We're sorry to see you go! You can always explore more events on Spott.
                </p>
                <p style="font-size: 12px; color: #999; margin-top: 16px;">
                  This is an automated notification from Spott.
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: `"Spott Events" <${process.env.SMTP_EMAIL}>`,
      to: attendeeEmail,
      subject: `❌ Registration cancelled for ${event.title}${wasPaidOnline ? " — Refund initiated" : ""}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Cancellation email error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}
