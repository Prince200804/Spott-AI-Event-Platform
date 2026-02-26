import nodemailer from "nodemailer";

// Create reusable transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, NOT your Gmail password
  },
});

/**
 * Send registration confirmation email with QR ticket
 */
export async function sendRegistrationEmail({
  to,
  attendeeName,
  event,
  qrCode,
  qrCodeDataUrl, // base64 data URL of the QR code image
  paymentMethod = "free", // "free" | "online" | "offline"
  paymentStatus = "free", // "free" | "paid" | "pending"
}) {
  const eventDate = new Date(event.startDate).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const eventTime = new Date(event.startDate).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime = new Date(event.endDate).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const location =
    event.locationType === "physical"
      ? `${event.venue || ""}${event.address ? `, ${event.address}` : ""}, ${event.city}, ${event.state ? `${event.state}, ` : ""}${event.country}`
      : "Online Event";

  const themeColor = event.themeColor || "#7c3aed";

  // Extract base64 data from data URL for embedding
  const qrBase64 = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");

  // Payment status display
  let paymentBadgeHtml = "";
  if (event.ticketType === "free" || paymentStatus === "free") {
    paymentBadgeHtml = `
      <p style="color: #18181b; font-size: 14px; font-weight: 600; margin: 0;">
        Free Entry
      </p>`;
  } else if (paymentStatus === "paid") {
    paymentBadgeHtml = `
      <p style="color: #16a34a; font-size: 14px; font-weight: 600; margin: 0;">
        ✅ Payment Complete — ₹${event.ticketPrice}
      </p>
      <p style="color: #71717a; font-size: 12px; margin: 4px 0 0 0;">Paid online via Stripe</p>`;
  } else {
    // pending / offline
    paymentBadgeHtml = `
      <p style="color: #d97706; font-size: 14px; font-weight: 600; margin: 0;">
        ⚠️ Payment Pending — ₹${event.ticketPrice}
      </p>
      <p style="color: #92400e; font-size: 12px; margin: 4px 0 0 0;">Please pay at the venue (Cash / UPI)</p>`;
  }

  // Payment notice banner for pending
  const paymentNoticeBanner =
    paymentStatus === "pending"
      ? `
          <tr>
            <td style="padding: 0 32px 16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fffbeb; border: 2px solid #f59e0b; border-radius: 12px; padding: 20px;">
                <tr>
                  <td align="center">
                    <p style="color: #92400e; font-size: 18px; font-weight: 700; margin: 0 0 8px 0;">💰 Payment Required</p>
                    <p style="color: #a16207; font-size: 24px; font-weight: 800; margin: 0 0 8px 0;">₹${event.ticketPrice}</p>
                    <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.6;">
                      Please pay this amount at the venue on the day of the event.<br/>
                      Accepted: Cash, UPI, or any digital payment at the venue.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, ${themeColor}, #ec4899); padding: 40px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">🎉 You're In!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 16px;">Registration Confirmed</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              <p style="color: #18181b; font-size: 16px; margin: 0 0 8px 0;">Hi <strong>${attendeeName}</strong>,</p>
              <p style="color: #52525b; font-size: 14px; margin: 0; line-height: 1.6;">
                Your registration for the event below is confirmed. Show the QR code at the venue for check-in.
              </p>
            </td>
          </tr>

          ${paymentNoticeBanner}

          <!-- Event Details Card -->
          <tr>
            <td style="padding: 16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf5ff; border: 1px solid #e9d5ff; border-radius: 12px; padding: 24px;">
                <tr>
                  <td>
                    <h2 style="color: #18181b; font-size: 20px; margin: 0 0 20px 0; font-weight: 700;">${event.title}</h2>
                    
                    <!-- Date -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: top;">
                          <span style="font-size: 18px;">📅</span>
                        </td>
                        <td>
                          <p style="color: #18181b; font-size: 14px; font-weight: 600; margin: 0;">${eventDate}</p>
                          <p style="color: #71717a; font-size: 13px; margin: 2px 0 0 0;">${eventTime} — ${endTime}</p>
                        </td>
                      </tr>
                    </table>
                    
                    <!-- Location -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: top;">
                          <span style="font-size: 18px;">📍</span>
                        </td>
                        <td>
                          <p style="color: #18181b; font-size: 14px; font-weight: 600; margin: 0;">${location}</p>
                        </td>
                      </tr>
                    </table>

                    <!-- Payment Status -->
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: top;">
                          <span style="font-size: 18px;">🎟️</span>
                        </td>
                        <td>
                          ${paymentBadgeHtml}
                        </td>
                      </tr>
                    </table>

                    <!-- Organizer -->
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: top;">
                          <span style="font-size: 18px;">👤</span>
                        </td>
                        <td>
                          <p style="color: #18181b; font-size: 14px; font-weight: 600; margin: 0;">Organized by ${event.organizerName}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- QR Code Ticket -->
          <tr>
            <td style="padding: 16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px dashed #d4d4d8; border-radius: 12px; padding: 24px; text-align: center;">
                <tr>
                  <td align="center">
                    <p style="color: #18181b; font-size: 16px; font-weight: 700; margin: 0 0 4px 0;">🎫 Your Entry Ticket</p>
                    <p style="color: #71717a; font-size: 12px; margin: 0 0 16px 0;">Show this QR code at the venue for check-in</p>
                    <img src="cid:qrcode" alt="QR Code Ticket" width="200" height="200" style="border: 4px solid #18181b; border-radius: 8px;" />
                    <p style="color: #a1a1aa; font-size: 11px; margin: 12px 0 0 0; font-family: monospace; letter-spacing: 1px;">${qrCode}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Important Notes -->
          <tr>
            <td style="padding: 16px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #fefce8; border: 1px solid #fde68a; border-radius: 8px; padding: 16px;">
                <tr>
                  <td>
                    <p style="color: #92400e; font-size: 13px; font-weight: 600; margin: 0 0 8px 0;">⚠️ Important:</p>
                    <ul style="color: #a16207; font-size: 12px; margin: 0; padding-left: 16px; line-height: 1.8;">
                      <li>Please arrive 15 minutes before the event starts.</li>
                      <li>Keep this email handy — you'll need the QR code for entry.</li>
                      <li>Screenshot the QR code in case you don't have internet at the venue.</li>
                      ${paymentStatus === "pending" ? '<li style="font-weight: 600;">Don\'t forget to carry ₹' + event.ticketPrice + ' for payment at the venue.</li>' : ""}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; text-align: center; border-top: 1px solid #e4e4e7;">
              <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 4px 0;">
                This email was sent by <strong style="color: #7c3aed;">Spott</strong> — Your Event Platform
              </p>
              <p style="color: #d4d4d8; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} Spott. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const mailOptions = {
    from: `"Spott Events" <${process.env.GMAIL_USER}>`,
    to,
    subject: `🎫 Your Ticket for "${event.title}" — Registration Confirmed!`,
    html,
    attachments: [
      {
        filename: "qr-ticket.png",
        content: qrBase64,
        encoding: "base64",
        cid: "qrcode", // Referenced in the HTML as cid:qrcode
      },
    ],
  };

  const info = await transporter.sendMail(mailOptions);
  console.log("✅ Registration email sent:", info.messageId);
  return info;
}
