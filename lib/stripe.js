import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-12-18.acacia",
  typescript: false,
});

// Stripe price IDs - Update these after creating products in Stripe Dashboard
export const STRIPE_PLANS = {
  PRO_MONTHLY: {
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "price_xxx", // Update this
    name: "Pro Monthly",
    price: 9.99,
    interval: "month",
  },
};

// Check if running on localhost
export const isLocalhost = (url) => {
  return url.includes("localhost") || url.includes("127.0.0.1");
};

/**
 * Derive the base URL from the incoming request's origin/host headers.
 * This ensures Stripe always redirects back to the domain the user is on.
 */
export const getBaseUrlFromRequest = (req) => {
  // 1. Origin header (set on POST requests from the browser)
  const origin = req.headers.get?.("origin");
  if (origin && !origin.includes("localhost") && process.env.NODE_ENV === "production") {
    return origin;
  }
  if (origin && process.env.NODE_ENV !== "production") {
    return origin;
  }

  // 2. Host / x-forwarded-host header (works for both GET and POST)
  const host = req.headers.get?.("x-forwarded-host") || req.headers.get?.("host");
  if (host) {
    const proto = req.headers.get?.("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  // 3. Fallback to env-based
  return getBaseUrl();
};

// Get the base URL for redirects (env-based fallback)
export const getBaseUrl = () => {
  // 1. Explicit production URL override (set this on Vercel!)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.NODE_ENV === "production" && url.includes("localhost")) {
      console.warn("⚠️ NEXT_PUBLIC_APP_URL contains localhost in production — ignoring");
    } else {
      return url;
    }
  }

  // 2. Vercel stable production URL (not deployment-specific)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 3. Vercel deployment URL (fallback — may trigger deployment protection!)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Development default
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  throw new Error("NEXT_PUBLIC_APP_URL must be set in production");
};
