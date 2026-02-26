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

// Get the base URL for redirects
export const getBaseUrl = () => {
  // In production on Vercel, always prefer VERCEL_URL to avoid localhost leaks
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Allow explicit override (but skip if it's localhost in production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    if (process.env.NODE_ENV === "production" && url.includes("localhost")) {
      console.warn("⚠️ NEXT_PUBLIC_APP_URL contains localhost in production — ignoring");
    } else {
      return url;
    }
  }
  
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  
  throw new Error("NEXT_PUBLIC_APP_URL must be set in production");
};
