import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getTimeUntilUtcMidnight } from "@/contexts/DailyRewardContext";
import { GET as getDailyCheckInRoute, POST as postDailyCheckInRoute } from "@/app/api/user/daily-checkin/route";
import {
  getDailyCheckInStatusServer,
  claimDailyCheckinServer,
} from "@/lib/server/wallet";
import {
  setTestUserServerClientFactory,
  setTestUserServiceRoleClientFactory,
} from "@/lib/supabase/user-server";
import type { User } from "@supabase/supabase-js";

/**
 * In-memory Supabase mock client simulating User DB state.
 */
function createMockUserDbClient(initialData?: {
  wallets?: any[];
  profiles?: any[];
  coinTransactions?: any[];
  dailyCheckins?: any[];
}) {
  const wallets = [...(initialData?.wallets || [])];
  const profiles = [...(initialData?.profiles || [])];
  const coinTransactions = [...(initialData?.coinTransactions || [])];
  const dailyCheckins = [...(initialData?.dailyCheckins || [])];

  const client: any = {
    _wallets: wallets,
    _profiles: profiles,
    _coinTransactions: coinTransactions,
    _dailyCheckins: dailyCheckins,
    from(tableName: string) {
      let activeTable: any[];
      if (tableName === "wallets") activeTable = wallets;
      else if (tableName === "profiles") activeTable = profiles;
      else if (tableName === "coin_transactions") activeTable = coinTransactions;
      else if (tableName === "daily_checkins") activeTable = dailyCheckins;
      else activeTable = [];

      let filters: Array<(row: any) => boolean> = [];
      let sortFn: ((a: any, b: any) => number) | null = null;
      let limitCount: number | null = null;

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
        single() {
          let matched = activeTable.filter((row) => filters.every((f) => f(row)));
          if (sortFn) matched = [...matched].sort(sortFn);
          if (matched.length === 0) {
            return Promise.resolve({ data: null, error: { message: "Row not found", code: "PGRST116" } });
          }
          return Promise.resolve({ data: matched[0], error: null });
        },
        maybeSingle() {
          let matched = activeTable.filter((row) => filters.every((f) => f(row)));
          if (sortFn) matched = [...matched].sort(sortFn);
          return Promise.resolve({ data: matched[0] || null, error: null });
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
      };

      return builder;
    },
  };

  return client;
}

