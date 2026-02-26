import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import QRCode from "qrcode";
import { sendRegistrationEmail } from "@/lib/email";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

/**
 * Find the Stripe checkout session for a registration.
 * If sessionId is provided, retrieve it directly.
 * Otherwise, search recent checkout sessions by metadata.
 */
async function findStripeSession(sessionId, registrationId) {
  if (sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch {
      // Session not found, fall through to search
    }
  }

  // No sessionId or retrieval failed — search recent checkout sessions
  const sessions = await stripe.checkout.sessions.list({
    limit: 50,
    status: "complete",
  });

  const match = sessions.data.find(
    (s) =>
      s.metadata?.type === "event_ticket" &&
      s.metadata?.registrationId === registrationId
  );

  return match || null;
}

/**
 * Helper: Mark registration paid + send confirmation email.
 * Returns { emailSent: boolean }
 */
async function verifyAndProcessPayment(registrationId, session) {
  const metadata = session.metadata || {};

  // Mark registration as paid
  await convex.mutation(api.registrations.markRegistrationPaid, {
    registrationId,
    stripePaymentId: session.id,
    amountPaid: Number(metadata.ticketPrice || 0),
  });

  console.log("✅ Registration marked as paid:", registrationId);

  // Send confirmation email
  let emailSent = false;
  try {
    const registration = await convex.query(
      api.registrations.getRegistrationById,
      { registrationId }
    );

    const eventId = metadata.eventId || String(registration?.eventId || "");
    const eventData = await convex.query(api.events.getEventById, { eventId });

    if (eventData && registration) {
      const qrCodeDataUrl = await QRCode.toDataURL(registration.qrCode, {
        width: 400,
        margin: 2,
        color: { dark: "#18181b", light: "#ffffff" },
        errorCorrectionLevel: "H",
      });

      await sendRegistrationEmail({
        to: registration.attendeeEmail,
        attendeeName: registration.attendeeName,
        event: {
          title: eventData.title,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          locationType: eventData.locationType,
          venue: eventData.venue,
          address: eventData.address,
          city: eventData.city,
          state: eventData.state,
          country: eventData.country,
          ticketType: eventData.ticketType,
          ticketPrice: eventData.ticketPrice,
          organizerName: eventData.organizerName,
          themeColor: eventData.themeColor,
        },
        qrCode: registration.qrCode,
        qrCodeDataUrl,
        paymentMethod: "online",
        paymentStatus: "paid",
      });

      emailSent = true;
      console.log("📧 Confirmation email sent to:", registration.attendeeEmail);
    }
  } catch (emailErr) {
    console.error("⚠️ Failed to send payment email:", emailErr.message);
  }

  return { emailSent };
}

/**
 * GET /api/stripe/verify-ticket-payment?session_id=...&registration_id=...
 *
 * Stripe redirects here after successful payment.
 * Verifies payment server-side, marks registration paid, sends email,
 * then redirects to /my-tickets with a status indicator.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const registrationId = searchParams.get("registration_id");
    const baseUrl = new URL("/", req.url).origin;

    if (!registrationId) {
      return NextResponse.redirect(
        new URL("/my-tickets?ticket_status=error&msg=missing_id", baseUrl)
      );
    }

    // 1. Check if already paid
    const registration = await convex.query(
      api.registrations.getRegistrationById,
      { registrationId }
    );

    if (!registration) {
      return NextResponse.redirect(
        new URL("/my-tickets?ticket_status=error&msg=not_found", baseUrl)
      );
    }

    if (registration.paymentStatus === "paid") {
      return NextResponse.redirect(
        new URL("/my-tickets?ticket_status=already_paid", baseUrl)
      );
    }

    // 2. Find and verify the Stripe checkout session
    const session = await findStripeSession(sessionId, registrationId);

    if (!session || session.payment_status !== "paid") {
      return NextResponse.redirect(
        new URL("/my-tickets?ticket_status=error&msg=payment_incomplete", baseUrl)
      );
    }

    // 3. Process payment + send email
    const { emailSent } = await verifyAndProcessPayment(registrationId, session);

    const redirectUrl = new URL("/my-tickets", baseUrl);
    redirectUrl.searchParams.set("ticket_status", "verified");
    if (emailSent) redirectUrl.searchParams.set("email_sent", "1");

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ Verify ticket payment GET error:", error);
    const baseUrl = new URL("/", req.url).origin;
    return NextResponse.redirect(
      new URL("/my-tickets?ticket_status=error&msg=server_error", baseUrl)
    );
  }
}

/**
 * POST /api/stripe/verify-ticket-payment
 * Fallback for client-side verification (e.g., old redirects).
 */
export async function POST(req) {
  try {
    const { sessionId, registrationId } = await req.json();

    if (!registrationId) {
      return NextResponse.json(
        { error: "Missing registrationId" },
        { status: 400 }
      );
    }

    // 1. Check current registration status
    const registration = await convex.query(
      api.registrations.getRegistrationById,
      { registrationId }
    );

    if (!registration) {
      return NextResponse.json(
        { error: "Registration not found" },
        { status: 404 }
      );
    }

    if (registration.paymentStatus === "paid") {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        message: "Payment was already verified",
      });
    }

    // 2. Find and verify the Stripe session
    const session = await findStripeSession(sessionId, registrationId);

    if (!session) {
      return NextResponse.json(
        { error: "No matching Stripe session found" },
        { status: 404 }
      );
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed" },
        { status: 400 }
      );
    }

    // 3. Process payment + send email
    const { emailSent } = await verifyAndProcessPayment(registrationId, session);

    return NextResponse.json({
      success: true,
      alreadyPaid: false,
      emailSent,
      message: "Payment verified and registration updated",
    });
  } catch (error) {
    console.error("❌ Verify ticket payment POST error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment", details: error.message },
      { status: 500 }
    );
  }
}
