import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { sendRegistrationEmail } from "@/lib/email";

export async function POST(req) {
  try {
    const { attendeeName, attendeeEmail, qrCode, event, paymentMethod, paymentStatus } = await req.json();

    // Validate required fields
    if (!attendeeName || !attendeeEmail || !qrCode || !event) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate QR code as base64 data URL (PNG)
    const qrCodeDataUrl = await QRCode.toDataURL(qrCode, {
      width: 400,
      margin: 2,
      color: {
        dark: "#18181b",
        light: "#ffffff",
      },
      errorCorrectionLevel: "H",
    });

    // Send the email
    await sendRegistrationEmail({
      to: attendeeEmail,
      attendeeName,
      event,
      qrCode,
      qrCodeDataUrl,
      paymentMethod: paymentMethod || "free",
      paymentStatus: paymentStatus || "free",
    });

    return NextResponse.json({
      success: true,
      message: "Confirmation email sent successfully",
    });
  } catch (error) {
    console.error("❌ Error sending registration email:", error);
    return NextResponse.json(
      {
        error: "Failed to send email",
        details: error?.message || String(error),
        code: error?.code || "UNKNOWN",
      },
      { status: 500 }
    );
  }
}
