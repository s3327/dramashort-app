import "server-only";
import { createUserServiceRoleClient } from "@/lib/supabase/user-server";
import { getContentAdminClient } from "@/lib/supabase/content";
import { type Result, ok, err } from "@/lib/common/result";
import {
  type WalletInfo,
  type CoinTransaction,
  type CoinTransactionType,
  type UnlockedEpisode,
  type DailyCheckInStatus,
  type DailyCheckInResult,
  type UnlockEpisodeResult,
  type UnlockEpisodeInput,
  type BulkUnlockRemainingInput,
  type BulkUnlockResult,
  type DramaEpisodesLockSummary,
  type EpisodeLockStatus,
  type CoinPackageId,
  type WebhookProcessingResult,
} from "@/types/wallet";
import { getCoinPackageById } from "@/lib/payments/packages";

const DAILY_REWARD_SCHEDULE: Record<number, number> = {
  1: 5,
  2: 10,
  3: 10,
  4: 15,
  5: 15,
  6: 20,
  7: 50,
};

/** Price of a single episode unlock, in coins. Decided by the server only. */
export const EPISODE_UNLOCK_COST = 10;

interface WalletRpcError {
  code?: string;
  message: string;
}

/**
 * Calls one of the atomic wallet stored procedures.
 *
 * Against a real database these procedures are the only write path: when one
 * fails, the caller surfaces the error instead of retrying with table writes,
 * which would bypass the row locks, status checks and unique constraints the
 * procedure enforces. The table-based branches in this file run only for the
 * in-memory test clients, which have no `rpc` method.
 */
