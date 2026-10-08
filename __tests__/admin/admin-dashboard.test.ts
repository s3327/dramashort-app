import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/stats/route";
import {
  getDramaRetentionCurve,
  getAdminDashboardStats,
} from "@/lib/services/analytics.service";
import {
  setTestUserServiceRoleClientFactory,
  setTestUserServerClientFactory,
} from "@/lib/supabase/user-server";
import { setTestContentClient } from "@/lib/supabase/content";
import type { User } from "@supabase/supabase-js";

const ROOT = process.cwd();

const mockAdminUser: User = {
  id: "admin-uuid-1",
  email: "admin@dramashort.com",
  app_metadata: { role: "admin" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const mockRegularUser: User = {
  id: "user-uuid-2",
  email: "viewer@dramashort.com",
  app_metadata: { role: "user" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

test("Task 15.4: getDramaRetentionCurve computes progression and drop-off rates accurately", async () => {
  setTestUserServiceRoleClientFactory(() => ({
    from: (table: string) => {
      if (table === "episode_stats_daily") {
        return {
          select: () => ({
            eq: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { episode_number: 1, starts: 1000, completes: 800 },
                    { episode_number: 2, starts: 800, completes: 640 },
                    { episode_number: 3, starts: 600, completes: 450 },
                    { episode_number: 4, starts: 540, completes: 400 },
                    { episode_number: 5, starts: 480, completes: 350 },
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

  const curve = await getDramaRetentionCurve("test-slug");
  assert.equal(curve.length, 5);

  // Episode 1 (Baseline 100%)
  assert.equal(curve[0].episodeNumber, 1);
  assert.equal(curve[0].starts, 1000);
  assert.equal(curve[0].completes, 800);
  assert.equal(curve[0].avgCompletion, 0.8);
  assert.equal(curve[0].retentionFromEp1, 1.0);
  assert.equal(curve[0].dropOffFromPrev, 0);

  // Episode 2 (800 / 1000 = 80% retention from Ep 1; (1000 - 800)/1000 = 20% drop from Ep 1)
  assert.equal(curve[1].episodeNumber, 2);
  assert.equal(curve[1].retentionFromEp1, 0.8);
  assert.equal(curve[1].dropOffFromPrev, 0.2);

  // Episode 3 (600 / 1000 = 60% retention from Ep 1; (800 - 600)/800 = 25% drop from Ep 2)
  assert.equal(curve[2].episodeNumber, 3);
  assert.equal(curve[2].retentionFromEp1, 0.6);
  assert.equal(curve[2].dropOffFromPrev, 0.25);

  // Episode 4 (540 / 1000 = 54% retention; (600 - 540)/600 = 10% drop from Ep 3)
  assert.equal(curve[3].episodeNumber, 4);
  assert.equal(curve[3].retentionFromEp1, 0.54);
  assert.equal(curve[3].dropOffFromPrev, 0.1);

  setTestUserServiceRoleClientFactory(null);
});

test("Task 15.4: getDramaRetentionCurve provides realistic baseline fallback when no rows exist", async () => {
  setTestUserServiceRoleClientFactory(() => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }));

  const curve = await getDramaRetentionCurve("non-existent-slug");
  assert.ok(Array.isArray(curve));
  assert.ok(curve.length >= 10);
  assert.equal(curve[0].episodeNumber, 1);
  assert.equal(curve[0].retentionFromEp1, 1.0);
  assert.ok(curve[1].retentionFromEp1 < 1.0);

  setTestUserServiceRoleClientFactory(null);
});

test("Task 15.4: getAdminDashboardStats aggregates platform KPIs, users, and tickets", async () => {
  setTestContentClient({
    from: (table: string) => {
      if (table === "titles") {
        return {
          select: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { id: "1", slug: "drama-1", title: "Drama 1", status: "Published" },
                  { id: "2", slug: "drama-2", title: "Drama 2", status: "Published" },
                  { id: "3", slug: "drama-3", title: "Drama 3", status: "Draft" },
                  { id: "4", slug: "drama-4", title: "Drama 4", status: "Archived" },
                ],
                error: null,
              }),
            in: () =>
              Promise.resolve({
                data: [
                  { slug: "drama-1", title: "Drama 1", poster_url: "/p1.jpg", channel_name: "Channel A" },
                ],
                error: null,
              }),
          }),
        };
      }
      return {};
    },
  });

  setTestUserServiceRoleClientFactory(() => ({
    from: (table: string) => {
      if (table === "user_profiles") {
        return {
          select: (_cols: any, opts: any) => {
            if (opts?.head) {
              return {
                gte: () => Promise.resolve({ count: 15, error: null }),
                then: (cb: any) => Promise.resolve({ count: 120, error: null }).then(cb),
              };
            }
            return Promise.resolve({ data: [], count: 120, error: null });
          },
        };
      }
      if (table === "playback_events") {
        return {
          select: () => ({
            gte: () =>
              Promise.resolve({
                data: [{ anon_id: "u1" }, { anon_id: "u2" }, { anon_id: "u3" }],
                error: null,
              }),
          }),
        };
      }
      if (table === "title_stats_daily") {
        return {
          select: () => ({
            gte: () => ({
              order: () =>
                Promise.resolve({
                  data: [
                    { title_slug: "drama-1", stat_date: "2026-10-08", starts: 500, completes: 350, unique_viewers: 400, avg_completion: 0.7, trending_score: 800 },
                  ],
                  error: null,
                }),
              then: (cb: any) =>
                Promise.resolve({
                  data: [
                    { starts: 500, completes: 350 },
                    { starts: 300, completes: 200 },
                  ],
                  error: null,
                }).then(cb),
            }),
          }),
        };
      }
      if (table === "support_tickets") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ count: 4, error: null }),
          }),
        };
      }
      if (table === "episode_stats_daily") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    },
  }));

  const stats = await getAdminDashboardStats("drama-1");
  assert.ok(stats);

  // Titles
  assert.equal(stats.titles.total, 4);
  assert.equal(stats.titles.published, 2);
  assert.equal(stats.titles.draft, 1);
  assert.equal(stats.titles.archived, 1);

  // Retention
  assert.equal(stats.retention.activeDramaSlug, "drama-1");
  assert.ok(Array.isArray(stats.retention.episodes));
  assert.ok(stats.retention.availableDramas.length >= 4);

  // Support tickets
  assert.equal(stats.support.openTickets, 4);

  setTestContentClient(null);
  setTestUserServiceRoleClientFactory(null);
});

