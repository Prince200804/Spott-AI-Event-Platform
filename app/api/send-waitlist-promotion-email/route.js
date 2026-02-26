import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import QRCode from "qrcode";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

export async function POST(req) {
  try {
    const { attendeeName, attendeeEmail, qrCode, event } = await req.json();

    if (!attendeeName || !attendeeEmail || !event) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate QR code if provided
    let qrCodeHtml = "";
    if (qrCode) {
      const qrDataUrl = await QRCode.toDataURL(qrCode, {
        width: 300,
        margin: 2,
        color: { dark: "#18181b", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      qrCodeHtml = `
        <div style="text-align: center; margin: 20px 0;">
          <img src="${qrDataUrl}" alt="QR Ticket" style="width: 200px; height: 200px;" />
          <p style="font-size: 12px; color: #666; margin-top: 8px;">Your entry QR code</p>
        </div>
      `;
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
            <div style="background: linear-gradient(135deg, ${themeColor}, #22c55e); padding: 32px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 12px;">🎉</div>
              <h1 style="color: white; margin: 0; font-size: 24px;">A Spot Opened Up!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">
                You've been promoted from the waitlist
              </p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333;">
                Hi <strong>${attendeeName}</strong>,
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Great news! A spot has opened up for <strong>${event.title}</strong> 
                and you've been automatically registered. 🎊
              </p>

              <!-- Event Details -->
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: ${themeColor};">${event.title}</h3>
                <p style="margin: 4px 0; color: #555;">📅 ${eventDate}</p>
                <p style="margin: 4px 0; color: #555;">📍 ${event.venue || event.city || "Online"}</p>
                ${event.ticketType === "paid" ? `<p style="margin: 4px 0; color: #555;">💰 ₹${event.ticketPrice} (pay at venue)</p>` : ""}
              </div>

              ${qrCodeHtml}

              ${event.ticketType === "paid" ? `
                <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0;">
                  <p style="margin: 0; color: #92400e; font-size: 14px;">
                    💰 <strong>Payment Reminder:</strong> Please pay ₹${event.ticketPrice} at the venue on event day.
                  </p>
                </div>
              ` : ""}

              <div style="text-align: center; margin-top: 24px;">
                <p style="font-size: 14px; color: #666;">
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
      subject: `🎉 Spot opened! You're registered for ${event.title}`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Waitlist promotion email error:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}
