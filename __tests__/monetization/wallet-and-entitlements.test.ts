import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getUserWalletServer,
  creditWalletCoinsServer,
  debitWalletCoinsServer,
  unlockEpisodeServer,
  isEpisodeUnlockedServer,
  getDailyCheckInStatusServer,
  claimDailyCheckinServer,
  getCoinTransactionsServer,
} from "@/lib/server/wallet";
import { canAccessEpisode, type EpisodePlaybackInfo } from "@/lib/server/playback";
import { GET as getWalletRoute } from "@/app/api/user/wallet/route";
import { POST as postUnlockRoute } from "@/app/api/user/wallet/unlock/route";
import { GET as getCheckinRoute, POST as postCheckinRoute } from "@/app/api/user/wallet/checkin/route";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";

/**
 * Creates an in-memory mock Supabase client simulating User DB state.
 */
function createMockUserDbClient(initialData?: {
  wallets?: any[];
  profiles?: any[];
  coinTransactions?: any[];
  userUnlockedEpisodes?: any[];
  dailyCheckins?: any[];
}) {
  const wallets = [...(initialData?.wallets || [])];
  const profiles = [...(initialData?.profiles || [])];
  const coinTransactions = [...(initialData?.coinTransactions || [])];
  const userUnlockedEpisodes = [...(initialData?.userUnlockedEpisodes || [])];
  const dailyCheckins = [...(initialData?.dailyCheckins || [])];

  const client: any = {
    _wallets: wallets,
    _profiles: profiles,
    _coinTransactions: coinTransactions,
    _userUnlockedEpisodes: userUnlockedEpisodes,
    _dailyCheckins: dailyCheckins,
    from(tableName: string) {
      let activeTable: any[];
      if (tableName === "wallets") activeTable = wallets;
      else if (tableName === "profiles") activeTable = profiles;
      else if (tableName === "coin_transactions") activeTable = coinTransactions;
      else if (tableName === "user_unlocked_episodes") activeTable = userUnlockedEpisodes;
      else if (tableName === "daily_checkins") activeTable = dailyCheckins;
      else activeTable = [];

      let filters: Array<(row: any) => boolean> = [];
      let sortFn: ((a: any, b: any) => number) | null = null;
      let limitCount: number | null = null;
      let rangeBounds: { from: number; to: number } | null = null;

      const builder: any = {
        select(_columns?: string, _options?: any) {
          return builder;
        },
        eq(column: string, value: any) {
          filters.push((row: any) => row[column] === value);
          return builder;
        },
        order(column: string, { ascending = true } = {}) {
          sortFn = (a: any, b: any) => {
            if (a[column] < b[column]) return ascending ? -1 : 1;
            if (a[column] > b[column]) return ascending ? 1 : -1;
            return 0;
          };
          return builder;
        },
        limit(count: number) {
          limitCount = count;
          return builder;
        },
        range(from: number, to: number) {
          rangeBounds = { from, to };
          return builder;
        },
        insert(data: any) {
          const rows = Array.isArray(data) ? data : [data];
          const inserted = rows.map((r) => ({
            id: r.id || `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ...r,
          }));
          activeTable.push(...inserted);

          return {
            select(_cols?: string) {
              return {
                single() {
                  return Promise.resolve({ data: inserted[0], error: null });
                },
                maybeSingle() {
                  return Promise.resolve({ data: inserted[0], error: null });
                },
              };
            },
            single() {
              return Promise.resolve({ data: inserted[0], error: null });
            },
            maybeSingle() {
              return Promise.resolve({ data: inserted[0], error: null });
            },
          };
        },
        update(updates: any) {
          return {
            eq(column: string, value: any) {
              let updatedCount = 0;
              for (const row of activeTable) {
                if (row[column] === value) {
                  Object.assign(row, updates);
                  updatedCount++;
                }
              }
              return Promise.resolve({ data: null, error: null, count: updatedCount });
            },
          };
        },
        async maybeSingle() {
          let filtered = activeTable.filter((row) => filters.every((fn) => fn(row)));
          if (sortFn) filtered.sort(sortFn);
          return { data: filtered[0] || null, error: null };
        },
        async single() {
          let filtered = activeTable.filter((row) => filters.every((fn) => fn(row)));
          if (sortFn) filtered.sort(sortFn);
          if (filtered.length === 0) {
            return { data: null, error: { message: "Row not found" } };
          }
          return { data: filtered[0], error: null };
        },
        then(resolve: any) {
          let filtered = activeTable.filter((row) => filters.every((fn) => fn(row)));
          if (sortFn) filtered.sort(sortFn);
          const total = filtered.length;
          if (rangeBounds) {
            filtered = filtered.slice(rangeBounds.from, rangeBounds.to + 1);
          }
          if (limitCount !== null) {
            filtered = filtered.slice(0, limitCount);
          }
          return Promise.resolve({ data: filtered, count: total, error: null }).then(resolve);
        },
      };

      return builder;
    },
  };

  return client;
}

function makeEpisodeFixture(overrides: Partial<EpisodePlaybackInfo> = {}): EpisodePlaybackInfo {
  return {
    episodeId: "ep-1111-1111",
    titleId: "drama-2222-2222",
    titleName: "Billionaire's Secret Bride",
    titleSlug: "billionaires-secret-bride",
    titleStatus: "Published",
    episodeNumber: 1,
    isFree: true,
    videoUrl: "https://example.com/video.mp4",
    hlsUrl: "https://example.com/video.m3u8",
    mp4Url: "https://example.com/video.mp4",
    durationSeconds: 90,
    aspectRatio: "9:16",
    ...overrides,
  };
}

describe("Task 8.1: Monetization Database Schema, Wallets, Entitlements & Daily Rewards", () => {
  describe("1. Database Schema Migration Invariants & Security Hardening", () => {
    const userMigrationPath = path.join(
      process.cwd(),
      "supabase",
      "user",
      "supabase",
      "migrations",
      "20261009220000_monetization_wallets_and_entitlements.sql"
    );
    const contentMigrationPath = path.join(
      process.cwd(),
      "supabase",
      "content",
      "supabase",
      "migrations",
      "20261009220000_monetization_wallets_and_entitlements.sql"
    );

    it("verifies dual migration files exist for ADR-0003 topology parity", () => {
      assert.equal(fs.existsSync(userMigrationPath), true);
      assert.equal(fs.existsSync(contentMigrationPath), true);
    });

    it("defines profiles mirror columns, wallets, coin_transactions, user_unlocked_episodes, and daily_checkins", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");

      assert.match(sql, /ALTER TABLE public\.profiles\s+ADD COLUMN IF NOT EXISTS coin_balance/);
      assert.match(sql, /ADD COLUMN IF NOT EXISTS is_vip BOOLEAN/);
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.wallets/);
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.coin_transactions/);
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.user_unlocked_episodes/);
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.daily_checkins/);
    });

    it("enforces Row-Level Security and least-privilege grants", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");

      assert.match(sql, /ALTER TABLE public\.wallets ENABLE ROW LEVEL SECURITY;/);
      assert.match(sql, /ALTER TABLE public\.coin_transactions ENABLE ROW LEVEL SECURITY;/);
      assert.match(sql, /ALTER TABLE public\.user_unlocked_episodes ENABLE ROW LEVEL SECURITY;/);
      assert.match(sql, /ALTER TABLE public\.daily_checkins ENABLE ROW LEVEL SECURITY;/);

      assert.match(sql, /REVOKE ALL ON public\.wallets FROM anon, authenticated;/);
      assert.match(sql, /REVOKE ALL ON public\.coin_transactions FROM anon, authenticated;/);
      assert.match(sql, /GRANT SELECT ON public\.wallets TO authenticated;/);
      assert.match(sql, /GRANT ALL ON public\.wallets TO service_role;/);
    });

    it("defines atomic SECURITY DEFINER stored procedures with search_path protection", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");

      assert.match(sql, /CREATE OR REPLACE FUNCTION public\.ensure_user_wallet/);
      assert.match(sql, /CREATE OR REPLACE FUNCTION public\.credit_wallet_coins/);
      assert.match(sql, /CREATE OR REPLACE FUNCTION public\.debit_wallet_coins/);
      assert.match(sql, /CREATE OR REPLACE FUNCTION public\.unlock_episode_with_coins/);
      assert.match(sql, /CREATE OR REPLACE FUNCTION public\.claim_daily_checkin/);

      assert.match(sql, /SECURITY DEFINER SET search_path = public, auth/);
    });
  });

  describe("2. Server Wallet Operations (Balance, Credits, Debits, Transactions)", () => {
    it("auto-initializes a new wallet with 0 balance if user has no row", async () => {
      const mockClient = createMockUserDbClient();
      const res = await getUserWalletServer("usr-alice", mockClient);

      assert.equal(res.ok, true);
      assert.equal(res.value.userId, "usr-alice");
      assert.equal(res.value.balance, 0);
      assert.equal(res.value.isVip, false);
      assert.equal(mockClient._wallets.length, 1);
    });

    it("credits coins to wallet, updates profile mirror, and appends to ledger", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-bob", balance: 50, is_vip: false }],
        profiles: [{ id: "usr-bob", coin_balance: 50, is_vip: false }],
      });

      const res = await creditWalletCoinsServer(
        "usr-bob",
        100,
        "purchase",
        "pi_test_123",
        "Purchased 100 coins pack",
        mockClient
      );

      assert.equal(res.ok, true);
      assert.equal(res.value.newBalance, 150);

      // Verify wallet row updated
      assert.equal(mockClient._wallets[0].balance, 150);
      // Verify profile mirror updated
      assert.equal(mockClient._profiles[0].coin_balance, 150);
      // Verify coin_transactions ledger has row
      assert.equal(mockClient._coinTransactions.length, 1);
      assert.equal(mockClient._coinTransactions[0].amount, 100);
      assert.equal(mockClient._coinTransactions[0].balance_after, 150);
      assert.equal(mockClient._coinTransactions[0].transaction_type, "purchase");
    });

    it("debits coins from wallet and rejects if balance is insufficient", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-charlie", balance: 15, is_vip: false }],
      });

      // 1. Success debit
      const debitRes = await debitWalletCoinsServer(
        "usr-charlie",
        10,
        "episode_unlock",
        "ep-1",
        "Unlocked episode 1",
        mockClient
      );
      assert.equal(debitRes.ok, true);
      assert.equal(debitRes.value.newBalance, 5);
      assert.equal(mockClient._wallets[0].balance, 5);

      // 2. Reject debit when balance < amount
      const failRes = await debitWalletCoinsServer(
        "usr-charlie",
        10,
        "episode_unlock",
        "ep-2",
        "Unlocked episode 2",
        mockClient
      );
      assert.equal(failRes.ok, false);
      assert.equal(failRes.error, "INSUFFICIENT_COINS");
      // Balance remains 5
      assert.equal(mockClient._wallets[0].balance, 5);
    });

    it("retrieves paginated coin transactions ledger", async () => {
      const mockClient = createMockUserDbClient({
        coinTransactions: [
          { id: "tx-1", user_id: "usr-dan", amount: 100, balance_after: 100, transaction_type: "purchase", created_at: "2026-10-09T01:00:00Z" },
          { id: "tx-2", user_id: "usr-dan", amount: -10, balance_after: 90, transaction_type: "episode_unlock", created_at: "2026-10-09T02:00:00Z" },
        ],
      });

      const res = await getCoinTransactionsServer("usr-dan", { page: 1, pageSize: 10 }, mockClient);
      assert.equal(res.ok, true);
      assert.equal(res.value.total, 2);
      assert.equal(res.value.items.length, 2);
      assert.equal(res.value.items[0].transactionType, "episode_unlock");
      assert.equal(res.value.items[1].transactionType, "purchase");
    });
  });

  describe("3. Episode Unlock Engine & Entitlements", () => {
    it("unlocks an episode with standard 10 coins deduction", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-elena", balance: 30, is_vip: false }],
      });

      const res = await unlockEpisodeServer(
        "usr-elena",
        {
          dramaId: "drama-1",
          dramaSlug: "ceo-wife",
          episodeId: "ep-6",
          episodeNumber: 6,
          cost: 10,
        },
        mockClient
      );

      assert.equal(res.ok, true);
      assert.equal(res.value.success, true);
      assert.equal(res.value.alreadyUnlocked, false);
      assert.equal(res.value.coinsSpent, 10);
      assert.equal(res.value.newBalance, 20);

      // Verify entitlement record in user_unlocked_episodes
      assert.equal(mockClient._userUnlockedEpisodes.length, 1);
      assert.equal(mockClient._userUnlockedEpisodes[0].episode_number, 6);

      // isEpisodeUnlockedServer returns true
      const isUnlocked = await isEpisodeUnlockedServer("usr-elena", "drama-1", 6, mockClient);
      assert.equal(isUnlocked, true);
    });

    it("enforces idempotency: repeated unlock charges zero coins", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-frank", balance: 50, is_vip: false }],
        userUnlockedEpisodes: [
          { id: "unl-1", user_id: "usr-frank", drama_id: "drama-1", drama_slug: "ceo-wife", episode_id: "ep-6", episode_number: 6, coins_spent: 10 },
        ],
      });

      const res = await unlockEpisodeServer(
        "usr-frank",
        {
          dramaId: "drama-1",
          dramaSlug: "ceo-wife",
          episodeId: "ep-6",
          episodeNumber: 6,
          cost: 10,
        },
        mockClient
      );

      assert.equal(res.ok, true);
      assert.equal(res.value.alreadyUnlocked, true);
      assert.equal(res.value.coinsSpent, 0);
      assert.equal(res.value.newBalance, 50);
      assert.equal(mockClient._wallets[0].balance, 50);
    });

    it("allows active VIP users to unlock episodes at 0 coin cost", async () => {
      const futureDate = new Date(Date.now() + 7 * 86400000).toISOString();
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-vip", balance: 20, is_vip: true, vip_expires_at: futureDate }],
      });

      const res = await unlockEpisodeServer(
        "usr-vip",
        {
          dramaId: "drama-1",
          dramaSlug: "ceo-wife",
          episodeId: "ep-7",
          episodeNumber: 7,
          cost: 10,
        },
        mockClient
      );

      assert.equal(res.ok, true);
      assert.equal(res.value.isVipUnlock, true);
      assert.equal(res.value.coinsSpent, 0);
      assert.equal(res.value.newBalance, 20); // Coins untouched
      assert.equal(mockClient._userUnlockedEpisodes.length, 1);
    });

    it("rejects unlock attempt when user has insufficient coins", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-broke", balance: 5, is_vip: false }],
      });

      const res = await unlockEpisodeServer(
        "usr-broke",
        {
          dramaId: "drama-1",
          dramaSlug: "ceo-wife",
          episodeId: "ep-8",
          episodeNumber: 8,
          cost: 10,
        },
        mockClient
      );

      assert.equal(res.ok, false);
      assert.equal(res.error, "INSUFFICIENT_COINS");
      assert.equal(mockClient._userUnlockedEpisodes.length, 0);
    });
  });

  describe("4. 7-Day Daily Check-in Streak Reward Engine", () => {
    it("awards Day 1 bonus (+5 coins) for first checkin", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-streak-1", balance: 0, is_vip: false }],
      });

      const statusRes = await getDailyCheckInStatusServer("usr-streak-1", mockClient);
      assert.equal(statusRes.ok, true);
      assert.equal(statusRes.value.canCheckIn, true);
      assert.equal(statusRes.value.nextStreak, 1);
      assert.equal(statusRes.value.nextCoinsReward, 5);

      const claimRes = await claimDailyCheckinServer("usr-streak-1", mockClient);
      assert.equal(claimRes.ok, true);
      assert.equal(claimRes.value.streakCount, 1);
      assert.equal(claimRes.value.coinsAwarded, 5);
      assert.equal(claimRes.value.newBalance, 5);

      // Verify wallet row
      assert.equal(mockClient._wallets[0].balance, 5);
    });

    it("advances streak on consecutive day and awards progressive rewards", async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-streak-2", balance: 5, is_vip: false }],
        dailyCheckins: [
          { id: "chk-1", user_id: "usr-streak-2", streak_count: 1, last_checkin_date: yesterday, coins_awarded: 5 },
        ],
      });

      const statusRes = await getDailyCheckInStatusServer("usr-streak-2", mockClient);
      assert.equal(statusRes.ok, true);
      assert.equal(statusRes.value.canCheckIn, true);
      assert.equal(statusRes.value.currentStreak, 1);
      assert.equal(statusRes.value.nextStreak, 2);
      assert.equal(statusRes.value.nextCoinsReward, 10);

      const claimRes = await claimDailyCheckinServer("usr-streak-2", mockClient);
      assert.equal(claimRes.ok, true);
      assert.equal(claimRes.value.streakCount, 2);
      assert.equal(claimRes.value.coinsAwarded, 10);
      assert.equal(claimRes.value.newBalance, 15);
    });

    it("rejects duplicate check-in on the same UTC day", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-streak-3", balance: 15, is_vip: false }],
        dailyCheckins: [
          { id: "chk-today", user_id: "usr-streak-3", streak_count: 2, last_checkin_date: today, coins_awarded: 10 },
        ],
      });

      const statusRes = await getDailyCheckInStatusServer("usr-streak-3", mockClient);
      assert.equal(statusRes.ok, true);
      assert.equal(statusRes.value.canCheckIn, false);

      const claimRes = await claimDailyCheckinServer("usr-streak-3", mockClient);
      assert.equal(claimRes.ok, false);
      assert.equal(claimRes.error, "ALREADY_CHECKED_IN_TODAY");
    });

    it("resets streak to Day 1 when user misses more than 1 day", async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-streak-4", balance: 50, is_vip: false }],
        dailyCheckins: [
          { id: "chk-old", user_id: "usr-streak-4", streak_count: 5, last_checkin_date: threeDaysAgo, coins_awarded: 15 },
        ],
      });

      const statusRes = await getDailyCheckInStatusServer("usr-streak-4", mockClient);
      assert.equal(statusRes.ok, true);
      assert.equal(statusRes.value.canCheckIn, true);
      assert.equal(statusRes.value.currentStreak, 0); // Reset
      assert.equal(statusRes.value.nextStreak, 1);
      assert.equal(statusRes.value.nextCoinsReward, 5);
    });
  });

  describe("5. Server-Side Paywall Gatekeeper Integration (canAccessEpisode)", () => {
    it("permits guest access to free published episodes", async () => {
      const ep = makeEpisodeFixture({ episodeNumber: 1, isFree: true });
      const res = await canAccessEpisode(null, ep);
      assert.equal(res.allowed, true);
    });

    it("permits logged-in user access to free published episodes", async () => {
      const ep = makeEpisodeFixture({ episodeNumber: 2, isFree: true });
      const user = { id: "usr-reg", app_metadata: {}, user_metadata: {} } as unknown as User;
      const res = await canAccessEpisode(user, ep);
      assert.equal(res.allowed, true);
    });

    it("denies unauthenticated guests from locked episodes with PAYMENT_REQUIRED", async () => {
      const ep = makeEpisodeFixture({ episodeNumber: 6, isFree: false });
      const res = await canAccessEpisode(null, ep);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, "PAYMENT_REQUIRED");
      assert.equal(res.message, "Sign in to watch locked episodes.");
    });

    it("allows staff (admin/editor) bypass for locked episodes", async () => {
      const ep = makeEpisodeFixture({ episodeNumber: 6, isFree: false });
      const admin = { id: "adm-1", app_metadata: { role: "admin" }, user_metadata: {} } as unknown as User;
      const editor = { id: "edt-1", app_metadata: { role: "editor" }, user_metadata: {} } as unknown as User;

      assert.equal((await canAccessEpisode(admin, ep)).allowed, true);
      assert.equal((await canAccessEpisode(editor, ep)).allowed, true);
    });

    it("allows user with active VIP pass to access locked episodes", async () => {
      const ep = makeEpisodeFixture({ episodeNumber: 6, isFree: false });
      const user = { id: "usr-vip-viewer", app_metadata: {}, user_metadata: {} } as unknown as User;
      const futureDate = new Date(Date.now() + 86400000).toISOString();

      const mockDb = createMockUserDbClient({
        wallets: [{ user_id: "usr-vip-viewer", is_vip: true, vip_expires_at: futureDate }],
      });

      const res = await canAccessEpisode(user, ep, mockDb);
      assert.equal(res.allowed, true);
    });

    it("allows user who unlocked the episode to access it", async () => {
      const ep = makeEpisodeFixture({
        titleId: "drama-xyz",
        episodeNumber: 6,
        isFree: false,
      });
      const user = { id: "usr-paid", app_metadata: {}, user_metadata: {} } as unknown as User;

      const mockDb = createMockUserDbClient({
        wallets: [{ user_id: "usr-paid", is_vip: false }],
        userUnlockedEpisodes: [
          { id: "unl-xyz", user_id: "usr-paid", drama_id: "drama-xyz", episode_number: 6 },
        ],
      });

      const res = await canAccessEpisode(user, ep, mockDb);
      assert.equal(res.allowed, true);
    });

    it("denies regular user who has not unlocked the episode with PAYMENT_REQUIRED", async () => {
      const ep = makeEpisodeFixture({
        titleId: "drama-xyz",
        episodeNumber: 6,
        isFree: false,
      });
      const user = { id: "usr-unpaid", app_metadata: {}, user_metadata: {} } as unknown as User;

      const mockDb = createMockUserDbClient({
        wallets: [{ user_id: "usr-unpaid", balance: 5, is_vip: false }],
        userUnlockedEpisodes: [],
      });

      const res = await canAccessEpisode(user, ep, mockDb);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, "PAYMENT_REQUIRED");
      assert.equal(res.message, "This episode requires 10 coins to unlock.");
    });
  });

  describe("6. REST API Route Handler Contracts", () => {
    it("GET /api/user/wallet rejects unauthenticated callers with 401", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: { message: "No session" } }),
        },
      }));
      try {
        const req = new NextRequest("http://localhost:3000/api/user/wallet");
        const res = await getWalletRoute(req);
        assert.equal(res.status, 401);
        const json = await res.json();
        assert.equal(json.error, "UNAUTHORIZED");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("POST /api/user/wallet/unlock rejects unauthenticated callers with 401", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: { message: "No session" } }),
        },
      }));
      try {
        const req = new NextRequest("http://localhost:3000/api/user/wallet/unlock", {
          method: "POST",
          body: JSON.stringify({
            dramaId: "drama-1",
            dramaSlug: "ceo-wife",
            episodeId: "ep-6",
            episodeNumber: 6,
          }),
        });
        const res = await postUnlockRoute(req);
        assert.equal(res.status, 401);
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("GET and POST /api/user/wallet/checkin reject unauthenticated callers with 401", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: { message: "No session" } }),
        },
      }));
      try {
        const getRes = await getCheckinRoute();
        assert.equal(getRes.status, 401);

        const postRes = await postCheckinRoute();
        assert.equal(postRes.status, 401);
      } finally {
        setTestUserServerClientFactory(null);
      }
    });
  });
});
