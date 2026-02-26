"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Ticket,
  CheckCircle,
  CreditCard,
  Banknote,
  Clock,
  ListOrdered,
} from "lucide-react";
import { useConvexMutation, useConvexQuery } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useUser } from "@clerk/nextjs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function RegisterModal({ event, isOpen, onClose }) {
  const router = useRouter();
  const { user } = useUser();
  const [name, setName] = useState(user?.fullName || "");
  const [email, setEmail] = useState(
    user?.primaryEmailAddress?.emailAddress || ""
  );
  const [isSuccess, setIsSuccess] = useState(false);
  const [isWaitlistSuccess, setIsWaitlistSuccess] = useState(false);
  const [waitlistPosition, setWaitlistPosition] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(
    event.ticketType === "free" ? "free" : ""
  );
  const [isRedirecting, setIsRedirecting] = useState(false);

  const { mutate: registerForEvent, isLoading } = useConvexMutation(
    api.registrations.registerForEvent
  );
  const { mutate: joinWaitlist, isLoading: isJoiningWaitlist } = useConvexMutation(
    api.waitlist.joinWaitlist
  );

  // Check if user is already on waitlist
  const { data: existingWaitlist } = useConvexQuery(
    api.waitlist.getWaitlistPosition,
    { eventId: event._id }
  );

  // Get waitlist count
  const { data: waitlistCount } = useConvexQuery(
    api.waitlist.getWaitlistCount,
    { eventId: event._id }
  );

  const isPaid = event.ticketType === "paid";
  const isFull = event.registrationCount >= event.capacity;

  const sendConfirmationEmail = async (qrCode, method, pStatus) => {
    try {
      const emailRes = await fetch("/api/send-ticket-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendeeName: name,
          attendeeEmail: email,
          qrCode,
          paymentMethod: method,
          paymentStatus: pStatus,
          event: {
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            locationType: event.locationType,
            venue: event.venue,
            address: event.address,
            city: event.city,
            state: event.state,
            country: event.country,
            ticketType: event.ticketType,
            ticketPrice: event.ticketPrice,
            organizerName: event.organizerName,
            themeColor: event.themeColor,
          },
        }),
      });

      if (emailRes.ok) {
        toast.success("Confirmation email sent to " + email + " 📧");
      } else {
        const errData = await emailRes.json().catch(() => ({}));
        console.error("Email API error:", errData);
        toast.error(
          errData?.details
            ? "Email failed: " + errData.details
            : "Registration done, but email failed to send."
        );
      }
    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      toast.error("Registration done, but email failed to send.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    // If event is full, join waitlist instead
    if (isFull) {
      try {
        const result = await joinWaitlist({
          eventId: event._id,
          attendeeName: name,
          attendeeEmail: email,
        });
        setWaitlistPosition(result.position);
        setIsWaitlistSuccess(true);
        toast.success(`You're #${result.position} on the waitlist! 🎯`);
      } catch (error) {
        toast.error(error.message || "Failed to join waitlist");
      }
      return;
    }

    if (isPaid && !paymentMethod) {
      toast.error("Please select a payment method");
      return;
    }

    const method = isPaid ? paymentMethod : "free";

    try {
      const result = await registerForEvent({
        eventId: event._id,
        attendeeName: name,
        attendeeEmail: email,
        paymentMethod: method,
      });

      // If online payment — redirect to Stripe checkout
      if (method === "online") {
        setIsRedirecting(true);
        toast.success("Registration saved! Redirecting to payment...");

        try {
          const checkoutRes = await fetch("/api/stripe/ticket-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventTitle: event.title,
              ticketPrice: event.ticketPrice,
              registrationId: result.registrationId,
              eventId: event._id,
            }),
          });

          const checkoutData = await checkoutRes.json();

          if (checkoutRes.ok && checkoutData.url) {
            // Email will be sent after payment is confirmed via webhook
            window.location.href = checkoutData.url;
            return;
          } else {
            throw new Error(
              checkoutData.error || "Failed to create checkout session"
            );
          }
        } catch (err) {
          console.error("Checkout error:", err);
          toast.error("Payment setup failed: " + err.message);
          setIsRedirecting(false);
        }
        return;
      }

      // For free events and offline payment — show success and send email
      setIsSuccess(true);
      toast.success("Registration successful! 🎉");

      const pStatus = method === "free" ? "free" : "pending";
      await sendConfirmationEmail(result.qrCode, method, pStatus);
    } catch (error) {
      toast.error(error.message || "Registration failed");
    }
  };

  const handleViewTicket = () => {
    router.push("/my-tickets");
    onClose();
  };

  // Waitlist success state
  if (isWaitlistSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <ListOrdered className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">You&apos;re on the Waitlist!</h2>
              <p className="text-muted-foreground">
                You&apos;re <strong className="text-amber-600">#{waitlistPosition}</strong> in line for{" "}
                <strong>{event.title}</strong>.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                We&apos;ll automatically register you when a spot opens up and
                send a confirmation email to <strong>{email}</strong>.
              </p>
            </div>
            <Separator />
            <div className="w-full space-y-2">
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Already on waitlist state
  if (existingWaitlist && !isSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Already on Waitlist</h2>
              <p className="text-muted-foreground">
                You&apos;re <strong className="text-amber-600">#{existingWaitlist.position}</strong> of{" "}
                {existingWaitlist.totalWaiting} on the waitlist.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Hang tight! We&apos;ll notify you when a spot opens up.
              </p>
            </div>
            <Separator />
            <Button variant="outline" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Registration success state
  if (isSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-4 py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">You&apos;re All Set!</h2>
              <p className="text-muted-foreground">
                Your registration is confirmed. We&apos;ve sent a confirmation
                email with your QR ticket to <strong>{email}</strong>.
                {paymentMethod === "offline" && (
                  <span className="block mt-2 text-amber-600 font-medium">
                    💰 Please pay ₹{event.ticketPrice} at the venue on event
                    day.
                  </span>
                )}
              </p>
            </div>
            <Separator />
            <div className="w-full space-y-2">
              <Button className="w-full gap-2" onClick={handleViewTicket}>
                <Ticket className="w-4 h-4" />
                View My Ticket
              </Button>
              <Button variant="outline" className="w-full" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Registration form
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isFull ? "Join Waitlist" : "Register for Event"}
          </DialogTitle>
          <DialogDescription>
            {isFull
              ? `This event is full. Join the waitlist to be notified when a spot opens up.${waitlistCount ? ` ${waitlistCount} people waiting.` : ""}`
              : `Fill in your details to register for ${event.title}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <p className="font-semibold">{event.title}</p>
            {isFull && (
              <p className="text-sm text-amber-600 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Event is full — join the waitlist
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {event.ticketType === "free" ? (
                "Free Event"
              ) : (
                <span className="font-medium text-foreground">
                  Price: ₹{event.ticketPrice}
                </span>
              )}
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              required
            />
          </div>

          {/* Payment Method Selection (only for paid events that aren't full) */}
          {isPaid && !isFull && (
            <div className="space-y-3">
              <Label>Payment Method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("online")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    paymentMethod === "online"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <CreditCard
                    className={`w-6 h-6 ${paymentMethod === "online" ? "text-purple-600" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-medium ${paymentMethod === "online" ? "text-purple-600" : ""}`}
                  >
                    Pay Online
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Secure Stripe payment
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("offline")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    paymentMethod === "offline"
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                      : "border-muted hover:border-muted-foreground/30"
                  }`}
                >
                  <Banknote
                    className={`w-6 h-6 ${paymentMethod === "offline" ? "text-amber-600" : "text-muted-foreground"}`}
                  />
                  <span
                    className={`text-sm font-medium ${paymentMethod === "offline" ? "text-amber-600" : ""}`}
                  >
                    Pay at Venue
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Cash / UPI at event
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Terms */}
          <p className="text-xs text-muted-foreground">
            By registering, you agree to receive event updates and reminders via
            email.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isLoading || isRedirecting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 gap-2"
              disabled={isLoading || isRedirecting || isJoiningWaitlist || (!isFull && isPaid && !paymentMethod)}
            >
              {isLoading || isRedirecting || isJoiningWaitlist ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRedirecting ? "Redirecting..." : isJoiningWaitlist ? "Joining..." : "Registering..."}
                </>
              ) : isFull ? (
                <>
                  <ListOrdered className="w-4 h-4" />
                  Join Waitlist
                </>
              ) : (
                <>
                  {isPaid && paymentMethod === "online" ? (
                    <>
                      <CreditCard className="w-4 h-4" />
                      Pay ₹{event.ticketPrice}
                    </>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4" />
                      Register
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
