import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET as getDramas } from "@/app/api/admin/dramas/route";
import { GET as getDramaById } from "@/app/api/admin/dramas/[id]/route";
import { getAdminDramas, getDramaById as getDramaByIdService } from "@/lib/services/content.service";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestContentAdminClientFactory, setTestContentClient } from "@/lib/supabase/content";
import type { User } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const VALID_UUID_DRAFT = "22222222-2222-4222-8222-222222222222";
const VALID_UUID_PUBLISHED = "33333333-3333-4333-8333-333333333333";
const NON_EXISTENT_UUID = "44444444-4444-4444-8444-444444444444";

const mockAdminUser: User = {
  id: "admin-uuid-1",
  email: "admin@dramashort.com",
  app_metadata: { role: "admin" },
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date().toISOString(),
};

const sampleRows = [
  {
    id: VALID_UUID_DRAFT,
    title: "Secret Heiress in Disguise",
    slug: "secret-heiress-in-disguise-1001",
    synopsis: "A billionaire heiress pretends to be a maid.",
    genre: "Romance",
    tags: ["Billionaire", "Secret Identity"],
    channel_name: "DramaShort Originals",
    channel_code: "DSO",
    channel_id: "c-1",
    poster_url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800",
    status: "Draft",
    total_episodes: 45,
    release_year: 2026,
    views_count: 0,
    rating: 0,
    created_at: "2026-10-06T00:00:00.000Z",
  },
  {
    id: VALID_UUID_PUBLISHED,
    title: "The CEO's Double Life",
    slug: "the-ceos-double-life-1002",
    synopsis: "A CEO lives a double life at night.",
    genre: "CEO",
    tags: ["CEO", "Drama"],
    channel_name: "DramaShort Originals",
    channel_code: "DSO",
    channel_id: "c-1",
    poster_url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800",
    status: "Published",
    total_episodes: 60,
    release_year: 2026,
    views_count: 15400,
    rating: 4.8,
    created_at: "2026-10-05T00:00:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    title: "Moonlight Alpha Returns",
    slug: "moonlight-alpha-returns-1003",
    synopsis: "The exiled alpha returns to reclaim his pack.",
    genre: "Werewolf",
    tags: ["Alpha", "Werewolf"],
    channel_name: "Moonlight Dramas",
    channel_code: "MLD",
    channel_id: "c-2",
    poster_url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800",
    status: "Scheduled",
    total_episodes: 50,
    release_year: 2026,
    views_count: 500,
    rating: 4.2,
    created_at: "2026-10-04T00:00:00.000Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    title: "Revenge of the Forgotten Son",
    slug: "revenge-of-the-forgotten-son-1004",
    synopsis: "Banished for ten years, he returns as a tycoon.",
    genre: "Revenge",
    tags: ["Revenge", "Tycoon"],
    channel_name: "DramaShort Originals",
    channel_code: "DSO",
    channel_id: "c-1",
    poster_url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800",
    status: "Archived",
    total_episodes: 30,
    release_year: 2025,
    views_count: 85000,
    rating: 4.1,
    created_at: "2026-10-03T00:00:00.000Z",
  },
];

