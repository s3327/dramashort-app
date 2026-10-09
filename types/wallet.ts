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
  schedule?: Array<{
    day: number;
    coins: number;
    claimed?: boolean;
    isCurrent?: boolean;
  }>;
}

export interface DailyCheckInResult {
  success: boolean;
  checkinId?: string;
  streakCount: number;
  coinsAwarded: number;
  newBalance: number;
  alreadyClaimed?: boolean;
  error?: string;
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

export interface BulkUnlockRemainingInput {
  dramaId: string;
  dramaSlug: string;
}

export interface BulkUnlockResult {
  success: boolean;
  episodesUnlockedCount: number;
  unlockedEpisodeNumbers: number[];
  standardCost: number;
  discountedCost: number;
  discountPercent: number;
  newBalance: number;
  isVipUnlock?: boolean;
  error?: string;
}

export interface DramaEpisodesLockSummary {
  dramaId: string;
  dramaSlug: string;
  totalEpisodes: number;
  freeEpisodesCount: number;
  lockedEpisodesCount: number;
  userUnlockedCount: number;
  remainingLockedCount: number;
  bundleUnlockCost: number;
  bundleSavingsCoins: number;
  episodes: EpisodeLockStatus[];
}

export type CoinPackageId =
  | "coins_starter_100"
  | "coins_popular_350"
  | "coins_binge_800"
  | "vip_weekly_pass";

export interface CoinPackage {
  id: CoinPackageId;
  name: string;
  coins: number;
  bonusCoins: number;
  totalCoins: number;
  priceUsd: number;
  formattedPrice: string;
  badge?: string;
  isVipPass?: boolean;
  vipDays?: number;
  popular?: boolean;
  bestValue?: boolean;
  description: string;
}

export interface CreateCheckoutSessionInput {
  packageId: CoinPackageId;
  returnUrl?: string;
}

export interface CreateCheckoutSessionResult {
  success: boolean;
  checkoutUrl?: string;
  sessionId?: string;
  referenceId: string;
  simulatedInstantSuccess?: boolean;
  newBalance?: number;
  isVip?: boolean;
  error?: string;
}

export interface PaymentWebhookPayload {
  eventId: string;
  eventType: "payment.completed" | "payment.failed" | "payment.refunded";
  userId: string;
  packageId: CoinPackageId;
  referenceId: string;
  amountUsd: number;
  createdAt: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  duplicate: boolean;
  coinsCredited?: number;
  vipGranted?: boolean;
  newBalance?: number;
  error?: string;
}