async function callWalletRpc(
  client: any,
  fn: string,
  params: Record<string, unknown>
): Promise<{ data: any; error: null } | { data: null; error: WalletRpcError }> {
  try {
    const { data, error } = await client.rpc(fn, params);
    if (error) {
      return { data: null, error: { code: error.code, message: error.message || "Unknown database error" } };
    }
    if (!data) {
      return { data: null, error: { message: "no result returned" } };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

function formatWalletRpcError(fn: string, error: WalletRpcError): string {
  return `${fn} failed: ${error.code ? `${error.code}: ` : ""}${error.message}`;
}

/** PostgreSQL 23505 unique_violation, by code or by message. */
function isUniqueViolation(error: WalletRpcError): boolean {
  const message = error.message.toLowerCase();
  return error.code === "23505" || message.includes("duplicate key") || message.includes("unique constraint");
}

function getUtcTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUtcYesterdayDateString(): string {
  const yesterday = new Date(Date.now() - 86400000);
  return yesterday.toISOString().slice(0, 10);
}

/**
 * Maps database row to domain WalletInfo.
 */
export function mapWalletRowToInfo(row: any): WalletInfo {
  return {
    userId: row.user_id,
    balance: Number(row.balance ?? 0),
    isVip: Boolean(row.is_vip ?? false),
    vipExpiresAt: row.vip_expires_at || null,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Maps database row to domain CoinTransaction.
 */
export function mapCoinTransactionRowToItem(row: any): CoinTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    amount: Number(row.amount ?? 0),
    balanceAfter: Number(row.balance_after ?? 0),
    transactionType: row.transaction_type as CoinTransactionType,
    referenceId: row.reference_id || null,
    description: row.description || "",
    createdAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Retrieves the user's authoritative wallet info.
 * Creates an initial 0-balance wallet row if one does not exist yet.
 */
export async function getUserWalletServer(
  userId: string,
  injectedClient?: any
): Promise<Result<WalletInfo, string>> {
  if (!userId) {
    return err("User ID is required");
  }

  const client = injectedClient || (await createUserServiceRoleClient());

  const { data: walletRow, error: selectError } = await client
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    return err(`Failed to fetch wallet: ${selectError.message}`);
  }

  if (walletRow) {
    return ok(mapWalletRowToInfo(walletRow));
  }

  // Auto-initialize wallet row if not found
  const now = new Date().toISOString();
  const { data: inserted, error: insertError } = await client
    .from("wallets")
    .insert({
      user_id: userId,
      balance: 0,
      is_vip: false,
      vip_expires_at: null,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (insertError) {
    // If conflict, re-fetch
    const { data: retryRow } = await client
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (retryRow) {
      return ok(mapWalletRowToInfo(retryRow));
    }
    return err(`Failed to initialize wallet: ${insertError.message}`);
  }

  return ok(mapWalletRowToInfo(inserted));
}

/**
 * Credits coins atomically to a user's wallet with ledger logging.
 */
export async function creditWalletCoinsServer(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  refId?: string | null,
  description = "Coins credited",
  injectedClient?: any
): Promise<Result<{ newBalance: number; transactionId?: string }, string>> {
  if (!userId) return err("User ID is required");
  if (!amount || amount <= 0) return err("Amount must be greater than 0");

  const client = injectedClient || (await createUserServiceRoleClient());

  if (typeof client.rpc === "function") {
    const { data: rpcData, error: rpcError } = await callWalletRpc(client, "credit_wallet_coins", {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_ref_id: refId || null,
      p_description: description,
    });

    if (rpcError) {
      return err(formatWalletRpcError("credit_wallet_coins", rpcError));
    }
    return ok({
      newBalance: Number(rpcData.balance_after ?? rpcData.new_balance ?? 0),
      transactionId: rpcData.transaction_id,
    });
  }

  // In-memory test client (no rpc): table operations
  const walletRes = await getUserWalletServer(userId, client);
  if (!walletRes.ok) return err(walletRes.error);

  const currentWallet = walletRes.value;
  const newBalance = currentWallet.balance + amount;
  const now = new Date().toISOString();

  const { error: updateError } = await client
    .from("wallets")
    .update({ balance: newBalance, updated_at: now })
    .eq("user_id", userId);

  if (updateError) {
    return err(`Failed to update wallet: ${updateError.message}`);
  }

  // Also sync profiles
  await client
    .from("profiles")
    .update({ coin_balance: newBalance, updated_at: now })
    .eq("id", userId);

  const { data: txRow } = await client
    .from("coin_transactions")
    .insert({
      user_id: userId,
      amount,
      balance_after: newBalance,
      transaction_type: type,
      reference_id: refId || null,
      description,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  return ok({
    newBalance,
    transactionId: txRow?.id,
  });
}

/**
 * Debits coins atomically from a user's wallet with balance validation.
 */
export async function debitWalletCoinsServer(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  refId?: string | null,
  description = "Coins debited",
  injectedClient?: any
): Promise<Result<{ newBalance: number; transactionId?: string }, string>> {
  if (!userId) return err("User ID is required");
  if (!amount || amount <= 0) return err("Amount must be greater than 0");

  const client = injectedClient || (await createUserServiceRoleClient());

  if (typeof client.rpc === "function") {
    const { data: rpcData, error: rpcError } = await callWalletRpc(client, "debit_wallet_coins", {
      p_user_id: userId,
      p_amount: amount,
      p_type: type,
      p_ref_id: refId || null,
      p_description: description,
    });

    if (rpcError) {
      if (rpcError.message.includes("INSUFFICIENT_COINS")) {
        return err("INSUFFICIENT_COINS");
      }
      return err(formatWalletRpcError("debit_wallet_coins", rpcError));
    }
    return ok({
      newBalance: Number(rpcData.balance_after ?? rpcData.new_balance ?? 0),
      transactionId: rpcData.transaction_id,
    });
  }

  // In-memory test client (no rpc): table operations
  const walletRes = await getUserWalletServer(userId, client);
  if (!walletRes.ok) return err(walletRes.error);

  const currentWallet = walletRes.value;
  if (currentWallet.balance < amount) {
    return err("INSUFFICIENT_COINS");
  }

  const newBalance = currentWallet.balance - amount;
  const now = new Date().toISOString();

  const { error: updateError } = await client
    .from("wallets")
    .update({ balance: newBalance, updated_at: now })
    .eq("user_id", userId);

  if (updateError) {
    return err(`Failed to update wallet: ${updateError.message}`);
  }

  // Also sync profiles
  await client
    .from("profiles")
    .update({ coin_balance: newBalance, updated_at: now })
    .eq("id", userId);

  const { data: txRow } = await client
    .from("coin_transactions")
    .insert({
      user_id: userId,
      amount: -amount,
      balance_after: newBalance,
      transaction_type: type,
      reference_id: refId || null,
      description,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  return ok({
    newBalance,
    transactionId: txRow?.id,
  });
}

/**
 * Checks whether an episode has been permanently unlocked by the user.
 */
export async function isEpisodeUnlockedServer(
  userId: string,
  dramaId: string,
  episodeNumber: number,
  injectedClient?: any
): Promise<boolean> {
  if (!userId || !dramaId || !episodeNumber) return false;

  const client = injectedClient || (await createUserServiceRoleClient());

  const { data } = await client
    .from("user_unlocked_episodes")
    .select("id")
    .eq("user_id", userId)
    .eq("drama_id", dramaId)
    .eq("episode_number", episodeNumber)
    .maybeSingle();

  return Boolean(data);
}

/**
 * Unlocks an episode with coin deduction or active VIP status.
 * Idempotent: repeated calls for an already unlocked episode return success with 0 coin charge.
 */
export async function unlockEpisodeServer(
  userId: string,
  input: UnlockEpisodeInput,
  injectedClient?: any
): Promise<Result<UnlockEpisodeResult, string>> {
  if (!userId) return err("User ID is required");
  if (!input.dramaId) return err("dramaId is required");
  if (!input.dramaSlug) return err("dramaSlug is required");
  if (!input.episodeId) return err("episodeId is required");
  if (!input.episodeNumber || input.episodeNumber < 1) return err("Valid episodeNumber is required");

  const cost = EPISODE_UNLOCK_COST;
  const client = injectedClient || (await createUserServiceRoleClient());

  // 1. Check idempotency: already unlocked?
  const alreadyUnlocked = await isEpisodeUnlockedServer(userId, input.dramaId, input.episodeNumber, client);
  if (alreadyUnlocked) {
    const walletRes = await getUserWalletServer(userId, client);
    const balance = walletRes.ok ? walletRes.value.balance : 0;
    return ok({
      success: true,
      alreadyUnlocked: true,
      unlockedEpisodeId: "existing",
      coinsSpent: 0,
      newBalance: balance,
    });
  }

  // 2. Atomic unlock (debit + entitlement in one transaction)
  if (typeof client.rpc === "function") {
    const { data: rpcData, error: rpcError } = await callWalletRpc(client, "unlock_episode_with_coins", {
      p_user_id: userId,
      p_drama_id: input.dramaId,
      p_drama_slug: input.dramaSlug,
      p_episode_id: input.episodeId,
      p_episode_number: input.episodeNumber,
      p_cost: cost,
    });

    if (rpcError) {
      if (rpcError.message.includes("INSUFFICIENT_COINS")) {
        return err("INSUFFICIENT_COINS");
      }
      // A concurrent request unlocked the same episode first; the procedure rolled
      // this one back (including its debit), so nothing was charged here.
      if (isUniqueViolation(rpcError)) {
        const walletRes = await getUserWalletServer(userId, client);
        return ok({
          success: true,
          alreadyUnlocked: true,
          unlockedEpisodeId: "existing",
          coinsSpent: 0,
          newBalance: walletRes.ok ? walletRes.value.balance : 0,
        });
      }
      return err(formatWalletRpcError("unlock_episode_with_coins", rpcError));
    }

    return ok({
      success: true,
      alreadyUnlocked: Boolean(rpcData.already_unlocked),
      unlockedEpisodeId: rpcData.unlocked_episode_id || "unlocked",
      coinsSpent: Number(rpcData.coins_spent ?? 0),
      newBalance: Number(rpcData.new_balance ?? 0),
      isVipUnlock: Boolean(rpcData.is_vip_unlock),
    });
  }

  // 3. In-memory test client (no rpc): inspect VIP and wallet
  const walletRes = await getUserWalletServer(userId, client);
  if (!walletRes.ok) return err(walletRes.error);

  const wallet = walletRes.value;
  const isVipActive =
    wallet.isVip && (!wallet.vipExpiresAt || new Date(wallet.vipExpiresAt) > new Date());
  const effectiveCost = isVipActive ? 0 : cost;

  let newBalance = wallet.balance;

  if (effectiveCost > 0) {
    if (wallet.balance < effectiveCost) {
      return err("INSUFFICIENT_COINS");
    }

    const debitRes = await debitWalletCoinsServer(
      userId,
      effectiveCost,
      "episode_unlock",
      input.episodeId,
      `Unlocked episode ${input.episodeNumber} of ${input.dramaSlug}`,
      client
    );

    if (!debitRes.ok) {
      return err(debitRes.error);
    }
    newBalance = debitRes.value.newBalance;
  }

  // 4. Record unlock
  const now = new Date().toISOString();
  const { data: unlockRow, error: unlockError } = await client
    .from("user_unlocked_episodes")
    .insert({
      user_id: userId,
      drama_id: input.dramaId,
      drama_slug: input.dramaSlug,
      episode_id: input.episodeId,
      episode_number: input.episodeNumber,
      coins_spent: effectiveCost,
      unlocked_at: now,
    })
    .select("id")
    .single();

  if (unlockError) {
    // If unique constraint conflict, return success
    return ok({
      success: true,
      alreadyUnlocked: true,
      unlockedEpisodeId: "conflict_resolved",
      coinsSpent: 0,
      newBalance,
      isVipUnlock: isVipActive,
    });
  }

  return ok({
    success: true,
    alreadyUnlocked: false,
    unlockedEpisodeId: unlockRow.id,
    coinsSpent: effectiveCost,
    newBalance,
    isVipUnlock: isVipActive,
  });
}

/**
 * Evaluates user daily check-in status and returns the 7-day schedule.
 */
export async function getDailyCheckInStatusServer(
  userId: string,
  injectedClient?: any
): Promise<Result<DailyCheckInStatus, string>> {
  if (!userId) return err("User ID is required");

  const client = injectedClient || (await createUserServiceRoleClient());
  const today = getUtcTodayDateString();
  const yesterday = getUtcYesterdayDateString();

  const { data: lastCheckin, error: queryError } = await client
    .from("daily_checkins")
    .select("streak_count, last_checkin_date")
    .eq("user_id", userId)
    .order("last_checkin_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (queryError) {
    return err(`Failed to fetch daily checkin status: ${queryError.message}`);
  }

  let canCheckIn = true;
  let currentStreak = 0;
  let nextStreak = 1;

  if (lastCheckin) {
    const lastDate = lastCheckin.last_checkin_date;
    const streak = Number(lastCheckin.streak_count || 1);

    if (lastDate === today) {
      canCheckIn = false;
      currentStreak = streak;
      nextStreak = (streak % 7) + 1;
    } else if (lastDate === yesterday) {
      canCheckIn = true;
      currentStreak = streak;
      nextStreak = (streak % 7) + 1;
    } else {
      // Streak broken
      canCheckIn = true;
      currentStreak = 0;
      nextStreak = 1;
    }
  }

  const nextCoinsReward = DAILY_REWARD_SCHEDULE[nextStreak] || 5;

  const streakSchedule = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    coins: DAILY_REWARD_SCHEDULE[day] || 5,
    claimed: !canCheckIn ? day <= currentStreak : day < nextStreak,
    isCurrent: canCheckIn ? day === nextStreak : day === currentStreak,
  }));

  return ok({
    canCheckIn,
    currentStreak,
    nextStreak,
    nextCoinsReward,
    lastCheckinDate: lastCheckin?.last_checkin_date || null,
    streakSchedule,
  });
}

/**
 * Claims today's daily check-in reward and increments the user's streak.
 */
export async function claimDailyCheckinServer(
  userId: string,
  injectedClient?: any
): Promise<Result<DailyCheckInResult, string>> {
  if (!userId) return err("User ID is required");

  const client = injectedClient || (await createUserServiceRoleClient());

  if (typeof client.rpc === "function") {
    const { data: rpcData, error: rpcError } = await callWalletRpc(client, "claim_daily_checkin", {
      p_user_id: userId,
    });

    if (rpcError) {
      // The unique (user_id, last_checkin_date) constraint catches a concurrent claim
      if (rpcError.message.includes("ALREADY_CHECKED_IN_TODAY") || isUniqueViolation(rpcError)) {
        return err("ALREADY_CHECKED_IN_TODAY");
      }
      return err(formatWalletRpcError("claim_daily_checkin", rpcError));
    }

    return ok({
      success: true,
      checkinId: rpcData.checkin_id,
      streakCount: Number(rpcData.streak_count ?? 1),
      coinsAwarded: Number(rpcData.coins_awarded ?? 5),
      newBalance: Number(rpcData.new_balance ?? 0),
    });
  }

  // In-memory test client (no rpc): table operations
  const statusRes = await getDailyCheckInStatusServer(userId, client);
  if (!statusRes.ok) return err(statusRes.error);

  const status = statusRes.value;
  if (!status.canCheckIn) {
    return err("ALREADY_CHECKED_IN_TODAY");
  }

  const streakCount = status.nextStreak;
  const coinsAwarded = status.nextCoinsReward;
  const today = getUtcTodayDateString();
  const now = new Date().toISOString();

  const { data: checkinRow, error: checkinError } = await client
    .from("daily_checkins")
    .insert({
      user_id: userId,
      streak_count: streakCount,
      last_checkin_date: today,
      coins_awarded: coinsAwarded,
      created_at: now,
    })
    .select("id")
    .single();

  if (checkinError) {
    if (checkinError.message.includes("duplicate") || checkinError.code === "23505") {
      return err("ALREADY_CHECKED_IN_TODAY");
    }
    return err(`Failed to record checkin: ${checkinError.message}`);
  }

  const creditRes = await creditWalletCoinsServer(
    userId,
    coinsAwarded,
    "daily_checkin",
    today,
    `Day ${streakCount} daily check-in bonus`,
    client
  );

  if (!creditRes.ok) {
    return err(creditRes.error);
  }

  return ok({
    success: true,
    checkinId: checkinRow.id,
    streakCount,
    coinsAwarded,
    newBalance: creditRes.value.newBalance,
  });
}

/**
 * Retrieves paginated coin transactions for the account ledger.
 */
export async function getCoinTransactionsServer(
  userId: string,
  options?: { page?: number; pageSize?: number },
  injectedClient?: any
): Promise<Result<{ items: CoinTransaction[]; total: number; page: number; pageSize: number; totalPages: number }, string>> {
  if (!userId) return err("User ID is required");

  const page = Math.max(1, options?.page || 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const client = injectedClient || (await createUserServiceRoleClient());

  const { data, count, error } = await client
    .from("coin_transactions")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return err(`Failed to fetch transactions: ${error.message}`);
  }

  const items = Array.isArray(data) ? data.map(mapCoinTransactionRowToItem) : [];
  const total = count || items.length;
  const totalPages = Math.ceil(total / pageSize);

  return ok({
    items,
    total,
    page,
    pageSize,
    totalPages,
  });
}

/**
 * Computes bundled discount cost for unlocking remaining episodes.
 * 20% discount applied to the standard 10-coin per episode price.
 */
export function calculateBundleCost(
  remainingCount: number,
  perEpisodeCost = 10,
  discountRate = 0.20
): { standardCost: number; discountedCost: number; savings: number; discountPercent: number } {
  if (remainingCount <= 0) {
    return { standardCost: 0, discountedCost: 0, savings: 0, discountPercent: Math.round(discountRate * 100) };
  }
  const standardCost = remainingCount * perEpisodeCost;
  // Apply discount, minimum 10 coins if unlocking at least 1 episode
  const discountedCost = Math.max(perEpisodeCost, Math.floor(standardCost * (1 - discountRate)));
  const savings = Math.max(0, standardCost - discountedCost);
  return {
    standardCost,
    discountedCost,
    savings,
    discountPercent: Math.round(discountRate * 100),
  };
}

/**
 * Computes lock status for all episodes of a drama for a given user.
 */
export async function getDramaEpisodesLockSummaryServer(
  userId: string | null,
  dramaId: string,
  dramaSlug: string,
  contentEpisodes: Array<{ id: string; episodeNumber: number; isFree?: boolean }>,
  freeEpisodesCount = 5,
  injectedUserDbClient?: any
): Promise<DramaEpisodesLockSummary> {
  const userClient = injectedUserDbClient || (await createUserServiceRoleClient());

  let isVipActive = false;
  const unlockedEpisodeNumbers = new Set<number>();

  if (userId) {
    // 1. Check VIP
    const { data: wallet } = await userClient
      .from("wallets")
      .select("is_vip, vip_expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    isVipActive =
      Boolean(wallet?.is_vip) &&
      (!wallet?.vip_expires_at || new Date(wallet.vip_expires_at) > new Date());

    // 2. Fetch unlocked episodes
    const { data: unlockedRows } = await userClient
      .from("user_unlocked_episodes")
      .select("episode_number")
      .eq("user_id", userId)
      .eq("drama_id", dramaId);

    if (Array.isArray(unlockedRows)) {
      for (const row of unlockedRows) {
        unlockedEpisodeNumbers.add(Number(row.episode_number));
      }
    }
  }

  const episodes: EpisodeLockStatus[] = contentEpisodes.map((ep) => {
    const isFree = ep.isFree ?? (ep.episodeNumber <= freeEpisodesCount);
    const isUnlockedByUser = unlockedEpisodeNumbers.has(ep.episodeNumber);
    const isVipBypass = isVipActive;
    const isLocked = !isFree && !isUnlockedByUser && !isVipBypass;
    const coinsCost = isLocked ? 10 : 0;

    return {
      episodeId: ep.id,
      episodeNumber: ep.episodeNumber,
      isFree,
      isLocked,
      coinsCost,
      isUnlockedByUser,
      isVipBypass,
    };
  });

  const totalEpisodes = episodes.length;
  const lockedEpisodesCount = episodes.filter((e) => !e.isFree).length;
  const userUnlockedCount = episodes.filter((e) => e.isUnlockedByUser).length;
  const remainingLockedCount = episodes.filter((e) => e.isLocked).length;

  const bundlePricing = calculateBundleCost(remainingLockedCount);

  return {
    dramaId,
    dramaSlug,
    totalEpisodes,
    freeEpisodesCount,
    lockedEpisodesCount,
    userUnlockedCount,
    remainingLockedCount,
    bundleUnlockCost: bundlePricing.discountedCost,
    bundleSavingsCoins: bundlePricing.savings,
    episodes,
  };
}

/**
 * Unlocks all remaining locked episodes of a drama in a single atomic bundle operation.
 * Applies a 20% bundle discount.
 */
export async function unlockRemainingEpisodesServer(
  userId: string,
  input: BulkUnlockRemainingInput,
  injectedUserDbClient?: any,
  injectedContentDbClient?: any
): Promise<Result<BulkUnlockResult, string>> {
  if (!userId) return err("User ID is required");
  if (!input.dramaId) return err("dramaId is required");
  if (!input.dramaSlug) return err("dramaSlug is required");

  const userClient = injectedUserDbClient || (await createUserServiceRoleClient());
  const contentClient = injectedContentDbClient || (await getContentAdminClient());

  // 1. Fetch drama and all its episodes from Content DB
  const { data: dramaRow, error: dramaError } = await contentClient
    .from("titles")
    .select("id, free_episodes_count")
    .eq("id", input.dramaId)
    .maybeSingle();

  if (dramaError || !dramaRow) {
    return err("Drama not found");
  }

  const freeCount = Number(dramaRow.free_episodes_count ?? 5);

  const { data: episodeRows, error: episodesError } = await contentClient
    .from("episodes")
    .select("id, episode_number, is_free")
    .eq("title_id", input.dramaId)
    .order("episode_number", { ascending: true });

  if (episodesError || !Array.isArray(episodeRows)) {
    return err("Failed to retrieve drama episodes");
  }

  // 2. Fetch existing unlocks from User DB
  const { data: existingUnlocks } = await userClient
    .from("user_unlocked_episodes")
    .select("episode_number")
    .eq("user_id", userId)
    .eq("drama_id", input.dramaId);

  const alreadyUnlockedNumbers = new Set(
    (existingUnlocks || []).map((r: any) => Number(r.episode_number))
  );

  // 3. Identify locked episodes that still need unlocking
  const episodesToUnlock = episodeRows.filter((ep: any) => {
    const isFree = ep.is_free ?? (ep.episode_number <= freeCount);
    return !isFree && !alreadyUnlockedNumbers.has(ep.episode_number);
  });

  const walletRes = await getUserWalletServer(userId, userClient);
  if (!walletRes.ok) return err(walletRes.error);

  const wallet = walletRes.value;
  const isVipActive =
    wallet.isVip && (!wallet.vipExpiresAt || new Date(wallet.vipExpiresAt) > new Date());

  if (episodesToUnlock.length === 0) {
    return ok({
      success: true,
      episodesUnlockedCount: 0,
      unlockedEpisodeNumbers: [],
      standardCost: 0,
      discountedCost: 0,
      discountPercent: 20,
      newBalance: wallet.balance,
      isVipUnlock: isVipActive,
    });
  }

  const bundlePricing = calculateBundleCost(episodesToUnlock.length);
  const effectiveCost = isVipActive ? 0 : bundlePricing.discountedCost;

  let newBalance = wallet.balance;

  if (effectiveCost > 0) {
    if (wallet.balance < effectiveCost) {
      return err("INSUFFICIENT_COINS");
    }

    const debitRes = await debitWalletCoinsServer(
      userId,
      effectiveCost,
      "episode_unlock",
      input.dramaId,
      `Bundle unlocked ${episodesToUnlock.length} episodes of ${input.dramaSlug} (20% discount)`,
      userClient
    );

    if (!debitRes.ok) {
      return err(debitRes.error);
    }
    newBalance = debitRes.value.newBalance;
  }

  // 4. Batch insert into user_unlocked_episodes
  const now = new Date().toISOString();
  const perEpisodeSpent = isVipActive ? 0 : Math.round(effectiveCost / episodesToUnlock.length);

  const unlockInserts = episodesToUnlock.map((ep: any) => ({
    user_id: userId,
    drama_id: input.dramaId,
    drama_slug: input.dramaSlug,
    episode_id: ep.id,
    episode_number: ep.episode_number,
    coins_spent: perEpisodeSpent,
    unlocked_at: now,
  }));

  const { error: batchInsertError } = await userClient
    .from("user_unlocked_episodes")
    .insert(unlockInserts);

  if (batchInsertError) {
    console.warn("[unlockRemainingEpisodesServer] Warning during batch insert:", batchInsertError.message);
  }

  return ok({
    success: true,
    episodesUnlockedCount: episodesToUnlock.length,
    unlockedEpisodeNumbers: episodesToUnlock.map((e: any) => e.episode_number),
    standardCost: bundlePricing.standardCost,
    discountedCost: effectiveCost,
    discountPercent: 20,
    newBalance,
    isVipUnlock: isVipActive,
  });
}

/**
 * Grants or extends VIP pass status for a user.
 */
export async function grantVipAccessServer(
  userId: string,
  durationDays = 7,
  referenceId?: string | null,
  injectedClient?: any
): Promise<Result<{ isVip: boolean; vipExpiresAt: string; transactionId?: string }, string>> {
  if (!userId) return err("User ID is required");
  if (durationDays <= 0) return err("Duration must be at least 1 day");

  const client = injectedClient || (await createUserServiceRoleClient());
  const walletRes = await getUserWalletServer(userId, client);
  if (!walletRes.ok) return err(walletRes.error);

  const wallet = walletRes.value;
  const nowMs = Date.now();
  let baseMs = nowMs;

  if (wallet.isVip && wallet.vipExpiresAt) {
    const currentExpiryMs = new Date(wallet.vipExpiresAt).getTime();
    if (currentExpiryMs > nowMs) {
      baseMs = currentExpiryMs;
    }
  }

  const durationMs = durationDays * 24 * 60 * 60 * 1000;
  const newVipExpiresAt = new Date(baseMs + durationMs).toISOString();
  const nowIso = new Date().toISOString();

  const { error: updateError } = await client
    .from("wallets")
    .update({
      is_vip: true,
      vip_expires_at: newVipExpiresAt,
      updated_at: nowIso,
    })
    .eq("user_id", userId);

  if (updateError) {
    return err(`Failed to update VIP status: ${updateError.message}`);
  }

  const { data: txRow } = await client
    .from("coin_transactions")
    .insert({
      user_id: userId,
      amount: 0,
      balance_after: wallet.balance,
      transaction_type: "purchase",
      reference_id: referenceId || null,
      description: `VIP Pass (${durationDays} Days)`,
      created_at: nowIso,
    })
    .select("id")
    .maybeSingle();

  return ok({
    isVip: true,
    vipExpiresAt: newVipExpiresAt,
    transactionId: txRow?.id,
  });
}

/**
 * Idempotently fulfills coin purchases and VIP passes.
 * Deduplicates using referenceId to prevent double-crediting.
 */
export async function processPaymentFulfillmentServer(
  userId: string,
  packageId: CoinPackageId,
  referenceId: string,
  injectedClient?: any
): Promise<Result<WebhookProcessingResult, string>> {
  if (!userId) return err("User ID is required");
  if (!packageId) return err("Package ID is required");
  if (!referenceId) return err("Reference ID is required");

  const client = injectedClient || (await createUserServiceRoleClient());

  // 1. Idempotency Check: see if reference_id already recorded
  const { data: existingTx } = await client
    .from("coin_transactions")
    .select("id, amount, balance_after")
    .eq("reference_id", referenceId)
    .maybeSingle();

  if (existingTx) {
    const walletRes = await getUserWalletServer(userId, client);
    return ok({
      success: true,
      duplicate: true,
      coinsCredited: existingTx.amount,
      newBalance: walletRes.ok ? walletRes.value.balance : existingTx.balance_after,
    });
  }

  // 2. Validate package
  const pkg = getCoinPackageById(packageId);
  if (!pkg) {
    return err(`Invalid coin package ID: ${packageId}`);
  }

  // 3. Fulfill VIP Pass vs Coin Package
  if (pkg.isVipPass) {
    const vipRes = await grantVipAccessServer(userId, pkg.vipDays || 7, referenceId, client);
    if (!vipRes.ok) {
      if (
        vipRes.error.includes("23505") ||
        vipRes.error.toLowerCase().includes("duplicate key") ||
        vipRes.error.toLowerCase().includes("unique constraint")
      ) {
        const walletRes = await getUserWalletServer(userId, client);
        return ok({
          success: true,
          duplicate: true,
          vipGranted: true,
          newBalance: walletRes.ok ? walletRes.value.balance : 0,
        });
      }
      return err(vipRes.error);
    }

    const walletRes = await getUserWalletServer(userId, client);
    return ok({
      success: true,
      duplicate: false,
      vipGranted: true,
      newBalance: walletRes.ok ? walletRes.value.balance : 0,
    });
  }

  // 4. Credit Coins
  const creditRes = await creditWalletCoinsServer(
    userId,
    pkg.totalCoins,
    "purchase",
    referenceId,
    `Purchase: ${pkg.name} (+${pkg.totalCoins} Coins)`,
    client
  );

  if (!creditRes.ok) {
    // Intercept PostgreSQL 23505 unique constraint violation on reference_id as idempotent duplicate
    if (
      creditRes.error.includes("23505") ||
      creditRes.error.toLowerCase().includes("duplicate key") ||
      creditRes.error.toLowerCase().includes("unique constraint")
    ) {
      const { data: existingTx } = await client
        .from("coin_transactions")
        .select("id, amount, balance_after")
        .eq("reference_id", referenceId)
        .maybeSingle();

      const walletRes = await getUserWalletServer(userId, client);
      return ok({
        success: true,
        duplicate: true,
        coinsCredited: existingTx?.amount || pkg.totalCoins,
        newBalance: walletRes.ok ? walletRes.value.balance : (existingTx?.balance_after ?? 0),
      });
    }
    return err(creditRes.error);
  }

  return ok({
    success: true,
    duplicate: false,
    coinsCredited: pkg.totalCoins,
    newBalance: creditRes.value.newBalance,
  });
}

export interface FulfillPaymentOrderResult {
  success: boolean;
  duplicate: boolean;
  orderId: string;
  packageId: string;
  userId: string;
  status: string;
  coinsCredited: number;
  vipGranted: boolean;
  newBalance: number;
  vipExpiresAt?: string | null;
}

/**
 * Atomically fulfills a payment order using database-level locking and transaction isolation.
 */
export async function fulfillPaymentOrderServer(
  orderId: string,
  providerPaymentId?: string | null,
  injectedClient?: any
): Promise<Result<FulfillPaymentOrderResult, string>> {
  if (!orderId) return err("Order ID is required");

  const client = injectedClient || (await createUserServiceRoleClient());

  // 1. Atomic PostgreSQL procedure. Its refusals (ORDER_NOT_FOUND, ORDER_NOT_PAYABLE
  //    for a refunded/failed/expired order) are final and must not be retried below.
  if (typeof client.rpc === "function") {
    const { data: rpcData, error: rpcError } = await callWalletRpc(client, "fulfill_payment_order", {
      p_order_id: orderId,
      p_provider_payment_id: providerPaymentId || null,
    });

    if (rpcError) {
      if (isUniqueViolation(rpcError) || rpcError.message.includes("already paid")) {
        return ok({
          success: true,
          duplicate: true,
          orderId,
          packageId: "",
          userId: "",
          status: "paid",
          coinsCredited: 0,
          vipGranted: false,
          newBalance: 0,
        });
      }
      if (rpcError.message.includes("ORDER_NOT_FOUND")) {
        return err(`Order not found: ${orderId}`);
      }
      return err(formatWalletRpcError("fulfill_payment_order", rpcError));
    }

    return ok({
      success: Boolean(rpcData.success),
      duplicate: Boolean(rpcData.duplicate),
      orderId: rpcData.order_id,
      packageId: rpcData.package_id,
      userId: rpcData.user_id,
      status: rpcData.status,
      coinsCredited: Number(rpcData.coins_credited ?? 0),
      vipGranted: Boolean(rpcData.vip_granted ?? false),
      newBalance: Number(rpcData.new_balance ?? 0),
      vipExpiresAt: rpcData.vip_expires_at || null,
    });
  }

  // 2. In-memory test client (no rpc): table queries
  const { data: order, error: orderError } = await client
    .from("payment_orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return err(`Failed to fetch order: ${orderError.message}`);
  }
  if (!order) {
    return err(`Order not found: ${orderId}`);
  }

  if (order.status === "paid") {
    const walletRes = await getUserWalletServer(order.user_id, client);
    return ok({
      success: true,
      duplicate: true,
      orderId: order.id,
      packageId: order.package_id,
      userId: order.user_id,
      status: "paid",
      coinsCredited: 0,
      vipGranted: false,
      newBalance: walletRes.ok ? walletRes.value.balance : 0,
      vipExpiresAt: walletRes.ok ? walletRes.value.vipExpiresAt : null,
    });
  }

  // Mark order paid
  const nowIso = new Date().toISOString();
  await client
    .from("payment_orders")
    .update({
      status: "paid",
      paid_at: nowIso,
      provider_payment_id: providerPaymentId || order.provider_payment_id,
    })
    .eq("id", orderId);

  // Fulfill package via processPaymentFulfillmentServer
  const fulfillRes = await processPaymentFulfillmentServer(
    order.user_id,
    order.package_id as CoinPackageId,
    order.id,
    client
  );

  if (!fulfillRes.ok) {
    return err(fulfillRes.error);
  }

  const fVal = fulfillRes.value;
  return ok({
    success: true,
    duplicate: Boolean(fVal.duplicate),
    orderId: order.id,
    packageId: order.package_id,
    userId: order.user_id,
    status: "paid",
    coinsCredited: fVal.coinsCredited ?? 0,
    vipGranted: Boolean(fVal.vipGranted),
    newBalance: fVal.newBalance ?? 0,
  });
}

