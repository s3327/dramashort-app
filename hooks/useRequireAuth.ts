"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Client-side route protection hook for account pages.
 * Ensures the user has an active Supabase authentication session.
 * If unauthenticated after initial hydration, redirects to /login with returnUrl.
 */
export function useRequireAuth(redirectTo = "/login") {
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, isLoading, isLoggedIn } = useAuth();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      const returnUrl = encodeURIComponent(pathname || "/account");
      router.replace(`${redirectTo}?returnUrl=${returnUrl}`);
    }
  }, [isLoading, isLoggedIn, pathname, redirectTo, router]);

  return { user, profile, isLoading, isLoggedIn };
}
