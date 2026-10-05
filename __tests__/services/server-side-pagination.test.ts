import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { searchPublishedTitles } from "@/lib/services/content.service";
import { setTestContentClient } from "@/lib/supabase/content";

describe("Server-Side Pagination & Discovery Pages (Task 12.1)", () => {
  let capturedQueryCalls: {
    eqFilters: Array<[string, any]>;
    orderCalls: Array<[string, any]>;
    rangeCalls: Array<[number, number]>;
  } = {
    eqFilters: [],
    orderCalls: [],
    rangeCalls: [],
  };

  beforeEach(() => {
    capturedQueryCalls = {
      eqFilters: [],
      orderCalls: [],
      rangeCalls: [],
    };

    const mockQueryBuilder = {
      select: () => mockQueryBuilder,
      eq: (field: string, val: any) => {
        capturedQueryCalls.eqFilters.push([field, val]);
        return mockQueryBuilder;
      },
      or: () => mockQueryBuilder,
      contains: () => mockQueryBuilder,
      order: (field: string, opts: any) => {
        capturedQueryCalls.orderCalls.push([field, opts]);
        return mockQueryBuilder;
      },
      range: (from: number, to: number) => {
        capturedQueryCalls.rangeCalls.push([from, to]);
        // Return dummy rows matching the range
        const count = to - from + 1;
        const items = Array.from({ length: Math.min(count, 5) }, (_, i) => ({
          id: `title-${from + i}`,
          slug: `slug-${from + i}`,
          title: `Drama ${from + i}`,
          channel_name: "Originals",
          genre: "Romance",
          status: "Published",
          views_count: 1000 - (from + i),
          created_at: "2026-01-01T00:00:00Z",
          total_episodes: 20,
        }));
        return Promise.resolve({
          data: items,
          count: 27, // Total 27 published titles
          error: null,
        });
      },
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };

    setTestContentClient({
      from: () => mockQueryBuilder,
    });
  });

  afterEach(() => {
    setTestContentClient(null);
  });

  describe("Query Parameters & Pagination Range Math", () => {
    it("requests default page size of 24 when none specified and computes range [0, 23]", async () => {
      const res = await searchPublishedTitles({ page: 1 });

      assert.equal(res.page, 1);
      assert.equal(res.pageSize, 24);
      assert.equal(res.total, 27);
      assert.equal(res.totalPages, 2);
      assert.deepEqual(capturedQueryCalls.rangeCalls[0], [0, 23]);
    });

    it("computes range [24, 47] on page 2 with page size 24", async () => {
      const res = await searchPublishedTitles({ page: 2, pageSize: 24 });

      assert.equal(res.page, 2);
      assert.equal(res.pageSize, 24);
      assert.deepEqual(capturedQueryCalls.rangeCalls[0], [24, 47]);
    });

    it("enforces maximum pageSize limit of 60", async () => {
      const res = await searchPublishedTitles({ page: 1, pageSize: 120 });

      assert.equal(res.pageSize, 60);
      assert.deepEqual(capturedQueryCalls.rangeCalls[0], [0, 59]);
    });
  });

  describe("Sorting & Stable ID Tie-Breakers", () => {
    it("applies primary views sort with stable id tie-breaker for trending", async () => {
      await searchPublishedTitles({ sort: "trending", page: 1 });

      assert.equal(capturedQueryCalls.orderCalls.length, 2);
      assert.equal(capturedQueryCalls.orderCalls[0][0], "views_count");
      assert.equal(capturedQueryCalls.orderCalls[1][0], "id");
      assert.deepEqual(capturedQueryCalls.orderCalls[1][1], { ascending: true });
    });

    it("applies primary created_at sort with stable id tie-breaker for newest", async () => {
      await searchPublishedTitles({ sort: "newest", page: 1 });

      assert.equal(capturedQueryCalls.orderCalls.length, 2);
      assert.equal(capturedQueryCalls.orderCalls[0][0], "created_at");
      assert.equal(capturedQueryCalls.orderCalls[1][0], "id");
      assert.deepEqual(capturedQueryCalls.orderCalls[1][1], { ascending: true });
    });
  });

  describe("Channel & Genre Filtering", () => {
    it("filters by channel_id UUID rather than name when channelId is provided", async () => {
      await searchPublishedTitles({
        channelId: "channel-uuid-1234",
        channelName: "Outdated Channel Name",
      });

      const hasChannelId = capturedQueryCalls.eqFilters.some(
        ([f, v]) => f === "channel_id" && v === "channel-uuid-1234"
      );
      const hasChannelName = capturedQueryCalls.eqFilters.some(
        ([f]) => f === "channel_name"
      );

      assert.ok(hasChannelId, "Must filter by channel_id");
      assert.ok(!hasChannelName, "Must not filter by channel_name when channelId is present");
    });

    it("filters by genre when genre option is provided", async () => {
      await searchPublishedTitles({
        genre: "Romance",
      });

      const hasGenre = capturedQueryCalls.eqFilters.some(
        ([f, v]) => f === "genre" && v === "Romance"
      );
      assert.ok(hasGenre, "Must filter by genre");
    });
  });

  describe("Discovery Page Wiring Contracts", () => {
    it("verifies all 4 discovery pages call searchPublishedTitles and wrap in Suspense", () => {
      const pages = [
        "app/genres/page.tsx",
        "app/trending/page.tsx",
        "app/new-release/page.tsx",
        "app/channel/[slug]/page.tsx",
      ];

      for (const relPath of pages) {
        const fullPath = path.resolve(process.cwd(), relPath);
        const code = fs.readFileSync(fullPath, "utf8");

        assert.ok(
          code.includes("searchPublishedTitles"),
          `${relPath} must use searchPublishedTitles`
        );
        assert.ok(
          code.includes("<Suspense"),
          `${relPath} must wrap content in <Suspense>`
        );
        assert.ok(
          !code.includes("getPublishedTitles("),
          `${relPath} must not use unpaginated getPublishedTitles`
        );
      }
    });
  });
});