test("Task 15.4: GET /api/admin/stats route enforces admin authorization", async () => {
  // 1. Unauthenticated -> 401 Unauthorized
  setTestUserServerClientFactory(() => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  }));

  const unauthReq = new NextRequest("http://localhost:3000/api/admin/stats");
  const unauthRes = await GET(unauthReq);
  assert.equal(unauthRes.status, 401);

  // 2. Regular non-admin user -> 403 Forbidden
  setTestUserServerClientFactory(() => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockRegularUser }, error: null }),
    },
  }));

  const forbiddenReq = new NextRequest("http://localhost:3000/api/admin/stats");
  const forbiddenRes = await GET(forbiddenReq);
  assert.equal(forbiddenRes.status, 403);

  // 3. Admin user -> 200 OK with payload
  setTestUserServerClientFactory(() => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: mockAdminUser }, error: null }),
    },
  }));

  setTestContentClient({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  });

  setTestUserServiceRoleClientFactory(() => ({
    from: () => ({
      select: () => ({
        gte: () => ({
          lte: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: [], error: null }),
        }),
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }));

  const adminReq = new NextRequest("http://localhost:3000/api/admin/stats?slug=test-slug");
  const adminRes = await GET(adminReq);
  assert.equal(adminRes.status, 200);

  const json = await adminRes.json();
  assert.equal(json.success, true);
  assert.ok(json.data.titles);
  assert.ok(json.data.users);
  assert.ok(json.data.playback);
  assert.ok(json.data.retention);

  setTestUserServerClientFactory(null);
  setTestContentClient(null);
  setTestUserServiceRoleClientFactory(null);

});

test("Task 15.4: Dashboard page source connects to live stats and retention island", () => {
  const pagePath = path.join(ROOT, "app", "admin", "dashboard", "page.tsx");
  assert.ok(fs.existsSync(pagePath), "app/admin/dashboard/page.tsx must exist");

  const code = fs.readFileSync(pagePath, "utf-8");

  // Live service connection
  assert.match(code, /getAdminDashboardStats/i);
  // Retention Curve Island
  assert.match(code, /RetentionCurveIsland/i);
  // Live Telemetry badge
  assert.match(code, /Live Telemetry/i);
  // KPI categories
  assert.match(code, /Total Dramas/i);
  assert.match(code, /Audience & Reach/i);
  assert.match(code, /Starts/i);
  assert.match(code, /Support Tickets/i);
  // Top Trending table
  assert.match(code, /Top Trending Dramas/i);
});
