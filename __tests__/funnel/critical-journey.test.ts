import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateEpisodeTabs,
  computeActiveTabForEpisode,
  getAdjacentEpisode,
  clampEpisodeNumber,
  DEFAULT_EPISODES_PER_TAB,
} from "@/lib/watch/episode-tabs";
import {
  deriveContinueWatching,
  type DramaMeta,
} from "@/lib/watch/continue-watching";
import { getUserRole, hasRole } from "@/lib/auth/roles";
import { getSafeRedirect, readReturnUrl } from "@/lib/navigation/safe-redirect";
import {
  calculateBundleCost,
  getCoinPackageById,
  COIN_PACKAGES,
} from "@/lib/services/wallet.service";
import type { WatchHistoryRow } from "@/lib/services/user.service";

describe("Critical User Journey Funnel Verification (Task 17.1 Realignment)", () => {
  test("Funnel Step 1: Real Episode Tab & Pagination Engine", () => {
    const totalEpisodes = 85;

    // Verify pagination/tab calculation against pure module
    const tabs = calculateEpisodeTabs(totalEpisodes, DEFAULT_EPISODES_PER_TAB);
    assert.equal(tabs.length, 3, "85 episodes should yield 3 tabs");
    assert.deepEqual(tabs[0], { index: 0, start: 1, end: 40, label: "1-40" });
    assert.deepEqual(tabs[1], { index: 1, start: 41, end: 80, label: "41-80" });
    assert.deepEqual(tabs[2], { index: 2, start: 81, end: 85, label: "81-85" });

    // Verify active tab index resolution
    assert.equal(computeActiveTabForEpisode(1, totalEpisodes), 0);
    assert.equal(computeActiveTabForEpisode(40, totalEpisodes), 0);
    assert.equal(computeActiveTabForEpisode(41, totalEpisodes), 1);
    assert.equal(computeActiveTabForEpisode(80, totalEpisodes), 1);
    assert.equal(computeActiveTabForEpisode(81, totalEpisodes), 2);
    assert.equal(computeActiveTabForEpisode(85, totalEpisodes), 2);

    // Verify adjacent navigation boundaries
    assert.equal(getAdjacentEpisode(1, totalEpisodes, "prev"), null, "Cannot go before episode 1");
    assert.equal(getAdjacentEpisode(1, totalEpisodes, "next"), 2, "From ep 1 next is ep 2");
    assert.equal(getAdjacentEpisode(85, totalEpisodes, "next"), null, "Cannot go after episode 85");
    assert.equal(getAdjacentEpisode(85, totalEpisodes, "prev"), 84, "From ep 85 prev is ep 84");

    // Clamping boundaries
    assert.equal(clampEpisodeNumber(0, totalEpisodes), 1);
    assert.equal(clampEpisodeNumber(999, totalEpisodes), 85);
  });

  test("Funnel Step 2: Real Continue Watching & Series Completion Engine", () => {
    const dramasMap = new Map<string, DramaMeta>([
      [
        "billionaire-boss",
        {
          title: "Billionaire Boss Secret Lover",
          poster: "https://example.com/boss.jpg",
          totalEpisodes: 80,
          channel: "DramaBox",
        },
      ],
      [
        "revenge-heiress",
        {
          title: "Revenge of the Heiress",
          poster: "https://example.com/heiress.jpg",
          totalEpisodes: 40,
          channel: "ShortMax",
        },
      ],
      [
        "finished-series",
        {
          title: "Completed Destiny",
          poster: "https://example.com/destiny.jpg",
          totalEpisodes: 30,
          channel: "ReelShort",
        },
      ],
    ]);

    const historyRows: WatchHistoryRow[] = [
      // Case A: In-progress episode (< 0.95) -> should remain current ep with exact progress
      {
        id: "hist-1",
        user_id: "user-123",
        title_slug: "billionaire-boss",
        episode_number: 15,
        progress: 0.45,
        position_seconds: 54,
        duration_seconds: 120,
        updated_at: new Date().toISOString(),
      },
      // Case B: Finished episode (>= 0.95) with subsequent episodes -> should advance to EP 6 with 0% progress
      {
        id: "hist-2",
        user_id: "user-123",
        title_slug: "revenge-heiress",
        episode_number: 5,
        progress: 0.98,
        position_seconds: 118,
        duration_seconds: 120,
        updated_at: new Date().toISOString(),
      },
      // Case C: Series completed (last episode >= 0.95) -> should be omitted from continue watching
      {
        id: "hist-3",
        user_id: "user-123",
        title_slug: "finished-series",
        episode_number: 30,
        progress: 0.99,
        position_seconds: 120,
        duration_seconds: 120,
        updated_at: new Date().toISOString(),
      },
    ];

    const entries = deriveContinueWatching(historyRows, dramasMap);

    assert.equal(entries.length, 2, "Completed series must be omitted from continue watching");

    // Verify Case A
    const entryA = entries.find((e) => e.slug === "billionaire-boss");
    assert.ok(entryA, "In-progress drama must be included");
    assert.equal(entryA.episodeNumber, 15);
    assert.equal(entryA.episodeLabel, "EP 15 of 80");
    assert.equal(entryA.progress, 54 / 120);
    assert.equal(entryA.href, "/watch/billionaire-boss?ep=15");

    // Verify Case B (Auto-advance)
    const entryB = entries.find((e) => e.slug === "revenge-heiress");
    assert.ok(entryB, "Finished episode drama must advance to next episode");
    assert.equal(entryB.episodeNumber, 6, "Must advance to episode 6");
    assert.equal(entryB.episodeLabel, "Up Next: EP 6 of 40");
    assert.equal(entryB.progress, 0, "Progress must reset to 0 for next episode");
    assert.equal(entryB.href, "/watch/revenge-heiress?ep=6");
  });

  test("Funnel Step 3: Real Role Resolution & Security Privilege Guarding", () => {
    // Admin user via trusted app_metadata
    const adminUser = {
      id: "admin-1",
      email: "admin@dramashort.com",
      app_metadata: { role: "admin" },
      user_metadata: {},
    };
    assert.equal(getUserRole(adminUser), "admin");
    assert.equal(hasRole(adminUser, ["admin"]), true);

    // Editor user
    const editorUser = {
      id: "editor-1",
      email: "editor@dramashort.com",
      app_metadata: { role: "editor" },
      user_metadata: {},
    };
    assert.equal(getUserRole(editorUser), "editor");
    assert.equal(hasRole(editorUser, ["editor"]), true);
    assert.equal(hasRole(editorUser, ["admin"]), false);

    // Malicious self-elevation attempt via user_metadata
    const spoofedUser = {
      id: "attacker-1",
      email: "attacker@dramashort.com",
      app_metadata: {},
      user_metadata: { role: "admin" }, // User-writable metadata must be rejected
    };
    assert.equal(getUserRole(spoofedUser), null, "user_metadata.role must be strictly ignored");
    assert.equal(hasRole(spoofedUser, ["admin"]), false);

    // Unauthenticated user
    assert.equal(getUserRole(null), null);
    assert.equal(hasRole(null, ["admin"]), false);
  });

  test("Funnel Step 4: Real Open-Redirect Post-Login Protection", () => {
    // Valid internal return URLs
    assert.equal(
      getSafeRedirect("/watch/billionaire-boss?ep=12"),
      "/watch/billionaire-boss?ep=12"
    );
    assert.equal(getSafeRedirect("/wallet/topup"), "/wallet/topup");

    // Malicious open redirect exploits
    assert.equal(getSafeRedirect("https://attacker-phishing.com"), "/home");
    assert.equal(getSafeRedirect("http://evil.com/login"), "/home");
    assert.equal(getSafeRedirect("//evil.com/exploit"), "/home");
    assert.equal(getSafeRedirect("/\\evil.com/bypass"), "/home");
    assert.equal(getSafeRedirect("javascript:alert(1)"), "/home");

    // Loop prevention: Auth pages must not be post-login destinations
    const searchParamsWithLogin = {
      get: (key: string) => (key === "returnUrl" ? "/login" : null),
    };
    assert.equal(readReturnUrl(searchParamsWithLogin), "/home");

    const searchParamsWithSignup = {
      get: (key: string) => (key === "returnUrl" ? "/signup" : null),
    };
    assert.equal(readReturnUrl(searchParamsWithSignup), "/home");

    const searchParamsWithWatch = {
      get: (key: string) => (key === "returnUrl" ? "/watch/alpha-drama?ep=3" : null),
    };
    assert.equal(readReturnUrl(searchParamsWithWatch), "/watch/alpha-drama?ep=3");
  });

  test("Funnel Step 5: Real Paywall & Bundle Pricing Engine", () => {
    // Bundle cost calculation with 20% discount
    const bundle35 = calculateBundleCost(35);
    assert.equal(bundle35.standardCost, 350, "35 episodes * 10 coins = 350 coins");
    assert.equal(bundle35.discountedCost, 280, "350 * 0.8 = 280 coins");
    assert.equal(bundle35.savings, 70, "350 - 280 = 70 coins saved");
    assert.equal(bundle35.discountPercent, 20);

    // Single episode edge case (minimum floor)
    const bundle1 = calculateBundleCost(1);
    assert.equal(bundle1.standardCost, 10);
    assert.equal(bundle1.discountedCost, 10, "Minimum 10 coins enforced");
    assert.equal(bundle1.savings, 0);

    // 0 remaining episodes
    const bundle0 = calculateBundleCost(0);
    assert.equal(bundle0.standardCost, 0);
    assert.equal(bundle0.discountedCost, 0);
    assert.equal(bundle0.savings, 0);

    // Coin package catalog integrity
    assert.ok(COIN_PACKAGES.length >= 4, "Must offer multiple coin top-up tiers");
    const pkgPopular = getCoinPackageById("coins_popular_350");
    assert.ok(pkgPopular, "coins_popular_350 package must exist");
    assert.equal(pkgPopular?.coins, 300);
    assert.equal(pkgPopular?.bonusCoins, 50);
    assert.equal(pkgPopular?.totalCoins, 350);
    assert.ok(pkgPopular?.priceUsd > 0);

    // Non-existent package lookup
    const invalidPkg = getCoinPackageById("invalid_package" as any);
    assert.equal(invalidPkg, undefined);
  });
});
