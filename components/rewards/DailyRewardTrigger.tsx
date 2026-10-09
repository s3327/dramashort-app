"use client";

import { Gift, Flame } from "lucide-react";
import { useDailyReward } from "@/contexts/DailyRewardContext";
import { useAuth } from "@/contexts/AuthContext";

export interface DailyRewardTriggerProps {
  variant?: "floating" | "compact" | "header";
  className?: string;
  onGuestClick?: () => void;
}

export default function DailyRewardTrigger({
  variant = "floating",
  className = "",
  onGuestClick,
}: DailyRewardTriggerProps) {
  const { user } = useAuth();
  const { canCheckIn, status, openRewardModal } = useDailyReward();

  const handleClick = () => {
    if (!user) {
      if (onGuestClick) {
        onGuestClick();
      } else {
        openRewardModal();
      }
      return;
    }
    openRewardModal();
  };

  const streak = status?.currentStreak || 0;

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label="Daily Check-in Rewards"
        className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
          canCheckIn
            ? "bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 shadow-sm"
            : "bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-elevated"
        } ${className}`}
      >
        {canCheckIn ? (
          <>
            <Gift size={14} className="text-amber-400 animate-pulse" />
            <span>Free Coins</span>
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping absolute -top-0.5 -right-0.5" />
            <span className="h-2 w-2 rounded-full bg-amber-400 absolute -top-0.5 -right-0.5" />
          </>
        ) : (
          <>
            <Flame size={14} className={streak > 0 ? "text-orange-500 fill-orange-500" : "text-text-muted"} />
            <span>{streak > 0 ? `${streak}d` : "Rewards"}</span>
          </>
        )}
      </button>
    );
  }

  // Floating variant (for mobile/tablet screens or bottom corner)
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Daily Check-in Rewards"
      className={`fixed bottom-20 right-4 md:bottom-8 md:right-8 z-40 p-3 rounded-full shadow-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
        canCheckIn
          ? "bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:scale-105 active:scale-95 shadow-amber-500/30 animate-bounce"
          : "bg-surface border border-border text-text hover:bg-surface-elevated hover:scale-105"
      } ${className}`}
    >
      <div className="relative flex items-center justify-center">
        {canCheckIn ? (
          <>
            <Gift size={20} />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 border-2 border-white animate-pulse" />
          </>
        ) : (
          <Flame size={20} className={streak > 0 ? "text-orange-500 fill-orange-500" : "text-text-muted"} />
        )}
      </div>
    </button>
  );
}
