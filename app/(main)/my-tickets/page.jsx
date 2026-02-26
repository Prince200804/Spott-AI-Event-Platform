/* eslint-disable react-hooks/purity */
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Calendar, MapPin, Loader2, Ticket, Clock, X } from "lucide-react";
import { useConvexQuery, useConvexMutation } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import EventCard from "@/components/event-card";

function MyTicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedTicket, setSelectedTicket] = useState(null);

  const { data: registrations, isLoading } = useConvexQuery(
    api.registrations.getMyRegistrations
  );

  const { mutate: cancelRegistration, isLoading: isCancelling } =
    useConvexMutation(api.registrations.cancelRegistration);

  // Fetch waitlist entries
  const { data: waitlistEntries } = useConvexQuery(
    api.waitlist.getMyWaitlistEntries
  );
  const { mutate: leaveWaitlist, isLoading: isLeavingWaitlist } =
    useConvexMutation(api.waitlist.leaveWaitlist);

  // ── Handle ticket status from verify redirect ──
  useEffect(() => {
    const ticketStatus = searchParams.get("ticket_status");
    const emailSent = searchParams.get("email_sent");
    const payment = searchParams.get("payment");

    if (ticketStatus) {
      // Clean URL immediately
      window.history.replaceState(null, "", "/my-tickets");

      switch (ticketStatus) {
        case "verified":
          toast.success("Payment verified! Your ticket is confirmed 🎉");
          if (emailSent === "1") {
            toast.success("Confirmation email sent! 📧", { duration: 4000 });
          }
          break;
        case "already_paid":
          toast.success("Payment already confirmed! ✅");
          break;
        case "error": {
          const msg = searchParams.get("msg");
          const messages = {
            missing_id: "Invalid payment link.",
            not_found: "Registration not found.",
            payment_incomplete: "Payment not yet complete. Please try again.",
            server_error: "Verification failed. Please contact support.",
          };
          toast.error(messages[msg] || "Could not verify payment.");
          break;
        }
      }
    } else if (payment === "cancelled") {
      window.history.replaceState(null, "", "/my-tickets");
      toast.error("Payment was cancelled. Your registration is still pending.");
    }
  }, [searchParams]);

  const handleCancelRegistration = async (registrationId) => {
    if (!window.confirm("Are you sure you want to cancel this registration?"))
      return;

    try {
      const result = await cancelRegistration({ registrationId });
      toast.success("Registration cancelled successfully.");

      // If someone was promoted from waitlist, send them an email
      if (result?.promoted) {
        try {
          const reg = registrations?.find((r) => r._id === registrationId);
          await fetch("/api/send-waitlist-promotion-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attendeeName: result.promoted.name,
              attendeeEmail: result.promoted.email,
              qrCode: result.promoted.qrCode,
              event: reg?.event || {},
            }),
          });
        } catch (emailErr) {
          console.error("Waitlist promotion email failed:", emailErr);
        }
      }
    } catch (error) {
      toast.error(error.message || "Failed to cancel registration");
    }
  };

  const handleLeaveWaitlist = async (eventId) => {
    if (!window.confirm("Are you sure you want to leave the waitlist?")) return;
    try {
      await leaveWaitlist({ eventId });
      toast.success("Left waitlist successfully.");
    } catch (error) {
      toast.error(error.message || "Failed to leave waitlist");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  const now = Date.now();

  const upcomingTickets = registrations?.filter(
    (reg) =>
      reg.event && reg.event.startDate >= now && reg.status === "confirmed"
  );
  const pastTickets = registrations?.filter(
    (reg) =>
      reg.event && (reg.event.startDate < now || reg.status === "cancelled")
  );

  return (
    <div className="min-h-screen pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Tickets</h1>
          <p className="text-muted-foreground">
            View and manage your event registrations
          </p>
        </div>

        {/* Upcoming Tickets */}
        {upcomingTickets?.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4">Upcoming Events</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingTickets.map((registration) => (
                <EventCard
                  key={registration._id}
                  event={registration.event}
                  action="ticket"
                  onClick={() => setSelectedTicket(registration)}
                  onDelete={() => handleCancelRegistration(registration._id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Past Tickets */}
        {pastTickets?.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Past Events</h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pastTickets.map((registration) => (
                <EventCard
                  key={registration._id}
                  event={registration.event}
                  action={null}
                  className="opacity-60"
                />
              ))}
            </div>
          </div>
        )}

        {/* Waitlist Entries */}
        {waitlistEntries && waitlistEntries.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Clock className="w-6 h-6 text-amber-500" />
              On Waitlist
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {waitlistEntries.map((entry) => (
                <Card key={entry._id} className="p-4 border-amber-200 dark:border-amber-800">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold line-clamp-1">
                        {entry.event?.title || "Event"}
                      </h3>
                      {entry.event && (
                        <p className="text-sm text-muted-foreground">
                          {format(entry.event.startDate, "PPP")}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      #{entry.position || "—"} in line
                    </Badge>
                  </div>
                  {entry.event && (
                    <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {entry.event.city}, {entry.event.state || entry.event.country}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-red-500 hover:text-red-600 gap-1"
                    onClick={() => handleLeaveWaitlist(entry.eventId)}
                    disabled={isLeavingWaitlist}
                  >
                    <X className="w-3.5 h-3.5" />
                    Leave Waitlist
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!upcomingTickets?.length && !pastTickets?.length && (
          <Card className="p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-6xl mb-4">🎟️</div>
              <h2 className="text-2xl font-bold">No tickets yet</h2>
              <p className="text-muted-foreground">
                Register for events to see your tickets here
              </p>
              <Button asChild className="gap-2">
                <Link href="/explore">
                  <Ticket className="w-4 h-4" /> Browse Events
                </Link>
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* QR Code Modal */}
      {selectedTicket && (
        <Dialog
          open={!!selectedTicket}
          onOpenChange={() => setSelectedTicket(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Your Ticket</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="text-center">
                <p className="font-semibold mb-1">
                  {selectedTicket.attendeeName}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedTicket.event.title}
                </p>
              </div>

              <div className="flex justify-center p-6 bg-white rounded-lg">
                <QRCode value={selectedTicket.qrCode} size={200} level="H" />
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Ticket ID</p>
                <p className="font-mono text-sm">{selectedTicket.qrCode}</p>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {format(selectedTicket.event.startDate, "PPP, h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {selectedTicket.event.locationType === "online"
                      ? "Online Event"
                      : `${selectedTicket.event.city}, ${
                          selectedTicket.event.state ||
                          selectedTicket.event.country
                        }`}
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Show this QR code at the event entrance for check-in
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function MyTicketsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      }
    >
      <MyTicketsContent />
    </Suspense>
  );
}
