import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EPISODES_PER_TAB,
  clampEpisodeNumber,
  calculateEpisodeTabs,
  computeActiveTabForEpisode,
  getEpisodesForTab,
  getAdjacentEpisode,
} from "@/lib/watch/episode-tabs";

describe("Episode Tabs & Navigation Pure Engine (lib/watch/episode-tabs.ts)", () => {
  describe("clampEpisodeNumber", () => {
    test("preserves valid episode numbers within [1, totalEpisodes]", () => {
      assert.equal(clampEpisodeNumber(1, 40), 1);
      assert.equal(clampEpisodeNumber(25, 40), 25);
      assert.equal(clampEpisodeNumber(40, 40), 40);
    });

    test("clamps negative, zero, and NaN inputs to 1", () => {
      assert.equal(clampEpisodeNumber(0, 50), 1);
      assert.equal(clampEpisodeNumber(-10, 50), 1);
      assert.equal(clampEpisodeNumber(NaN, 50), 1);
      assert.equal(clampEpisodeNumber(Number.POSITIVE_INFINITY, 50), 50);
      assert.equal(clampEpisodeNumber(Number.NEGATIVE_INFINITY, 50), 1);
    });

    test("clamps values greater than totalEpisodes to totalEpisodes", () => {
      assert.equal(clampEpisodeNumber(85, 40), 40);
      assert.equal(clampEpisodeNumber(1000, 75), 75);
    });

    test("floors fractional numbers", () => {
      assert.equal(clampEpisodeNumber(3.8, 10), 3);
      assert.equal(clampEpisodeNumber(1.2, 10), 1);
    });

    test("handles edge case of totalEpisodes <= 0 by defaulting total to 1", () => {
      assert.equal(clampEpisodeNumber(5, 0), 1);
      assert.equal(clampEpisodeNumber(1, -5), 1);
    });
  });

  describe("calculateEpisodeTabs", () => {
    test("calculates single tab for total <= DEFAULT_EPISODES_PER_TAB", () => {
      const tabs1 = calculateEpisodeTabs(1);
      assert.equal(tabs1.length, 1);
      assert.deepEqual(tabs1[0], { index: 0, start: 1, end: 1, label: "1" });

      const tabs20 = calculateEpisodeTabs(20);
      assert.equal(tabs20.length, 1);
      assert.deepEqual(tabs20[0], { index: 0, start: 1, end: 20, label: "1-20" });

      const tabs40 = calculateEpisodeTabs(DEFAULT_EPISODES_PER_TAB);
      assert.equal(tabs40.length, 1);
      assert.deepEqual(tabs40[0], { index: 0, start: 1, end: 40, label: "1-40" });
    });

    test("calculates multiple tabs for total > 40", () => {
      const tabs85 = calculateEpisodeTabs(85);
      assert.equal(tabs85.length, 3);
      assert.deepEqual(tabs85[0], { index: 0, start: 1, end: 40, label: "1-40" });
      assert.deepEqual(tabs85[1], { index: 1, start: 41, end: 80, label: "41-80" });
      assert.deepEqual(tabs85[2], { index: 2, start: 81, end: 85, label: "81-85" });
    });

    test("handles exact multiples of tab size without phantom extra tab", () => {
      const tabs80 = calculateEpisodeTabs(80);
      assert.equal(tabs80.length, 2);
      assert.deepEqual(tabs80[0], { index: 0, start: 1, end: 40, label: "1-40" });
      assert.deepEqual(tabs80[1], { index: 1, start: 41, end: 80, label: "41-80" });
    });

    test("supports custom episodesPerTab parameter", () => {
      const tabsCustom = calculateEpisodeTabs(50, 20);
      assert.equal(tabsCustom.length, 3);
      assert.deepEqual(tabsCustom[0], { index: 0, start: 1, end: 20, label: "1-20" });
      assert.deepEqual(tabsCustom[1], { index: 1, start: 21, end: 40, label: "21-40" });
      assert.deepEqual(tabsCustom[2], { index: 2, start: 41, end: 50, label: "41-50" });
    });

    test("safely handles totalEpisodes <= 0", () => {
      const tabsZero = calculateEpisodeTabs(0);
      assert.equal(tabsZero.length, 1);
      assert.deepEqual(tabsZero[0], { index: 0, start: 1, end: 1, label: "1" });
    });
  });

  describe("computeActiveTabForEpisode", () => {
    test("computes correct tab index for episodes across boundaries", () => {
      const total = 85;
      assert.equal(computeActiveTabForEpisode(1, total), 0);
      assert.equal(computeActiveTabForEpisode(20, total), 0);
      assert.equal(computeActiveTabForEpisode(40, total), 0);
      assert.equal(computeActiveTabForEpisode(41, total), 1);
      assert.equal(computeActiveTabForEpisode(80, total), 1);
      assert.equal(computeActiveTabForEpisode(81, total), 2);
      assert.equal(computeActiveTabForEpisode(85, total), 2);
    });

    test("clamps out-of-range episodes to valid tab indices", () => {
      const total = 85;
      assert.equal(computeActiveTabForEpisode(0, total), 0);
      assert.equal(computeActiveTabForEpisode(-5, total), 0);
      assert.equal(computeActiveTabForEpisode(999, total), 2);
    });

    test("supports custom episodesPerTab", () => {
      assert.equal(computeActiveTabForEpisode(25, 60, 20), 1);
      assert.equal(computeActiveTabForEpisode(45, 60, 20), 2);
    });
  });

  describe("getEpisodesForTab", () => {
    test("returns full array of episode numbers for given tab", () => {
      const tab0 = getEpisodesForTab(0, 85);
      assert.equal(tab0.length, 40);
      assert.equal(tab0[0], 1);
      assert.equal(tab0[39], 40);

      const tab1 = getEpisodesForTab(1, 85);
      assert.equal(tab1.length, 40);
      assert.equal(tab1[0], 41);
      assert.equal(tab1[39], 80);

      const tab2 = getEpisodesForTab(2, 85);
      assert.equal(tab2.length, 5);
      assert.deepEqual(tab2, [81, 82, 83, 84, 85]);
    });

    test("returns empty array for invalid tab indices", () => {
      assert.deepEqual(getEpisodesForTab(-1, 85), []);
      assert.deepEqual(getEpisodesForTab(5, 85), []);
    });
  });

  describe("getAdjacentEpisode", () => {
    test("navigates next correctly within bounds", () => {
      assert.equal(getAdjacentEpisode(1, 40, "next"), 2);
      assert.equal(getAdjacentEpisode(39, 40, "next"), 40);
    });

    test("blocks next when at last episode", () => {
      assert.equal(getAdjacentEpisode(40, 40, "next"), null);
      assert.equal(getAdjacentEpisode(85, 85, "next"), null);
    });

    test("navigates prev correctly within bounds", () => {
      assert.equal(getAdjacentEpisode(2, 40, "prev"), 1);
      assert.equal(getAdjacentEpisode(40, 40, "prev"), 39);
    });

    test("blocks prev when at first episode", () => {
      assert.equal(getAdjacentEpisode(1, 40, "prev"), null);
    });

    test("clamps input before calculating navigation", () => {
      assert.equal(getAdjacentEpisode(0, 40, "prev"), null);
      assert.equal(getAdjacentEpisode(0, 40, "next"), 2);
      assert.equal(getAdjacentEpisode(999, 40, "next"), null);
      assert.equal(getAdjacentEpisode(999, 40, "prev"), 39);
    });
  });
});
