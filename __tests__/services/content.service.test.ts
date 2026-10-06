import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mapTitleRowToTitle,
  mapChannelRowToChannel,
  mapEpisodeRowToEpisode,
} from "@/lib/services/content.service";
import { titles, getTitleBySlugOrFallback } from "@/data/titles.mock";
import { getRelatedTitles } from "@/lib/getRelatedTitles";
import type { Database } from "@/types/supabase-content";

type TitleRow = Database["public"]["Tables"]["titles"]["Row"];
type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];

describe("Content Service Unit Tests", () => {
  test("mapTitleRowToTitle maps Supabase database row to Drama domain model", () => {
    const mockRow: TitleRow = {
      id: "drama-uuid-123",
      title: "My Secret Billionaire Husband",
      slug: "my-secret-billionaire-husband",
      synopsis: "An heiress marries a supposed pauper who is secretly the CEO.",
      poster_url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131",
      channel_id: "chan-1",
      channel_name: "DramaShort Originals",
      channel_code: "DSO",
      genre: "Romance",
      tags: ["CEO", "Secret Identity", "Marriage"],
      total_episodes: 50,
      episodes_available: 45,
      rating: 4.8,
      views_count: 1250000,
      release_year: 2026,
      status: "Published",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    };

    const drama = mapTitleRowToTitle(mockRow);

    assert.equal(drama.id, "drama-uuid-123");
    assert.equal(drama.title, "My Secret Billionaire Husband");
    assert.equal(drama.slug, "my-secret-billionaire-husband");
    assert.equal(drama.channel, "DramaShort Originals");
    assert.equal(drama.genre, "Romance");
    assert.deepEqual(drama.tags, ["CEO", "Secret Identity", "Marriage"]);
    assert.equal(drama.totalEpisodes, 50);
    assert.equal(drama.episodesAvailable, 45);
    assert.equal(drama.rating, 4.8);
    assert.equal(drama.views, 1250000);
    assert.equal(drama.year, 2026);
    assert.equal(drama.status, "Published");
  });

  test("mapChannelRowToChannel transforms Channel DB row", () => {
    const mockChannelRow: ChannelRow = {
      id: "chan-uuid-456",
      name: "DramaShort Originals",
      code: "DSO",
      slug: "dramashort-originals",
      description: "Exclusive flagship short drama productions",
      avatar_url: "https://example.com/icon.png",
      banner_url: "https://example.com/banner.png",
      created_at: "2026-01-01T00:00:00Z",
    };

    const channel = mapChannelRowToChannel(mockChannelRow);
    assert.equal(channel.slug, "dramashort-originals");
    assert.equal(channel.name, "DramaShort Originals");
  });

  test("mapEpisodeRowToEpisode transforms Episode DB row with fallback title", () => {
    const mockEpisodeRow: EpisodeRow = {
      id: "ep-uuid-789",
      title_id: "drama-uuid-123",
      episode_number: 5,
      title: null,
      video_url: "https://example.com/stream.m3u8",
      thumbnail_url: "https://example.com/thumb.jpg",
      duration_seconds: 120,
      is_free: true,
      created_at: "2026-01-01T00:00:00Z",
    };

    const episode = mapEpisodeRowToEpisode(mockEpisodeRow);
    assert.equal(episode.episodeNumber, 5);
    assert.equal(episode.title, "Episode 5");
    assert.equal(episode.videoUrl, "https://example.com/stream.m3u8");
    assert.equal(episode.isFree, true);
  });

  test("getTitleBySlugOrFallback resolves existing title or provides valid fallback", () => {
    const existing = titles[0];
    const resolved = getTitleBySlugOrFallback(existing.slug);
    assert.equal(resolved.slug, existing.slug);
    assert.equal(resolved.title, existing.title);

    const nonExistent = getTitleBySlugOrFallback("non-existent-drama-slug-123");
    assert.ok(nonExistent);
    assert.ok(nonExistent.title);
  });

  test("getRelatedTitles filters and excludes current title", () => {
    const target = titles[0];
    const related = getRelatedTitles(target, 4);

    assert.ok(Array.isArray(related));
    assert.ok(related.length <= 4);
    assert.ok(related.every((item) => item.id !== target.id));
  });
});
