"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SubscriptionSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");

    if (sessionId) {
      // Actively sync the subscription instead of blindly waiting
      const syncSubscription = async (retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            // Wait a bit for the webhook to process first
            await new Promise((r) => setTimeout(r, 2000));

            const res = await fetch("/api/sync-subscription", {
              method: "POST",
            });

            if (res.ok) {
              setVerified(true);
              setLoading(false);
              return;
            }

            // If not found yet, the webhook may still be processing — retry
            console.log(`Sync attempt ${i + 1} failed, retrying...`);
          } catch (err) {
            console.error("Sync error:", err);
          }
        }

        // Even if sync fails, show success (webhook may still arrive)
        setVerified(true);
        setLoading(false);
      };

      syncSubscription();
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-16 h-16 animate-spin text-purple-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Processing your subscription...</h2>
            <p className="text-sm text-muted-foreground text-center">
              Please wait while we confirm your payment
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {verified ? (
              <CheckCircle className="w-20 h-20 text-green-500" />
            ) : (
              <Crown className="w-20 h-20 text-purple-500" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {verified ? "Welcome to Pro! 🎉" : "Payment Successful!"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-muted-foreground">
            {verified 
              ? "Your subscription is now active. You can now enjoy all Pro features!"
              : "Your payment has been processed. Your subscription will be activated shortly."
            }
          </p>

          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 space-y-2">
            <p className="font-semibold text-sm">Pro Features Unlocked:</p>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✅ Unlimited Events</li>
              <li>✅ Custom Theme Colors</li>
              <li>✅ Advanced Analytics</li>
              <li>✅ Priority Support</li>
              <li>✅ AI Event Descriptions</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => router.push("/create-event")}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
            >
              Create Your First Pro Event
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push("/")}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SubscriptionSuccess() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-16 h-16 animate-spin text-purple-500" />
        </div>
      }
    >
      <SubscriptionSuccessContent />
    </Suspense>
  );
}
