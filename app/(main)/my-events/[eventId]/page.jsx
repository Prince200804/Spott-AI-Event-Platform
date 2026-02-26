"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import Image from "next/image";
import { format } from "date-fns";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  TrendingUp,
  Clock,
  Trash2,
  QrCode,
  Loader2,
  CheckCircle,
  Download,
  Search,
  Eye,
  IndianRupee,
  Wallet,
  BarChart3,
  ListOrdered,
} from "lucide-react";
import { useConvexQuery, useConvexMutation } from "@/hooks/use-convex-query";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { getCategoryIcon, getCategoryLabel } from "@/lib/data";
import QRScannerModal from "../_components/qr-scanner-modal";
import { AttendeeCard } from "../_components/attendee-card";
import {
  RegistrationTrendChart,
  PaymentBreakdownChart,
  GeographicChart,
  CheckInTimelineChart,
  RegistrationDayChart,
  AnalyticsSummary,
} from "../_components/analytics-charts";

export default function EventDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId;

  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Fetch event dashboard data
  const { data: dashboardData, isLoading } = useConvexQuery(
    api.dashboard.getEventDashboard,
    { eventId }
  );

  // Fetch registrations
  const { data: registrations, isLoading: loadingRegistrations } =
    useConvexQuery(api.registrations.getEventRegistrations, { eventId });

  // Fetch analytics data
  const { data: trendData } = useConvexQuery(
    api.analytics.getRegistrationTrend,
    { eventId }
  );
  const { data: paymentData } = useConvexQuery(
    api.analytics.getPaymentAnalytics,
    { eventId }
  );
  const { data: geoData } = useConvexQuery(
    api.analytics.getGeographicDistribution,
    { eventId }
  );
  const { data: checkInData } = useConvexQuery(
    api.analytics.getCheckInTimeline,
    { eventId }
  );
  const { data: dayData } = useConvexQuery(
    api.analytics.getRegistrationHeatmap,
    { eventId }
  );

  // Fetch waitlist data
  const { data: waitlistData } = useConvexQuery(
    api.waitlist.getEventWaitlist,
    { eventId }
  );

  const waitingCount = waitlistData?.filter((w) => w.status === "waiting").length || 0;

  // Delete event mutation
  const { mutate: deleteEvent, isLoading: isDeleting } = useConvexMutation(
    api.dashboard.deleteEvent
  );

  const handleDelete = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this event? This action cannot be undone and will permanently delete the event and all associated registrations."
    );

    if (!confirmed) return;

    try {
      await deleteEvent({ eventId });
      toast.success("Event deleted successfully");
      router.push("/my-events");
    } catch (error) {
      toast.error(error.message || "Failed to delete event");
    }
  };

  const handleExportCSV = () => {
    if (!registrations || registrations.length === 0) {
      toast.error("No registrations to export");
      return;
    }

    const csvContent = [
      [
        "Name",
        "Email",
        "Registered At",
        "Checked In",
        "Checked In At",
        "Payment Method",
        "Payment Status",
        "Amount Paid",
        "QR Code",
      ],
      ...registrations.map((reg) => [
        reg.attendeeName,
        reg.attendeeEmail,
        new Date(reg.registeredAt).toLocaleString(),
        reg.checkedIn ? "Yes" : "No",
        reg.checkedInAt ? new Date(reg.checkedInAt).toLocaleString() : "-",
        reg.paymentMethod || "free",
        reg.paymentStatus || "free",
        reg.amountPaid != null ? `₹${reg.amountPaid}` : "-",
        reg.qrCode,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dashboardData?.event.title || "event"}_registrations.csv`;
    a.click();
    toast.success("CSV exported successfully");
  };

  if (isLoading || loadingRegistrations) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!dashboardData) {
    notFound();
  }

  const { event, stats } = dashboardData;

  // Filter registrations based on active tab and search
  const filteredRegistrations = registrations?.filter((reg) => {
    const matchesSearch =
      reg.attendeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.attendeeEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reg.qrCode.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch && reg.status === "confirmed";
    if (activeTab === "checked-in")
      return matchesSearch && reg.checkedIn && reg.status === "confirmed";
    if (activeTab === "pending")
      return matchesSearch && !reg.checkedIn && reg.status === "confirmed";

    return matchesSearch;
  });

  return (
    <div className="min-h-screen pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Navigation */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push("/my-events")}
            className="gap-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Events
          </Button>
        </div>

        {event.coverImage && (
          <div className="relative h-[350px] rounded-2xl overflow-hidden mb-6">
            <Image
              src={event.coverImage}
              alt={event.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Event Header */}
        <div className="flex flex-col gap-5 sm:flex-row items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-3">{event.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <Badge variant="outline">
                {getCategoryIcon(event.category)}{" "}
                {getCategoryLabel(event.category)}
              </Badge>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{format(event.startDate, "PPP")}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>
                  {event.locationType === "online"
                    ? "Online"
                    : `${event.city}, ${event.state || event.country}`}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/events/${event.slug}`)}
              className="gap-2 flex-1"
            >
              <Eye className="w-4 h-4" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-500 hover:text-red-600 gap-2 flex-1"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>

        {/* Quick Actions - Show QR Scanner if event is today */}
        {stats.isEventToday && !stats.isEventPast && (
          <Button
            size="lg"
            // variant="outline"
            className="mb-8 w-full gap-2 h-10 bg-linear-to-r from-orange-500 via-pink-500 to-red-500 text-white hover:scale-[1.02]"
            onClick={() => setShowQRScanner(true)}
          >
            <QrCode className="w-6 h-6" />
            Scan QR Code to Check-In
          </Button>
        )}

        {/* Stats Grid */}
        <div className={`grid grid-cols-2 ${event.ticketType === "paid" ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4 mb-4`}>
          <Card className="py-0">
            <CardContent className="p-6 flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.totalRegistrations}/{stats.capacity}
                </p>
                <p className="text-sm text-muted-foreground">Capacity</p>
              </div>
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardContent className="p-6 flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.checkedInCount}</p>
                <p className="text-sm text-muted-foreground">Checked In</p>
              </div>
            </CardContent>
          </Card>

          {event.ticketType === "paid" && (
            <>
              <Card className="py-0">
                <CardContent className="p-6 flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <IndianRupee className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">₹{stats.totalRevenue}</p>
                    <p className="text-sm text-muted-foreground">Revenue</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="py-0">
                <CardContent className="p-6 flex items-center gap-3">
                  <div className="p-3 bg-emerald-100 rounded-lg">
                    <Wallet className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      <span className="text-green-600">{stats.paidCount}</span>
                      <span className="text-muted-foreground text-lg"> / </span>
                      <span className="text-amber-600">{stats.unpaidCount}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">Paid / Unpaid</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {event.ticketType !== "paid" && (
            <Card className="py-0">
              <CardContent className="p-6 flex items-center gap-3">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.checkInRate}%</p>
                  <p className="text-sm text-muted-foreground">Check-in Rate</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="py-0">
            <CardContent className="p-6 flex items-center gap-3">
              <div className="p-3 bg-amber-100 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.isEventPast
                    ? "Ended"
                    : stats.hoursUntilEvent > 24
                      ? `${Math.floor(stats.hoursUntilEvent / 24)}d`
                      : `${stats.hoursUntilEvent}h`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {stats.isEventPast ? "Event Over" : "Time Left"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Attendee Management */}
        <h2 className="text-2xl font-bold mb-4">Event Management</h2>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">
              All ({stats.totalRegistrations})
            </TabsTrigger>
            <TabsTrigger value="checked-in">
              Checked In ({stats.checkedInCount})
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pending ({stats.pendingCount})
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="gap-1">
              <ListOrdered className="w-3.5 h-3.5" />
              Waitlist {waitingCount > 0 && `(${waitingCount})`}
            </TabsTrigger>
          </TabsList>

          {/* Search and Actions (for attendee tabs) */}
          {(activeTab === "all" || activeTab === "checked-in" || activeTab === "pending") && (
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or QR code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            </div>
          )}

          {/* Attendee List */}
          <TabsContent value="all" className="space-y-3 mt-0">
            {filteredRegistrations && filteredRegistrations.length > 0 ? (
              filteredRegistrations.map((registration) => (
                <AttendeeCard
                  key={registration._id}
                  registration={registration}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No attendees found
              </div>
            )}
          </TabsContent>

          <TabsContent value="checked-in" className="space-y-3 mt-0">
            {filteredRegistrations && filteredRegistrations.length > 0 ? (
              filteredRegistrations.map((registration) => (
                <AttendeeCard
                  key={registration._id}
                  registration={registration}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No checked-in attendees
              </div>
            )}
          </TabsContent>

          <TabsContent value="pending" className="space-y-3 mt-0">
            {filteredRegistrations && filteredRegistrations.length > 0 ? (
              filteredRegistrations.map((registration) => (
                <AttendeeCard
                  key={registration._id}
                  registration={registration}
                />
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No pending attendees
              </div>
            )}
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-0">
            <AnalyticsSummary stats={stats} trendData={trendData} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <RegistrationTrendChart data={trendData} />
              <PaymentBreakdownChart data={paymentData} />
              <GeographicChart data={geoData} />
              <CheckInTimelineChart data={checkInData} />
              <RegistrationDayChart data={dayData} />
            </div>
          </TabsContent>

          {/* Waitlist Tab */}
          <TabsContent value="waitlist" className="mt-0">
            {waitlistData && waitlistData.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">
                    {waitingCount} people waiting · {waitlistData.filter((w) => w.status === "promoted").length} promoted
                  </p>
                </div>
                {waitlistData.map((entry, index) => (
                  <Card key={entry._id} className="py-0">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          entry.status === "waiting"
                            ? "bg-amber-100 text-amber-700"
                            : entry.status === "promoted"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-500"
                        }`}>
                          {entry.status === "waiting" ? index + 1 : "✓"}
                        </div>
                        <div>
                          <p className="font-medium">{entry.attendeeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.attendeeEmail}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-muted-foreground">
                          Joined {new Date(entry.joinedAt).toLocaleDateString()}
                        </p>
                        <Badge
                          variant={
                            entry.status === "waiting"
                              ? "secondary"
                              : entry.status === "promoted"
                                ? "default"
                                : "outline"
                          }
                          className={
                            entry.status === "promoted"
                              ? "bg-green-500 text-white"
                              : entry.status === "cancelled"
                                ? "text-red-500"
                                : ""
                          }
                        >
                          {entry.status === "waiting"
                            ? "Waiting"
                            : entry.status === "promoted"
                              ? "Promoted ✓"
                              : entry.status === "cancelled"
                                ? "Left"
                                : entry.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ListOrdered className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No waitlist entries yet</p>
                <p className="text-sm mt-1">
                  When your event reaches capacity, attendees can join the waitlist
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScannerModal
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
}
