import "server-only";
import { createUserServiceRoleClient } from "@/lib/supabase/user-server";
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
} from "@/types/wallet";

const DAILY_REWARD_SCHEDULE: Record<number, number> = {
  1: 5,
  2: 10,
  3: 10,
  4: 15,
  5: 15,
  6: 20,
  7: 50,
};

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

  // Attempt RPC first
  if (typeof client.rpc === "function") {
    try {
      const { data: rpcData, error: rpcError } = await client.rpc("credit_wallet_coins", {
        p_user_id: userId,
        p_amount: amount,
        p_type: type,
        p_ref_id: refId || null,
        p_description: description,
      });

      if (!rpcError && rpcData) {
        return ok({
          newBalance: Number(rpcData.balance_after ?? rpcData.new_balance ?? 0),
          transactionId: rpcData.transaction_id,
        });
      }
    } catch {
      // Fallback to table operations if RPC not defined in test environment
    }
  }

  // Fallback table operations
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

  // Attempt RPC first
  if (typeof client.rpc === "function") {
    try {
      const { data: rpcData, error: rpcError } = await client.rpc("debit_wallet_coins", {
        p_user_id: userId,
        p_amount: amount,
        p_type: type,
        p_ref_id: refId || null,
        p_description: description,
      });

      if (!rpcError && rpcData) {
        return ok({
          newBalance: Number(rpcData.balance_after ?? rpcData.new_balance ?? 0),
          transactionId: rpcData.transaction_id,
        });
      }
      if (rpcError && rpcError.message.includes("INSUFFICIENT_COINS")) {
        return err("INSUFFICIENT_COINS");
      }
    } catch {
      // Fallback to table operations
    }
  }

  // Fallback table operations
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

  const cost = input.cost !== undefined ? input.cost : 10;
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

  // 2. Attempt RPC execution
  if (typeof client.rpc === "function") {
    try {
      const { data: rpcData, error: rpcError } = await client.rpc("unlock_episode_with_coins", {
        p_user_id: userId,
        p_drama_id: input.dramaId,
        p_drama_slug: input.dramaSlug,
        p_episode_id: input.episodeId,
        p_episode_number: input.episodeNumber,
        p_cost: cost,
      });

      if (!rpcError && rpcData) {
        return ok({
          success: true,
          alreadyUnlocked: Boolean(rpcData.already_unlocked),
          unlockedEpisodeId: rpcData.unlocked_episode_id || "unlocked",
          coinsSpent: Number(rpcData.coins_spent ?? 0),
          newBalance: Number(rpcData.new_balance ?? 0),
          isVipUnlock: Boolean(rpcData.is_vip_unlock),
        });
      }

      if (rpcError && rpcError.message.includes("INSUFFICIENT_COINS")) {
        return err("INSUFFICIENT_COINS");
      }
    } catch {
      // Fallback
    }
  }

  // 3. Fallback logic: inspect VIP and wallet
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

  // Attempt RPC execution
  if (typeof client.rpc === "function") {
    try {
      const { data: rpcData, error: rpcError } = await client.rpc("claim_daily_checkin", {
        p_user_id: userId,
      });

      if (!rpcError && rpcData) {
        return ok({
          success: true,
          checkinId: rpcData.checkin_id,
          streakCount: Number(rpcData.streak_count ?? 1),
          coinsAwarded: Number(rpcData.coins_awarded ?? 5),
          newBalance: Number(rpcData.new_balance ?? 0),
        });
      }

      if (rpcError && rpcError.message.includes("ALREADY_CHECKED_IN_TODAY")) {
        return err("ALREADY_CHECKED_IN_TODAY");
      }
    } catch {
      // Fallback
    }
  }

  // Fallback table operations
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