describe("Admin Catalog Reads & API Handlers (Task 12.2)", () => {
  beforeEach(() => {
    setTestUserServerClientFactory(() => ({
      auth: {
        getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
      },
    }));
  });

  afterEach(() => {
    setTestUserServerClientFactory(null);
    setTestContentAdminClientFactory(null);
    setTestContentClient(null);
  });

  describe("GET /api/admin/dramas endpoint", () => {
    it("returns dramas across all statuses (Draft, Published, Scheduled, Archived) with service role", async () => {
      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          const qb: any = {
            order: () => qb,
            range: async () => ({
              data: sampleRows,
              count: sampleRows.length,
              error: null,
            }),
          };
          return {
            select: () => qb,
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas");
      const res = await getDramas(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.total, 4);
      assert.equal(json.data.items.length, 4);

      // Verify Draft drama is present and correct
      const draft = json.data.items.find((d: any) => d.id === VALID_UUID_DRAFT);
      assert.ok(draft);
      assert.equal(draft.title, "Secret Heiress in Disguise");
      assert.equal(draft.status, "Draft");

      // Verify Scheduled and Archived dramas are present
      assert.ok(json.data.items.some((d: any) => d.status === "Scheduled"));
      assert.ok(json.data.items.some((d: any) => d.status === "Archived"));
      assert.ok(json.data.items.some((d: any) => d.status === "Published"));
    });

    it("applies status filter when status query parameter is passed", async () => {
      let filteredStatus = "";

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          const qb: any = {
            eq: (col: string, val: string) => {
              if (col === "status") filteredStatus = val;
              return qb;
            },
            order: () => qb,
            range: async () => {
              const matched = sampleRows.filter((r) => r.status === filteredStatus);
              return { data: matched, count: matched.length, error: null };
            },
          };
          return {
            select: () => qb,
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas?status=Draft");
      const res = await getDramas(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(filteredStatus, "Draft");
      assert.equal(json.data.total, 1);
      assert.equal(json.data.items[0].status, "Draft");
    });

    it("applies channel filter when channel query parameter is passed", async () => {
      let filteredChannel = "";

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          const qb: any = {
            eq: (col: string, val: string) => {
              if (col === "channel_name") filteredChannel = val;
              return qb;
            },
            order: () => qb,
            range: async () => {
              const matched = sampleRows.filter((r) => r.channel_name === filteredChannel);
              return { data: matched, count: matched.length, error: null };
            },
          };
          return {
            select: () => qb,
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas?channel=Moonlight%20Dramas");
      const res = await getDramas(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(filteredChannel, "Moonlight Dramas");
      assert.equal(json.data.total, 1);
      assert.equal(json.data.items[0].channel, "Moonlight Dramas");
    });

    it("applies search query with ILIKE when q parameter is passed", async () => {
      let ilikeCol = "";
      let ilikePattern = "";

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          const qb: any = {
            ilike: (col: string, pattern: string) => {
              ilikeCol = col;
              ilikePattern = pattern;
              return qb;
            },
            order: () => qb,
            range: async () => ({
              data: [sampleRows[0]],
              count: 1,
              error: null,
            }),
          };
          return {
            select: () => qb,
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas?q=Heiress");
      const res = await getDramas(req);
      assert.equal(res.status, 200);

      assert.equal(ilikeCol, "title");
      assert.equal(ilikePattern, "%Heiress%");
    });

    it("computes server-side pagination range and metadata correctly", async () => {
      let capturedRange: [number, number] | null = null;

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          const qb: any = {
            order: () => qb,
            range: async (from: number, to: number) => {
              capturedRange = [from, to];
              return {
                data: sampleRows.slice(0, 2),
                count: 45,
                error: null,
              };
            },
          };
          return {
            select: () => qb,
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas?page=3&pageSize=10");
      const res = await getDramas(req);
      assert.equal(res.status, 200);

      assert.deepEqual(capturedRange, [20, 29]); // page 3 with size 10 -> [20, 29]

      const json = await res.json();
      assert.equal(json.data.page, 3);
      assert.equal(json.data.pageSize, 10);
      assert.equal(json.data.total, 45);
      assert.equal(json.data.totalPages, 5); // Math.ceil(45 / 10)
    });
  });

  describe("GET /api/admin/dramas/[id] endpoint", () => {
    it("returns Draft drama by UUID via service role", async () => {
      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: (_col: string, val: string) => ({
                maybeSingle: async () => {
                  if (val === VALID_UUID_DRAFT) {
                    return { data: sampleRows[0], error: null };
                  }
                  return { data: null, error: null };
                },
              }),
            }),
          };
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${VALID_UUID_DRAFT}`);
      const params = Promise.resolve({ id: VALID_UUID_DRAFT });

      const res = await getDramaById(req, { params });
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.id, VALID_UUID_DRAFT);
      assert.equal(json.data.status, "Draft");
      assert.equal(json.data.title, "Secret Heiress in Disguise");
    });

    it("returns 404 NOT_FOUND when drama UUID does not exist", async () => {
      setTestContentAdminClientFactory(() => ({
        from: (table: string) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }));

      const req = new NextRequest(`http://localhost:3000/api/admin/dramas/${NON_EXISTENT_UUID}`);
      const params = Promise.resolve({ id: NON_EXISTENT_UUID });

      const res = await getDramaById(req, { params });
      assert.equal(res.status, 404);

      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "NOT_FOUND");
    });
  });

  describe("getAdminDramas & getDramaById service behaviors", () => {
    it("getAdminDramas never returns mock titles on empty or error; returns empty items", async () => {
      // In server context with no client returning data
      setTestContentAdminClientFactory(() => ({
        from: () => ({
          select: () => ({
            order: () => ({
              order: () => ({
                range: async () => ({ data: [], count: 0, error: null }),
              }),
            }),
          }),
        }),
      }));

      const result = await getAdminDramas({ q: "nonexistent" });
      assert.deepEqual(result.items, []);
      assert.equal(result.total, 0);
      assert.equal(result.totalPages, 1);
    });

    it("getDramaById never falls back to mock titles; returns null when not found", async () => {
      setTestContentAdminClientFactory(() => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }));

      const result = await getDramaByIdService(NON_EXISTENT_UUID);
      assert.equal(result, null);
    });
  });

  describe("Admin UI Catalog Contracts", () => {
    it("verifies AdminTitlesPage does not import adminTitles from mock data", () => {
      const pageFile = path.resolve(process.cwd(), "app/admin/titles/page.tsx");
      const content = fs.readFileSync(pageFile, "utf-8");

      assert.ok(
        !content.includes("adminTitles"),
        "AdminTitlesPage must not reference adminTitles mock data"
      );
      assert.ok(
        !content.includes("import { titles"),
        "AdminTitlesPage must not import titles from mock"
      );
      assert.ok(
        content.includes("getAdminDramas"),
        "AdminTitlesPage must call getAdminDramas"
      );
      assert.ok(
        content.includes("selectedStatus"),
        "AdminTitlesPage must include status filter"
      );
      assert.ok(
        content.includes("/admin/dramas/${res.data.id}/edit"),
        "AdminTitlesPage must navigate to drama edit page after creation"
      );
    });
  });
});
