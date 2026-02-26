import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import QRCode from "qrcode";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req) {
  try {
    const { attendeeName, attendeeEmail, qrCode, event, type } = await req.json();

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
    const isPaidPromotion = type === "paid";
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://spott-ai-event-platform.vercel.app";

    // Generate QR code HTML for free events (they get ticket immediately)
    let qrCodeHtml = "";
    if (qrCode && !isPaidPromotion) {
      const qrDataUrl = await QRCode.toDataURL(qrCode, {
        width: 300,
        margin: 2,
        color: { dark: "#18181b", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });
      qrCodeHtml = `
        <div style="text-align: center; margin: 20px 0;">
          <p style="font-size: 16px; font-weight: 700; color: #18181b; margin-bottom: 12px;">🎫 Your Entry Ticket</p>
          <img src="${qrDataUrl}" alt="QR Ticket" style="width: 200px; height: 200px; border: 4px solid #18181b; border-radius: 8px;" />
          <p style="font-size: 12px; color: #666; margin-top: 8px;">Show this QR code at the venue</p>
        </div>
      `;
    }

    // Action section differs for paid vs free
    const actionHtml = isPaidPromotion
      ? `
        <!-- PAID: Payment Required -->
        <div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          <div style="font-size: 36px; margin-bottom: 8px;">💳</div>
          <h3 style="color: #92400e; margin: 0 0 8px 0; font-size: 18px;">Payment Required to Confirm</h3>
          <p style="color: #a16207; font-size: 24px; font-weight: 800; margin: 0 0 12px 0;">₹${event.ticketPrice}</p>
          <p style="color: #92400e; font-size: 14px; margin: 0 0 16px 0; line-height: 1.6;">
            A spot has opened up! Complete your payment to secure your ticket.
          </p>
          <a href="${siteUrl}/my-tickets" style="display: inline-block; background: linear-gradient(135deg, ${themeColor}, #ec4899); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Pay Now & Get Ticket →
          </a>
          <p style="color: #b45309; font-size: 12px; margin: 12px 0 0 0;">
            ⚠️ Please complete payment soon — the spot may be offered to the next person.
          </p>
        </div>
      `
      : `
        <!-- FREE: Auto-registered -->
        <div style="background: #ecfdf5; border: 2px solid #22c55e; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
          <div style="font-size: 36px; margin-bottom: 8px;">✅</div>
          <h3 style="color: #16a34a; margin: 0 0 8px 0; font-size: 18px;">You're Registered!</h3>
          <p style="color: #15803d; font-size: 14px; margin: 0; line-height: 1.6;">
            You've been automatically registered. Your QR ticket is below!
          </p>
        </div>
        ${qrCodeHtml}
      `;

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
                ${isPaidPromotion ? "Complete payment to secure your spot" : "You've been promoted from the waitlist"}
              </p>
            </div>

            <!-- Content -->
            <div style="padding: 32px;">
              <p style="font-size: 16px; color: #333;">
                Hi <strong>${attendeeName}</strong>,
              </p>
              <p style="font-size: 16px; color: #333; line-height: 1.6;">
                Great news! A spot has opened up for <strong>${event.title}</strong>! 🎊
              </p>

              <!-- Event Details -->
              <div style="background: #f9fafb; border-radius: 12px; padding: 20px; margin: 24px 0;">
                <h3 style="margin: 0 0 12px; color: ${themeColor};">${event.title}</h3>
                <p style="margin: 4px 0; color: #555;">📅 ${eventDate}</p>
                <p style="margin: 4px 0; color: #555;">📍 ${event.venue || event.city || "Online"}</p>
                ${event.ticketType === "paid" ? `<p style="margin: 4px 0; color: #555;">💰 ₹${event.ticketPrice}</p>` : ""}
              </div>

              ${actionHtml}

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

    const subject = isPaidPromotion
      ? `🎉 Spot opened for ${event.title} — Pay now to confirm!`
      : `🎉 You're registered for ${event.title}!`;

    await transporter.sendMail({
      from: `"Spott Events" <${process.env.GMAIL_USER}>`,

      to: attendeeEmail,
      subject,
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
