"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Coins, Sparkles, Check, AlertCircle, Loader2, Zap } from "lucide-react";
import Modal from "@/components/Modal";
import {
  unlockEpisodeClient,
  unlockRemainingEpisodesClient,
  calculateBundleCost,
} from "@/lib/services/wallet.service";
import { trackPaywallView, trackEpisodeUnlock } from "@/lib/analytics/track";

export interface EpisodeUnlockModalProps {
  open: boolean;
  onClose: () => void;
  drama: {
    id: string;
    slug: string;
    title: string;
    poster?: string;
  };
  episode: {
    id: string;
    episodeNumber: number;
    title?: string;
  };
  remainingLockedCount?: number;
  userBalance: number;
  isVip?: boolean;
  onUnlocked: (newBalance: number, isBundle?: boolean) => void;
  onOpenCheckIn?: () => void;
}

export const AUTO_UNLOCK_STORAGE_KEY = "dramashort_auto_unlock_episodes";

export default function EpisodeUnlockModal({
  open,
  onClose,
  drama,
  episode,
  remainingLockedCount = 1,
  userBalance,
  isVip = false,
  onUnlocked,
  onOpenCheckIn,
}: EpisodeUnlockModalProps) {
  const [isUnlockingSingle, setIsUnlockingSingle] = useState(false);
  const [isUnlockingBundle, setIsUnlockingBundle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoUnlockNext, setAutoUnlockNext] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        return localStorage.getItem(AUTO_UNLOCK_STORAGE_KEY) === "true";
      } catch {
        return false;
      }
    }
    return false;
  });

  // Track paywall impression when modal opens
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      trackPaywallView({
        titleSlug: drama.slug,
        episodeNumber: episode.episodeNumber,
        source: "navigation",
      });
    }
  }, [open, drama.slug, episode.episodeNumber]);

  const handleToggleAutoUnlock = useCallback(() => {
    setAutoUnlockNext((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(AUTO_UNLOCK_STORAGE_KEY, String(next));
        } catch {}
      }
      return next;
    });
  }, []);

  const bundlePricing = calculateBundleCost(Math.max(1, remainingLockedCount));
  const hasEnoughForSingle = isVip || userBalance >= 10;
  const hasEnoughForBundle = isVip || userBalance >= bundlePricing.discountedCost;

  // Execute single episode unlock
  const handleUnlockSingle = async () => {
    if (isUnlockingSingle || isUnlockingBundle) return;
    setIsUnlockingSingle(true);
    setErrorMessage(null);

    const res = await unlockEpisodeClient({
      dramaId: drama.id,
      dramaSlug: drama.slug,
      episodeId: episode.id,
      episodeNumber: episode.episodeNumber,
      cost: 10,
    });

    setIsUnlockingSingle(false);

    if (res.success) {
      trackEpisodeUnlock({
        titleSlug: drama.slug,
        episodeNumber: episode.episodeNumber,
        coinsSpent: res.coinsSpent,
        isBundle: false,
        episodesCount: 1,
        isVip: res.isVipUnlock || isVip,
      });
      onUnlocked(res.newBalance, false);
      onClose();
    } else {
      setErrorMessage(res.error || "Failed to unlock episode. Please try again.");
    }
  };

  // Execute remaining episodes bundle unlock
  const handleUnlockBundle = async () => {
    if (isUnlockingSingle || isUnlockingBundle) return;
    setIsUnlockingBundle(true);
    setErrorMessage(null);

    const res = await unlockRemainingEpisodesClient({
      dramaId: drama.id,
      dramaSlug: drama.slug,
    });

    setIsUnlockingBundle(false);

    if (res.success) {
      trackEpisodeUnlock({
        titleSlug: drama.slug,
        episodeNumber: episode.episodeNumber,
        coinsSpent: res.discountedCost,
        isBundle: true,
        episodesCount: res.episodesUnlockedCount,
        isVip: res.isVipUnlock || isVip,
      });
      onUnlocked(res.newBalance, true);
      onClose();
    } else {
      setErrorMessage(res.error || "Failed to unlock bundle. Please try again.");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <div className="w-full text-left">
        {/* Header Badge & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm">
            <Coins size={24} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-text">
                Unlock Episode {episode.episodeNumber}
              </h2>
              {isVip && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-black">
                  VIP Free
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted line-clamp-1">{drama.title}</p>
          </div>
        </div>

        {/* Current Coin Balance Indicator */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated border border-border mb-4">
          <span className="text-xs font-medium text-text-muted">Your Coin Balance</span>
          <div className="flex items-center gap-1.5 font-display font-bold text-sm text-amber-400">
            <Coins size={15} />
            <span>{isVip ? "Unlimited (VIP)" : `${userBalance} Coins`}</span>
          </div>
        </div>

        {/* Error Alert if any */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium flex items-center gap-2"
          >
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Unlock Options */}
        <div className="space-y-3 mb-5">
          {/* Option 1: Single Episode Unlock */}
          <button
            type="button"
            onClick={handleUnlockSingle}
            disabled={!hasEnoughForSingle || isUnlockingSingle || isUnlockingBundle}
            className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              hasEnoughForSingle
                ? "bg-bg hover:bg-surface-elevated border-border hover:border-primary/50 cursor-pointer shadow-sm"
                : "bg-bg/40 border-border/40 opacity-60 cursor-not-allowed"
            }`}
          >
            <div>
              <div className="text-sm font-bold text-text flex items-center gap-2">
                <span>Unlock This Episode</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Episode {episode.episodeNumber} &middot; Permanent access
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold text-amber-400 flex items-center gap-1">
                <Coins size={14} />
                {isVip ? "0" : "10"}
              </span>
              <div className="px-3 py-1.5 rounded-lg bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-bold text-xs shadow-sm flex items-center gap-1">
                {isUnlockingSingle ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <span>Unlock</span>
                )}
              </div>
            </div>
          </button>

          {/* Option 2: Bulk Bundle Unlock (if multiple locked episodes remain) */}
          {remainingLockedCount > 1 && (
            <button
              type="button"
              onClick={handleUnlockBundle}
              disabled={!hasEnoughForBundle || isUnlockingSingle || isUnlockingBundle}
              className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all duration-150 relative overflow-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                hasEnoughForBundle
                  ? "bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent hover:from-amber-500/20 border-amber-500/40 cursor-pointer shadow-sm"
                  : "bg-bg/40 border-border/40 opacity-60 cursor-not-allowed"
              }`}
            >
              <div>
                <div className="text-sm font-bold text-text flex items-center gap-2">
                  <span>Unlock Remaining Series</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Save 20%
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  All {remainingLockedCount} remaining locked episodes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  {!isVip && (
                    <span className="text-[11px] text-text-muted line-through block">
                      {bundlePricing.standardCost}
                    </span>
                  )}
                  <span className="text-sm font-extrabold text-amber-400 flex items-center gap-1">
                    <Coins size={14} />
                    {isVip ? "0" : bundlePricing.discountedCost}
                  </span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs shadow-sm flex items-center gap-1">
                  {isUnlockingBundle ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <span>Unlock All</span>
                  )}
                </div>
              </div>
            </button>
          )}
        </div>

        {/* Auto-Unlock Checkbox Option */}
        <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-elevated/50 cursor-pointer select-none text-xs text-text-muted mb-4 transition-colors">
          <input
            type="checkbox"
            checked={autoUnlockNext}
            onChange={handleToggleAutoUnlock}
            className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
          />
          <div className="flex items-center gap-1">
            <Zap size={13} className="text-amber-400" />
            <span>Auto-unlock next episodes when playing continuously</span>
          </div>
        </label>

        {/* Insufficient Coins Notification / Top-Up Action */}
        {!hasEnoughForSingle && !isVip && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4 text-xs">
            <div className="flex items-start gap-2.5">
              <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-text mb-1">Need more coins?</p>
                <p className="text-text-muted leading-relaxed mb-3">
                  Claim your free daily check-in coins or top up your wallet to continue watching.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {onOpenCheckIn && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenCheckIn();
                      }}
                      className="px-3 py-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-sm"
                    >
                      Daily Free Coins
                    </button>
                  )}
                  <Link
                    href="/account/wallet"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-full bg-surface-elevated hover:bg-surface border border-border text-text font-bold text-xs transition-colors shadow-sm"
                  >
                    Top Up Coins
                  </Link>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-full border border-border text-text hover:bg-surface font-semibold text-xs transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer Dismiss Button */}
        {hasEnoughForSingle && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isUnlockingSingle || isUnlockingBundle}
              className="px-4 py-2 rounded-full border border-border text-text hover:bg-surface font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
