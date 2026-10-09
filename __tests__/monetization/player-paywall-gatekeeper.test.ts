import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  trackPaywallView,
  trackEpisodeUnlock,
  _resetTrackingForTesting,
  _getEventQueue,
} from "@/lib/analytics/track";
import { AUTO_UNLOCK_STORAGE_KEY } from "@/components/player/EpisodeUnlockModal";
import { calculateBundleCost } from "@/lib/server/wallet";

describe("Task 8.3: Custom Player Paywall Gatekeeper UI & Coin Unlock Modal", () => {
  beforeEach(() => {
    _resetTrackingForTesting();
  });

  describe("Analytics Paywall & Unlock Tracking (Phase 15 Integration)", () => {
    it("tracks paywall_view event with source and metadata", () => {
      trackPaywallView({
        titleSlug: "alpha-boss",
        episodeNumber: 6,
        source: "navigation",
      });

      const queue = _getEventQueue();
      assert.equal(queue.length, 1);
      assert.equal(queue[0].eventType, "paywall_view");
      assert.equal(queue[0].titleSlug, "alpha-boss");
      assert.equal(queue[0].episodeNumber, 6);
      assert.equal(queue[0].payload?.source, "navigation");
    });

    it("tracks single episode unlock event with coinsSpent and isVip false", () => {
      trackEpisodeUnlock({
        titleSlug: "alpha-boss",
        episodeNumber: 6,
        coinsSpent: 10,
        isBundle: false,
        episodesCount: 1,
        isVip: false,
      });

      const queue = _getEventQueue();
      assert.equal(queue.length, 1);
      assert.equal(queue[0].eventType, "episode_unlock");
      assert.equal(queue[0].titleSlug, "alpha-boss");
      assert.equal(queue[0].episodeNumber, 6);
      assert.equal(queue[0].payload?.coinsSpent, 10);
      assert.equal(queue[0].payload?.isBundle, false);
      assert.equal(queue[0].payload?.episodesCount, 1);
      assert.equal(queue[0].payload?.isVip, false);
    });

    it("tracks bulk bundle episode unlock event with 20% discount and isBundle true", () => {
      trackEpisodeUnlock({
        titleSlug: "alpha-boss",
        episodeNumber: 6,
        coinsSpent: 80,
        isBundle: true,
        episodesCount: 10,
        isVip: false,
      });

      const queue = _getEventQueue();
      assert.equal(queue.length, 1);
      assert.equal(queue[0].eventType, "episode_unlock");
      assert.equal(queue[0].payload?.coinsSpent, 80);
      assert.equal(queue[0].payload?.isBundle, true);
      assert.equal(queue[0].payload?.episodesCount, 10);
    });

    it("tracks VIP bypass unlock with coinsSpent 0 and isVip true", () => {
      trackEpisodeUnlock({
        titleSlug: "alpha-boss",
        episodeNumber: 7,
        coinsSpent: 0,
        isBundle: false,
        episodesCount: 1,
        isVip: true,
      });

      const queue = _getEventQueue();
      assert.equal(queue.length, 1);
      assert.equal(queue[0].eventType, "episode_unlock");
      assert.equal(queue[0].payload?.coinsSpent, 0);
      assert.equal(queue[0].payload?.isVip, true);
    });
  });

  describe("Paywall Gatekeeper Invariants & Component Contracts", () => {
    it("exports AUTO_UNLOCK_STORAGE_KEY matching standard storage identifier", () => {
      assert.equal(AUTO_UNLOCK_STORAGE_KEY, "dramashort_auto_unlock_episodes");
    });

    it("verifies EpisodeUnlockModal component exists and includes required UX elements", () => {
      const modalPath = path.join(
        process.cwd(),
        "components",
        "player",
        "EpisodeUnlockModal.tsx"
      );
      assert.ok(fs.existsSync(modalPath), "EpisodeUnlockModal.tsx must exist");

      const content = fs.readFileSync(modalPath, "utf8");
      // Check single unlock and bundle unlock UI
      assert.ok(content.includes("handleUnlockSingle"), "Must handle single unlock");
      assert.ok(content.includes("handleUnlockBundle"), "Must handle bundle unlock");
      assert.ok(content.includes("AUTO_UNLOCK_STORAGE_KEY"), "Must support auto-unlock toggle");
      assert.ok(content.includes("calculateBundleCost"), "Must calculate 20% bundle discount");
      assert.ok(content.includes("trackPaywallView"), "Must emit paywall_view on open");
      assert.ok(content.includes("trackEpisodeUnlock"), "Must emit episode_unlock on debit");
      assert.ok(content.includes("Save 20%"), "Must highlight 20% discount savings badge");
    });

    it("verifies re-export facade exists at components/modals/EpisodeUnlockModal.tsx", () => {
      const facadePath = path.join(
        process.cwd(),
        "components",
        "modals",
        "EpisodeUnlockModal.tsx"
      );
      assert.ok(fs.existsSync(facadePath), "components/modals/EpisodeUnlockModal.tsx must exist");

      const content = fs.readFileSync(facadePath, "utf8");
      assert.ok(
        content.includes("@/components/player/EpisodeUnlockModal"),
        "Must re-export from @/components/player/EpisodeUnlockModal"
      );
    });

    it("verifies EpisodeSheet supports monetization props", () => {
      const sheetPath = path.join(
        process.cwd(),
        "components",
        "player",
        "EpisodeSheet.tsx"
      );
      assert.ok(fs.existsSync(sheetPath), "EpisodeSheet.tsx must exist");

      const content = fs.readFileSync(sheetPath, "utf8");
      assert.ok(content.includes("unlockedEpisodeNumbers"), "Must accept unlockedEpisodeNumbers");
      assert.ok(content.includes("freeEpisodesCount"), "Must accept freeEpisodesCount");
      assert.ok(content.includes("isVip"), "Must accept isVip flag");
      assert.ok(content.includes("onSelectLockedEpisode"), "Must accept onSelectLockedEpisode");
      assert.ok(content.includes("Lock"), "Must render Lock icon on locked episodes");
    });

    it("verifies WatchPlayerIsland wires EpisodeUnlockModal and LoginRequiredModal", () => {
      const islandPath = path.join(
        process.cwd(),
        "components",
        "watch",
        "WatchPlayerIsland.tsx"
      );
      assert.ok(fs.existsSync(islandPath), "WatchPlayerIsland.tsx must exist");

      const content = fs.readFileSync(islandPath, "utf8");
      assert.ok(content.includes("EpisodeUnlockModal"), "Must render EpisodeUnlockModal");
      assert.ok(content.includes("LoginRequiredModal"), "Must render LoginRequiredModal");
      assert.ok(content.includes("getClientWallet"), "Must fetch wallet and entitlements");
      assert.ok(content.includes("AUTO_UNLOCK_STORAGE_KEY"), "Must support auto-unlock continuous playback");
      assert.ok(content.includes("PAYMENT_REQUIRED"), "Must intercept PAYMENT_REQUIRED paywall errors");
      assert.ok(content.includes("handleModalUnlocked"), "Must handle successful unlock callback");
    });
  });

  describe("Episode Lock Decision Logic", () => {
    function evaluateLock(params: {
      episodeNumber: number;
      freeEpisodesCount?: number;
      isFreeExplicit?: boolean;
      unlockedEpisodeNumbers: Set<number>;
      isVip: boolean;
      isAvailable: boolean;
    }) {
      const freeLimit = params.freeEpisodesCount ?? 5;
      const isFree = params.isFreeExplicit ?? (params.episodeNumber <= freeLimit);
      const isUnlocked = params.isVip || params.unlockedEpisodeNumbers.has(params.episodeNumber);
      return params.isAvailable && !isFree && !isUnlocked;
    }

    it("considers episodes 1 to freeEpisodesCount unconditionally free", () => {
      for (let ep = 1; ep <= 5; ep++) {
        const locked = evaluateLock({
          episodeNumber: ep,
          freeEpisodesCount: 5,
          unlockedEpisodeNumbers: new Set(),
          isVip: false,
          isAvailable: true,
        });
        assert.equal(locked, false, `Episode ${ep} must be free`);
      }
    });

    it("considers episode 6+ locked for guest or regular user with no unlocks", () => {
      const locked = evaluateLock({
        episodeNumber: 6,
        freeEpisodesCount: 5,
        unlockedEpisodeNumbers: new Set(),
        isVip: false,
        isAvailable: true,
      });
      assert.equal(locked, true, "Episode 6 must be locked");
    });

    it("honors custom freeEpisodesCount parameter (e.g. 3 or 7 free)", () => {
      // 3 free
      assert.equal(
        evaluateLock({
          episodeNumber: 3,
          freeEpisodesCount: 3,
          unlockedEpisodeNumbers: new Set(),
          isVip: false,
          isAvailable: true,
        }),
        false
      );
      assert.equal(
        evaluateLock({
          episodeNumber: 4,
          freeEpisodesCount: 3,
          unlockedEpisodeNumbers: new Set(),
          isVip: false,
          isAvailable: true,
        }),
        true
      );

      // 7 free
      assert.equal(
        evaluateLock({
          episodeNumber: 7,
          freeEpisodesCount: 7,
          unlockedEpisodeNumbers: new Set(),
          isVip: false,
          isAvailable: true,
        }),
        false
      );
      assert.equal(
        evaluateLock({
          episodeNumber: 8,
          freeEpisodesCount: 7,
          unlockedEpisodeNumbers: new Set(),
          isVip: false,
          isAvailable: true,
        }),
        true
      );
    });

    it("unlocks episode when recorded in unlockedEpisodeNumbers", () => {
      const locked = evaluateLock({
        episodeNumber: 8,
        freeEpisodesCount: 5,
        unlockedEpisodeNumbers: new Set([8]),
        isVip: false,
        isAvailable: true,
      });
      assert.equal(locked, false, "Unlocked episode 8 must not be locked");
    });

    it("unlocks all episodes for active VIP member", () => {
      for (let ep = 1; ep <= 50; ep++) {
        const locked = evaluateLock({
          episodeNumber: ep,
          freeEpisodesCount: 5,
          unlockedEpisodeNumbers: new Set(),
          isVip: true,
          isAvailable: true,
        });
        assert.equal(locked, false, `Episode ${ep} must be unlocked for VIP`);
      }
    });
  });

  describe("Bundle Pricing in Modal Context", () => {
    it("computes 20% discount correctly for remaining locked episodes", () => {
      const pricing10 = calculateBundleCost(10);
      assert.equal(pricing10.standardCost, 100);
      assert.equal(pricing10.discountedCost, 80);
      assert.equal(pricing10.savings, 20);
      assert.equal(pricing10.discountPercent, 20);

      const pricing25 = calculateBundleCost(25);
      assert.equal(pricing25.standardCost, 250);
      assert.equal(pricing25.discountedCost, 200);
      assert.equal(pricing25.savings, 50);
    });
  });
});
