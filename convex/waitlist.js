import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Join the waitlist for a full event
export const joinWaitlist = mutation({
  args: {
    eventId: v.id("events"),
    attendeeName: v.string(),
    attendeeEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Check if event is actually full
    if (event.registrationCount < event.capacity) {
      throw new Error("Event is not full. You can register directly.");
    }

    // Check if already registered (ignore cancelled)
    const existingRegs = await ctx.db
      .query("registrations")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .collect();

    if (existingRegs.some((r) => r.status === "confirmed")) {
      throw new Error("You are already registered for this event");
    }

    // Check if already on waitlist (ignore cancelled/promoted/expired)
    const existingWaitlists = await ctx.db
      .query("waitlist")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .collect();

    if (existingWaitlists.some((w) => w.status === "waiting" || w.status === "offered")) {
      throw new Error("You are already on the waitlist for this event");
    }

    // Get current waitlist count to determine position
    const currentWaitlist = await ctx.db
      .query("waitlist")
      .withIndex("by_event_status", (q) =>
        q.eq("eventId", args.eventId).eq("status", "waiting")
      )
      .collect();

    const position = currentWaitlist.length + 1;

    const waitlistId = await ctx.db.insert("waitlist", {
      eventId: args.eventId,
      userId: user._id,
      attendeeName: args.attendeeName,
      attendeeEmail: args.attendeeEmail,
      position,
      status: "waiting",
      joinedAt: Date.now(),
    });

    return { waitlistId, position };
  },
});

// Get user's waitlist position for an event
export const getWaitlistPosition = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const entries = await ctx.db
      .query("waitlist")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .collect();

    const entry = entries.find((e) => e.status === "waiting" || e.status === "offered");
    if (!entry) return null;

    // If offered, return with offered status so UI can show payment prompt
    if (entry.status === "offered") {
      return {
        ...entry,
        position: 0, // They're next!
        totalWaiting: 0,
        isOffered: true,
      };
    }

    // Get actual position (count of waiting entries before this one)
    const allWaiting = await ctx.db
      .query("waitlist")
      .withIndex("by_event_status", (q) =>
        q.eq("eventId", args.eventId).eq("status", "waiting")
      )
      .collect();

    const sorted = allWaiting.sort((a, b) => a.joinedAt - b.joinedAt);
    const actualPosition = sorted.findIndex(
      (w) => w._id.toString() === entry._id.toString()
    ) + 1;

    return {
      ...entry,
      position: actualPosition,
      totalWaiting: allWaiting.length,
    };
  },
});

// Get waitlist count for an event (public)
export const getWaitlistCount = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const waiting = await ctx.db
      .query("waitlist")
      .withIndex("by_event_status", (q) =>
        q.eq("eventId", args.eventId).eq("status", "waiting")
      )
      .collect();

    return waiting.length;
  },
});

// Get full waitlist for an event (organizer only)
export const getEventWaitlist = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const event = await ctx.db.get(args.eventId);
    if (!event || event.organizerId !== user._id) {
      throw new Error("Unauthorized");
    }

    const waitlist = await ctx.db
      .query("waitlist")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    // Sort: waiting first (by joinedAt), then promoted, then others
    const sorted = waitlist.sort((a, b) => {
      if (a.status === "waiting" && b.status !== "waiting") return -1;
      if (a.status !== "waiting" && b.status === "waiting") return 1;
      return a.joinedAt - b.joinedAt;
    });

    return sorted;
  },
});

// Auto-promote next person from waitlist (called when someone cancels)
export const promoteNextFromWaitlist = mutation({
  args: {
    eventId: v.id("events"),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) return { promoted: false };

    // Check if there's capacity
    if (event.registrationCount >= event.capacity) {
      return { promoted: false, reason: "Event still full" };
    }

    // Get next person on waitlist
    const waitingEntries = await ctx.db
      .query("waitlist")
      .withIndex("by_event_status", (q) =>
        q.eq("eventId", args.eventId).eq("status", "waiting")
      )
      .collect();

    const sorted = waitingEntries.sort((a, b) => a.joinedAt - b.joinedAt);
    const nextInLine = sorted[0];

    if (!nextInLine) {
      return { promoted: false, reason: "No one on waitlist" };
    }

    const isFree = event.ticketType === "free";

    if (isFree) {
      // FREE EVENT: Auto-register immediately
      const qrCode = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      const registrationId = await ctx.db.insert("registrations", {
        eventId: args.eventId,
        userId: nextInLine.userId,
        attendeeName: nextInLine.attendeeName,
        attendeeEmail: nextInLine.attendeeEmail,
        qrCode,
        checkedIn: false,
        paymentMethod: "free",
        paymentStatus: "free",
        amountPaid: 0,
        status: "confirmed",
        registeredAt: Date.now(),
      });

      await ctx.db.patch(args.eventId, {
        registrationCount: event.registrationCount + 1,
      });

      await ctx.db.patch(nextInLine._id, {
        status: "promoted",
        promotedAt: Date.now(),
      });

      return {
        promoted: true,
        type: "free",
        promotedUser: {
          name: nextInLine.attendeeName,
          email: nextInLine.attendeeEmail,
          registrationId,
          qrCode,
        },
      };
    } else {
      // PAID EVENT: Mark as "offered" — they must pay first
      await ctx.db.patch(nextInLine._id, {
        status: "offered",
        offeredAt: Date.now(),
      });

      return {
        promoted: true,
        type: "paid",
        promotedUser: {
          name: nextInLine.attendeeName,
          email: nextInLine.attendeeEmail,
          waitlistId: nextInLine._id,
          eventTitle: event.title,
          ticketPrice: event.ticketPrice,
        },
      };
    }
  },
});

// Cancel waitlist entry (user leaves waitlist)
export const leaveWaitlist = mutation({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const allEntries = await ctx.db
      .query("waitlist")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .collect();

    const entry = allEntries.find((e) => e.status === "waiting" || e.status === "offered");
    if (!entry) {
      throw new Error("No active waitlist entry found");
    }

    await ctx.db.patch(entry._id, {
      status: "cancelled",
    });

    return { success: true };
  },
});

// Get user's all waitlist entries
export const getMyWaitlistEntries = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const entries = await ctx.db
      .query("waitlist")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Fetch event details
    const withEvents = await Promise.all(
      entries.map(async (entry) => {
        const event = await ctx.db.get(entry.eventId);
        return { ...entry, event };
      })
    );

    return withEvents.filter((e) => e.status === "waiting" || e.status === "offered");
  },
});
