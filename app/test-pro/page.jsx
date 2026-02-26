"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function TestProPage() {
  const [loading, setLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const enablePro = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/test-pro", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to enable Pro");
      }

      setSuccess(true);
      toast.success("Pro status enabled! Refresh the page to see changes.");
    } catch (error) {
      console.error("Error enabling Pro:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncSubscription = async () => {
    setSyncLoading(true);
    try {
      const response = await fetch("/api/sync-subscription", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync subscription");
      }

      setSuccess(true);
      toast.success(data.message);
    } catch (error) {
      console.error("Error syncing subscription:", error);
      toast.error(error.message);
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-6 h-6 text-purple-500" />
            <CardTitle>Test Pro Access</CardTitle>
          </div>
          <CardDescription>
            Enable Pro features for testing without real payment.
            This is for development/testing only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {success ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle className="w-5 h-5" />
                <p className="font-semibold">Pro Status Enabled!</p>
              </div>
              <p className="text-sm text-green-600 dark:text-green-500">
                Your account now has Pro access with:
              </p>
              <ul className="text-sm space-y-1 text-green-600 dark:text-green-500 ml-4">
                <li>✅ Unlimited event creation</li>
                <li>✅ Custom theme colors</li>
                <li>✅ Advanced features</li>
                <li>✅ Valid for 30 days</li>
              </ul>
              <Button 
                onClick={() => window.location.href = "/create-event"}
                className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500"
              >
                Create Your First Pro Event
              </Button>
            </div>
          ) : (
            <>
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  Click the button below to instantly enable Pro features for your account.
                  No payment required - perfect for testing!
                </p>
              </div>

              <Button
                onClick={enablePro}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enabling Pro...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Enable Pro Access (Test Mode)
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                  Already paid via Stripe but don't have Pro access? Sync your subscription:
                </p>
                <Button
                  onClick={syncSubscription}
                  disabled={syncLoading}
                  variant="outline"
                  className="w-full border-blue-300 dark:border-blue-700"
                >
                  {syncLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    "Sync Stripe Subscription"
                  )}
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                This is a test endpoint for development. In production, users must subscribe via Stripe.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
