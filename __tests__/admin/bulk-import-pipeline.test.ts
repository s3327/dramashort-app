import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseImportManifest,
  validateImportDramas,
  parseCsvRows,
} from "@/lib/validation/import";
import { hasPermission } from "@/lib/auth/permissions";
import {
  validateImportManifestServer,
  executeImportJobServer,
} from "@/lib/server/admin-import";

describe("Task 16.11: Bulk Import Pipeline", () => {
  describe("Database Migration Integrity (20261009210000_bulk_import_pipeline.sql)", () => {
    test("migration files exist in Content and User DBs", () => {
      const contentMig = path.resolve(
        process.cwd(),
        "supabase/migrations/20261009210000_bulk_import_pipeline.sql"
      );
      const userMig = path.resolve(
        process.cwd(),
        "supabase/user/supabase/migrations/20261009210000_bulk_import_pipeline.sql"
      );

      assert.ok(fs.existsSync(contentMig), "Content migration must exist");
      assert.ok(fs.existsSync(userMig), "User migration must exist");

      const sql = fs.readFileSync(contentMig, "utf-8");
      assert.ok(sql.includes("external_source"), "titles must have external_source column");
      assert.ok(sql.includes("external_id"), "titles must have external_id column");
      assert.ok(sql.includes("idx_titles_external_source_id"), "titles must have partial unique index");
      assert.ok(sql.includes("idx_episodes_external_source_id"), "episodes must have partial unique index");
      assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.import_jobs"), "import_jobs table must be defined");
      assert.ok(sql.includes("trg_import_jobs_updated_at"), "import_jobs updated_at trigger must exist");
      assert.ok(sql.includes("GRANT ALL ON TABLE public.import_jobs TO service_role"), "service_role privileges must be granted");
    });
  });

  describe("Permissions Matrix Contracts", () => {
    test("verifies admin and editor roles have import permissions", () => {
      assert.strictEqual(hasPermission("admin", "import:read"), true);
      assert.strictEqual(hasPermission("admin", "import:write"), true);
      assert.strictEqual(hasPermission("editor", "import:read"), true);
      assert.strictEqual(hasPermission("editor", "import:write"), true);
    });

    test("verifies regular users or guests are forbidden from import permissions", () => {
      assert.strictEqual(hasPermission("user" as any, "import:read"), false);
      assert.strictEqual(hasPermission("user" as any, "import:write"), false);
      assert.strictEqual(hasPermission(null, "import:read"), false);
      assert.strictEqual(hasPermission(undefined, "import:write"), false);
    });
  });

  describe("Multi-Format Manifest Parsers", () => {
    test("parses DramaBoss partner JSON schema cleanly", () => {
      const dramabossPayload = JSON.stringify({
        dramas: [
          {
            id: "db-101",
            title: "Revenge of the Submissive Wife",
            synopsis: "Torn apart by deceit, she rises from the ashes.",
            channel: "vf",
            category: "Revenge",
            tags: ["Revenge", "Strong Female"],
            poster: "https://images.unsplash.com/photo-1534528741775-53994a69daeb",
            episodes: [
              {
                id: "db-101-ep1",
                number: 1,
                title: "Betrayal",
                video_url: "https://example.com/video1.mp4",
                duration: 90,
                is_free: true,
              },
              {
                id: "db-101-ep2",
                number: 2,
                title: "A New Identity",
                video_url: "https://example.com/video2.mp4",
                duration: 95,
                is_free: false,
              },
            ],
          },
        ],
      });

      const res = parseImportManifest(dramabossPayload, "dramaboss");
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.value.length, 1);
        const drama = res.value[0];
        assert.strictEqual(drama.externalId, "db-101");
        assert.strictEqual(drama.title, "Revenge of the Submissive Wife");
        assert.strictEqual(drama.channelCode, "vf");
        assert.strictEqual(drama.genre, "Revenge");
        assert.strictEqual(drama.episodes?.length, 2);
        assert.strictEqual(drama.episodes?.[0].externalId, "db-101-ep1");
        assert.strictEqual(drama.episodes?.[0].isFree, true);
      }
    });

    test("parses Tabular CSV format into aggregated drama and episode objects", () => {
      const csvData = `drama_external_id,drama_title,drama_synopsis,channel_code,genre,tags,episode_external_id,episode_number,episode_title,video_url,is_free
csv-101,"The Silent Alpha","She hides her wolf heritage.","np","Supernatural","Werewolf;Romance",csv-101-1,1,"The Full Moon","https://example.com/ep1.mp4",true
csv-101,"The Silent Alpha","She hides her wolf heritage.","np","Supernatural","Werewolf;Romance",csv-101-2,2,"The Pack Meets","https://example.com/ep2.mp4",false`;

      const res = parseImportManifest(csvData, "custom_csv");
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.value.length, 1);
        const drama = res.value[0];
        assert.strictEqual(drama.externalId, "csv-101");
        assert.strictEqual(drama.title, "The Silent Alpha");
        assert.strictEqual(drama.channelCode, "np");
        assert.strictEqual(drama.episodes?.length, 2);
        assert.strictEqual(drama.episodes?.[0].episodeNumber, 1);
        assert.strictEqual(drama.episodes?.[1].episodeNumber, 2);
      }
    });

    test("rejects malformed or empty manifest content", () => {
      const emptyRes = parseImportManifest("   ", "custom_json");
      assert.strictEqual(emptyRes.ok, false);

      const invalidJson = parseImportManifest("{ not json }", "dramaboss");
      assert.strictEqual(invalidJson.ok, false);

      const emptyCsv = parseImportManifest("header_only\n", "custom_csv");
      assert.strictEqual(emptyCsv.ok, false);
    });
  });

  describe("Dry-Run Validation Report Engine", () => {
    test("detects validation errors (missing title, duplicate IDs, invalid episode numbers)", () => {
      const invalidDramas = [
        {
          externalId: "dup-1",
          title: "", // empty title
          episodes: [
            {
              externalId: "ep-dup-1",
              episodeNumber: 1,
            },
            {
              externalId: "ep-dup-2",
              episodeNumber: 1, // duplicate episode number
            },
          ],
        },
        {
          externalId: "dup-1", // duplicate drama external ID
          title: "Second Drama",
        },
      ];

      const report = validateImportDramas(invalidDramas as any);
      assert.strictEqual(report.valid, false);
      assert.ok(report.errors.some((e) => e.field === "title"));
      assert.ok(report.errors.some((e) => e.message.includes("Duplicate externalId")));
      assert.ok(report.errors.some((e) => e.message.includes("Duplicate episodeNumber")));
    });

    test("produces clean report for valid candidate dramas", () => {
      const validDramas = [
        {
          externalId: "valid-1",
          title: "The CEO's Heiress",
          synopsis: "A captivating romance.",
          episodes: [
            { externalId: "valid-1-ep1", episodeNumber: 1, title: "Pilot" },
            { externalId: "valid-1-ep2", episodeNumber: 2, title: "The Encounter" },
          ],
        },
      ];

      const report = validateImportDramas(validDramas as any);
      assert.strictEqual(report.valid, true);
      assert.strictEqual(report.errors.length, 0);
      assert.strictEqual(report.totalDramas, 1);
      assert.strictEqual(report.totalEpisodes, 2);
    });
  });

  describe("Server Operations & Idempotent Upsert Verification", () => {
    // In-memory mock database simulation
    const mockDb = {
      titles: [] as any[],
      episodes: [] as any[],
      episode_media: [] as any[],
      import_jobs: [] as any[],
      channels: [
        { id: "chan-1", name: "DramaShort Originals", code: "ds" },
      ],
    };

    function createMockClient() {
      return {
        from: (table: string) => {
          const tableStore: any[] = (mockDb as any)[table] || [];

          const eqFilters: Record<string, any> = {};
          let filterInVals: any[] | null = null;
          let filterInCol: string | null = null;

          const builder: any = {
            select: (_cols?: string, _opts?: any) => builder,
            eq: (col: string, val: any) => {
              eqFilters[col] = val;
              return builder;
            },
            in: (col: string, vals: any[]) => {
              filterInCol = col;
              filterInVals = vals;
              return builder;
            },
            or: (_expr: string) => builder,
            order: (_col: string, _opts?: any) => builder,
            range: (_from: number, _to: number) => {
              return Promise.resolve({ data: tableStore, count: tableStore.length, error: null });
            },
            limit: (_n: number) => builder,
            maybeSingle: () => {
              const item = tableStore.find((r) =>
                Object.entries(eqFilters).every(([k, v]) => r[k] === v)
              );
              return Promise.resolve({ data: item || null, error: null });
            },
            single: () => {
              const item = tableStore.length > 0 ? tableStore[tableStore.length - 1] : null;
              return Promise.resolve({ data: item, error: null });
            },
            insert: (payload: any) => {
              const row = {
                id: `id-${Math.random().toString(36).slice(2, 9)}`,
                ...payload,
              };
              tableStore.push(row);
              return builder;
            },
            update: (payload: any) => {
              const target = tableStore.find((r) =>
                Object.entries(eqFilters).every(([k, v]) => r[k] === v)
              );
              if (target) Object.assign(target, payload);
              return builder;
            },
            upsert: (payload: any) => {
              const target = tableStore.find((r) => r.episode_id === payload.episode_id);
              if (target) {
                Object.assign(target, payload);
              } else {
                tableStore.push({ id: `id-${Math.random().toString(36).slice(2, 9)}`, ...payload });
              }
              return builder;
            },
          };
          return builder;
        },
      };
    }

    test("Run 1: First execution imports new drama and episodes", async () => {
      const manifest = JSON.stringify({
        dramas: [
          {
            id: "idem-100",
            title: "Idempotent Royalty",
            synopsis: "A royal romance thriller.",
            episodes: [
              { id: "idem-100-ep1", number: 1, title: "EP 1", video_url: "https://example.com/1.mp4" },
              { id: "idem-100-ep2", number: 2, title: "EP 2", video_url: "https://example.com/2.mp4" },
            ],
          },
        ],
      });

      const client = createMockClient();
      const res = await executeImportJobServer(manifest, "dramaboss", { id: "admin-1", email: "admin@dramashort.com" }, "test.json", client);

      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.value.createdDramas, 1);
        assert.strictEqual(res.value.createdEpisodes, 2);
        assert.strictEqual(res.value.unchangedRecords, 0);
      }
    });

    test("Run 2: Re-running exact same manifest produces 0 duplicates and reports 100% unchanged records", async () => {
      const manifest = JSON.stringify({
        dramas: [
          {
            id: "idem-100",
            title: "Idempotent Royalty",
            synopsis: "A royal romance thriller.",
            episodes: [
              { id: "idem-100-ep1", number: 1, title: "EP 1", video_url: "https://example.com/1.mp4" },
              { id: "idem-100-ep2", number: 2, title: "EP 2", video_url: "https://example.com/2.mp4" },
            ],
          },
        ],
      });

      const client = createMockClient();
      const res = await executeImportJobServer(manifest, "dramaboss", { id: "admin-1", email: "admin@dramashort.com" }, "test.json", client);

      assert.strictEqual(res.ok, true);
      if (res.ok) {
        // Must NOT create duplicates!
        assert.strictEqual(res.value.createdDramas, 0, "Must not create duplicate dramas on repeat run");
        assert.strictEqual(res.value.createdEpisodes, 0, "Must not create duplicate episodes on repeat run");
        // Must report unchanged record!
        assert.strictEqual(res.value.unchangedRecords, 1, "Must report unchanged drama record");
        assert.strictEqual(res.value.status, "completed");
      }
    });
  });

  describe("UI & Navigation Contracts (app/admin/import/page.tsx)", () => {
    test("verifies app/admin/import/page.tsx replaces the placeholder with interactive wizard", () => {
      const importPagePath = path.resolve(process.cwd(), "app/admin/import/page.tsx");
      assert.ok(fs.existsSync(importPagePath), "app/admin/import/page.tsx must exist");

      const content = fs.readFileSync(importPagePath, "utf-8");
      assert.ok(!content.includes("AdminPlaceholderPage"), "Placeholder page must be completely removed");
      assert.ok(content.includes("AdminSidebar"), "Must render AdminSidebar");
      assert.ok(content.includes("Bulk Import Pipeline"), "Must display Bulk Import Pipeline title");
      assert.ok(content.includes("/api/admin/import/validate"), "Must connect to dry-run validation API");
      assert.ok(content.includes("/api/admin/import/execute"), "Must connect to execution API");
      assert.ok(content.includes("DramaBoss Partner JSON"), "Must offer DramaBoss source format");
      assert.ok(content.includes("Tabular CSV Format"), "Must offer Tabular CSV source format");
    });
  });
});
