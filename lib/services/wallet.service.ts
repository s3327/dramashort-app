import {
  type WalletInfo,
  type DailyCheckInStatus,
  type DailyCheckInResult,
  type UnlockEpisodeResult,
  type UnlockEpisodeInput,
  type CoinTransaction,
} from "@/types/wallet";

/**
 * Client service layer for interacting with wallet, entitlements, and check-in APIs.
 */

export async function getClientWallet(): Promise<WalletInfo | null> {
  try {
    const res = await fetch("/api/user/wallet", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.wallet || null;
  } catch {
    return null;
  }
}

export async function unlockEpisodeClient(
  input: UnlockEpisodeInput
): Promise<UnlockEpisodeResult> {
  try {
    const res = await fetch("/api/user/wallet/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) {
      return {
        success: false,
        alreadyUnlocked: false,
        unlockedEpisodeId: "",
        coinsSpent: 0,
        newBalance: 0,
        error: json.error || "Failed to unlock episode",
      };
    }

    return json.data;
  } catch (err: any) {
    return {
      success: false,
      alreadyUnlocked: false,
      unlockedEpisodeId: "",
      coinsSpent: 0,
      newBalance: 0,
      error: err?.message || "Network error",
    };
  }
}

export async function getDailyCheckInStatusClient(): Promise<DailyCheckInStatus | null> {
  try {
    const res = await fetch("/api/user/wallet/checkin", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch {
    return null;
  }
}

export async function claimDailyCheckInClient(): Promise<DailyCheckInResult> {
  try {
    const res = await fetch("/api/user/wallet/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const json = await res.json();
    if (!res.ok) {
      return {
        success: false,
        checkinId: "",
        streakCount: 0,
        coinsAwarded: 0,
        newBalance: 0,
      };
    }

    return json.data;
  } catch {
    return {
      success: false,
      checkinId: "",
      streakCount: 0,
      coinsAwarded: 0,
      newBalance: 0,
    };
  }
}

export async function getClientCoinTransactions(options?: {
  page?: number;
  pageSize?: number;
}): Promise<{ items: CoinTransaction[]; total: number; totalPages: number }> {
  try {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));

    const res = await fetch(`/api/user/wallet?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!res.ok) return { items: [], total: 0, totalPages: 0 };
    const json = await res.json();
    return {
      items: json.transactions?.items || [],
      total: json.transactions?.total || 0,
      totalPages: json.transactions?.totalPages || 0,
    };
  } catch {
    return { items: [], total: 0, totalPages: 0 };
  }
}
