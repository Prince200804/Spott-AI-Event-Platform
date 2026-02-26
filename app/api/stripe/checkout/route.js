import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe, STRIPE_PLANS, getBaseUrl } from "@/lib/stripe";

export async function POST(req) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId, plan } = await req.json();

    // Validate plan
    if (!priceId || !plan) {
      return NextResponse.json(
        { error: "Missing priceId or plan" },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl();

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId: userId,
        plan: plan,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: error.message },
      { status: 500 }
    );
  }
}
