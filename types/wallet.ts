/**
 * Domain types for Phase 8: Short Drama Monetization Engine
 * Covers Wallets, Coin Transactions, Entitlements (Unlocked Episodes), and Daily Check-ins.
 */

export type CoinTransactionType =
  | "purchase"
  | "episode_unlock"
  | "daily_checkin"
  | "streak_bonus"
  | "referral"
  | "admin_grant"
  | "refund";

export interface WalletInfo {
  userId: string;
  balance: number;
  isVip: boolean;
  vipExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number; // positive for credit, negative for debit
  balanceAfter: number;
  transactionType: CoinTransactionType;
  referenceId: string | null;
  description: string;
  createdAt: string;
}

export interface UnlockedEpisode {
  id: string;
  userId: string;
  dramaId: string;
  dramaSlug: string;
  episodeId: string;
  episodeNumber: number;
  coinsSpent: number;
  unlockedAt: string;
}

export interface DailyCheckInStatus {
  canCheckIn: boolean;
  currentStreak: number;
  nextStreak: number;
  nextCoinsReward: number;
  lastCheckinDate: string | null;
  streakSchedule: Array<{
    day: number;
    coins: number;
    claimed: boolean;
    isCurrent: boolean;
  }>;
}

export interface DailyCheckInResult {
  success: boolean;
  checkinId: string;
  streakCount: number;
  coinsAwarded: number;
  newBalance: number;
}

export interface UnlockEpisodeResult {
  success: boolean;
  alreadyUnlocked: boolean;
  unlockedEpisodeId: string;
  coinsSpent: number;
  newBalance: number;
  isVipUnlock?: boolean;
  error?: string;
}

export interface EpisodeLockStatus {
  episodeId: string;
  episodeNumber: number;
  isFree: boolean;
  isLocked: boolean;
  coinsCost: number;
  isUnlockedByUser: boolean;
  isVipBypass: boolean;
}

export interface UnlockEpisodeInput {
  dramaId: string;
  dramaSlug: string;
  episodeId: string;
  episodeNumber: number;
  cost?: number;
}
