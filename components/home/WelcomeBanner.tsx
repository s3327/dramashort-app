"use client";

import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";

/**
 * Dismissible First-Visit Welcome Banner (Task 14.5)
 *
 * Welcomes first-time visitors with the DramaShort premise
 * without gating content or adding click barriers.
 * Remembers dismissal preference in localStorage.
 */
export default function WelcomeBanner() {
  const [isDismissed, setIsDismissed] = useState<boolean>(true);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const dismissed = localStorage.getItem("dramashort_welcome_dismissed") === "true";
      setIsDismissed(dismissed);
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem("dramashort_welcome_dismissed", "true");
    } catch {}
  }, []);

  if (!isMounted || isDismissed) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Welcome banner"
      className="relative z-20 w-full bg-gradient-to-r from-primary/15 via-tertiary/10 to-primary/5 border-b border-border/40 px-4 py-2.5 sm:px-6 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-primary/25 text-primary text-xs font-bold">
            ★
          </span>
          <p className="text-xs sm:text-sm text-text font-medium truncate sm:whitespace-normal">
            <strong className="font-semibold text-text">Welcome to DramaShort:</strong>{" "}
            Vertical micro-dramas designed for quick breaks.
            <span className="hidden sm:inline text-text-muted ml-1">
              Revenge, rebirth & romance — free to stream, no app required.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="shrink-0 p-1.5 rounded-full text-text-muted hover:text-text hover:bg-white/10 active:scale-95 transition-all"
          aria-label="Dismiss welcome banner"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
