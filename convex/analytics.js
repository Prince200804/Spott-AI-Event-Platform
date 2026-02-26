import { internal } from "./_generated/api";
import { query } from "./_generated/server";
import { v } from "convex/values";

// Get registration trend data (registrations over time)
export const getRegistrationTrend = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.organizerId !== user._id) {
      throw new Error("Unauthorized");
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const confirmed = registrations.filter((r) => r.status === "confirmed");

    // Group registrations by day
    const dailyMap = {};
    confirmed.forEach((reg) => {
      const date = new Date(reg.registeredAt);
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, registrations: 0, revenue: 0 };
      }
      dailyMap[dayKey].registrations += 1;
      if (reg.paymentStatus === "paid" && reg.amountPaid) {
        dailyMap[dayKey].revenue += reg.amountPaid;
      }
    });

    // Sort by date and add cumulative count
    const sorted = Object.values(dailyMap).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    let cumulative = 0;
    sorted.forEach((d) => {
      cumulative += d.registrations;
      d.cumulative = cumulative;
    });

    return sorted;
  },
});

// Get payment analytics breakdown
export const getPaymentAnalytics = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.organizerId !== user._id) {
      throw new Error("Unauthorized");
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const confirmed = registrations.filter((r) => r.status === "confirmed");

    // Payment method breakdown
    const methodCounts = { online: 0, offline: 0, free: 0 };
    const statusCounts = { paid: 0, pending: 0, free: 0 };

    confirmed.forEach((reg) => {
      const method = reg.paymentMethod || "free";
      methodCounts[method] = (methodCounts[method] || 0) + 1;
      const status = reg.paymentStatus || "free";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const methodData = Object.entries(methodCounts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name === "online" ? "Online" : name === "offline" ? "At Venue" : "Free",
        value,
      }));

    const statusData = Object.entries(statusCounts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name: name === "paid" ? "Paid" : name === "pending" ? "Pending" : "Free",
        value,
        fill:
          name === "paid"
            ? "#22c55e"
            : name === "pending"
              ? "#f59e0b"
              : "#8b5cf6",
      }));

    return { methodData, statusData };
  },
});

// Get check-in timeline (for event day)
export const getCheckInTimeline = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.organizerId !== user._id) {
      throw new Error("Unauthorized");
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const checkedIn = registrations.filter(
      (r) => r.checkedIn && r.checkedInAt && r.status === "confirmed"
    );

    // Group check-ins by hour
    const hourMap = {};
    checkedIn.forEach((reg) => {
      const date = new Date(reg.checkedInAt);
      const hourKey = `${String(date.getHours()).padStart(2, "0")}:00`;
      if (!hourMap[hourKey]) {
        hourMap[hourKey] = { time: hourKey, checkIns: 0 };
      }
      hourMap[hourKey].checkIns += 1;
    });

    const sorted = Object.values(hourMap).sort((a, b) =>
      a.time.localeCompare(b.time)
    );

    let cumulative = 0;
    sorted.forEach((d) => {
      cumulative += d.checkIns;
      d.cumulative = cumulative;
    });

    return sorted;
  },
});

// Get geographic distribution of attendees
export const getGeographicDistribution = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.organizerId !== user._id) {
      throw new Error("Unauthorized");
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const confirmed = registrations.filter((r) => r.status === "confirmed");

    // Fetch user data for each registration to get their location
    const cityMap = {};
    for (const reg of confirmed) {
      const regUser = await ctx.db.get(reg.userId);
      if (regUser?.location?.city) {
        const city = regUser.location.city;
        if (!cityMap[city]) {
          cityMap[city] = { city, count: 0 };
        }
        cityMap[city].count += 1;
      } else {
        if (!cityMap["Unknown"]) {
          cityMap["Unknown"] = { city: "Unknown", count: 0 };
        }
        cityMap["Unknown"].count += 1;
      }
    }

    return Object.values(cityMap).sort((a, b) => b.count - a.count);
  },
});

// Get hourly registration pattern (which hours get most signups)
export const getRegistrationHeatmap = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUserInternal);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.organizerId !== user._id) {
      throw new Error("Unauthorized");
    }

    const registrations = await ctx.db
      .query("registrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();

    const confirmed = registrations.filter((r) => r.status === "confirmed");

    // Day of week distribution
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayMap = {};
    dayNames.forEach((d) => {
      dayMap[d] = { day: d, registrations: 0 };
    });

    confirmed.forEach((reg) => {
      const date = new Date(reg.registeredAt);
      const day = dayNames[date.getDay()];
      dayMap[day].registrations += 1;
    });

    return Object.values(dayMap);
  },
});
