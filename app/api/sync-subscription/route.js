import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// Check if user has active Stripe subscription and sync with database
export async function POST(req) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🔄 Syncing Stripe subscription for user:", userId);

    // Get all customers from Stripe and find this user
    const customers = await stripe.customers.list({
      limit: 100,
    });

    // Find customer by metadata or email
    let customer = null;
    for (const cust of customers.data) {
      // Check if this customer was created with this user's reference
      const sessions = await stripe.checkout.sessions.list({
        customer: cust.id,
        limit: 10,
      });
      
      const userSession = sessions.data.find(s => s.client_reference_id === userId);
      if (userSession) {
        customer = cust;
        break;
      }
    }

    if (!customer) {
      return NextResponse.json(
        { error: "No Stripe customer found. Please complete a payment first." },
        { status: 404 }
      );
    }

    console.log("✅ Found Stripe customer:", customer.id);

    // Get active subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 10,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      );
    }

    const subscription = subscriptions.data[0];
    console.log("✅ Found active subscription:", subscription.id);

    // Update user in Convex
    await convex.mutation(api.users.updateSubscription, {
      clerkUserId: userId,
      stripeCustomerId: customer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0].price.id,
      stripeSubscriptionStatus: subscription.status,
      subscriptionEndsAt: subscription.current_period_end * 1000,
    });

    console.log("✅ Subscription synced successfully");

    return NextResponse.json({
      success: true,
      message: "Pro subscription activated! Refresh the page to see changes.",
      subscription: {
        status: subscription.status,
        endsAt: new Date(subscription.current_period_end * 1000).toLocaleDateString(),
      },
    });
  } catch (error) {
    console.error("❌ Error syncing subscription:", error);
    return NextResponse.json(
      { error: "Failed to sync subscription: " + error.message },
      { status: 500 }
    );
  }
}
