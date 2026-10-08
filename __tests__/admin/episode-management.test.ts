import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getAdminEpisodesRoute, POST as postAdminEpisodesRoute } from "@/app/api/admin/dramas/[id]/episodes/route";
import { PATCH as patchAdminEpisodeRoute, DELETE as deleteAdminEpisodeRoute } from "@/app/api/admin/episodes/[episodeId]/route";
import { PATCH as patchDramaRoute } from "@/app/api/admin/dramas/[id]/route";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestContentAdminClientFactory } from "@/lib/supabase/content";
import type { User } from "@supabase/supabase-js";

const VALID_DRAMA_ID = "11111111-1111-4111-8111-111111111111";
const EPISODE_ID_1 = "22222222-2222-4222-8222-222222222221";
const EPISODE_ID_2 = "22222222-2222-4222-8222-222222222222";
const EPISODE_ID_3 = "22222222-2222-4222-8222-222222222223";

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

describe("Admin Episode Operations Console (Task 16.1)", () => {
  let mockTitles: any[];
  let mockEpisodes: any[];
  let mockEpisodeMedia: any[];

  function setupMockClient() {
    setTestContentAdminClientFactory(() => ({
      from: (table: string) => {
        let currentTable = table;
        let selectedRows: any[] = [];
        let filters: Array<(row: any) => boolean> = [];
        let orderFn: ((a: any, b: any) => number) | null = null;
        let limitVal: number | null = null;

        function getTargetStore() {
          if (currentTable === "titles") return mockTitles;
          if (currentTable === "episodes") return mockEpisodes;
          if (currentTable === "episode_media") return mockEpisodeMedia;
          return [];
        }

        const qb: any = {
          select: (cols = "*", opts?: any) => {
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
                maybeSingle: async () => ({ data: inserted[0], error: null }),
              }),
              then: (resolve: any) => resolve({ data: inserted, error: null }),
            };
          },
          upsert: (data: any) => {
            const store = getTargetStore();
            const arr = Array.isArray(data) ? data : [data];
            let lastUpserted: any = null;
            arr.forEach((item) => {
              if (currentTable === "episode_media") {
                const idx = store.findIndex(
                  (m) => m.episode_id === item.episode_id && m.provider === (item.provider || "custom")
                );
                if (idx >= 0) {
                  store[idx] = { ...store[idx], ...item };
                  lastUpserted = store[idx];
                } else {
                  const newRow = { id: `media-${Math.random().toString(36).substring(2, 9)}`, ...item };
                  store.push(newRow);
                  lastUpserted = newRow;
                }
              }
            });
            return {
              select: () => ({
                single: async () => ({ data: lastUpserted || store[store.length - 1], error: null }),
                maybeSingle: async () => ({ data: lastUpserted || store[store.length - 1], error: null }),
              }),
              then: (resolve: any) => resolve({ data: arr, error: null }),
            };
          },
          update: (updates: any) => {
            return {
              eq: (col: string, val: any) => {
                filters.push((row) => row[col] === val);
                return {
                  select: () => ({
                    single: async () => {
                      const store = getTargetStore();
                      const target = store.find((row) => filters.every((f) => f(row)));
                      if (target) Object.assign(target, updates);
                      return { data: target, error: null };
                    },
                    maybeSingle: async () => {
                      const store = getTargetStore();
                      const target = store.find((row) => filters.every((f) => f(row)));
                      if (target) Object.assign(target, updates);
                      return { data: target, error: null };
                    },
                  }),
                  lte: (col2: string, val2: any) => {
                    filters.push((row) => row[col2] <= val2);
                    const store = getTargetStore();
                    store.filter((row) => filters.every((f) => f(row))).forEach((row) => Object.assign(row, updates));
                    return Promise.resolve({ data: null, error: null });
                  },
                  gt: (col2: string, val2: any) => {
                    filters.push((row) => row[col2] > val2);
                    const store = getTargetStore();
                    store.filter((row) => filters.every((f) => f(row))).forEach((row) => Object.assign(row, updates));
                    return Promise.resolve({ data: null, error: null });
                  },
                  then: (resolve: any) => {
                    const store = getTargetStore();
                    const targets = store.filter((row) => filters.every((f) => f(row)));
                    targets.forEach((t) => Object.assign(t, updates));
                    resolve({ data: targets, error: null });
                  },
                };
              },
            };
          },
          delete: () => {
            return {
              eq: (col: string, val: any) => {
                const store = getTargetStore();
                const idx = store.findIndex((row) => row[col] === val);
                if (idx >= 0) {
                  const deleted = store.splice(idx, 1)[0];
                  // If episode deleted, cascade delete episode_media
                  if (currentTable === "episodes") {
                    mockEpisodeMedia = mockEpisodeMedia.filter((m) => m.episode_id !== deleted.id);
                  }
                }
                return Promise.resolve({ data: null, error: null });
              },
            };
          },
          eq: (col: string, val: any) => {
            filters.push((row) => row[col] === val);
            return qb;
          },
          in: (col: string, vals: any[]) => {
            filters.push((row) => vals.includes(row[col]));
            return qb;
          },
          gte: (col: string, val: any) => {
            filters.push((row) => row[col] >= val);
            return qb;
          },
          lte: (col: string, val: any) => {
            filters.push((row) => row[col] <= val);
            return qb;
          },
          order: (col: string, opts = { ascending: true }) => {
            orderFn = (a, b) => {
              if (a[col] < b[col]) return opts.ascending ? -1 : 1;
              if (a[col] > b[col]) return opts.ascending ? 1 : -1;
              return 0;
            };
            return qb;
          },
          limit: (n: number) => {
            limitVal = n;
            return qb;
          },
          single: async () => {
            let res = getTargetStore().filter((row) => filters.every((f) => f(row)));
            if (orderFn) res.sort(orderFn);
            return { data: res[0] || null, error: res[0] ? null : { message: "Not found" } };
          },
          maybeSingle: async () => {
            let res = getTargetStore().filter((row) => filters.every((f) => f(row)));
            if (orderFn) res.sort(orderFn);
            return { data: res[0] || null, error: null };
          },
          then: (resolve: any) => {
            let res = getTargetStore().filter((row) => filters.every((f) => f(row)));
            if (orderFn) res.sort(orderFn);
            if (limitVal) res = res.slice(0, limitVal);
            resolve({ data: res, error: null });
          },
        };
        return qb;
      },
    }));
  }

  beforeEach(() => {
    mockTitles = [
      {
        id: VALID_DRAMA_ID,
        title: "Test Drama Series",
        slug: "test-drama-series",
        status: "Draft",
        total_episodes: 3,
        free_episodes_count: 2,
        channel_name: "DramaShort Originals",
        poster_url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800",
      },
    ];

    mockEpisodes = [
      {
        id: EPISODE_ID_1,
        title_id: VALID_DRAMA_ID,
        episode_number: 1,
        title: "Episode 1",
        duration_seconds: 120,
        is_free: true,
      },
      {
        id: EPISODE_ID_2,
        title_id: VALID_DRAMA_ID,
        episode_number: 2,
        title: "Episode 2",
        duration_seconds: 110,
        is_free: true,
      },
      {
        id: EPISODE_ID_3,
        title_id: VALID_DRAMA_ID,
        episode_number: 3,
        title: "Episode 3",
        duration_seconds: 95,
        is_free: false,
      },
    ];

    mockEpisodeMedia = [
      {
        id: "media-1",
        episode_id: EPISODE_ID_1,
        provider: "custom",
        hls_url: "https://cdn.example.com/ep1.m3u8",
        status: "ready",
        duration_seconds: 120,
      },
      {
        id: "media-2",
        episode_id: EPISODE_ID_2,
        provider: "custom",
        hls_url: "https://cdn.example.com/ep2.m3u8",
        status: "processing",
        duration_seconds: 110,
      },
    ];

    setTestUserServerClientFactory(() => ({
      auth: {
        getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
      },
    }));

    setupMockClient();
  });

  afterEach(() => {
    setTestUserServerClientFactory(null);
    setTestContentAdminClientFactory(null);
  });

  describe("Authentication & Authorization Guard", () => {
    it("returns 401 when no session is present", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`);
      const res = await getAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 401);
    });

    it("returns 403 when user is not an admin", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: mockRegularUser }, error: null }),
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`);
      const res = await getAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 403);
    });
  });

  describe("GET /api/admin/dramas/[id]/episodes", () => {
    it("rejects non-UUID drama ids with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/dramas/invalid-id/episodes");
      const res = await getAdminEpisodesRoute(req, { params: Promise.resolve({ id: "invalid-id" }) });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.error.code, "INVALID_ID");
    });

    it("lists all episodes ordered by episode_number with joined media status", async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`);
      const res = await getAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.length, 3);

      // Check Episode 1 has 'ready' media
      const ep1 = json.data.find((e: any) => e.episodeNumber === 1);
      assert.equal(ep1.mediaStatus, "ready");
      assert.equal(ep1.isFree, true);
      assert.equal(ep1.media.hlsUrl, "https://cdn.example.com/ep1.m3u8");

      // Check Episode 2 has 'processing' media
      const ep2 = json.data.find((e: any) => e.episodeNumber === 2);
      assert.equal(ep2.mediaStatus, "processing");

      // Check Episode 3 has 'missing' media
      const ep3 = json.data.find((e: any) => e.episodeNumber === 3);
      assert.equal(ep3.mediaStatus, "missing");
      assert.equal(ep3.isFree, false);
    });
  });

  describe("POST /api/admin/dramas/[id]/episodes (Operations)", () => {
    it("creates a single episode and respects free_episodes_count default", async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          mode: "single",
          title: "Episode 4 - The Climax",
          durationSeconds: 140,
          hlsUrl: "https://cdn.example.com/ep4.m3u8",
        }),
      });

      const res = await postAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 201);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.episodeNumber, 4);
      assert.equal(json.data.title, "Episode 4 - The Climax");
      // Drama has free_episodes_count = 2, so Ep 4 should default to isFree: false
      assert.equal(json.data.isFree, false);
      assert.equal(json.data.mediaStatus, "ready");
    });

    it("bulk-creates a range of episodes", async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          mode: "bulk_range",
          startNumber: 4,
          endNumber: 10,
          titleTemplate: "Ep {n}",
          autoFree: true,
        }),
      });

      const res = await postAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 201);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.createdCount, 7);

      // Verify episodes now total 10
      assert.equal(mockEpisodes.length, 10);
    });

    it("rejects bulk creation when range overlaps existing episodes", async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          mode: "bulk_range",
          startNumber: 2,
          endNumber: 5,
        }),
      });

      const res = await postAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.ok(json.error.message.includes("Episodes already exist"));
    });

    it("bulk-assigns media URLs to episodes", async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          mode: "bulk_media",
          items: [
            { episodeNumber: 2, urlOrAssetId: "https://cdn.example.com/ep2-ready.m3u8", durationSeconds: 115 },
            { episodeNumber: 3, urlOrAssetId: "https://cdn.example.com/ep3.m3u8", durationSeconds: 98 },
          ],
        }),
      });

      const res = await postAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.data.updatedCount, 2);

      // Verify media for Ep 3 is now ready
      const m3 = mockEpisodeMedia.find((m) => m.episode_id === EPISODE_ID_3);
      assert.ok(m3);
      assert.equal(m3.hls_url, "https://cdn.example.com/ep3.m3u8");
      assert.equal(m3.status, "ready");
    });

    it("safely reorders episodes without duplicate key collision", async () => {
      // Reorder [Ep 3, Ep 1, Ep 2]
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          mode: "reorder",
          orderedEpisodeIds: [EPISODE_ID_3, EPISODE_ID_1, EPISODE_ID_2],
        }),
      });

      const res = await postAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 200);

      // EPISODE_ID_3 should now be episode_number = 1
      const ep3 = mockEpisodes.find((e) => e.id === EPISODE_ID_3);
      const ep1 = mockEpisodes.find((e) => e.id === EPISODE_ID_1);
      const ep2 = mockEpisodes.find((e) => e.id === EPISODE_ID_2);

      assert.equal(ep3.episode_number, 1);
      assert.equal(ep1.episode_number, 2);
      assert.equal(ep2.episode_number, 3);
    });

    it("updates free_episodes_count and syncs is_free flags", async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}/episodes`, {
        method: "POST",
        body: JSON.stringify({
          mode: "update_free_count",
          freeEpisodesCount: 3,
          syncExistingEpisodes: true,
        }),
      });

      const res = await postAdminEpisodesRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 200);

      // All 3 episodes should now be is_free = true
      const ep3 = mockEpisodes.find((e) => e.id === EPISODE_ID_3);
      assert.equal(ep3.is_free, true);
    });
  });

  describe("PATCH & DELETE /api/admin/episodes/[episodeId]", () => {
    it("updates single episode metadata and media", async () => {
      const req = new NextRequest(`http://localhost:3000/api/admin/episodes/${EPISODE_ID_1}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: "Updated Ep 1 Title",
          durationSeconds: 155,
          isFree: false,
          hlsUrl: "https://cdn.example.com/ep1-updated.m3u8",
        }),
      });

      const res = await patchAdminEpisodeRoute(req, { params: Promise.resolve({ episodeId: EPISODE_ID_1 }) });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.data.title, "Updated Ep 1 Title");
      assert.equal(json.data.durationSeconds, 155);
      assert.equal(json.data.isFree, false);
      assert.equal(json.data.media.hlsUrl, "https://cdn.example.com/ep1-updated.m3u8");
    });

    it("deletes an episode and renumbers remaining episodes sequentially", async () => {
      // Delete Episode 2 (EPISODE_ID_2)
      const req = new NextRequest(`http://localhost:3000/api/admin/episodes/${EPISODE_ID_2}`, {
        method: "DELETE",
      });

      const res = await deleteAdminEpisodeRoute(req, { params: Promise.resolve({ episodeId: EPISODE_ID_2 }) });
      assert.equal(res.status, 200);

      // Only 2 episodes remain
      assert.equal(mockEpisodes.length, 2);

      // Remaining episodes should be renumbered 1, 2
      const ep1 = mockEpisodes.find((e) => e.id === EPISODE_ID_1);
      const ep3 = mockEpisodes.find((e) => e.id === EPISODE_ID_3);

      assert.equal(ep1.episode_number, 1);
      assert.equal(ep3.episode_number, 2);

      // Title total_episodes updated
      assert.equal(mockTitles[0].total_episodes, 2);
    });
  });

  describe("Publish Block Guard (Requirement 5)", () => {
    it("blocks publishing a drama when it has zero ready episodes", async () => {
      // Clear all ready media
      mockEpisodeMedia = [];

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Published",
        }),
      });

      const res = await patchDramaRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 400);

      const json = await res.json();
      assert.equal(json.error.code, "VALIDATION_ERROR");
      assert.ok(json.error.message.includes("zero ready episodes"));
    });

    it("allows publishing a drama when at least one episode has ready media", async () => {
      // mockEpisodeMedia has EPISODE_ID_1 with status 'ready'
      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_DRAMA_ID}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "Published",
        }),
      });

      const res = await patchDramaRoute(req, { params: Promise.resolve({ id: VALID_DRAMA_ID }) });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.status, "Published");
    });
  });
});
