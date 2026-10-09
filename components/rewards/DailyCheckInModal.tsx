"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Flame,
  Coins,
  Check,
  Gift,
  Sparkles,
  Clock,
  Loader2,
  Calendar,
} from "lucide-react";
import Modal from "@/components/Modal";
import { useDailyReward } from "@/contexts/DailyRewardContext";
import { useAuth } from "@/contexts/AuthContext";

export interface DailyCheckInModalProps {
  open?: boolean;
  onClose?: () => void;
  onBalanceUpdated?: (newBalance: number) => void;
}

interface ScheduleDay {
  day: number;
  coins: number;
  claimed?: boolean;
  isCurrent?: boolean;
}

const DEFAULT_SCHEDULE: ScheduleDay[] = [
  { day: 1, coins: 5 },
  { day: 2, coins: 10 },
  { day: 3, coins: 10 },
  { day: 4, coins: 15 },
  { day: 5, coins: 15 },
  { day: 6, coins: 20 },
  { day: 7, coins: 50 },
];

export default function DailyCheckInModal({
  open: controlledOpen,
  onClose: controlledOnClose,
  onBalanceUpdated,
}: DailyCheckInModalProps) {
  const { user } = useAuth();
  const {
    status,
    isClaiming,
    canCheckIn,
    claimReward,
    countdown,
    isModalOpen,
    closeRewardModal,
  } = useDailyReward();

  const isOpen = controlledOpen !== undefined ? controlledOpen : isModalOpen;
  const handleClose = controlledOnClose || closeRewardModal;

  const [claimSuccessMessage, setClaimSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const streak = status?.currentStreak ?? 0;
  const schedule: ScheduleDay[] =
    status?.streakSchedule && status.streakSchedule.length === 7
      ? status.streakSchedule
      : status?.schedule && status.schedule.length === 7
      ? status.schedule
      : DEFAULT_SCHEDULE;

  // The active day index to claim today (1 to 7)
  const activeDayNumber = canCheckIn
    ? Math.min(7, streak + 1)
    : Math.max(1, Math.min(7, streak));

  const handleClaim = async () => {
    if (!canCheckIn || isClaiming) return;
    setErrorMessage(null);

    const res = await claimReward();
    if (res.success) {
      setClaimSuccessMessage(`Claimed +${res.coinsAwarded} Coins! Streak: ${res.streakCount} days.`);
      if (onBalanceUpdated) {
        onBalanceUpdated(res.newBalance);
      }
      setTimeout(() => {
        setClaimSuccessMessage(null);
      }, 4000);
    } else {
      setErrorMessage(res.error || "Failed to claim reward. Please try again.");
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <div className="w-full text-center">
        {/* Header Icon & Title */}
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm">
          <Gift size={28} className="animate-bounce" />
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h2 className="font-display font-extrabold text-xl text-text">
            Daily Check-in Rewards
          </h2>
        </div>

        {/* Streak Pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold mb-4">
          <Flame size={14} className="fill-orange-500" />
          <span>{streak > 0 ? `${streak}-Day Streak` : "Start Your Streak Today"}</span>
        </div>

        <p className="text-xs text-text-muted mb-5 max-w-sm mx-auto">
          Check in every day to claim free coins. Keep your streak alive to unlock the 50-coin Day 7 reward!
        </p>

        {/* Success Alert */}
        {claimSuccessMessage && (
          <div
            role="status"
            className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in"
          >
            <Sparkles size={15} />
            <span>{claimSuccessMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-medium flex items-center justify-center gap-2"
          >
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 7-Day Visual Calendar Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-6">
          {schedule.map((item) => {
            const isDayCompleted = !canCheckIn
              ? item.day <= streak
              : item.day <= streak;
            const isToday = item.day === activeDayNumber;
            const isDay7 = item.day === 7;

            return (
              <div
                key={item.day}
                className={`relative rounded-xl p-2.5 flex flex-col items-center justify-center border transition-all duration-150 ${
                  isDay7 ? "col-span-2 sm:col-span-1" : ""
                } ${
                  isDayCompleted
                    ? "bg-surface-elevated/70 border-emerald-500/40 text-emerald-500"
                    : isToday && canCheckIn
                    ? "bg-gradient-to-b from-amber-500/20 to-amber-500/5 border-amber-500 ring-2 ring-amber-500/30 shadow-md scale-105"
                    : "bg-surface border-border text-text-muted"
                }`}
              >
                {/* Day Label */}
                <span className="text-[10px] font-bold uppercase tracking-wider mb-1">
                  Day {item.day}
                </span>

                {/* Coin Icon or Checkmark */}
                <div className="my-1">
                  {isDayCompleted ? (
                    <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check size={13} strokeWidth={3} className="text-emerald-500" />
                    </div>
                  ) : (
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        isDay7 ? "bg-amber-500/30 text-amber-300" : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      <Coins size={14} />
                    </div>
                  )}
                </div>

                {/* Coin Value */}
                <span
                  className={`text-xs font-black ${
                    isDayCompleted
                      ? "text-emerald-500 line-through"
                      : isDay7
                      ? "text-amber-300"
                      : isToday && canCheckIn
                      ? "text-amber-400 font-extrabold"
                      : "text-text"
                  }`}
                >
                  +{item.coins}
                </span>

                {/* Mystery Chest Badge for Day 7 */}
                {isDay7 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500 text-black shadow-sm">
                    Bonus
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Claim Action / Countdown Banner */}
        <div className="space-y-3">
          {!user ? (
            <div className="space-y-2">
              <Link
                href="/login"
                onClick={handleClose}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Coins size={16} />
                <span>Sign In to Claim Free Coins</span>
              </Link>
              <p className="text-[11px] text-text-muted">
                Create an account or sign in to start claiming daily coins.
              </p>
            </div>
          ) : canCheckIn ? (
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isClaiming ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Claiming Reward...</span>
                </>
              ) : (
                <>
                  <Coins size={16} />
                  <span>Claim Today&apos;s Reward (+{schedule[activeDayNumber - 1]?.coins ?? 10} Coins)</span>
                </>
              )}
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-surface-elevated border border-border flex flex-col items-center justify-center gap-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-500 font-bold">
                <Check size={15} strokeWidth={3} />
                <span>Checked in today! Streak continued.</span>
              </div>
              <div className="flex items-center gap-1.5 text-text-muted">
                <Clock size={13} />
                <span>Next reward in {countdown.formatted} (UTC)</span>
              </div>
            </div>
          )}

          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-2.5 rounded-xl border border-border text-text hover:bg-surface font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
