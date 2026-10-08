import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  GET as getScheduledPublishingRoute,
  POST as postScheduledPublishingRoute,
} from "@/app/api/admin/dramas/publish-scheduled/route";
import { POST as postDramaRoute } from "@/app/api/admin/dramas/route";
import { PATCH as patchDramaRoute } from "@/app/api/admin/dramas/[id]/route";
import { validateDramaPayload } from "@/lib/validation/drama";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestContentAdminClientFactory } from "@/lib/supabase/content";
import type { User } from "@supabase/supabase-js";

/* -------------------------------------------------------------------------- */
/* Mock Users & Test State                                                    */
/* -------------------------------------------------------------------------- */

const mockAdminUser: User = {
  id: "admin-uuid-1",
  email: "admin@dramashort.com",
  app_metadata: { role: "admin" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const mockRegularUser: User = {
  id: "user-uuid-1",
  email: "user@example.com",
  app_metadata: { role: "authenticated" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

describe("Scheduled Publishing Engine (Task 16.3)", () => {
  let mockTitles: any[] = [];
  let mockEpisodes: any[] = [];
  let mockEpisodeMedia: any[] = [];
  let mockChannels: any[] = [];

  function setupMockClients() {
    setTestContentAdminClientFactory(() => ({
      from: (table: string) => {
        let currentTable = table;
        let selectedRows: any[] = [];
        let filters: Array<(row: any) => boolean> = [];
        let orderFn: ((a: any, b: any) => number) | null = null;

        function getTargetStore() {
          if (currentTable === "titles") return mockTitles;
          if (currentTable === "episodes") return mockEpisodes;
          if (currentTable === "episode_media") return mockEpisodeMedia;
          if (currentTable === "channels") return mockChannels;
          return [];
        }

        const qb: any = {
          select: (cols = "*") => {
            selectedRows = [...getTargetStore()];
            return qb;
          },
          insert: (data: any) => {
            const arr = Array.isArray(data) ? data : [data];
            const store = getTargetStore();
            const inserted = arr.map((item) => {
              const row = {
                id: item.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
                created_at: new Date().toISOString(),
                ...item,
              };
              store.push(row);
              return row;
            });
            return {
              select: () => ({
                single: async () => ({ data: inserted[0], error: null }),
              }),
            };
          },
          update: (data: any) => {
            return {
              eq: (col: string, val: any) => {
                const store = getTargetStore();
                const matched = store.filter((r) => r[col] === val);
                matched.forEach((r) => Object.assign(r, data));
                return {
                  select: () => ({
                    single: async () => ({ data: matched[0] || null, error: null }),
                    maybeSingle: async () => ({ data: matched[0] || null, error: null }),
                  }),
                };
              },
            };
          },
          eq: (col: string, val: any) => {
            filters.push((r) => r[col] === val);
            return qb;
          },
          neq: (col: string, val: any) => {
            filters.push((r) => r[col] !== val);
            return qb;
          },
          lte: (col: string, val: any) => {
            filters.push((r) => r[col] !== null && r[col] !== undefined && r[col] <= val);
            return qb;
          },
          in: (col: string, vals: any[]) => {
            filters.push((r) => vals.includes(r[col]));
            return qb;
          },
          ilike: (col: string, pattern: string) => {
            const raw = pattern.replace(/%/g, "").toLowerCase();
            filters.push((r) => String(r[col] || "").toLowerCase().includes(raw));
            return qb;
          },
          order: (col: string, opts?: any) => {
            const asc = opts?.ascending ?? true;
            orderFn = (a: any, b: any) => {
              if (a[col] < b[col]) return asc ? -1 : 1;
              if (a[col] > b[col]) return asc ? 1 : -1;
              return 0;
            };
            return qb;
          },
          limit: () => qb,
          maybeSingle: async () => {
            let res = selectedRows;
            for (const f of filters) res = res.filter(f);
            return { data: res[0] || null, error: null };
          },
          single: async () => {
            let res = selectedRows;
            for (const f of filters) res = res.filter(f);
            return { data: res[0] || null, error: null };
          },
          then: (resolve: any) => {
            let res = selectedRows;
            for (const f of filters) res = res.filter(f);
            if (orderFn) res.sort(orderFn);
            resolve({ data: res, error: null });
          },
        };
        return qb;
      },
    } as any));
  }

  beforeEach(() => {
    mockTitles = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Drama Due for Publish",
        slug: "drama-due-for-publish-ds",
        status: "Scheduled",
        publish_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
        channel_name: "DramaShort Originals",
        total_episodes: 40,
        free_episodes_count: 5,
        created_at: new Date().toISOString(),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        title: "Future Scheduled Drama",
        slug: "future-scheduled-drama-ds",
        status: "Scheduled",
        publish_at: new Date(Date.now() + 86400000).toISOString(), // tomorrow
        channel_name: "DramaShort Originals",
        total_episodes: 40,
        free_episodes_count: 5,
        created_at: new Date().toISOString(),
      },
    ];

    mockEpisodes = [
      {
        id: "ep-101",
        title_id: "11111111-1111-4111-8111-111111111111",
        episode_number: 1,
        title: "Episode 1",
        video_url: "https://example.com/ep1.mp4",
      },
    ];

    mockEpisodeMedia = [
      {
        id: "med-101",
        episode_id: "ep-101",
        status: "ready",
        mp4_url: "https://example.com/ep1.mp4",
      },
    ];

    mockChannels = [
      {
        id: "chan-1",
        name: "DramaShort Originals",
        slug: "dramashort-originals",
        code: "ds",
      },
    ];

    setupMockClients();
  });

  afterEach(() => {
    setTestUserServerClientFactory(null);
    setTestContentAdminClientFactory(null);
  });

  /* ------------------------------------------------------------------------ */
  /* 1. Validation Logic: publishAt & Scheduled Status                        */
  /* ------------------------------------------------------------------------ */

  describe("Scheduled Publishing Payload Validation", () => {
    it("requires publishAt when creating a drama with status Scheduled", () => {
      const res = validateDramaPayload(
        {
          title: "My Scheduled Drama",
          status: "Scheduled",
        },
        "create"
      );

      assert.equal(res.ok, false);
      if (!res.ok) {
        const fieldErr = res.errors.find((e) => e.field === "publishAt");
        assert.ok(fieldErr);
        assert.match(fieldErr.message, /publishAt is required when status is Scheduled/);
      }
    });

    it("rejects invalid date string for publishAt", () => {
      const res = validateDramaPayload(
        {
          title: "Invalid Date Drama",
          status: "Scheduled",
          publishAt: "not-a-valid-date",
        },
        "create"
      );

      assert.equal(res.ok, false);
      if (!res.ok) {
        const fieldErr = res.errors.find((e) => e.field === "publishAt");
        assert.ok(fieldErr);
        assert.match(fieldErr.message, /valid date timestamp/);
      }
    });

    it("accepts valid ISO date string for publishAt", () => {
      const targetDate = "2026-10-15T18:00:00.000Z";
      const res = validateDramaPayload(
        {
          title: "Valid Scheduled Drama",
          status: "Scheduled",
          publishAt: targetDate,
        },
        "create"
      );

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.status, "Scheduled");
        assert.equal(res.value.publishAt, targetDate);
      }
    });

    it("allows clearing publishAt when switching status away from Scheduled", () => {
      const res = validateDramaPayload(
        {
          status: "Draft",
          publishAt: null,
        },
        "update"
      );

      assert.equal(res.ok, true);
      if (res.ok) {
        assert.equal(res.value.status, "Draft");
        assert.equal(res.value.publishAt, null);
      }
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Dry-Run Preview: GET /api/admin/dramas/publish-scheduled               */
  /* ------------------------------------------------------------------------ */

  describe("Scheduled Preview (GET /api/admin/dramas/publish-scheduled)", () => {
    it("rejects unauthenticated requests with 401", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/dramas/publish-scheduled", {
        method: "GET",
      });
      const res = await getScheduledPublishingRoute(req);
      assert.equal(res.status, 401);
    });

    it("rejects non-admin users with 403", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockRegularUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/dramas/publish-scheduled", {
        method: "GET",
      });
      const res = await getScheduledPublishingRoute(req);
      assert.equal(res.status, 403);
    });

    it("returns accurate scheduled counts for admin", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/dramas/publish-scheduled", {
        method: "GET",
      });
      const res = await getScheduledPublishingRoute(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.totalScheduled, 2);
      assert.equal(json.data.dueNowCount, 1);
      assert.equal(json.data.upcomingCount, 1);
      assert.ok(json.data.nextPublishAt);
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 3. Scheduled Publisher Execution: POST /api/admin/dramas/publish-scheduled */
  /* ------------------------------------------------------------------------ */

  describe("Publisher Execution (POST /api/admin/dramas/publish-scheduled)", () => {
    it("promotes due scheduled dramas with ready episodes to Published", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const req = new NextRequest("http://localhost/api/admin/dramas/publish-scheduled", {
        method: "POST",
      });
      const res = await postScheduledPublishingRoute(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.publishedCount, 1);
      assert.equal(json.data.publishedDramas[0].id, "11111111-1111-4111-8111-111111111111");

      // Verify row status flipped in mock store
      const promotedDrama = mockTitles.find((t) => t.id === "11111111-1111-4111-8111-111111111111");
      assert.equal(promotedDrama.status, "Published");

      // Future drama remains Scheduled
      const futureDrama = mockTitles.find((t) => t.id === "22222222-2222-4222-8222-222222222222");
      assert.equal(futureDrama.status, "Scheduled");
    });

    it("skips scheduled drama if it has zero episodes", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      // Clear episodes so the due drama has 0 episodes
      mockEpisodes = [];
      mockEpisodeMedia = [];

      const req = new NextRequest("http://localhost/api/admin/dramas/publish-scheduled", {
        method: "POST",
      });
      const res = await postScheduledPublishingRoute(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.publishedCount, 0);
      assert.equal(json.data.skippedCount, 1);
      assert.match(json.data.skippedDramas[0].reason, /Zero episodes exist/);

      // Verify status remained Scheduled
      const drama = mockTitles.find((t) => t.id === "11111111-1111-4111-8111-111111111111");
      assert.equal(drama.status, "Scheduled");
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 4. Drama Mutation Endpoints Persistence                                  */
  /* ------------------------------------------------------------------------ */

  describe("Drama CRUD Scheduled Integration", () => {
    it("creates a drama with status Scheduled and publish_at timestamp", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const futureDate = "2026-11-01T12:00:00.000Z";
      const req = new NextRequest("http://localhost/api/admin/dramas", {
        method: "POST",
        body: JSON.stringify({
          title: "Created Scheduled Drama",
          status: "Scheduled",
          publishAt: futureDate,
        }),
      });

      const res = await postDramaRoute(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, "Scheduled");
      assert.equal(json.data.publishAt, futureDate);

      const created = mockTitles.find((t) => t.title === "Created Scheduled Drama");
      assert.ok(created);
      assert.equal(created.publish_at, futureDate);
    });

    it("rejects PATCH to Scheduled if publishAt is missing and none exists", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
        },
      } as any));

      const draftDramaId = "33333333-3333-4333-8333-333333333333";
      mockTitles.push({
        id: draftDramaId,
        title: "Draft Title",
        status: "Draft",
        publish_at: null,
      });

      const req = new NextRequest(`http://localhost/api/admin/dramas/${draftDramaId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Scheduled",
        }),
      });

      const res = await patchDramaRoute(req, { params: Promise.resolve({ id: draftDramaId }) });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.match(json.error.message, /publishAt.*required/);
    });
  });
});
