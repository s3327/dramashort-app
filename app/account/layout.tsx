"use client";

import { ReactNode } from "react";
import Header from "@/components/Header";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * Account layout wrapper providing authenticated state verification and hydration skeleton.
 * Protects all /account/* routes against unauthenticated guest rendering.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const { isLoading, isLoggedIn } = useRequireAuth();

  // Display polished skeleton while confirming user session
  if (isLoading || !isLoggedIn) {
    return (
      <div data-theme={theme} className="min-h-screen bg-bg text-text">
        <Header />
        <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
          <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
            {/* Sidebar skeleton */}
            <div className="w-full lg:w-64 space-y-4">
              <div className="bg-surface border border-border rounded-lg p-6 space-y-4 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-border/40 mx-auto" />
                <div className="h-4 bg-border/40 rounded w-3/4 mx-auto" />
                <div className="h-3 bg-border/30 rounded w-1/2 mx-auto" />
              </div>
              <div className="bg-surface border border-border rounded-lg p-3 space-y-2 animate-pulse">
                <div className="h-9 bg-border/30 rounded" />
                <div className="h-9 bg-border/30 rounded" />
                <div className="h-9 bg-border/30 rounded" />
                <div className="h-9 bg-border/30 rounded" />
              </div>
            </div>

            {/* Main content skeleton */}
            <div className="flex-1 w-full space-y-6">
              <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 space-y-4 animate-pulse">
                <div className="h-7 bg-border/40 rounded w-1/3" />
                <div className="h-4 bg-border/30 rounded w-2/3" />
                <div className="h-28 bg-border/20 rounded mt-6" />
                <div className="h-28 bg-border/20 rounded mt-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
