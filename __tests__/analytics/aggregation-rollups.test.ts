import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/cron/rollup/route";
import {
  computeDecayedTrendingScore,
  runDailyRollupJob,
  getTrendingStats,
  getTrendingTitles,
} from "@/lib/services/analytics.service";
import { setTestUserServiceRoleClientFactory } from "@/lib/supabase/user-server";
import { setTestContentClient } from "@/lib/supabase/content";

const ROOT = process.cwd();

test("Task 15.3: Database migration defines title_stats_daily, episode_stats_daily, and rollup RPC", () => {
  const migrationPath = path.join(
    ROOT,
    "supabase",
    "migrations",
    "20261012100600_analytics_rollups.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration 20261008180000_analytics_rollups.sql must exist");

  const sql = fs.readFileSync(migrationPath, "utf-8");

  // Summary tables
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.title_stats_daily/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.episode_stats_daily/i);

  // Columns & Constraints
  assert.match(sql, /title_slug\s+text\s+NOT\s+NULL/i);
  assert.match(sql, /stat_date\s+date\s+NOT\s+NULL/i);
  assert.match(sql, /starts\s+integer\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  assert.match(sql, /completes\s+integer\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  assert.match(sql, /unique_viewers\s+integer\s+NOT\s+NULL\s+DEFAULT\s+0/i);
  assert.match(sql, /avg_completion\s+numeric\(5,4\)/i);
  assert.match(sql, /ep1_to_ep2_rate\s+numeric\(5,4\)/i);
  assert.match(sql, /trending_score\s+numeric\(12,4\)/i);

  // Uniqueness
  assert.match(sql, /CONSTRAINT\s+uq_title_stats_daily\s+UNIQUE\s*\(title_slug,\s*stat_date\)/i);
  assert.match(sql, /CONSTRAINT\s+uq_episode_stats_daily\s+UNIQUE\s*\(title_slug,\s*episode_number,\s*stat_date\)/i);

  // Indexes
  assert.match(sql, /idx_title_stats_daily_slug_date/i);
  assert.match(sql, /idx_title_stats_daily_date_trending/i);
  assert.match(sql, /idx_episode_stats_daily_slug_ep_date/i);

  // RLS Policies
  assert.match(sql, /Public read for title stats daily/i);
  assert.match(sql, /Public read for episode stats daily/i);
  assert.match(sql, /Service role full access on title stats daily/i);
  assert.match(sql, /Service role full access on episode stats daily/i);

  // Stored procedure function
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.rollup_daily_playback_stats/i);
});

test("Task 15.3: computeDecayedTrendingScore calculates hyperbolic time-decay accurately", () => {
  // 1. Empty array
  assert.equal(computeDecayedTrendingScore([]), 0);

  // 2. Day 0 (today) with 100 starts and 100% completion
  // formula: 100 * (1 + 1.0) / (1 + 0.15 * 0) = 200 / 1.0 = 200
  const scoreTodayPerfect = computeDecayedTrendingScore([
    { daysAgo: 0, starts: 100, avgCompletion: 1.0 },
  ]);
  assert.equal(scoreTodayPerfect, 200);

  // 3. Day 0 with 100 starts and 0% completion
  // formula: 100 * (1 + 0) / 1.0 = 100
  const scoreTodayZeroComp = computeDecayedTrendingScore([
    { daysAgo: 0, starts: 100, avgCompletion: 0 },
  ]);
  assert.equal(scoreTodayZeroComp, 100);

  // 4. Day 1 with 100 starts and 100% completion
  // formula: 200 / (1 + 0.15 * 1) = 200 / 1.15 = 173.9130
  const scoreDay1 = computeDecayedTrendingScore([
    { daysAgo: 1, starts: 100, avgCompletion: 1.0 },
  ]);
  assert.equal(scoreDay1, 173.913);

  // 5. Day 6 with 100 starts and 0% completion
  // formula: 100 / (1 + 0.15 * 6) = 100 / 1.9 = 52.6316
  const scoreDay6 = computeDecayedTrendingScore([
    { daysAgo: 6, starts: 100, avgCompletion: 0 },
  ]);
  assert.equal(scoreDay6, 52.6316);

  // 6. Cumulative multi-day decay accumulation
  const cumulativeScore = computeDecayedTrendingScore([
    { daysAgo: 0, starts: 100, avgCompletion: 1.0 }, // 200
    { daysAgo: 1, starts: 100, avgCompletion: 1.0 }, // 173.9130
    { daysAgo: 6, starts: 100, avgCompletion: 0 },   // 52.6316
  ]);
  assert.equal(cumulativeScore, Math.round((200 + 173.913043 + 52.631578) * 10000) / 10000);

  // 7. Defensive bounds handling (negative starts clamped to 0, completion clamped to 1.0)
  const defensiveScore = computeDecayedTrendingScore([
    { daysAgo: -2, starts: -50, avgCompletion: 2.5 },
  ]);
  assert.equal(defensiveScore, 0);
});

