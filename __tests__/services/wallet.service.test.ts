import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  calculateBundleCost,
  getClientWallet,
  unlockEpisodeClient,
  unlockRemainingEpisodesClient,
  getDailyCheckInStatusClient,
  claimDailyCheckInClient,
  getClientCoinTransactions,
  createCheckoutSessionClient,
} from "../../lib/services/wallet.service";
import { COIN_PACKAGES, getCoinPackageById, isValidCoinPackageId } from "../../lib/payments/packages";

describe("Task 9.5: Client Wallet Service Unit Tests (wallet.service.ts)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("calculateBundleCost Algorithm", () => {
    test("calculates standard cost, 20% discount, and savings for remaining episodes", () => {
      // 10 episodes remaining -> standard: 100, discounted: 80, savings: 20
      const res10 = calculateBundleCost(10);
      assert.equal(res10.standardCost, 100);
      assert.equal(res10.discountedCost, 80);
      assert.equal(res10.savings, 20);
      assert.equal(res10.discountPercent, 20);

      // 5 episodes remaining -> standard: 50, discounted: 40, savings: 10
      const res5 = calculateBundleCost(5);
      assert.equal(res5.standardCost, 50);
      assert.equal(res5.discountedCost, 40);
      assert.equal(res5.savings, 10);
    });

    test("enforces minimum cost floor of 10 coins when unlocking at least 1 episode", () => {
      // 1 episode remaining -> standard: 10, discount: Math.max(10, Math.floor(10 * 0.8)) = 10
      const res1 = calculateBundleCost(1);
      assert.equal(res1.standardCost, 10);
      assert.equal(res1.discountedCost, 10);
      assert.equal(res1.savings, 0);
    });

    test("returns 0 cost and savings when remainingCount is zero or negative", () => {
      const resZero = calculateBundleCost(0);
      assert.deepEqual(resZero, {
        standardCost: 0,
        discountedCost: 0,
        savings: 0,
        discountPercent: 20,
      });

      const resNeg = calculateBundleCost(-5);
      assert.deepEqual(resNeg, {
        standardCost: 0,
        discountedCost: 0,
        savings: 0,
        discountPercent: 20,
      });
    });
  });

  describe("Coin Packages Catalog (packages.ts)", () => {
    test("defines valid packages with distinct IDs and bonuses", () => {
      assert.equal(COIN_PACKAGES.length, 4);

      const starter = getCoinPackageById("coins_starter_100");
      assert.ok(starter);
      assert.equal(starter.coins, 100);
      assert.equal(starter.priceUsd, 0.99);

      const popular = getCoinPackageById("coins_popular_350");
      assert.ok(popular);
      assert.equal(popular.coins, 300);
      assert.equal(popular.bonusCoins, 50);
      assert.equal(popular.totalCoins, 350);

      const binge = getCoinPackageById("coins_binge_800");
      assert.ok(binge);
      assert.equal(binge.coins, 600);
      assert.equal(binge.bonusCoins, 200);
      assert.equal(binge.totalCoins, 800);

      const vip = getCoinPackageById("vip_weekly_pass");
      assert.ok(vip);
      assert.equal(vip.isVipPass, true);
      assert.equal(vip.priceUsd, 9.99);
    });

    test("isValidCoinPackageId accurately validates package identifiers", () => {
      assert.equal(isValidCoinPackageId("coins_starter_100"), true);
      assert.equal(isValidCoinPackageId("coins_popular_350"), true);
      assert.equal(isValidCoinPackageId("coins_binge_800"), true);
      assert.equal(isValidCoinPackageId("vip_weekly_pass"), true);
      assert.equal(isValidCoinPackageId("invalid_package"), false);
      assert.equal(isValidCoinPackageId(""), false);
    });
  });

  describe("getClientWallet API Calls", () => {
    test("fetches user wallet and unlocked episodes without dramaId", async () => {
      let requestedUrl = "";
      globalThis.fetch = (async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          json: async () => ({
            wallet: { balance: 150, isVip: false, vipExpiresAt: null },
            unlockedEpisodes: [1, 2, 3],
          }),
        } as any;
      }) as any;

      const res = await getClientWallet();
      assert.equal(requestedUrl, "/api/user/wallet");
      assert.ok(res);
      assert.equal(res.wallet?.balance, 150);
      assert.deepEqual(res.unlockedEpisodes, [1, 2, 3]);
    });

    test("appends dramaId query parameter when supplied", async () => {
      let requestedUrl = "";
      globalThis.fetch = (async (url: string) => {
        requestedUrl = url;
        return {
          ok: true,
          json: async () => ({
            wallet: { balance: 20, isVip: true, vipExpiresAt: "2026-10-15T00:00:00Z" },
            unlockedEpisodes: [1, 2, 3, 4, 5, 6],
          }),
        } as any;
      }) as any;

      const res = await getClientWallet("drama-123");
      assert.equal(requestedUrl, "/api/user/wallet?dramaId=drama-123");
      assert.ok(res);
      assert.equal(res.wallet?.isVip, true);
      assert.equal(res.unlockedEpisodes.length, 6);
    });

    test("gracefully returns null when fetch returns HTTP error or network rejects", async () => {
      globalThis.fetch = (async () => {
        return { ok: false, status: 500 } as any;
      }) as any;

      const resHttpError = await getClientWallet();
      assert.equal(resHttpError, null);

      globalThis.fetch = (async () => {
        throw new Error("Network offline");
      }) as any;

      const resNetworkError = await getClientWallet();
      assert.equal(resNetworkError, null);
    });
  });

  describe("unlockEpisodeClient API Calls", () => {
    test("successfully unlocks single episode and returns updated balance", async () => {
      globalThis.fetch = (async (url: string, opts: any) => {
        assert.equal(url, "/api/user/wallet/unlock");
        assert.equal(opts.method, "POST");
        const body = JSON.parse(opts.body);
        assert.equal(body.episodeNumber, 6);

        return {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              success: true,
              alreadyUnlocked: false,
              unlockedEpisodeId: "ep-uuid-6",
              coinsSpent: 10,
              newBalance: 40,
            },
          }),
        } as any;
      }) as any;

      const res = await unlockEpisodeClient({
        episodeId: "ep-uuid-6",
        episodeNumber: 6,
        dramaId: "drama-1",
        dramaSlug: "alpha-drama",
      });

      assert.equal(res.success, true);
      assert.equal(res.coinsSpent, 10);
      assert.equal(res.newBalance, 40);
    });

    test("handles insufficient coins or server failure error envelope", async () => {
      globalThis.fetch = (async () => {
        return {
          ok: false,
          status: 402,
          json: async () => ({
            error: "Insufficient coins. You need 10 coins to unlock this episode.",
          }),
        } as any;
      }) as any;

      const res = await unlockEpisodeClient({
        episodeId: "ep-uuid-6",
        episodeNumber: 6,
        dramaId: "drama-1",
        dramaSlug: "alpha-drama",
      });

      assert.equal(res.success, false);
      assert.equal(res.coinsSpent, 0);
      assert.ok(res.error?.includes("Insufficient coins"));
    });
  });

  describe("Daily Check-In Client Methods", () => {
    test("getDailyCheckInStatusClient returns streak and claimability info", async () => {
      globalThis.fetch = (async (url: string) => {
        assert.equal(url, "/api/user/wallet/checkin");
        return {
          ok: true,
          json: async () => ({
            data: {
              currentStreak: 3,
              nextStreak: 4,
              canCheckIn: true,
              lastCheckinDate: "2026-10-08",
              nextCoinsReward: 15,
              streakSchedule: [
                { day: 1, coins: 5, isCurrent: false, claimed: true },
                { day: 2, coins: 10, isCurrent: false, claimed: true },
                { day: 3, coins: 10, isCurrent: false, claimed: true },
                { day: 4, coins: 15, isCurrent: true, claimed: false },
                { day: 5, coins: 15, isCurrent: false, claimed: false },
                { day: 6, coins: 20, isCurrent: false, claimed: false },
                { day: 7, coins: 50, isCurrent: false, claimed: false },
              ],
            },
          }),
        } as any;
      }) as any;

      const status = await getDailyCheckInStatusClient();
      assert.ok(status);
      assert.equal(status.currentStreak, 3);
      assert.equal(status.canCheckIn, true);
      assert.equal(status.nextCoinsReward, 15);
      assert.equal(status.streakSchedule.length, 7);
    });

    test("claimDailyCheckInClient handles successful reward claim", async () => {
      globalThis.fetch = (async (url: string, opts: any) => {
        assert.equal(url, "/api/user/wallet/checkin");
        assert.equal(opts.method, "POST");
        return {
          ok: true,
          json: async () => ({
            data: {
              success: true,
              checkinId: "chk-123",
              streakCount: 4,
              coinsAwarded: 15,
              newBalance: 65,
            },
          }),
        } as any;
      }) as any;

      const claim = await claimDailyCheckInClient();
      assert.equal(claim.success, true);
      assert.equal(claim.streakCount, 4);
      assert.equal(claim.coinsAwarded, 15);
      assert.equal(claim.newBalance, 65);
    });
  });

  describe("Coin Transactions & Checkout", () => {
    test("getClientCoinTransactions passes pagination parameters", async () => {
      let capturedUrl = "";
      globalThis.fetch = (async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          json: async () => ({
            transactions: {
              items: [
                { id: "tx-1", type: "top_up", coins: 100, balanceAfter: 100, createdAt: "2026-10-09" },
              ],
              total: 1,
              totalPages: 1,
            },
          }),
        } as any;
      }) as any;

      const res = await getClientCoinTransactions({ page: 2, pageSize: 10 });
      assert.equal(capturedUrl, "/api/user/wallet?page=2&pageSize=10");
      assert.equal(res.items.length, 1);
      assert.equal(res.total, 1);
    });

    test("createCheckoutSessionClient initiates checkout order", async () => {
      globalThis.fetch = (async (url: string, opts: any) => {
        assert.equal(url, "/api/payments/create-checkout");
        const body = JSON.parse(opts.body);
        assert.equal(body.packageId, "coins_popular_350");

        return {
          ok: true,
          json: async () => ({
            success: true,
            referenceId: "order_coins_popular_350_9999",
            checkoutUrl: "/account/wallet?status=success",
          }),
        } as any;
      }) as any;

      const res = await createCheckoutSessionClient({ packageId: "coins_popular_350" });
      assert.equal(res.success, true);
      assert.equal(res.referenceId, "order_coins_popular_350_9999");
    });
  });
});
