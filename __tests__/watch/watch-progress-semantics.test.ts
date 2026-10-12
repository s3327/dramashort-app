import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as postProgress } from "@/app/api/progress/route";
import {
  deriveContinueWatching,
  type DramaMeta,
} from "@/lib/watch/continue-watching";
import {
  upsertWatchProgress,
  getWatchProgress,
  saveGuestWatchProgress,
  getGuestWatchProgress,
  clearGuestWatchHistory,
  type WatchHistoryRow,
} from "@/lib/services/user.service";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestUserClient } from "@/lib/supabase/user-client";
import type { User } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const MOCK_USER: User = {
  id: "user-uuid-111",
  email: "viewer@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

describe("Task 12.3: Watch Progress Semantics & Reliable Persistence", () => {
  afterEach(() => {
    setTestUserServerClientFactory(null);
    setTestUserClient(null);
  });

  describe("Continue Watching Derivation (lib/watch/continue-watching.ts)", () => {
    const sampleDramas = new Map<string, DramaMeta>([
      [
        "billionaire-boss",
        {
          title: "My Billionaire Boss",
          poster: "https://example.com/p1.jpg",
          totalEpisodes: 40,
          channel: "DramaShort Originals",
        },
      ],
      [
        "secret-wife",
        {
          title: "The CEO's Secret Wife",
          poster: "https://example.com/p2.jpg",
          totalEpisodes: 30,
          channel: "Romance Prime",
        },
      ],
      [
        "revenge-heir",
        {
          title: "Revenge of the Heir",
          poster: "https://example.com/p3.jpg",
          totalEpisodes: 25,
          channel: "DramaShort Originals",
        },
      ],
    ]);

    it("omits a finished series from Continue Watching (episode >= total and progress >= 0.95)", () => {
      const history: WatchHistoryRow[] = [
        {
          id: "h1",
          user_id: "user-1",
          title_slug: "billionaire-boss",
          episode_number: 40, // Final episode
          progress: 0.98, // Finished
          position_seconds: 118,
          duration_seconds: 120,
          updated_at: new Date().toISOString(),
        },
      ];

      const result = deriveContinueWatching(history, sampleDramas);
      assert.equal(result.length, 0, "Finished series must be omitted from Continue Watching");
    });

    it("advances to next episode as 'Up Next' when current episode is finished (progress >= 0.95)", () => {
      const history: WatchHistoryRow[] = [
        {
          id: "h2",
          user_id: "user-1",
          title_slug: "secret-wife",
          episode_number: 15,
          progress: 0.96, // Finished episode 15
          position_seconds: 115,
          duration_seconds: 120,
          updated_at: new Date().toISOString(),
        },
      ];

      const result = deriveContinueWatching(history, sampleDramas);
      assert.equal(result.length, 1);
      assert.equal(result[0].episodeNumber, 16, "Must advance to episode 16");
      assert.equal(result[0].progress, 0, "Progress for next episode must start at 0");
      assert.equal(result[0].episodeLabel, "Up Next: EP 16 of 30");
      assert.equal(result[0].href, "/watch/secret-wife?ep=16");
    });

    it("preserves newly selected episode with 0 progress and 'EP X of Y' label", () => {
      const history: WatchHistoryRow[] = [
        {
          id: "h3",
          user_id: "user-1",
          title_slug: "revenge-heir",
          episode_number: 20,
          progress: 0, // Freshly clicked
          position_seconds: 0,
          duration_seconds: 0,
          updated_at: new Date().toISOString(),
        },
      ];

      const result = deriveContinueWatching(history, sampleDramas);
      assert.equal(result.length, 1);
      assert.equal(result[0].episodeNumber, 20);
      assert.equal(result[0].progress, 0);
      assert.equal(result[0].episodeLabel, "EP 20 of 25");
      assert.equal(result[0].href, "/watch/revenge-heir?ep=20");
    });

    it("calculates exact progress ratio from position_seconds and duration_seconds", () => {
      const history: WatchHistoryRow[] = [
        {
          id: "h4",
          user_id: "user-1",
          title_slug: "billionaire-boss",
          episode_number: 5,
          progress: 0.1, // Stale ratio
          position_seconds: 60, // 60s of 120s = 50%
          duration_seconds: 120,
          updated_at: new Date().toISOString(),
        },
      ];

      const result = deriveContinueWatching(history, sampleDramas);
      assert.equal(result.length, 1);
      assert.equal(result[0].progress, 0.5, "Derived progress must equal position / duration");
      assert.equal(result[0].episodeNumber, 5);
      assert.equal(result[0].episodeLabel, "EP 5 of 40");
    });

    it("defensively omits rows where drama is missing from the database", () => {
      const history: WatchHistoryRow[] = [
        {
          id: "h5",
          user_id: "user-1",
          title_slug: "deleted-drama-slug",
          episode_number: 3,
          progress: 0.5,
          position_seconds: 50,
          duration_seconds: 100,
          updated_at: new Date().toISOString(),
        },
      ];

      const result = deriveContinueWatching(history, sampleDramas);
      assert.equal(result.length, 0);
    });

    it("respects maxVisible limit", () => {
      const history: WatchHistoryRow[] = Array.from({ length: 15 }, (_, i) => ({
        id: `h-${i}`,
        user_id: "user-1",
        title_slug: "billionaire-boss",
        episode_number: i + 1,
        progress: 0.3,
        position_seconds: 30,
        duration_seconds: 100,
        updated_at: new Date().toISOString(),
      }));

      const result = deriveContinueWatching(history, sampleDramas, 6);
      assert.equal(result.length, 6);
    });
  });

  describe("POST /api/progress Route Handler", () => {
    it("returns 400 on invalid JSON or missing payload", async () => {
      const req = new NextRequest("http://localhost:3000/api/progress", {
        method: "POST",
        body: "invalid-json",
      });

      const res = await postProgress(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, "INVALID_JSON");
    });

    it("returns 400 when required fields (titleSlug, episodeNumber) are invalid", async () => {
      const req = new NextRequest("http://localhost:3000/api/progress", {
        method: "POST",
        body: JSON.stringify({ titleSlug: "", episodeNumber: 0 }),
      });

      const res = await postProgress(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, "VALIDATION_ERROR");
    });

    it("persists progress with position_seconds and duration_seconds for authenticated user", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: MOCK_USER }, error: null }),
        },
        from: (table: string) => {
          assert.equal(table, "watch_history");
          return {
            upsert: async (record: any, options: any) => {
              assert.equal(record.user_id, MOCK_USER.id);
              assert.equal(record.title_slug, "the-ceo-secret");
              assert.equal(record.episode_number, 8);
              assert.equal(record.position_seconds, 45);
              assert.equal(record.duration_seconds, 90);
              assert.equal(record.progress, 0.5); // 45 / 90
              assert.deepEqual(options, { onConflict: "user_id,title_slug" });
              return { data: null, error: null };
            },
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/progress", {
        method: "POST",
        body: JSON.stringify({
          titleSlug: "the-ceo-secret",
          episodeNumber: 8,
          positionSeconds: 45,
          durationSeconds: 90,
        }),
      });

      const res = await postProgress(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.saved, true);
    });

    it("gracefully returns { saved: false, guest: true } for unauthenticated guest", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/progress", {
        method: "POST",
        body: JSON.stringify({
          titleSlug: "the-ceo-secret",
          episodeNumber: 3,
          positionSeconds: 10,
          durationSeconds: 100,
        }),
      });

      const res = await postProgress(req);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.saved, false);
      assert.equal(json.data.guest, true);
    });
  });

  describe("Single-Row Lookup Operations (user.service.ts)", () => {
    it("getWatchProgress performs single-row lookup by user_id and title_slug", async () => {
      let capturedUserId = "";
      let capturedTitleSlug = "";

      setTestUserClient({
        from: (table: string) => {
          assert.equal(table, "watch_history");
          const qb: any = {
            select: () => qb,
            eq: (col: string, val: string) => {
              if (col === "user_id") capturedUserId = val;
              if (col === "title_slug") capturedTitleSlug = val;
              return qb;
            },
            maybeSingle: async () => ({
              data: {
                id: "wh-1",
                user_id: capturedUserId,
                title_slug: capturedTitleSlug,
                episode_number: 12,
                progress: 0.45,
                position_seconds: 54,
                duration_seconds: 120,
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          };
          return qb;
        },
      });

      const row = await getWatchProgress("user-123", "billionaire-heir");
      assert.ok(row);
      assert.equal(capturedUserId, "user-123");
      assert.equal(capturedTitleSlug, "billionaire-heir");
      assert.equal(row.episode_number, 12);
      assert.equal(row.position_seconds, 54);
      assert.equal(row.duration_seconds, 120);
    });

    it("upsertWatchProgress derives progress ratio and persists position and duration seconds", async () => {
      let savedRecord: any = null;

      setTestUserClient({
        from: (table: string) => {
          assert.equal(table, "watch_history");
          return {
            upsert: async (record: any) => {
              savedRecord = record;
              return { error: null };
            },
          };
        },
      });

      const ok = await upsertWatchProgress("user-123", "alpha-wolf", 4, 0, 75, 100);
      assert.equal(ok, true);
      assert.ok(savedRecord);
      assert.equal(savedRecord.episode_number, 4);
      assert.equal(savedRecord.position_seconds, 75);
      assert.equal(savedRecord.duration_seconds, 100);
      assert.equal(savedRecord.progress, 0.75); // Derived 75 / 100
    });
  });

  describe("Watch Page Code Invariants & Architectural Contracts", () => {
    it("confirms handleSelectEpisode sets progress: 0 and never calculates episode / totalEpisodes", () => {
      const watchPagePath = path.resolve(process.cwd(), "app/watch/[slug]/page.tsx");
      const content = fs.readFileSync(watchPagePath, "utf-8");

      // Verify selecting an episode sets progress: 0
      assert.ok(
        content.includes("recordProgress(ep, 0, 0, 0);"),
        "handleSelectEpisode must record 0 progress for freshly selected episode"
      );

      // Verify ep / total progress calculation was completely removed from handleSelectEpisode
      assert.ok(
        !content.includes("const progress = Math.min(1.0, ep / total);"),
        "Watch page must never set ep / total as progress"
      );

      // Verify single-row lookup getWatchProgress is used
      assert.ok(
        content.includes("getWatchProgress(user.id, targetSlug)"),
        "Watch page must call single-row getWatchProgress"
      );

      // Verify visibilitychange and pagehide listeners are attached for reliable flushing
      assert.ok(
        content.includes('document.addEventListener("visibilitychange"'),
        "Watch page must listen to visibilitychange"
      );
      assert.ok(
        content.includes('window.addEventListener("pagehide"'),
        "Watch page must listen to pagehide"
      );
      assert.ok(
        content.includes("keepalive: true"),
        "Watch page must flush background beacons with keepalive: true"
      );
    });

    it("verifies user database migration file exists and defines position_seconds and duration_seconds", () => {
      const migrationFile = path.resolve(
        process.cwd(),
        "supabase/migrations/20261012100400_watch_progress_semantics.sql"
      );
      assert.ok(fs.existsSync(migrationFile), "Migration file must exist");
      const sql = fs.readFileSync(migrationFile, "utf-8");
      assert.ok(sql.includes("position_seconds INT"), "Must add position_seconds INT");
      assert.ok(sql.includes("duration_seconds INT"), "Must add duration_seconds INT");
    });
  });
});
