"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDailyCheckInStatusClient,
  claimDailyCheckInClient,
} from "@/lib/services/wallet.service";
import type { DailyCheckInStatus, DailyCheckInResult } from "@/types/wallet";

export interface UtcCountdown {
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
}

export function getTimeUntilUtcMidnight(): UtcCountdown {
  const now = new Date();
  const utcNow = now.getTime();
  const nextMidnightUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0
  );
  const diffMs = Math.max(0, nextMidnightUtc - utcNow);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const formatted = `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
  return { hours, minutes, seconds, formatted };
}

export interface DailyRewardContextValue {
  status: DailyCheckInStatus | null;
  isLoading: boolean;
  isClaiming: boolean;
  canCheckIn: boolean;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  openRewardModal: () => void;
  closeRewardModal: () => void;
  refreshStatus: () => Promise<void>;
  claimReward: () => Promise<DailyCheckInResult>;
  countdown: UtcCountdown;
}

const DailyRewardContext = createContext<DailyRewardContextValue | undefined>(undefined);

export function DailyRewardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<DailyCheckInStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [countdown, setCountdown] = useState<UtcCountdown>(getTimeUntilUtcMidnight());

  // Update countdown every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getTimeUntilUtcMidnight());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (!user) {
      setStatus(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await getDailyCheckInStatusClient();
      if (data) setStatus(data);
    } catch {
      // Ignore network errors
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load status on mount and when user auth state changes
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const claimReward = useCallback(async (): Promise<DailyCheckInResult> => {
    if (isClaiming) {
      return {
        success: false,
        streakCount: status?.currentStreak || 1,
        coinsAwarded: 0,
        newBalance: 0,
        alreadyClaimed: true,
        error: "Claim in progress",
      };
    }

    setIsClaiming(true);
    try {
      const result = await claimDailyCheckInClient();
      if (result.success) {
        // Refresh status after successful claim
        await refreshStatus();
      }
      return result;
    } finally {
      setIsClaiming(false);
    }
  }, [isClaiming, status?.currentStreak, refreshStatus]);

  const openRewardModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeRewardModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const canCheckIn = Boolean(user && status?.canCheckIn);

  return (
    <DailyRewardContext.Provider
      value={{
        status,
        isLoading,
        isClaiming,
        canCheckIn,
        isModalOpen,
        setIsModalOpen,
        openRewardModal,
        closeRewardModal,
        refreshStatus,
        claimReward,
        countdown,
      }}
    >
      {children}
    </DailyRewardContext.Provider>
  );
}

export function useDailyReward(): DailyRewardContextValue {
  const context = useContext(DailyRewardContext);
  if (!context) {
    throw new Error("useDailyReward must be used within a DailyRewardProvider");
  }
  return context;
}
