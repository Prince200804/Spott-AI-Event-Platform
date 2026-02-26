import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Generate unique QR code ID
function generateQRCode() {
  return `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

// Register for an event
export const registerForEvent = mutation({
  args: {
    eventId: v.id("events"),
    attendeeName: v.string(),
    attendeeEmail: v.string(),
    paymentMethod: v.union(v.literal("online"), v.literal("offline"), v.literal("free")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Check if event is full
    if (event.registrationCount >= event.capacity) {
      throw new Error("Event is full");
    }

    // Check if user already registered
    const existingRegistration = await ctx.db
      .query("registrations")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .unique();

    if (existingRegistration) {
      throw new Error("You are already registered for this event");
    }

    // Determine payment status
    const isFree = event.ticketType === "free" || args.paymentMethod === "free";
    const paymentStatus = isFree ? "free" : args.paymentMethod === "online" ? "pending" : "pending";

    // Create registration
    const qrCode = generateQRCode();
    const registrationId = await ctx.db.insert("registrations", {
      eventId: args.eventId,
      userId: user._id,
      attendeeName: args.attendeeName,
      attendeeEmail: args.attendeeEmail,
      qrCode: qrCode,
      checkedIn: false,
      paymentMethod: isFree ? "free" : args.paymentMethod,
      paymentStatus: isFree ? "free" : "pending",
      amountPaid: isFree ? 0 : undefined,
      status: "confirmed",
      registeredAt: Date.now(),
    });

    // Update event registration count
    await ctx.db.patch(args.eventId, {
      registrationCount: event.registrationCount + 1,
    });

    return { registrationId, qrCode };
  },
});

// Mark registration as paid (called after successful Stripe payment)
export const markRegistrationPaid = mutation({
  args: {
    registrationId: v.id("registrations"),
    stripePaymentId: v.string(),
    amountPaid: v.number(),
  },
  handler: async (ctx, args) => {
    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error("Registration not found");
    }

    await ctx.db.patch(args.registrationId, {
      paymentStatus: "paid",
      stripePaymentId: args.stripePaymentId,
      amountPaid: args.amountPaid,
      paidAt: Date.now(),
    });

    return { success: true };
  },
});

// Mark registration as paid by organizer (manual / offline)
export const markOfflinePaid = mutation({
  args: {
    registrationId: v.id("registrations"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error("Registration not found");
    }

    const event = await ctx.db.get(registration.eventId);
    if (!event || event.organizerId !== user._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.registrationId, {
      paymentStatus: "paid",
      amountPaid: event.ticketPrice || 0,
      paidAt: Date.now(),
    });

    return { success: true };
  },
});

// Check if user is registered for an event
export const checkRegistration = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return null;

    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .unique();

    return registration;
  },
});

// Get user's registrations (tickets)
export const getMyRegistrations = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    if (!user) return [];

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    // Fetch event details for each registration
    const registrationsWithEvents = await Promise.all(
      registrations.map(async (reg) => {
        const event = await ctx.db.get(reg.eventId);
        return {
          ...reg,
          event,
        };
      })
    );

    return registrationsWithEvents;
  },
});

// Cancel registration (triggers waitlist auto-promotion)
export const cancelRegistration = mutation({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const registration = await ctx.db.get(args.registrationId);
    if (!registration) {
      throw new Error("Registration not found");
    }

    // Check if user owns this registration
    if (registration.userId !== user._id) {
      throw new Error("You are not authorized to cancel this registration");
    }

    const event = await ctx.db.get(registration.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Update registration status
    await ctx.db.patch(args.registrationId, {
      status: "cancelled",
    });

    // Decrement event registration count
    if (event.registrationCount > 0) {
      await ctx.db.patch(registration.eventId, {
        registrationCount: event.registrationCount - 1,
      });
    }

    // Auto-promote next person from waitlist
    const waitingEntries = await ctx.db
      .query("waitlist")
      .withIndex("by_event_status", (q) =>
        q.eq("eventId", registration.eventId).eq("status", "waiting")
      )
      .collect();

    const sorted = waitingEntries.sort((a, b) => a.joinedAt - b.joinedAt);
    const nextInLine = sorted[0];

    if (nextInLine) {
      const isFree = event.ticketType === "free";

      if (isFree) {
        // FREE EVENT: Auto-register the promoted person immediately
        const qrCode = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        await ctx.db.insert("registrations", {
          eventId: registration.eventId,
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

        // Re-increment count (was decremented above, now filled by promoted user)
        const currentEvent = await ctx.db.get(registration.eventId);
        if (currentEvent) {
          await ctx.db.patch(registration.eventId, {
            registrationCount: currentEvent.registrationCount + 1,
          });
        }

        // Mark waitlist entry as promoted
        await ctx.db.patch(nextInLine._id, {
          status: "promoted",
          promotedAt: Date.now(),
        });

        return {
          success: true,
          cancelledRegistration: registration,
          promoted: {
            type: "free",
            name: nextInLine.attendeeName,
            email: nextInLine.attendeeEmail,
            qrCode,
          },
        };
      } else {
        // PAID EVENT: Mark waitlist entry as "offered" — they must pay first
        await ctx.db.patch(nextInLine._id, {
          status: "offered",
          offeredAt: Date.now(),
        });

        return {
          success: true,
          cancelledRegistration: registration,
          promoted: {
            type: "paid",
            name: nextInLine.attendeeName,
            email: nextInLine.attendeeEmail,
            waitlistId: nextInLine._id,
            eventTitle: event.title,
            ticketPrice: event.ticketPrice,
          },
        };
      }
    }

    return { success: true, cancelledRegistration: registration, promoted: null };
  },
});

// Get registrations for an event (for organizers)
export const getEventRegistrations = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const event = await ctx.db.get(args.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Check if user is the organizer
    if (event.organizerId !== user._id) {
      throw new Error("You are not authorized to view registrations");
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    return registrations;
  },
});

// Check-in attendee with QR code
export const checkInAttendee = mutation({
  args: { qrCode: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const registration = await ctx.db
      .query("registrations")
      .withIndex("by_qr_code", (q) => q.eq("qrCode", args.qrCode))
      .unique();

    if (!registration) {
      throw new Error("Invalid QR code");
    }

    const event = await ctx.db.get(registration.eventId);
    if (!event) {
      throw new Error("Event not found");
    }

    // Check if user is the organizer
    if (event.organizerId !== user._id) {
      throw new Error("You are not authorized to check in attendees");
    }

    // Check if already checked in
    if (registration.checkedIn) {
      return {
        success: false,
        message: "Already checked in",
        registration,
      };
    }

    // Check in
    await ctx.db.patch(registration._id, {
      checkedIn: true,
      checkedInAt: Date.now(),
    });

    return {
      success: true,
      message: "Check-in successful",
      registration: {
        ...registration,
        checkedIn: true,
        checkedInAt: Date.now(),
      },
    };
  },
});

// Get a single registration by ID (used by webhook for email after payment)
export const getRegistrationById = query({
  args: { registrationId: v.id("registrations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.registrationId);
  },
});

// Register a waitlist-promoted person for a paid event (called after they decide to pay)
export const registerFromWaitlist = mutation({
  args: {
    eventId: v.id("events"),
    paymentMethod: v.union(v.literal("online"), v.literal("offline")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    // Find user's waitlist entry that has "offered" status
    const waitlistEntry = await ctx.db
      .query("waitlist")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", user._id)
      )
      .unique();

    if (!waitlistEntry || waitlistEntry.status !== "offered") {
      throw new Error("No active offer found. The spot may have expired.");
    }

    // Generate QR code
    const qrCode = `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create registration
    const registrationId = await ctx.db.insert("registrations", {
      eventId: args.eventId,
      userId: user._id,
      attendeeName: waitlistEntry.attendeeName,
      attendeeEmail: waitlistEntry.attendeeEmail,
      qrCode,
      checkedIn: false,
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentMethod === "online" ? "pending" : "pending",
      status: "confirmed",
      registeredAt: Date.now(),
    });

    // Increment event registration count
    await ctx.db.patch(args.eventId, {
      registrationCount: event.registrationCount + 1,
    });

    // Mark waitlist entry as promoted
    await ctx.db.patch(waitlistEntry._id, {
      status: "promoted",
      promotedAt: Date.now(),
    });

    return { registrationId, qrCode };
  },
});
