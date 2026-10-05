import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessEpisode,
  resolvePlaybackSession,
  type EpisodePlaybackInfo,
} from "@/lib/server/playback";
import type { User } from "@supabase/supabase-js";

function makeEpisodeInfo(overrides: Partial<EpisodePlaybackInfo> = {}): EpisodePlaybackInfo {
  return {
    episodeId: "11111111-1111-4111-8111-111111111111",
    titleId: "22222222-2222-4222-8222-222222222222",
    titleName: "CEO's Secret Romance",
    titleSlug: "ceos-secret-romance-ds",
    titleStatus: "Published",
    episodeNumber: 1,
    isFree: true,
    videoUrl: "https://example.com/fallback.mp4",
    provider: "custom",
    assetRef: null,
    hlsUrl: "https://example.com/stream.m3u8",
    mp4Url: "https://example.com/fallback.mp4",
    durationSeconds: 95,
    aspectRatio: "9:16",
    ...overrides,
  };
}

describe("Episode Media Access Control & Server Playback (Task 10.6)", () => {
  describe("canAccessEpisode permission rules", () => {
    it("permits guest access to published episodes", async () => {
      const episode = makeEpisodeInfo({ titleStatus: "Published" });
      const result = await canAccessEpisode(null, episode);

      assert.equal(result.allowed, true);
    });

    it("permits signed-in regular user access to published episodes", async () => {
      const episode = makeEpisodeInfo({ titleStatus: "Published" });
      const user = {
        id: "usr-reg-1",
        app_metadata: {},
        user_metadata: {},
      } as unknown as User;

      const result = await canAccessEpisode(user, episode);
      assert.equal(result.allowed, true);
    });

    it("denies guest access to Draft titles", async () => {
      const episode = makeEpisodeInfo({ titleStatus: "Draft" });
      const result = await canAccessEpisode(null, episode);

      assert.equal(result.allowed, false);
      assert.equal(result.reason, "UNPUBLISHED_TITLE");
    });

    it("denies regular user access to Draft titles", async () => {
      const episode = makeEpisodeInfo({ titleStatus: "Draft" });
      const user = {
        id: "usr-reg-1",
        app_metadata: {},
        user_metadata: {},
      } as unknown as User;

      const result = await canAccessEpisode(user, episode);
      assert.equal(result.allowed, false);
      assert.equal(result.reason, "UNPUBLISHED_TITLE");
    });

    it("denies regular user with forged user_metadata.role access to Draft titles", async () => {
      const episode = makeEpisodeInfo({ titleStatus: "Draft" });
      const attacker = {
        id: "usr-bad-1",
        app_metadata: {}, // no role in app_metadata
        user_metadata: { role: "admin" }, // forged client metadata
      } as unknown as User;

      const result = await canAccessEpisode(attacker, episode);
      assert.equal(result.allowed, false);
      assert.equal(result.reason, "UNPUBLISHED_TITLE");
    });

    it("denies guest access to Archived or Scheduled titles", async () => {
      const archivedEp = makeEpisodeInfo({ titleStatus: "Archived" });
      const scheduledEp = makeEpisodeInfo({ titleStatus: "Scheduled" });

      assert.equal((await canAccessEpisode(null, archivedEp)).allowed, false);
      assert.equal((await canAccessEpisode(null, scheduledEp)).allowed, false);
    });

    it("allows admin to preview Draft episodes", async () => {
      const episode = makeEpisodeInfo({ titleStatus: "Draft" });
      const admin = {
        id: "usr-admin-1",
        app_metadata: { role: "admin" },
        user_metadata: {},
      } as unknown as User;

      const result = await canAccessEpisode(admin, episode);
      assert.equal(result.allowed, true);
    });

    it("allows editor to preview Draft episodes", async () => {
      const episode = makeEpisodeInfo({ titleStatus: "Draft" });
      const editor = {
        id: "usr-editor-1",
        app_metadata: { role: "editor" },
        user_metadata: {},
      } as unknown as User;

      const result = await canAccessEpisode(editor, episode);
      assert.equal(result.allowed, true);
    });
  });

  describe("resolvePlaybackSession streaming resolution", () => {
    it("prefers HLS master stream when available", () => {
      const episode = makeEpisodeInfo({
        hlsUrl: "https://example.com/stream/master.m3u8",
        mp4Url: "https://example.com/fallback.mp4",
        videoUrl: "https://example.com/legacy.mp4",
      });

      const session = resolvePlaybackSession(episode);
      assert.equal(session.url, "https://example.com/stream/master.m3u8");
      assert.equal(session.aspectRatio, "9:16");
      assert.equal(session.durationSeconds, 95);
      assert.ok(session.expiresAt);
      assert.ok(new Date(session.expiresAt).getTime() > Date.now());
    });

    it("falls back to MP4 URL when HLS is null", () => {
      const episode = makeEpisodeInfo({
        hlsUrl: null,
        mp4Url: "https://example.com/720p.mp4",
        videoUrl: "https://example.com/legacy.mp4",
      });

      const session = resolvePlaybackSession(episode);
      assert.equal(session.url, "https://example.com/720p.mp4");
    });

    it("falls back to legacy videoUrl when episode_media URLs are null", () => {
      const episode = makeEpisodeInfo({
        hlsUrl: null,
        mp4Url: null,
        videoUrl: "https://example.com/legacy-direct.mp4",
      });

      const session = resolvePlaybackSession(episode);
      assert.equal(session.url, "https://example.com/legacy-direct.mp4");
    });

    it("handles expiration parameter accurately", () => {
      const episode = makeEpisodeInfo();
      const oneHour = 3600;
      const before = Date.now() + oneHour * 1000;
      const session = resolvePlaybackSession(episode, oneHour);
      const expiry = new Date(session.expiresAt).getTime();

      // Should be within 2 seconds of expected future timestamp
      assert.ok(Math.abs(expiry - before) < 2000);
    });
  });
});
