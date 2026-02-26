import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

// TEST ENDPOINT - Enable Pro for current user
export async function POST(req) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("🧪 TEST: Enabling Pro for user:", userId);

    // Update user subscription status to active
    await convex.mutation(api.users.updateSubscription, {
      clerkUserId: userId,
      stripeCustomerId: "test_customer_" + userId,
      stripeSubscriptionId: "test_sub_" + Date.now(),
      stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
      stripeSubscriptionStatus: "active",
      subscriptionEndsAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
    });

    console.log("✅ TEST: Pro status enabled for user:", userId);

    return NextResponse.json({ 
      success: true, 
      message: "Pro status enabled for testing. Refresh the page to see changes." 
    });
  } catch (error) {
    console.error("❌ TEST: Error enabling Pro:", error);
    return NextResponse.json(
      { error: "Failed to enable Pro: " + error.message },
      { status: 500 }
    );
  }
}