test("Task 15.3: runDailyRollupJob executes stored procedure RPC when available", async () => {
  let rpcCalled = false;
  let rpcParams: any = null;

  setTestUserServiceRoleClientFactory(() => ({
    rpc: (fn: string, params: any) => {
      if (fn === "rollup_daily_playback_stats") {
        rpcCalled = true;
        rpcParams = params;
        return Promise.resolve({
          data: {
            ok: true,
            processed_titles: 8,
            processed_episodes: 24,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error("Unknown RPC") });
    },
    from: () => ({
      select: () => ({
        gte: () => ({
          lte: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }));

  const res = await runDailyRollupJob({ targetDate: "2026-10-08" });

  assert.equal(res.ok, true);
  assert.equal(res.date, "2026-10-08");
  assert.equal(res.processedTitles, 8);
  assert.equal(res.processedEpisodes, 24);
  assert.ok(typeof res.durationMs === "number");
  assert.equal(rpcCalled, true);
  assert.equal(rpcParams.target_date, "2026-10-08");

  setTestUserServiceRoleClientFactory(null);
});

test("Task 15.3: runDailyRollupJob falls back gracefully to in-memory aggregation if RPC is unavailable", async () => {
  let upsertedTitles: any[] = [];
  let upsertedEpisodes: any[] = [];

  setTestUserServiceRoleClientFactory(() => ({
    rpc: () => Promise.reject(new Error("RPC not found")),
    from: (table: string) => {
      if (table === "playback_events") {
        return {
          select: () => ({
            gte: () => ({
              lt: () =>
                Promise.resolve({
                  data: [
                    {
                      title_slug: "alpha-love",
                      episode_number: 1,
                      event_type: "episode_start",
                      anon_id: "anon-1",
                    },
                    {
                      title_slug: "alpha-love",
                      episode_number: 1,
                      event_type: "episode_complete",
                      anon_id: "anon-1",
                    },
                    {
                      title_slug: "alpha-love",
                      episode_number: 2,
                      event_type: "episode_start",
                      anon_id: "anon-1",
                    },
                    {
                      title_slug: "alpha-love",
                      episode_number: 1,
                      event_type: "episode_start",
                      anon_id: "anon-2",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === "episode_stats_daily") {
        return {
          upsert: (rows: any[]) => {
            upsertedEpisodes = rows;
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === "title_stats_daily") {
        return {
          upsert: (rows: any[]) => {
            upsertedTitles = rows;
            return Promise.resolve({ error: null });
          },
          select: () => ({
            gte: () => ({
              lte: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          gte: () => ({
            lte: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    },
  }));

  const res = await runDailyRollupJob({ targetDate: "2026-10-07" });

  assert.equal(res.ok, true);
  assert.equal(res.processedTitles, 1);
  assert.equal(res.processedEpisodes, 2);

  // Check aggregated episode records
  assert.equal(upsertedEpisodes.length, 2);
  const ep1 = upsertedEpisodes.find((e) => e.episode_number === 1);
  assert.ok(ep1);
  assert.equal(ep1.starts, 2);
  assert.equal(ep1.completes, 1);
  assert.equal(ep1.unique_viewers, 2);
  assert.equal(ep1.avg_completion, 0.5);

  // Check aggregated title records
  assert.equal(upsertedTitles.length, 1);
  assert.equal(upsertedTitles[0].title_slug, "alpha-love");
  assert.equal(upsertedTitles[0].starts, 3);
  assert.equal(upsertedTitles[0].completes, 1);
  assert.equal(upsertedTitles[0].unique_viewers, 2);
  // Ep1 viewers: anon-1, anon-2 (2). Ep2 viewers: anon-1 (1). Ep1->Ep2 rate = 1 / 2 = 0.5
  assert.equal(upsertedTitles[0].ep1_to_ep2_rate, 0.5);

  setTestUserServiceRoleClientFactory(null);
});

test("Task 15.3: getTrendingStats groups data and calculates decayed score", async () => {
  setTestUserServiceRoleClientFactory(() => ({
    from: (table: string) => {
      if (table === "title_stats_daily") {
        return {
          select: () => ({
            gte: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      title_slug: "trending-leader",
                      stat_date: new Date().toISOString().slice(0, 10),
                      starts: 200,
                      completes: 150,
                      unique_viewers: 180,
                      avg_completion: 0.75,
                      trending_score: 350,
                    },
                    {
                      title_slug: "trending-second",
                      stat_date: new Date().toISOString().slice(0, 10),
                      starts: 50,
                      completes: 20,
                      unique_viewers: 45,
                      avg_completion: 0.4,
                      trending_score: 70,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    },
  }));

  const stats = await getTrendingStats("7d", 10);
  assert.equal(stats.length, 2);
  assert.equal(stats[0].titleSlug, "trending-leader");
  assert.ok(stats[0].trendingScore > stats[1].trendingScore);
  assert.equal(stats[0].starts, 200);

  setTestUserServiceRoleClientFactory(null);
});

test("Task 15.3: getTrendingTitles returns titles ordered by trending stats", async () => {
  setTestUserServiceRoleClientFactory(() => ({
    from: (table: string) => {
      if (table === "title_stats_daily") {
        return {
          select: () => ({
            gte: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    {
                      title_slug: "top-hit",
                      stat_date: new Date().toISOString().slice(0, 10),
                      starts: 500,
                      completes: 400,
                      unique_viewers: 450,
                      avg_completion: 0.8,
                      trending_score: 900,
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    },
  }));

  setTestContentClient({
    from: (table: string) => {
      if (table === "titles") {
        return {
          select: () => ({
            in: (field: string, slugs: string[]) => ({
              eq: (statusField: string, statusVal: string) =>
                Promise.resolve({
                  data: [
                    {
                      id: "uuid-1",
                      slug: "top-hit",
                      title: "Top Hit Drama",
                      poster_url: "/posters/top.jpg",
                      synopsis: "A viral hit",
                      channel_name: "DramaShort",
                      genre: "Romance",
                      total_episodes: 50,
                      views_count: 500,
                      status: "Published",
                    },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }
      return {};
    },
  });

  const res = await getTrendingTitles({ period: "7d", page: 1, pageSize: 6 });
  assert.ok(res);
  assert.equal(res.items.length, 1);
  assert.equal(res.items[0].slug, "top-hit");
  assert.equal(res.total, 1);

  setTestUserServiceRoleClientFactory(null);
  setTestContentClient(null);
});

test("Task 15.3: getTrendingTitles transparently falls back to catalog search when no stats exist", async () => {
  setTestUserServiceRoleClientFactory(() => ({
    from: () => ({
      select: () => ({
        gte: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }));

  setTestContentClient({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            order: () => ({
              range: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "uuid-fallback",
                      slug: "fallback-drama",
                      title: "Fallback Drama",
                      status: "Published",
                    },
                  ],
                  count: 1,
                  error: null,
                }),
            }),
          }),
        }),
      }),
    }),
    rpc: () => Promise.reject(new Error("RPC not available")),
  });

  const res = await getTrendingTitles({ period: "7d", page: 1, pageSize: 6 });
  assert.ok(res);
  assert.ok(Array.isArray(res.items));
  assert.ok(res.total >= 0);
  assert.equal(res.page, 1);
  assert.equal(res.pageSize, 6);

  setTestUserServiceRoleClientFactory(null);
  setTestContentClient(null);
});

test("Task 15.3: /api/cron/rollup enforces secret authorization and date validation", async () => {
  const originalSecret = process.env.CRON_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  try {
    process.env.CRON_SECRET = "test-secret-key-12345";
    (process.env as any).NODE_ENV = "production";

    // 1. Missing authorization -> 401 Unauthorized
    const unauthReq = new NextRequest("http://localhost:3000/api/cron/rollup", {
      method: "GET",
    });
    const unauthRes = await GET(unauthReq);
    assert.equal(unauthRes.status, 401);
    const unauthData = await unauthRes.json();
    assert.equal(unauthData.success, false);
    assert.equal(unauthData.error.code, "UNAUTHORIZED");

    // 2. Incorrect Bearer token -> 401 Unauthorized
    const wrongBearerReq = new NextRequest("http://localhost:3000/api/cron/rollup", {
      method: "GET",
      headers: {
        authorization: "Bearer wrong-secret",
      },
    });
    const wrongBearerRes = await GET(wrongBearerReq);
    assert.equal(wrongBearerRes.status, 401);

    // 3. Valid Bearer token -> 200 OK
    setTestUserServiceRoleClientFactory(() => ({
      rpc: () =>
        Promise.resolve({
          data: { ok: true, processed_titles: 3, processed_episodes: 9 },
          error: null,
        }),
      from: () => ({
        select: () => ({
          gte: () => ({
            lte: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }));

    const validBearerReq = new NextRequest("http://localhost:3000/api/cron/rollup", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret-key-12345",
      },
    });
    const validBearerRes = await GET(validBearerReq);
    assert.equal(validBearerRes.status, 200);
    const validData = await validBearerRes.json();
    assert.equal(validData.success, true);
    assert.equal(validData.data.ok, true);
    assert.equal(validData.data.processedTitles, 3);

    // 4. Query param ?secret= is rejected (must use Bearer header only) -> 401 Unauthorized
    const queryParamReq = new NextRequest(
      "http://localhost:3000/api/cron/rollup?secret=test-secret-key-12345",
      { method: "POST" }
    );
    const queryParamRes = await POST(queryParamReq);
    assert.equal(queryParamRes.status, 401);
    const queryParamData = await queryParamRes.json();
    assert.equal(queryParamData.error.code, "UNAUTHORIZED");

    // 5. Invalid date query format with valid Bearer token -> 400 Validation Error
    const invalidDateReq = new NextRequest(
      "http://localhost:3000/api/cron/rollup?date=invalid-date",
      {
        method: "GET",
        headers: {
          authorization: "Bearer test-secret-key-12345",
        },
      }
    );
    const invalidDateRes = await GET(invalidDateReq);
    assert.equal(invalidDateRes.status, 400);
    const dateErrData = await invalidDateRes.json();
    assert.equal(dateErrData.error.code, "VALIDATION_ERROR");
  } finally {
    process.env.CRON_SECRET = originalSecret;
    (process.env as any).NODE_ENV = originalNodeEnv;
    setTestUserServiceRoleClientFactory(null);
  }
});

test("Task 15.3: vercel.json defines valid scheduled cron rollup job", () => {
  const vercelPath = path.join(ROOT, "vercel.json");
  assert.ok(fs.existsSync(vercelPath), "vercel.json must exist in project root");

  const rawJson = fs.readFileSync(vercelPath, "utf-8");
  const parsed = JSON.parse(rawJson);

  assert.ok(Array.isArray(parsed.crons), "vercel.json must have crons array");
  const rollupCron = parsed.crons.find((c: any) => c.path === "/api/cron/rollup");
  assert.ok(rollupCron, "vercel.json crons must define /api/cron/rollup");
  assert.equal(rollupCron.schedule, "0 1 * * *");
});
