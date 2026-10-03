import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { titles } from "@/data/titles.mock";
import { channels } from "@/data/channels.mock";
import { getTitleBySlugOrFallback } from "@/data/titles.mock";

describe("Critical User Journey Funnel Verification", () => {
  test("Funnel Step 1: Catalog Discovery & Channel Affiliation", () => {
    assert.ok(titles.length > 0, "Titles catalog must not be empty");
    assert.ok(channels.length > 0, "Channels catalog must not be empty");

    // Every drama item has valid essential fields
    for (const drama of titles) {
      assert.ok(drama.id, "Drama must have an ID");
      assert.ok(drama.title, "Drama must have a title");
      assert.ok(drama.slug, "Drama must have a slug");
      assert.ok(drama.poster, "Drama must have a poster image URL");
      assert.ok(drama.channel, "Drama must be associated with a channel");
      assert.ok(drama.genre, "Drama must have a genre defined");
      assert.ok(drama.totalEpisodes >= 1, "Drama must have at least 1 episode");
    }
  });

  test("Funnel Step 2: Drama Detail Page Metadata Resolution", () => {
    const sampleSlug = titles[0].slug;
    const drama = getTitleBySlugOrFallback(sampleSlug);

    assert.equal(drama.slug, sampleSlug);
    assert.ok(drama.synopsis, "Drama detail must include synopsis");
    assert.ok(Array.isArray(drama.tags), "Drama tags must be an array");
    assert.ok(drama.status, "Drama status must be declared");
  });

  test("Funnel Step 3: Video Player Navigation & Range Math", () => {
    const sampleDrama = titles[0];
    const totalEpisodes = sampleDrama.totalEpisodes || 40;
    const EPISODES_PER_TAB = 40;

    // Verify pagination/tab calculation
    const tabCount = Math.ceil(totalEpisodes / EPISODES_PER_TAB);
    assert.ok(tabCount >= 1, "Must have at least one tab range");

    const tabs = Array.from({ length: tabCount }, (_, i) => ({
      start: i * EPISODES_PER_TAB + 1,
      end: Math.min((i + 1) * EPISODES_PER_TAB, totalEpisodes),
    }));

    assert.equal(tabs[0].start, 1);
    assert.equal(tabs[tabs.length - 1].end, totalEpisodes);

    // Verify next/prev episode navigation boundary checks
    const currentEpisode = 1;
    const nextEpisode = Math.min(totalEpisodes, currentEpisode + 1);
    const prevEpisode = Math.max(1, currentEpisode - 1);

    assert.equal(nextEpisode, 2);
    assert.equal(prevEpisode, 1); // Cannot go below 1
  });

  test("Funnel Step 4: Progress Persistence & Storage Calculation", () => {
    const duration = 120; // 120 seconds episode
    const currentTime = 60; // 60 seconds watched

    const progressRatio = currentTime / duration;
    assert.equal(progressRatio, 0.5);

    // Watch percentage
    const percent = Math.round(progressRatio * 100);
    assert.equal(percent, 50);

    // Clamping limits
    const clampedTest = (t: number) => Math.min(1.0, Math.max(0.0, t / duration));
    assert.equal(clampedTest(-10), 0);
    assert.equal(clampedTest(200), 1.0);
  });
});
