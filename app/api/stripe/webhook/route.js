import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import QRCode from "qrcode";
import { sendRegistrationEmail } from "@/lib/email";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

export async function POST(req) {
  // In Next.js App Router, use req.text() to get the raw body string
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // Handle the event
  try {
    console.log("📥 Webhook event received:", event.type);
    
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const metadata = session.metadata || {};

        // ── Ticket payment (one-time) ──
        if (metadata.type === "event_ticket") {
          console.log("🎫 Ticket payment completed:", {
            registrationId: metadata.registrationId,
            amount: session.amount_total,
          });

          await convex.mutation(api.registrations.markRegistrationPaid, {
            registrationId: metadata.registrationId,
            stripePaymentId: session.id,
            amountPaid: Number(metadata.ticketPrice),
          });

          console.log("✅ Registration marked as paid:", metadata.registrationId);

          // Send confirmation email with "paid" status
          try {
            // Fetch registration to get attendee info and QR code
            const registration = await convex.query(
              api.registrations.getRegistrationById,
              { registrationId: metadata.registrationId }
            );

            if (registration) {
              // Fetch event details
              const eventData = await convex.query(
                api.events.getEventById,
                { eventId: metadata.eventId }
              );

              if (eventData) {
                // Generate QR code image
                const qrCodeDataUrl = await QRCode.toDataURL(
                  registration.qrCode,
                  {
                    width: 400,
                    margin: 2,
                    color: { dark: "#18181b", light: "#ffffff" },
                    errorCorrectionLevel: "H",
                  }
                );

                await sendRegistrationEmail({
                  to: registration.attendeeEmail,
                  attendeeName: registration.attendeeName,
                  event: {
                    title: eventData.title,
                    startDate: eventData.startDate,
                    endDate: eventData.endDate,
                    locationType: eventData.locationType,
                    venue: eventData.venue,
                    address: eventData.address,
                    city: eventData.city,
                    state: eventData.state,
                    country: eventData.country,
                    ticketType: eventData.ticketType,
                    ticketPrice: eventData.ticketPrice,
                    organizerName: eventData.organizerName,
                    themeColor: eventData.themeColor,
                  },
                  qrCode: registration.qrCode,
                  qrCodeDataUrl,
                  paymentMethod: "online",
                  paymentStatus: "paid",
                });

                console.log("📧 Payment confirmation email sent to:", registration.attendeeEmail);
              }
            }
          } catch (emailErr) {
            // Don't fail the webhook if email fails
            console.error("⚠️ Failed to send payment email:", emailErr.message);
          }

          break;
        }

        // ── Pro subscription checkout ──
        const clerkUserId = session.client_reference_id;
        
        console.log("💳 Checkout session:", {
          sessionId: session.id,
          clerkUserId,
          customer: session.customer,
          subscription: session.subscription,
          paymentStatus: session.payment_status,
        });
        
        if (!clerkUserId) {
          console.error("❌ No userId in session");
          throw new Error("No userId in session");
        }

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription
        );

        console.log("📋 Subscription details:", {
          id: subscription.id,
          status: subscription.status,
          priceId: subscription.items.data[0].price.id,
        });

        // Update user in Convex using Clerk userId
        const result = await convex.mutation(api.users.updateSubscription, {
          clerkUserId,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0].price.id,
          stripeSubscriptionStatus: subscription.status,
          subscriptionEndsAt: subscription.current_period_end * 1000,
        });

        console.log("✅ User updated in Convex:", result);
        console.log("✅ Checkout completed for user:", clerkUserId);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        
        // Update subscription status in Convex
        await convex.mutation(api.users.updateSubscriptionStatus, {
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          subscriptionEndsAt: subscription.current_period_end * 1000,
        });

        console.log("✅ Subscription updated:", subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        
        // Cancel subscription in Convex
        await convex.mutation(api.users.updateSubscriptionStatus, {
          stripeSubscriptionId: subscription.id,
          status: "canceled",
          subscriptionEndsAt: subscription.ended_at * 1000,
        });

        console.log("✅ Subscription canceled:", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscription = await stripe.subscriptions.retrieve(
          invoice.subscription
        );

        // Update subscription status
        await convex.mutation(api.users.updateSubscriptionStatus, {
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          subscriptionEndsAt: subscription.current_period_end * 1000,
        });

        console.log("⚠️ Payment failed for subscription:", subscription.id);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook handler failed", details: error.message },
      { status: 500 }
    );
  }
}
