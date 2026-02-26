import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useConvexMutation } from "@/hooks/use-convex-query";
import { format } from "date-fns";
import {
  CheckCircle,
  Circle,
  Loader2,
  CreditCard,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";

// Attendee Card Component
export function AttendeeCard({ registration }) {
  const { mutate: checkInAttendee, isLoading } = useConvexMutation(
    api.registrations.checkInAttendee
  );
  const { mutate: markOfflinePaid, isLoading: isMarkingPaid } =
    useConvexMutation(api.registrations.markOfflinePaid);

  const handleManualCheckIn = async () => {
    try {
      const result = await checkInAttendee({ qrCode: registration.qrCode });
      if (result.success) {
        toast.success("Attendee checked in successfully");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(error.message || "Failed to check in attendee");
    }
  };

  const handleMarkPaid = async () => {
    try {
      const result = await markOfflinePaid({
        registrationId: registration._id,
      });
      if (result.success) {
        toast.success("Marked as paid!");
      }
    } catch (error) {
      toast.error(error.message || "Failed to mark as paid");
    }
  };

  // Payment badge
  const getPaymentBadge = () => {
    if (
      !registration.paymentMethod ||
      registration.paymentMethod === "free" ||
      registration.paymentStatus === "free"
    ) {
      return null; // No badge needed for free events
    }
    if (registration.paymentStatus === "paid") {
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
          <CreditCard className="w-3 h-3" />
          Paid
        </Badge>
      );
    }
    // pending
    return (
      <Badge
        variant="outline"
        className="border-amber-400 text-amber-600 gap-1"
      >
        <Banknote className="w-3 h-3" />
        Unpaid
      </Badge>
    );
  };

  return (
    <Card className="py-0">
      <CardContent className="p-4 flex items-start gap-4">
        <div
          className={`mt-1 p-2 rounded-full ${
            registration.checkedIn ? "bg-green-100" : "bg-gray-100"
          }`}
        >
          {registration.checkedIn ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <Circle className="w-5 h-5 text-gray-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold">{registration.attendeeName}</h3>
            {getPaymentBadge()}
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {registration.attendeeEmail}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>
              {registration.checkedIn ? "⏰ Checked in" : "📅 Registered"}{" "}
              {registration.checkedIn && registration.checkedInAt
                ? format(registration.checkedInAt, "PPp")
                : format(registration.registeredAt, "PPp")}
            </span>
            {registration.paymentMethod &&
              registration.paymentMethod !== "free" && (
                <span>
                  {registration.paymentMethod === "online"
                    ? "💳 Online"
                    : "💵 Offline"}
                </span>
              )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* Mark Paid button for unpaid offline attendees */}
          {registration.paymentStatus === "pending" &&
            registration.paymentMethod === "offline" && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkPaid}
                disabled={isMarkingPaid}
                className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50"
              >
                {isMarkingPaid ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Banknote className="w-3.5 h-3.5" />
                    Mark Paid
                  </>
                )}
              </Button>
            )}

          {/* Check In button */}
          {!registration.checkedIn && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualCheckIn}
              disabled={isLoading}
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Check In
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
