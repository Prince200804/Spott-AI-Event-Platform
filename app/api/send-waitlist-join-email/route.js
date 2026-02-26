import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req) {
  try {
    const { attendeeName, attendeeEmail, position, event } = await req.json();

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
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">⏳</div>
              <h1 style="color: white; margin: 0; font-size: 24px;">You're on the Waitlist!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">
                Position #${position} in line
              </p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333;">
                Hi <strong>${attendeeName}</strong>,
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                The event <strong>${event.title}</strong> is currently full, but you're 
                <strong style="color: #d97706;">#${position}</strong> on the waitlist!
              </p>

              <!-- Event Details -->
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: ${themeColor};">${event.title}</h3>
                <p style="margin: 4px 0; color: #555;">📅 ${eventDate}</p>
                <p style="margin: 4px 0; color: #555;">📍 ${event.venue || event.city || "Online"}</p>
                ${event.ticketType === "paid" ? `<p style="margin: 4px 0; color: #555;">💰 ₹${event.ticketPrice}</p>` : `<p style="margin: 4px 0; color: #555;">🎟️ Free Event</p>`}
              </div>

              <!-- Position Badge -->
              <div style="background: #fffbeb; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
                <div style="font-size: 36px; margin-bottom: 8px;">🎯</div>
                <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
                  You're <strong>#${position}</strong> in the queue. When a spot opens up, 
                  we'll automatically notify you${event.ticketType === "paid" ? " with a link to complete your payment" : " and register you"}.
                </p>
              </div>

              <!-- What happens next -->
              <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0; color: #0369a1; font-size: 14px; font-weight: 600;">📋 What happens next?</p>
                <ul style="margin: 0; padding: 0 0 0 20px; color: #0c4a6e; font-size: 13px; line-height: 1.8;">
                  <li>We'll notify you by email the moment a spot opens up</li>
                  ${event.ticketType === "paid"
                    ? `<li>You'll receive a payment link to secure your spot</li>
                       <li>After payment, you'll get your QR ticket via email</li>`
                    : `<li>You'll be automatically registered when a spot opens</li>
                       <li>You'll receive your QR ticket via email</li>`
                  }
                  <li>You can leave the waitlist anytime from My Tickets</li>
                </ul>
              </div>

              <div style="text-align: center; margin-top: 24px;">
                <p style="font-size: 14px; color: #666;">
                  Hang tight! 🤞 We'll let you know as soon as there's an opening.
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
      from: `"Spott Events" <${process.env.GMAIL_USER}>`,

      to: attendeeEmail,
      subject: `⏳ You're #${position} on the waitlist for ${event.title}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Waitlist join email error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}
