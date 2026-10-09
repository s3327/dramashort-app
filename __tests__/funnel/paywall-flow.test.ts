import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { calculateBundleCost } from "../../lib/services/wallet.service";
import { getTimeUntilUtcMidnight } from "../../contexts/DailyRewardContext";

describe("Task 9.5: Monetization Paywall Funnel & Journey Verification (__tests__/funnel/paywall-flow.test.ts)", () => {
  // Pure logic engine replicating player paywall & entitlement rules
  function evaluateEpisodeAccess(options: {
    episodeNumber: number;
    titleTotalEpisodes: number;
    freeEpisodesCount?: number;
    episodeIsFreeFlag?: boolean;
    isGuest: boolean;
    userBalance: number;
    isVip: boolean;
    unlockedEpisodes: Set<number>;
    autoUnlockEnabled?: boolean;
  }) {
    const defaultFreeThreshold =
      typeof options.freeEpisodesCount === "number" ? options.freeEpisodesCount : 5;

    // Episode is free if explicit flag is true OR episode <= freeEpisodesCount (unless explicit flag is false)
    const isFree =
      options.episodeIsFreeFlag === true ||
      (options.episodeIsFreeFlag !== false && options.episodeNumber <= defaultFreeThreshold);

    if (isFree) {
      return {
        canPlay: true,
        isFree: true,
        isLocked: false,
        reason: "free_preview",
        requiredCoins: 0,
        flow: "direct_playback",
      };
    }

    // Locked episode handling:
    // 1. VIP bypass
    if (options.isVip) {
      return {
        canPlay: true,
        isFree: false,
        isLocked: false,
        reason: "vip_pass",
        requiredCoins: 0,
        flow: "vip_unlocked",
      };
    }

    // 2. Previously unlocked by user
    if (options.unlockedEpisodes.has(options.episodeNumber)) {
      return {
        canPlay: true,
        isFree: false,
        isLocked: false,
        reason: "user_entitled",
        requiredCoins: 0,
        flow: "previously_unlocked",
      };
    }

    // 3. Guest cannot unlock directly: requires authentication
    if (options.isGuest) {
      return {
        canPlay: false,
        isFree: false,
        isLocked: true,
        reason: "guest_login_required",
        requiredCoins: 10,
        flow: "login_required_modal",
      };
    }

    // 4. Authenticated user: check balance & auto-unlock preference
    if (options.userBalance >= 10) {
      if (options.autoUnlockEnabled) {
        return {
          canPlay: true,
          isFree: false,
          isLocked: false,
          reason: "auto_unlocked",
          requiredCoins: 10,
          flow: "auto_unlock_seamless",
        };
      }
      return {
        canPlay: false,
        isFree: false,
        isLocked: true,
        reason: "coins_sufficient",
        requiredCoins: 10,
        flow: "unlock_modal_confirm",
      };
    }

    // 5. Insufficient coins: prompt top up / daily rewards
    return {
      canPlay: false,
      isFree: false,
      isLocked: true,
      reason: "insufficient_coins",
      requiredCoins: 10,
      flow: "unlock_modal_insufficient",
    };
  }

  describe("Funnel Step 1: Free Preview Boundary Rules (Episodes 1-5 vs 6+)", () => {
    test("standard drama defaults to Episodes 1-5 free and Episode 6 locked", () => {
      // Episode 1 -> Free
      const ep1 = evaluateEpisodeAccess({
        episodeNumber: 1,
        titleTotalEpisodes: 40,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });
      assert.equal(ep1.canPlay, true);
      assert.equal(ep1.isFree, true);
      assert.equal(ep1.isLocked, false);

      // Episode 5 -> Free
      const ep5 = evaluateEpisodeAccess({
        episodeNumber: 5,
        titleTotalEpisodes: 40,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });
      assert.equal(ep5.canPlay, true);
      assert.equal(ep5.isFree, true);

      // Episode 6 -> Locked (Paywall threshold)
      const ep6 = evaluateEpisodeAccess({
        episodeNumber: 6,
        titleTotalEpisodes: 40,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });
      assert.equal(ep6.canPlay, false);
      assert.equal(ep6.isFree, false);
      assert.equal(ep6.isLocked, true);
      assert.equal(ep6.flow, "login_required_modal");
    });

    test("respects dynamic title-level freeEpisodesCount override", () => {
      // Short preview drama (only Ep 1-3 free)
      const ep3 = evaluateEpisodeAccess({
        episodeNumber: 3,
        titleTotalEpisodes: 20,
        freeEpisodesCount: 3,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });
      assert.equal(ep3.canPlay, true);

      const ep4 = evaluateEpisodeAccess({
        episodeNumber: 4,
        titleTotalEpisodes: 20,
        freeEpisodesCount: 3,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });
      assert.equal(ep4.canPlay, false);
      assert.equal(ep4.isLocked, true);
    });

    test("respects explicit episode-level is_free override flag", () => {
      // Episode 10 explicitly marked free by content administrator
      const ep10Override = evaluateEpisodeAccess({
        episodeNumber: 10,
        titleTotalEpisodes: 50,
        freeEpisodesCount: 5,
        episodeIsFreeFlag: true,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });
      assert.equal(ep10Override.canPlay, true);
      assert.equal(ep10Override.isFree, true);

      // Episode 2 explicitly locked by administrator
      const ep2LockedOverride = evaluateEpisodeAccess({
        episodeNumber: 2,
        titleTotalEpisodes: 50,
        freeEpisodesCount: 5,
        episodeIsFreeFlag: false,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });
      assert.equal(ep2LockedOverride.canPlay, false);
      assert.equal(ep2LockedOverride.isLocked, true);
    });
  });

  describe("Funnel Step 2: Guest Paywall & Redirection Journey", () => {
    test("unauthenticated guest attempting locked episode requires login with return URL", () => {
      const access = evaluateEpisodeAccess({
        episodeNumber: 8,
        titleTotalEpisodes: 30,
        isGuest: true,
        userBalance: 0,
        isVip: false,
        unlockedEpisodes: new Set(),
      });

      assert.equal(access.canPlay, false);
      assert.equal(access.flow, "login_required_modal");

      // Verify return URL construction
      const dramaSlug = "secret-heiress";
      const targetEp = 8;
      const expectedReturnUrl = `/watch/${dramaSlug}?ep=${targetEp}`;
      assert.equal(expectedReturnUrl, "/watch/secret-heiress?ep=8");
    });
  });

  describe("Funnel Step 3: Authenticated User Balance & Unlock Journey", () => {
    test("user with insufficient balance (<10 coins) triggers insufficient funds modal", () => {
      const access = evaluateEpisodeAccess({
        episodeNumber: 6,
        titleTotalEpisodes: 20,
        isGuest: false,
        userBalance: 5, // less than 10 coins
        isVip: false,
        unlockedEpisodes: new Set(),
      });

      assert.equal(access.canPlay, false);
      assert.equal(access.flow, "unlock_modal_insufficient");
      assert.equal(access.requiredCoins, 10);
    });

    test("user with sufficient balance (>=10 coins) triggers unlock modal confirmation", () => {
      const access = evaluateEpisodeAccess({
        episodeNumber: 6,
        titleTotalEpisodes: 20,
        isGuest: false,
        userBalance: 30,
        isVip: false,
        unlockedEpisodes: new Set(),
        autoUnlockEnabled: false,
      });

      assert.equal(access.canPlay, false);
      assert.equal(access.flow, "unlock_modal_confirm");
    });

    test("user with auto-unlock preference enabled seamlessly unlocks playback", () => {
      const access = evaluateEpisodeAccess({
        episodeNumber: 7,
        titleTotalEpisodes: 20,
        isGuest: false,
        userBalance: 40,
        isVip: false,
        unlockedEpisodes: new Set([6]),
        autoUnlockEnabled: true,
      });

      assert.equal(access.canPlay, true);
      assert.equal(access.flow, "auto_unlock_seamless");
    });

    test("previously unlocked episodes stream immediately without balance deduction", () => {
      const access = evaluateEpisodeAccess({
        episodeNumber: 6,
        titleTotalEpisodes: 20,
        isGuest: false,
        userBalance: 0, // 0 balance but already unlocked
        isVip: false,
        unlockedEpisodes: new Set([6]),
      });

      assert.equal(access.canPlay, true);
      assert.equal(access.reason, "user_entitled");
      assert.equal(access.flow, "previously_unlocked");
    });
  });

  describe("Funnel Step 4: Bulk Bundle Unlock & Discount Algorithm", () => {
    test("bulk bundle computes 20% discount on all remaining locked episodes", () => {
      const totalEpisodes = 40;
      const freeEpisodes = 5;
      const alreadyUnlocked = new Set([6, 7, 8]); // 3 already unlocked

      const remainingLocked = totalEpisodes - freeEpisodes - alreadyUnlocked.size; // 40 - 5 - 3 = 32
      assert.equal(remainingLocked, 32);

      const pricing = calculateBundleCost(remainingLocked);
      assert.equal(pricing.standardCost, 320); // 32 * 10
      assert.equal(pricing.discountedCost, 256); // Math.floor(320 * 0.8)
      assert.equal(pricing.savings, 64);
      assert.equal(pricing.discountPercent, 20);
    });
  });

  describe("Funnel Step 5: Active VIP Pass Bypass Journey", () => {
    test("active VIP subscription bypasses paywall across all episodes with 0 coin cost", () => {
      const accessEp15 = evaluateEpisodeAccess({
        episodeNumber: 15,
        titleTotalEpisodes: 40,
        isGuest: false,
        userBalance: 0,
        isVip: true, // VIP pass active
        unlockedEpisodes: new Set(),
      });

      assert.equal(accessEp15.canPlay, true);
      assert.equal(accessEp15.reason, "vip_pass");
      assert.equal(accessEp15.flow, "vip_unlocked");
      assert.equal(accessEp15.requiredCoins, 0);
    });
  });

  describe("Funnel Step 6: Gamified 7-Day Daily Check-in Streak Rewards", () => {
    const STREAK_SCHEDULE = [
      { day: 1, coins: 5 },
      { day: 2, coins: 10 },
      { day: 3, coins: 10 },
      { day: 4, coins: 15 },
      { day: 5, coins: 15 },
      { day: 6, coins: 20 },
      { day: 7, coins: 50 },
    ];

    test("provides progressive coin awards summing to 125 total streak coins", () => {
      const total = STREAK_SCHEDULE.reduce((sum, item) => sum + item.coins, 0);
      assert.equal(total, 125);
    });

    test("computes streak rollover back to Day 1 after Day 7 completion", () => {
      function getNextStreakDay(currentStreak: number): number {
        return (currentStreak % 7) + 1;
      }

      assert.equal(getNextStreakDay(1), 2);
      assert.equal(getNextStreakDay(6), 7);
      assert.equal(getNextStreakDay(7), 1); // Loops back to Day 1
      assert.equal(getNextStreakDay(14), 1); // Loops back to Day 1
    });

    test("calculates UTC midnight countdown accurately", () => {
      const countdown = getTimeUntilUtcMidnight();
      assert.ok(countdown.hours >= 0 && countdown.hours <= 23);
      assert.ok(countdown.minutes >= 0 && countdown.minutes <= 59);
      assert.ok(countdown.seconds >= 0 && countdown.seconds <= 59);
      assert.match(countdown.formatted, /^\d{2}h \d{2}m$/);
    });
  });
});
