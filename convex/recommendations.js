import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { v } from "convex/values";

// Get personalized event recommendations for current user
export const getRecommendations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);

    const limit = args.limit ?? 6;
    const now = Date.now();

    // Get all upcoming events
    const allEvents = await ctx.db
      .query("events")
      .withIndex("by_start_date")
      .filter((q) => q.gte(q.field("startDate"), now))
      .collect();

    // Get user's past registrations to avoid recommending already-registered events
    const myRegistrations = await ctx.db
      .query("registrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const registeredEventIds = new Set(
      myRegistrations
        .filter((r) => r.status === "confirmed")
        .map((r) => r.eventId.toString())
    );

    // Get categories user has registered for in the past (implicit interests)
    const registeredEvents = await Promise.all(
      myRegistrations
        .filter((r) => r.status === "confirmed")
        .map((r) => ctx.db.get(r.eventId))
    );
    const pastCategoryFreq = {};
    registeredEvents.filter(Boolean).forEach((e) => {
      pastCategoryFreq[e.category] = (pastCategoryFreq[e.category] || 0) + 1;
    });

    // Filter out events user already registered for and events they organized
    const candidateEvents = allEvents.filter(
      (e) =>
        !registeredEventIds.has(e._id.toString()) &&
        e.organizerId !== user._id
    );

    // Score each event
    const scored = candidateEvents.map((event) => {
      let score = 0;
      const reasons = [];

      // 1. Category match with user interests (strongest signal)
      if (user.interests && user.interests.includes(event.category)) {
        score += 40;
        reasons.push("Matches your interests");
      }

      // 2. Category match with past registrations (behavioral signal)
      if (pastCategoryFreq[event.category]) {
        const freq = pastCategoryFreq[event.category];
        score += Math.min(freq * 10, 30); // Up to 30 points
        reasons.push("Similar to events you've attended");
      }

      // 3. Location match (city-level)
      if (user.location?.city && event.city) {
        if (
          event.city.toLowerCase() === user.location.city.toLowerCase()
        ) {
          score += 25;
          reasons.push("In your city");
        } else if (
          user.location.state &&
          event.state &&
          event.state.toLowerCase() === user.location.state.toLowerCase()
        ) {
          score += 15;
          reasons.push("In your state");
        }
      }

      // 4. Popularity bonus (social proof)
      if (event.registrationCount >= 10) {
        score += Math.min(Math.floor(event.registrationCount / 5), 15);
        reasons.push("Popular event");
      }

      // 5. Freshness bonus (recently created events)
      const daysSinceCreated =
        (now - event.createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated <= 7) {
        score += 10;
        reasons.push("New event");
      }

      // 6. Happening soon bonus
      const daysUntilEvent =
        (event.startDate - now) / (1000 * 60 * 60 * 24);
      if (daysUntilEvent <= 7) {
        score += 10;
        reasons.push("Happening soon");
      } else if (daysUntilEvent <= 14) {
        score += 5;
      }

      // 7. Free event bonus (higher accessibility)
      if (event.ticketType === "free") {
        score += 5;
        reasons.push("Free event");
      }

      // 8. Availability check - slight penalty for nearly full events
      const fillRate = event.registrationCount / event.capacity;
      if (fillRate >= 0.9) {
        score -= 5;
        reasons.push("Almost full");
      }

      // 9. Tag matching with interests
      if (user.interests && event.tags) {
        const matchingTags = event.tags.filter((tag) =>
          user.interests.some(
            (interest) =>
              tag.toLowerCase().includes(interest.toLowerCase()) ||
              interest.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (matchingTags.length > 0) {
          score += matchingTags.length * 5;
          reasons.push("Matching tags");
        }
      }

      return {
        ...event,
        recommendationScore: score,
        recommendationReasons: reasons.length > 0 ? reasons : ["Discover something new"],
      };
    });

    // Sort by score descending, then by start date
    scored.sort((a, b) => {
      if (b.recommendationScore !== a.recommendationScore) {
        return b.recommendationScore - a.recommendationScore;
      }
      return a.startDate - b.startDate;
    });

    return scored.slice(0, limit);
  },
});

// Get "Because you attended X" style recommendations
export const getSimilarEvents = query({
  args: {
    eventId: v.id("events"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 4;
    const now = Date.now();

    const sourceEvent = await ctx.db.get(args.eventId);
    if (!sourceEvent) return [];

    // Get events in same category
    const sameCategory = await ctx.db
      .query("events")
      .withIndex("by_category", (q) =>
        q.eq("category", sourceEvent.category)
      )
      .filter((q) => q.gte(q.field("startDate"), now))
      .collect();

    // Filter out the source event itself
    const filtered = sameCategory.filter(
      (e) => e._id.toString() !== args.eventId.toString()
    );

    // Score by location proximity and tag overlap
    const scored = filtered.map((event) => {
      let score = 0;

      // Same city
      if (
        event.city?.toLowerCase() === sourceEvent.city?.toLowerCase()
      ) {
        score += 20;
      }

      // Tag overlap
      if (event.tags && sourceEvent.tags) {
        const overlap = event.tags.filter((t) =>
          sourceEvent.tags.includes(t)
        );
        score += overlap.length * 10;
      }

      // Popularity
      score += Math.min(event.registrationCount, 10);

      return { ...event, similarityScore: score };
    });

    scored.sort((a, b) => b.similarityScore - a.similarityScore);

    return scored.slice(0, limit);
  },
});
