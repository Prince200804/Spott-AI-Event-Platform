import { internal } from "./_generated/api";
import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Store or update user from Clerk
export const store = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Called storeUser without authentication present");
    }

    // Check if we've already stored this identity before
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (user !== null) {
      // If we've seen this identity before but details changed, update them
      const updates = {};
      if (user.name !== identity.name) {
        updates.name = identity.name ?? "Anonymous";
      }
      if (user.email !== identity.email) {
        updates.email = identity.email ?? "";
      }
      if (user.imageUrl !== identity.pictureUrl) {
        updates.imageUrl = identity.pictureUrl;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Date.now();
        await ctx.db.patch(user._id, updates);
      }

      return user._id;
    }

    // If it's a new identity, create a new user with defaults
    return await ctx.db.insert("users", {
      email: identity.email ?? "",
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name ?? "Anonymous",
      imageUrl: identity.pictureUrl,
      hasCompletedOnboarding: false,
      freeEventsCreated: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get current authenticated user
export const getCurrentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // 🔹 Lookup by tokenIdentifier
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      // User not found - this is normal for new users who haven't been stored yet
      // Return null so the frontend can call the store mutation
      console.log("User not found in database yet, identity:", identity.tokenIdentifier);
      return null;
    }

    // Add hasPro status based on Stripe subscription
    const hasPro =
      user.stripeSubscriptionStatus === "active" ||
      user.stripeSubscriptionStatus === "trialing";

    return {
      ...user,
      hasPro,
    };
  },
});

// Internal version for use in mutations
export const getCurrentUserInternal = internalQuery({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("User not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    // Add hasPro status based on Stripe subscription
    const hasPro =
      user.stripeSubscriptionStatus === "active" ||
      user.stripeSubscriptionStatus === "trialing";

    return {
      ...user,
      hasPro,
    };
  },
});

// Complete onboarding (attendee preferences)
export const completeOnboarding = mutation({
  args: {
    location: v.object({
      city: v.string(),
      state: v.optional(v.string()), // Added state field
      country: v.string(),
    }),
    interests: v.array(v.string()), // Min 3 categories
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    await ctx.db.patch(user._id, {
      location: args.location,
      interests: args.interests,
      hasCompletedOnboarding: true,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});


// Update user subscription (called by Stripe webhook)
export const updateSubscription = mutation({
  args: {
    clerkUserId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    stripeSubscriptionStatus: v.string(),
    subscriptionEndsAt: v.number(),
  },
  handler: async (ctx, args) => {
    console.log("🔍 Looking for user with Clerk ID:", args.clerkUserId);
    
    // Clerk tokenIdentifier format: "https://domain#user_id" or just "user_id"
    // We need to find the user regardless of format
    const users = await ctx.db.query("users").collect();
    
    const user = users.find(u => 
      u.tokenIdentifier === args.clerkUserId || 
      u.tokenIdentifier.endsWith("#" + args.clerkUserId) ||
      u.tokenIdentifier.includes(args.clerkUserId)
    );

    if (!user) {
      console.error("❌ User not found with Clerk ID:", args.clerkUserId);
      console.log("Available tokenIdentifiers:", users.map(u => u.tokenIdentifier).slice(0, 3));
      throw new Error("User not found with Clerk ID: " + args.clerkUserId);
    }

    console.log("✅ Found user:", user._id, "Email:", user.email);
    console.log("📝 Updating subscription status to:", args.stripeSubscriptionStatus);

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripeSubscriptionStatus: args.stripeSubscriptionStatus,
      subscriptionEndsAt: args.subscriptionEndsAt,
      updatedAt: Date.now(),
    });

    console.log("✅ User subscription updated successfully");
    return user._id;
  },
});

// Update subscription status (called by Stripe webhook)
export const updateSubscriptionStatus = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    status: v.string(),
    subscriptionEndsAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Find user by subscription ID
    const user = await ctx.db
      .query("users")
      .filter((q) =>
        q.eq(q.field("stripeSubscriptionId"), args.stripeSubscriptionId)
      )
      .unique();

    if (!user) {
      throw new Error("User not found with this subscription ID");
    }

    await ctx.db.patch(user._id, {
      stripeSubscriptionStatus: args.status,
      subscriptionEndsAt: args.subscriptionEndsAt,
      updatedAt: Date.now(),
    });

    return user._id;
  },
});