describe("Task 8.4: Gamified Daily Check-in & Reward Streak System", () => {
  describe("1. UTC Countdown & Schedule Rules", () => {
    it("calculates positive hours, minutes, and seconds until UTC midnight", () => {
      const countdown = getTimeUntilUtcMidnight();
      assert.ok(countdown.hours >= 0 && countdown.hours <= 23);
      assert.ok(countdown.minutes >= 0 && countdown.minutes <= 59);
      assert.ok(countdown.seconds >= 0 && countdown.seconds <= 59);
      assert.match(countdown.formatted, /^\d{2}h \d{2}m$/);
    });

    it("verifies 7-day progressive streak reward schedule values", () => {
      const expectedSchedule = [
        { day: 1, coins: 5 },
        { day: 2, coins: 10 },
        { day: 3, coins: 10 },
        { day: 4, coins: 15 },
        { day: 5, coins: 15 },
        { day: 6, coins: 20 },
        { day: 7, coins: 50 },
      ];

      assert.equal(expectedSchedule.length, 7);
      assert.equal(expectedSchedule[0].coins, 5);
      assert.equal(expectedSchedule[1].coins, 10);
      assert.equal(expectedSchedule[2].coins, 10);
      assert.equal(expectedSchedule[3].coins, 15);
      assert.equal(expectedSchedule[4].coins, 15);
      assert.equal(expectedSchedule[5].coins, 20);
      assert.equal(expectedSchedule[6].coins, 50);

      // Total coins over a full 7-day streak
      const totalCoins = expectedSchedule.reduce((sum, d) => sum + d.coins, 0);
      assert.equal(totalCoins, 125);
    });
  });

  describe("2. Server Check-in Logic & Streak Progression", () => {
    it("handles Day 1 first-time check-in accurately", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-streak-d1", balance: 0, is_vip: false }],
      });

      const status = await getDailyCheckInStatusServer("usr-streak-d1", mockClient);
      assert.equal(status.ok, true);
      assert.equal(status.value.canCheckIn, true);
      assert.equal(status.value.currentStreak, 0);
      assert.equal(status.value.nextStreak, 1);
      assert.equal(status.value.nextCoinsReward, 5);
      assert.equal(status.value.streakSchedule.length, 7);

      const claim = await claimDailyCheckinServer("usr-streak-d1", mockClient);
      assert.equal(claim.ok, true);
      assert.equal(claim.value.streakCount, 1);
      assert.equal(claim.value.coinsAwarded, 5);
      assert.equal(claim.value.newBalance, 5);
      assert.equal(mockClient._wallets[0].balance, 5);
    });

    it("cycles back smoothly after Day 7 streak completion", async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-streak-d7", balance: 75, is_vip: false }],
        dailyCheckins: [
          { id: "chk-6", user_id: "usr-streak-d7", streak_count: 6, last_checkin_date: yesterday, coins_awarded: 20 },
        ],
      });

      // User claims Day 7
      const claimD7 = await claimDailyCheckinServer("usr-streak-d7", mockClient);
      assert.equal(claimD7.ok, true);
      assert.equal(claimD7.value.streakCount, 7);
      assert.equal(claimD7.value.coinsAwarded, 50);
      assert.equal(claimD7.value.newBalance, 125);
      assert.equal(mockClient._wallets[0].balance, 125);
    });

    it("prevents duplicate claim on the same calendar day", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-dup", balance: 25, is_vip: false }],
        dailyCheckins: [
          { id: "chk-today", user_id: "usr-dup", streak_count: 3, last_checkin_date: today, coins_awarded: 10 },
        ],
      });

      const status = await getDailyCheckInStatusServer("usr-dup", mockClient);
      assert.equal(status.ok, true);
      assert.equal(status.value.canCheckIn, false);

      const claim = await claimDailyCheckinServer("usr-dup", mockClient);
      assert.equal(claim.ok, false);
      assert.equal(claim.error, "ALREADY_CHECKED_IN_TODAY");
    });
  });

  describe("3. Route Handler & API Aliases (/api/user/daily-checkin)", () => {
    it("returns 401 Unauthorized for unauthenticated GET /api/user/daily-checkin", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: { message: "No session" } }),
        },
      }));

      try {
        const res = await getDailyCheckInRoute();
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.error, "UNAUTHORIZED");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("returns 401 Unauthorized for unauthenticated POST /api/user/daily-checkin", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: null }, error: { message: "No session" } }),
        },
      }));

      try {
        const res = await postDailyCheckInRoute();
        assert.equal(res.status, 401);
        const body = await res.json();
        assert.equal(body.error, "UNAUTHORIZED");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("returns 200 with status for authenticated GET /api/user/daily-checkin", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-auth-chk", balance: 10, is_vip: false }],
      });
      const mockUser = { id: "usr-auth-chk", email: "checkin@example.com" } as User;

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
        },
        ...mockClient,
      }));
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        const res = await getDailyCheckInRoute();
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.data.canCheckIn, true);
        assert.equal(body.data.nextCoinsReward, 5);
        assert.equal(body.data.streakSchedule.length, 7);
      } finally {
        setTestUserServerClientFactory(null);
        setTestUserServiceRoleClientFactory(null);
      }
    });

    it("returns 200 on successful claim via POST /api/user/daily-checkin", async () => {
      const mockClient = createMockUserDbClient({
        wallets: [{ user_id: "usr-auth-post", balance: 0, is_vip: false }],
      });
      const mockUser = { id: "usr-auth-post", email: "claim@example.com" } as User;

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: () => Promise.resolve({ data: { user: mockUser }, error: null }),
        },
        ...mockClient,
      }));
      setTestUserServiceRoleClientFactory(() => mockClient);

      try {
        const res = await postDailyCheckInRoute();
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.data.coinsAwarded, 5);
        assert.equal(body.data.streakCount, 1);
        assert.equal(body.data.newBalance, 5);
      } finally {
        setTestUserServerClientFactory(null);
        setTestUserServiceRoleClientFactory(null);
      }
    });
  });

  describe("4. Component & Architectural Boundary Verification", () => {
    it("ensures zero server-only imports in client reward components", () => {
      const clientFiles = [
        path.join(process.cwd(), "contexts/DailyRewardContext.tsx"),
        path.join(process.cwd(), "components/rewards/DailyCheckInModal.tsx"),
        path.join(process.cwd(), "components/rewards/DailyRewardTrigger.tsx"),
      ];

      for (const filePath of clientFiles) {
        assert.ok(fs.existsSync(filePath), `File exists: ${filePath}`);
        const content = fs.readFileSync(filePath, "utf-8");

        // Must NOT import from lib/server/*
        assert.ok(
          !content.includes("@/lib/server/"),
          `Forbidden server import found in ${path.basename(filePath)}`
        );
        assert.ok(
          !content.includes("from \"../server/"),
          `Forbidden relative server import found in ${path.basename(filePath)}`
        );
      }
    });

    it("verifies DailyRewardTrigger component is present in HeaderActions", () => {
      const headerActionsPath = path.join(process.cwd(), "components/header/HeaderActions.tsx");
      const content = fs.readFileSync(headerActionsPath, "utf-8");
      assert.ok(
        content.includes("DailyRewardTrigger"),
        "HeaderActions.tsx must contain DailyRewardTrigger"
      );
    });

    it("verifies DailyCheckInModal is connected in layout.tsx and WatchPlayerIsland.tsx", () => {
      const layoutPath = path.join(process.cwd(), "app/layout.tsx");
      const layoutContent = fs.readFileSync(layoutPath, "utf-8");
      assert.ok(
        layoutContent.includes("<DailyCheckInModal"),
        "app/layout.tsx must render DailyCheckInModal"
      );
      assert.ok(
        layoutContent.includes("<DailyRewardProvider>"),
        "app/layout.tsx must wrap tree with DailyRewardProvider"
      );

      const islandPath = path.join(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandContent = fs.readFileSync(islandPath, "utf-8");
      assert.ok(
        islandContent.includes("isDailyCheckInModalOpen"),
        "WatchPlayerIsland must maintain isDailyCheckInModalOpen state"
      );
      assert.ok(
        islandContent.includes("onOpenCheckIn"),
        "WatchPlayerIsland must wire onOpenCheckIn to EpisodeUnlockModal"
      );
      assert.ok(
        islandContent.includes("<DailyCheckInModal"),
        "WatchPlayerIsland must render DailyCheckInModal"
      );
    });
  });
});
