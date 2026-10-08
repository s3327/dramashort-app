"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Sparkles, HeartHandshake, Film } from "lucide-react";
import Modal from "@/components/Modal";
import { returnUrlQuery } from "@/lib/navigation/safe-redirect";
import {
  type GuestEngagementTrigger,
  setGuestPromptDismissed,
  trackGuestEngagementEvent,
} from "@/lib/analytics/guest-engagement";

export interface GuestEngagementModalProps {
  open: boolean;
  onClose: () => void;
  trigger: GuestEngagementTrigger;
  dramaTitle?: string;
  dramaSlug?: string;
  episodeNumber?: number;
  returnUrl: string;
}

/**
 * Non-intrusive soft engagement prompt (Task 14.8).
 * Triggers after the 2nd guest favorite or upon completing Episode 3,
 * highlighting the value of cross-device sync without blocking the viewer.
 */
export default function GuestEngagementModal({
  open,
  onClose,
  trigger,
  dramaTitle,
  dramaSlug,
  episodeNumber,
  returnUrl,
}: GuestEngagementModalProps) {
  useEffect(() => {
    if (open) {
      trackGuestEngagementEvent({
        action: "shown",
        trigger,
        dramaSlug,
        episodeNumber,
      });
    }
  }, [open, trigger, dramaSlug, episodeNumber]);

  const handleDismiss = () => {
    setGuestPromptDismissed(trigger);
    trackGuestEngagementEvent({
      action: "dismiss",
      trigger,
      dramaSlug,
      episodeNumber,
    });
    onClose();
  };

  const handleCtaClick = () => {
    trackGuestEngagementEvent({
      action: "cta_click",
      trigger,
      dramaSlug,
      episodeNumber,
    });
    onClose();
  };

  const isFavoriteTrigger = trigger === "favorite";

  return (
    <Modal open={open} onClose={handleDismiss}>
      <div className="text-center">
        {/* Animated Accent Icon Badge */}
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isFavoriteTrigger ? (
            <HeartHandshake size={24} strokeWidth={2.2} className="animate-pulse" />
          ) : (
            <Film size={24} strokeWidth={2.2} className="animate-pulse" />
          )}
        </div>

        {/* Content Heading */}
        <h2 className="font-display font-bold text-lg sm:text-xl mb-1.5 text-text">
          {isFavoriteTrigger
            ? "Keep Your Favorites on Every Device"
            : "Enjoying the Story?"}
        </h2>

        {/* Contextual Value Proposition */}
        <p className="text-xs sm:text-sm text-text-muted mb-6 leading-relaxed">
          {isFavoriteTrigger ? (
            <>
              You&apos;ve saved favorites on this browser! Create a free account to sync
              your library and watch lists seamlessly across phone, tablet, and desktop.
            </>
          ) : (
            <>
              {dramaTitle ? (
                <>
                  You just finished Episode 3 of{" "}
                  <span className="font-semibold text-text">{dramaTitle}</span>.
                </>
              ) : (
                "You just finished Episode 3."
              )}{" "}
              Create a free account to save your watch progress and pick up anywhere.
            </>
          )}
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2.5">
          <Link
            href={`/signup${returnUrlQuery(returnUrl)}`}
            onClick={handleCtaClick}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 px-4 shadow-sm transition-colors"
          >
            <Sparkles size={16} strokeWidth={2.2} />
            Create Free Account
          </Link>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full rounded-full border border-border text-text-muted hover:text-text hover:bg-surface font-semibold text-xs py-2 transition-colors"
          >
            Maybe Later
          </button>
        </div>

        {/* Discreet Login Forwarder */}
        <p className="mt-4 text-xs text-text-muted">
          Already have an account?{" "}
          <Link
            href={`/login${returnUrlQuery(returnUrl)}`}
            onClick={handleCtaClick}
            className="font-semibold text-primary hover:underline transition-colors"
          >
            Log in
          </Link>
        </p>
      </div>
    </Modal>
  );
}
