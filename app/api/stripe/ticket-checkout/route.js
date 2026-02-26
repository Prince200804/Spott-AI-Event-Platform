import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, getBaseUrl } from "@/lib/stripe";

export async function POST(req) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventTitle, ticketPrice, registrationId, eventId } =
      await req.json();

    if (!eventTitle || !ticketPrice || !registrationId || !eventId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    // Create a one-time payment checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `Ticket: ${eventTitle}`,
              description: `Event registration ticket for ${eventTitle}`,
            },
            unit_amount: Math.round(ticketPrice * 100), // Stripe uses paise
          },
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/api/stripe/verify-ticket-payment?session_id={CHECKOUT_SESSION_ID}&registration_id=${registrationId}`,
      cancel_url: `${baseUrl}/my-tickets?payment=cancelled`,
      client_reference_id: userId,
      metadata: {
        type: "event_ticket",
        userId,
        registrationId,
        eventId,
        ticketPrice: String(ticketPrice),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Ticket checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: error.message },
      { status: 500 }
    );
  }
}
