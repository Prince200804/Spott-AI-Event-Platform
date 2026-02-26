"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Building, Crown, Plus, Sparkles, Ticket } from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { BarLoader } from "react-spinners";
import { useStoreUser } from "@/hooks/use-store-user";
import { useOnboarding } from "@/hooks/use-onboarding";
import OnboardingModal from "./onboarding-modal";
import SearchLocationBar from "./search-location-bar";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import UpgradeModal from "./upgrade-modal";
import { Badge } from "./ui/badge";
import { api } from "@/convex/_generated/api";

export default function Header() {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { isLoading } = useStoreUser();
  const { showOnboarding, handleOnboardingComplete, handleOnboardingSkip } =
    useOnboarding();

  // Get current user with Pro status from Convex
  const currentUser = useQuery(api.users.getCurrentUser);
  const hasPro = currentUser?.hasPro || false;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 bg-background/80 backdrop-blur-xl z-20 border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/spott.png"
              alt="Spott logo"
              width={500}
              height={500}
              className="w-full h-11"
              priority
            />
          </Link>

          {/* Search & Location - Desktop Only */}
          <div className="hidden md:flex flex-1 justify-center">
            <SearchLocationBar />
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-3">
            {/* Show Pro badge or Upgrade button */}
            <Authenticated>
              {hasPro ? (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 gap-1.5 shadow-lg">
                  <Crown className="w-4 h-4" />
                  <span className="font-semibold">Pro Member</span>
                </Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUpgradeModal(true)}
                  className="gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Pro
                </Button>
              )}
            </Authenticated>

            <Button variant="ghost" size="sm" asChild className={"mr-2"}>
              <Link href="/explore">Explore</Link>
            </Button>

            <Authenticated>
              {/* Create Event Button */}
              <Button size="sm" asChild className="flex gap-2 mr-4">
                <Link href="/create-event">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Create Event</span>
                </Link>
              </Button>

              {/* User Button */}
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "w-9 h-9",
                  },
                }}
              >
                <UserButton.MenuItems>
                  <UserButton.Link
                    label="My Tickets"
                    labelIcon={<Ticket size={16} />}
                    href="/my-tickets"
                  />
                  <UserButton.Link
                    label="My Events"
                    labelIcon={<Building size={16} />}
                    href="/my-events"
                  />
                  <UserButton.Action label="manageAccount" />
                </UserButton.MenuItems>
              </UserButton>
            </Authenticated>

            <Unauthenticated>
              <Button size="sm" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
            </Unauthenticated>
          </div>
        </div>

        {/* Mobile Search & Location - Below Header */}
        <div className="md:hidden border-t px-3 py-3">
          <SearchLocationBar />
        </div>

        {isLoading && (
          <div className="absolute bottom-0 left-0 w-full">
            <BarLoader width={"100%"} color="#a855f7" />
          </div>
        )}
      </nav>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={handleOnboardingSkip}
        onComplete={handleOnboardingComplete}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        trigger="header"
      />
    </>
  );
}
