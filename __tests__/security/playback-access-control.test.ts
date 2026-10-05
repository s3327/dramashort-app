import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessEpisode,
  resolvePlaybackSession,
  type EpisodePlaybackInfo,
} from "@/lib/server/playback";
import { GET as getPlaybackRoute } from "@/app/api/playback/[episodeId]/route";
import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

function createEpisodeFixture(overrides: Partial<EpisodePlaybackInfo> = {}): EpisodePlaybackInfo {
  return {
    episodeId: "11111111-1111-4111-8111-111111111111",
    titleId: "22222222-2222-4222-8222-222222222222",
    titleName: "Billionaire's Secret",
    titleSlug: "billionaires-secret",
    titleStatus: "Published",
    episodeNumber: 1,
    isFree: true,
    videoUrl: "https://example.com/fallback.mp4",
    provider: "custom",
    assetRef: null,
    hlsUrl: "https://example.com/stream.m3u8",
    mp4Url: "https://example.com/fallback.mp4",
    durationSeconds: 90,
    aspectRatio: "9:16",
    ...overrides,
  };
}

describe("Playback Media Access Control (Task 10.9)", () => {
  describe("canAccessEpisode Permission Logic", () => {
    it("permits guest access to published episode", async () => {
      const ep = createEpisodeFixture({ titleStatus: "Published" });
      const res = await canAccessEpisode(null, ep);
      assert.equal(res.allowed, true);
    });

    it("permits regular logged-in user access to published episode", async () => {
      const ep = createEpisodeFixture({ titleStatus: "Published" });
      const user = { id: "usr-1", app_metadata: {}, user_metadata: {} } as unknown as User;
      const res = await canAccessEpisode(user, ep);
      assert.equal(res.allowed, true);
    });

    it("DENIES guest access to unpublished Draft episode", async () => {
      const ep = createEpisodeFixture({ titleStatus: "Draft" });
      const res = await canAccessEpisode(null, ep);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, "UNPUBLISHED_TITLE");
    });

    it("DENIES regular logged-in user access to unpublished Draft episode", async () => {
      const ep = createEpisodeFixture({ titleStatus: "Draft" });
      const user = { id: "usr-1", app_metadata: {}, user_metadata: {} } as unknown as User;
      const res = await canAccessEpisode(user, ep);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, "UNPUBLISHED_TITLE");
    });

    it("CRITICAL: DENIES user with forged user_metadata.role = 'admin' access to Draft episode", async () => {
      const ep = createEpisodeFixture({ titleStatus: "Draft" });
      const attacker = {
        id: "usr-attacker-1",
        app_metadata: {}, // no role
        user_metadata: { role: "admin" }, // forged client payload
      } as unknown as User;

      const res = await canAccessEpisode(attacker, ep);
      assert.equal(res.allowed, false);
      assert.equal(res.reason, "UNPUBLISHED_TITLE");
    });

    it("DENIES access to Scheduled and Archived titles for regular users", async () => {
      const scheduledEp = createEpisodeFixture({ titleStatus: "Scheduled" });
      const archivedEp = createEpisodeFixture({ titleStatus: "Archived" });
      const user = { id: "usr-1", app_metadata: {}, user_metadata: {} } as unknown as User;

      assert.equal((await canAccessEpisode(user, scheduledEp)).allowed, false);
      assert.equal((await canAccessEpisode(user, archivedEp)).allowed, false);
    });

    it("ALLOWS genuine admin to preview Draft episodes", async () => {
      const ep = createEpisodeFixture({ titleStatus: "Draft" });
      const admin = {
        id: "usr-admin-1",
        app_metadata: { role: "admin" },
        user_metadata: {},
      } as unknown as User;

      const res = await canAccessEpisode(admin, ep);
      assert.equal(res.allowed, true);
    });

    it("ALLOWS genuine editor to preview Draft episodes", async () => {
      const ep = createEpisodeFixture({ titleStatus: "Draft" });
      const editor = {
        id: "usr-editor-1",
        app_metadata: { role: "editor" },
        user_metadata: {},
      } as unknown as User;

      const res = await canAccessEpisode(editor, ep);
      assert.equal(res.allowed, true);
    });
  });

  describe("resolvePlaybackSession Stream Signing & Protection", () => {
    it("resolves stream URL with valid expiry and metadata", () => {
      const ep = createEpisodeFixture();
      const session = resolvePlaybackSession(ep);

      assert.ok(session.url);
      assert.equal(session.provider, "custom");
      assert.equal(session.aspectRatio, "9:16");
      assert.ok(Date.parse(session.expiresAt) > Date.now());
      assert.equal(session.durationSeconds, 90);
    });
  });

  describe("GET /api/playback/[episodeId] Route Validation", () => {
    it("rejects invalid UUID episodeId parameter with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/playback/not-a-uuid");
      const params = Promise.resolve({ episodeId: "not-a-uuid" });

      const res = await getPlaybackRoute(req, { params });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error?.code, "INVALID_ID");
    });

    it("rejects SQL injection attempt in episodeId parameter with 400", async () => {
      const badId = "11111111-1111-4111-8111-111111111111' OR 1=1--";
      const req = new NextRequest(`http://localhost:3000/api/playback/${encodeURIComponent(badId)}`);
      const params = Promise.resolve({ episodeId: badId });

      const res = await getPlaybackRoute(req, { params });
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.equal(body.error?.code, "INVALID_ID");
    });
  });
});
