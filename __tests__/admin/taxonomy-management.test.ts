import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  slugifyTaxonomy,
  validateGenrePayload,
  validateTagPayload,
  validateMergeTagsPayload,
} from "@/lib/validation/taxonomy";
import {
  getAdminGenresServer,
  createAdminGenreServer,
  updateAdminGenreServer,
  deleteAdminGenreServer,
  getAdminTagsServer,
  createAdminTagServer,
  updateAdminTagServer,
  mergeTagsServer,
  deleteAdminTagServer,
} from "@/lib/server/admin-taxonomy";
import {
  setTestContentClient,
  setTestContentAdminClientFactory,
} from "@/lib/supabase/content";

describe("Task 16.6: Genres & Tags Taxonomy Management", () => {
  // --------------------------------------------------------------------------
  // 1. DATABASE SCHEMA & MIGRATION CONTRACTS
  // --------------------------------------------------------------------------
  describe("1. Database Schema & Migration Contracts", () => {
    it("migration files exist on disk for both content and user databases", () => {
      const contentMigration = path.join(
        process.cwd(),
        "supabase/content/supabase/migrations/20261009160000_taxonomy_management.sql"
      );
      const userMigration = path.join(
        process.cwd(),
        "supabase/user/supabase/migrations/20261009160000_taxonomy_management.sql"
      );

      assert.ok(fs.existsSync(contentMigration), "Content migration must exist");
      assert.ok(fs.existsSync(userMigration), "User migration mirror must exist");
    });

    it("defines genres table with slug, name, sort_order, is_visible, and updated_at", () => {
      const sql = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase/content/supabase/migrations/20261009160000_taxonomy_management.sql"
        ),
        "utf8"
      );

      assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.genres"), "Creates genres table");
      assert.ok(sql.includes("name TEXT NOT NULL UNIQUE"), "Genre name unique constraint");
      assert.ok(sql.includes("slug TEXT NOT NULL UNIQUE"), "Genre slug unique constraint");
      assert.ok(sql.includes("sort_order INT NOT NULL DEFAULT 0"), "sort_order integer column");
      assert.ok(sql.includes("is_visible BOOLEAN NOT NULL DEFAULT true"), "is_visible boolean column");
      assert.ok(sql.includes("idx_genres_slug"), "Index on genre slug");
      assert.ok(sql.includes("idx_genres_sort_order"), "Index on genre sort_order");
    });

    it("defines tags table and indexes", () => {
      const sql = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase/content/supabase/migrations/20261009160000_taxonomy_management.sql"
        ),
        "utf8"
      );

      assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.tags"), "Creates tags table");
      assert.ok(sql.includes("idx_tags_slug"), "Index on tag slug");
      assert.ok(sql.includes("idx_tags_name"), "Index on tag name");
    });

    it("alters titles table with genre_id foreign key reference and backfills from existing data", () => {
      const sql = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase/content/supabase/migrations/20261009160000_taxonomy_management.sql"
        ),
        "utf8"
      );

      assert.ok(sql.includes("ADD COLUMN IF NOT EXISTS genre_id UUID REFERENCES public.genres(id)"), "FK on genre_id");
      assert.ok(sql.includes("CREATE INDEX IF NOT EXISTS idx_titles_genre_id"), "Index on titles.genre_id");
      assert.ok(sql.includes("INSERT INTO public.genres"), "Backfills genres from titles");
      assert.ok(sql.includes("INSERT INTO public.tags"), "Backfills tags from titles");
    });

    it("configures updated_at trigger, RLS, and enhanced get_distinct_genres RPC", () => {
      const sql = fs.readFileSync(
        path.join(
          process.cwd(),
          "supabase/content/supabase/migrations/20261009160000_taxonomy_management.sql"
        ),
        "utf8"
      );

      assert.ok(sql.includes("trg_set_genres_updated_at"), "Triggers on genres");
      assert.ok(sql.includes("trg_set_tags_updated_at"), "Triggers on tags");
      assert.ok(sql.includes("ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY"), "Genres RLS");
      assert.ok(sql.includes("ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY"), "Tags RLS");
      assert.ok(sql.includes("CREATE OR REPLACE FUNCTION public.get_distinct_genres()"), "Enhanced get_distinct_genres RPC");
    });
  });

  // --------------------------------------------------------------------------
  // 2. TAXONOMY VALIDATION CONTRACTS
  // --------------------------------------------------------------------------
  describe("2. Taxonomy Validation Contracts", () => {
    it("slugifyTaxonomy converts strings into URL-safe lowercase slugs", () => {
      assert.equal(slugifyTaxonomy("Romantic Comedy"), "romantic-comedy");
      assert.equal(slugifyTaxonomy("  Slow  Burn & Revenge!!  "), "slow-burn-revenge");
      assert.equal(slugifyTaxonomy("Billionaire CEO's Wife"), "billionaire-ceos-wife");
    });

    it("validateGenrePayload validates name requirement and generates slug", () => {
      const valid = validateGenrePayload({ name: "Fantasy Adventure" }, "create");
      assert.ok(valid.ok);
      assert.equal(valid.value?.name, "Fantasy Adventure");
      assert.equal(valid.value?.slug, "fantasy-adventure");
      assert.equal(valid.value?.sortOrder, 0);
      assert.equal(valid.value?.isVisible, true);

      const invalidEmpty = validateGenrePayload({ name: "   " }, "create");
      assert.equal(invalidEmpty.ok, false);
      assert.equal(invalidEmpty.errors[0]?.field, "name");

      const invalidLong = validateGenrePayload({ name: "A".repeat(55) }, "create");
      assert.equal(invalidLong.ok, false);
      assert.equal(invalidLong.errors[0]?.field, "name");
    });

    it("validateTagPayload validates name and auto-derives slug", () => {
      const valid = validateTagPayload({ name: "Secret Heir" }, "create");
      assert.ok(valid.ok);
      assert.equal(valid.value?.name, "Secret Heir");
      assert.equal(valid.value?.slug, "secret-heir");

      const invalid = validateTagPayload({ name: "" }, "create");
      assert.equal(invalid.ok, false);
    });

    it("validateMergeTagsPayload validates source and target tag IDs", () => {
      const valid = validateMergeTagsPayload({
        sourceTagId: "tag-1",
        targetTagId: "tag-2",
      });
      assert.ok(valid.ok);

      const same = validateMergeTagsPayload({
        sourceTagId: "tag-1",
        targetTagId: "tag-1",
      });
      assert.equal(same.ok, false);
      assert.equal(same.errors[0]?.field, "targetTagId");

      const missing = validateMergeTagsPayload({});
      assert.equal(missing.ok, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. GENRES SERVER OPERATIONS & RENAMING PROPAGATION
  // --------------------------------------------------------------------------
  describe("3. Genres Server Operations & Renaming Propagation", () => {
    let mockGenres: any[] = [];
    let mockTitles: any[] = [];
    let mockAuditLogs: any[] = [];

    beforeEach(() => {
      mockGenres = [
        {
          id: "genre-romance",
          name: "Romance",
          slug: "romance",
          sort_order: 1,
          is_visible: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "genre-thriller",
          name: "Thriller",
          slug: "thriller",
          sort_order: 2,
          is_visible: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockTitles = [
        {
          id: "title-1",
          title: "Destined to Love",
          genre: "Romance",
          genre_id: "genre-romance",
          tags: ["Slow Burn", "CEO"],
        },
        {
          id: "title-2",
          title: "Sweet Revenge",
          genre: "Romance",
          genre_id: "genre-romance",
          tags: ["Revenge", "CEO"],
        },
      ];

      mockAuditLogs = [];

      // Mock Content DB client
      const mockClient: any = {
        from: (table: string) => {
          if (table === "genres") {
            return {
              select: (cols: string) => ({
                order: () => ({
                  order: () => ({ data: [...mockGenres], error: null }),
                }),
                eq: (col: string, val: any) => ({
                  maybeSingle: async () => {
                    const row = mockGenres.find((g) => g[col] === val);
                    return { data: row ? { ...row } : null, error: null };
                  },
                  neq: (neqCol: string, neqVal: any) => ({
                    maybeSingle: async () => {
                      const row = mockGenres.find((g) => g[col] === val && g[neqCol] !== neqVal);
                      return { data: row ? { ...row } : null, error: null };
                    },
                  }),
                }),
                or: (orClause: string) => ({
                  maybeSingle: async () => {
                    for (const g of mockGenres) {
                      if (orClause.includes(g.name) || orClause.includes(g.slug)) {
                        return { data: { ...g }, error: null };
                      }
                    }
                    return { data: null, error: null };
                  },
                }),
                ilike: (col: string, val: any) => ({
                  neq: (neqCol: string, neqVal: any) => ({
                    maybeSingle: async () => {
                      const row = mockGenres.find(
                        (g) => g[col]?.toLowerCase() === String(val).toLowerCase() && g[neqCol] !== neqVal
                      );
                      return { data: row ? { ...row } : null, error: null };
                    },
                  }),
                }),
              }),
              insert: (row: any) => ({
                select: () => ({
                  single: async () => {
                    const created = {
                      id: `genre-${Date.now()}`,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      ...row,
                    };
                    mockGenres.push(created);
                    return { data: created, error: null };
                  },
                }),
              }),
              update: (updates: any) => ({
                eq: (_col: string, idVal: string) => ({
                  select: () => ({
                    single: async () => {
                      const target = mockGenres.find((g) => g.id === idVal);
                      if (!target) return { data: null, error: new Error("Not found") };
                      Object.assign(target, updates, { updated_at: new Date().toISOString() });
                      return { data: target, error: null };
                    },
                  }),
                }),
              }),
              delete: () => ({
                eq: (_col: string, idVal: string) => {
                  const idx = mockGenres.findIndex((g) => g.id === idVal);
                  if (idx >= 0) mockGenres.splice(idx, 1);
                  return Promise.resolve({ error: null });
                },
              }),
            };
          }

          if (table === "titles") {
            return {
              select: () => ({
                data: [...mockTitles],
                error: null,
                or: (clause: string) => {
                  // Simulate filtering by genre_id or genre name
                  const filtered = mockTitles.filter((t) => {
                    return clause.includes(t.genre_id) || clause.includes(t.genre);
                  });
                  return { data: filtered, error: null };
                },
              }),
              update: (updates: any) => ({
                or: (clause: string) => {
                  for (const t of mockTitles) {
                    if (clause.includes(t.genre_id) || clause.includes(t.genre)) {
                      Object.assign(t, updates);
                    }
                  }
                  return Promise.resolve({ error: null });
                },
                eq: (_col: string, idVal: any) => {
                  const target = mockTitles.find((t) => t.id === idVal);
                  if (target) Object.assign(target, updates);
                  return Promise.resolve({ error: null });
                },
              }),
            };
          }

          if (table === "admin_audit_log") {
            return {
              insert: (row: any) => {
                mockAuditLogs.push(row);
                return Promise.resolve({ error: null });
              },
            };
          }

          return {};
        },
      };

      setTestContentAdminClientFactory(() => mockClient);
      setTestContentClient(mockClient);
    });

    it("getAdminGenresServer aggregates live drama counts for each genre", async () => {
      const genres = await getAdminGenresServer();
      assert.equal(genres.length, 2);

      const romance = genres.find((g) => g.slug === "romance");
      assert.ok(romance);
      assert.equal(romance.dramaCount, 2, "Romance should have 2 assigned titles");

      const thriller = genres.find((g) => g.slug === "thriller");
      assert.ok(thriller);
      assert.equal(thriller.dramaCount, 0, "Thriller should have 0 assigned titles");
    });

    it("createAdminGenreServer prevents duplicate slug/name and logs audit trail", async () => {
      // 1. Duplicate check
      const dupRes = await createAdminGenreServer({ name: "Romance" });
      assert.equal(dupRes.ok, false);
      assert.ok(dupRes.error.message.includes("already exists"));

      // 2. Successful creation
      const res = await createAdminGenreServer({
        name: "Historical Period",
        slug: "historical-period",
        sortOrder: 3,
        isVisible: true,
      });

      assert.ok(res.ok);
      assert.equal(res.value?.name, "Historical Period");
      assert.equal(res.value?.slug, "historical-period");
      assert.equal(res.value?.sortOrder, 3);
      assert.equal(mockGenres.length, 3);

      // Audit log entry
      const audit = mockAuditLogs.find((l) => l.action === "taxonomy.genre_create");
      assert.ok(audit, "Must record taxonomy.genre_create in audit log");
    });

    it("updateAdminGenreServer propagates rename to titles and updates genre_id", async () => {
      const res = await updateAdminGenreServer("genre-romance", {
        name: "Romantic Drama",
        slug: "romantic-drama",
      });

      assert.ok(res.ok);
      assert.equal(res.value?.name, "Romantic Drama");
      assert.equal(res.value?.slug, "romantic-drama");

      // Verify propagation to mockTitles
      for (const t of mockTitles) {
        assert.equal(t.genre, "Romantic Drama", "Title genre text must be updated to new name");
        assert.equal(t.genre_id, "genre-romance", "Title genre_id must be linked");
      }

      // Audit log entry
      const audit = mockAuditLogs.find((l) => l.action === "taxonomy.genre_update");
      assert.ok(audit, "Must record taxonomy.genre_update in audit log");
      assert.equal(audit.before.name, "Romance");
      assert.equal(audit.after.name, "Romantic Drama");
    });

    it("deleteAdminGenreServer prevents deletion when active titles exist (409 Conflict)", async () => {
      // Trying to delete genre with 2 active titles
      const blockedRes = await deleteAdminGenreServer("genre-romance");
      assert.equal(blockedRes.ok, false);
      assert.equal(blockedRes.error.code, "CONFLICT");
      assert.equal(blockedRes.error.count, 2);
      assert.ok(blockedRes.error.message.includes("assigned to 2 drama"));

      // Safe deletion when 0 titles
      const safeRes = await deleteAdminGenreServer("genre-thriller");
      assert.ok(safeRes.ok);
      assert.equal(mockGenres.length, 1);

      const audit = mockAuditLogs.find((l) => l.action === "taxonomy.genre_delete");
      assert.ok(audit, "Must record taxonomy.genre_delete in audit log");
    });
  });

  // --------------------------------------------------------------------------
  // 4. TAGS SERVER OPERATIONS, MERGING & TITLES SCRUBBING
  // --------------------------------------------------------------------------
  describe("4. Tags Server Operations, Merging & Titles Scrubbing", () => {
    let mockTags: any[] = [];
    let mockTitles: any[] = [];
    let mockAuditLogs: any[] = [];

    beforeEach(() => {
      mockTags = [
        {
          id: "tag-ceo",
          name: "CEO",
          slug: "ceo",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "tag-billionaire-ceo",
          name: "Billionaire CEO",
          slug: "billionaire-ceo",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "tag-revenge",
          name: "Revenge",
          slug: "revenge",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      mockTitles = [
        {
          id: "t-1",
          title: "Contract Marriage",
          tags: ["CEO", "Romance"],
        },
        {
          id: "t-2",
          title: "Secret Heiress",
          tags: ["Billionaire CEO", "Revenge"],
        },
        {
          id: "t-3",
          title: "Double Identity",
          tags: ["CEO", "Billionaire CEO"],
        },
      ];

      mockAuditLogs = [];

      const mockClient: any = {
        from: (table: string) => {
          if (table === "tags") {
            return {
              select: () => ({
                order: () => ({ data: [...mockTags], error: null }),
                eq: (col: string, val: any) => ({
                  maybeSingle: async () => {
                    const row = mockTags.find((t) => t[col] === val || t.id === val || t.slug === val);
                    return { data: row ? { ...row } : null, error: null };
                  },
                  neq: (neqCol: string, neqVal: any) => ({
                    maybeSingle: async () => {
                      const row = mockTags.find(
                        (t) => (t[col] === val || t.id === val || t.slug === val) && t[neqCol] !== neqVal
                      );
                      return { data: row ? { ...row } : null, error: null };
                    },
                  }),
                }),
                or: (orClause: string) => ({
                  maybeSingle: async () => {
                    for (const t of mockTags) {
                      if (orClause.includes(t.name) || orClause.includes(t.slug)) {
                        return { data: { ...t }, error: null };
                      }
                    }
                    return { data: null, error: null };
                  },
                }),
                ilike: (col: string, val: any) => ({
                  neq: (neqCol: string, neqVal: any) => ({
                    maybeSingle: async () => {
                      const row = mockTags.find(
                        (t) => t[col]?.toLowerCase() === String(val).toLowerCase() && t[neqCol] !== neqVal
                      );
                      return { data: row ? { ...row } : null, error: null };
                    },
                  }),
                }),
              }),
              insert: (row: any) => ({
                select: () => ({
                  single: async () => {
                    const created = {
                      id: `tag-${Date.now()}`,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                      ...row,
                    };
                    mockTags.push(created);
                    return { data: created, error: null };
                  },
                }),
              }),
              update: (updates: any) => ({
                eq: (_col: string, idVal: string) => ({
                  select: () => ({
                    single: async () => {
                      const target = mockTags.find((t) => t.id === idVal);
                      if (!target) return { data: null, error: new Error("Not found") };
                      Object.assign(target, updates, { updated_at: new Date().toISOString() });
                      return { data: target, error: null };
                    },
                  }),
                }),
              }),
              delete: () => ({
                eq: (_col: string, idVal: string) => {
                  const idx = mockTags.findIndex((t) => t.id === idVal);
                  if (idx >= 0) mockTags.splice(idx, 1);
                  return Promise.resolve({ error: null });
                },
              }),
            };
          }

          if (table === "titles") {
            return {
              select: () => ({
                data: [...mockTitles],
                error: null,
                contains: (_col: string, tagArray: string[]) => {
                  const searchTag = tagArray[0];
                  const matched = mockTitles.filter((t) => t.tags && t.tags.includes(searchTag));
                  return { data: matched, error: null };
                },
              }),
              update: (updates: any) => ({
                eq: (_col: string, idVal: any) => {
                  const target = mockTitles.find((t) => t.id === idVal);
                  if (target) Object.assign(target, updates);
                  return Promise.resolve({ error: null });
                },
              }),
            };
          }

          if (table === "admin_audit_log") {
            return {
              insert: (row: any) => {
                mockAuditLogs.push(row);
                return Promise.resolve({ error: null });
              },
            };
          }

          return {};
        },
      };

      setTestContentAdminClientFactory(() => mockClient);
      setTestContentClient(mockClient);
    });

    it("getAdminTagsServer computes usage count from titles.tags", async () => {
      const tags = await getAdminTagsServer();
      const ceo = tags.find((t) => t.slug === "ceo");
      assert.ok(ceo);
      assert.equal(ceo.dramaCount, 2, "CEO tag used in 2 titles");

      const bCeo = tags.find((t) => t.slug === "billionaire-ceo");
      assert.ok(bCeo);
      assert.equal(bCeo.dramaCount, 2, "Billionaire CEO tag used in 2 titles");
    });

    it("mergeTagsServer merges source tag into target tag and scrubs source tag", async () => {
      // Merge "Billionaire CEO" (source) into "CEO" (target)
      const res = await mergeTagsServer({
        sourceTagId: "tag-billionaire-ceo",
        targetTagId: "tag-ceo",
      });

      assert.ok(res.ok);
      assert.equal(res.value?.affectedTitlesCount, 2);

      // Verify title 2 now has "CEO" instead of "Billionaire CEO"
      const t2 = mockTitles.find((t) => t.id === "t-2");
      assert.deepEqual(t2.tags, ["CEO", "Revenge"]);

      // Verify title 3 had both, so it is deduplicated to just ["CEO"]
      const t3 = mockTitles.find((t) => t.id === "t-3");
      assert.deepEqual(t3.tags, ["CEO"]);

      // Verify source tag deleted from tags inventory
      assert.equal(mockTags.some((t) => t.id === "tag-billionaire-ceo"), false);

      // Verify audit log
      const audit = mockAuditLogs.find((l) => l.action === "taxonomy.tag_merge");
      assert.ok(audit, "Must record taxonomy.tag_merge in audit log");
      assert.equal(audit.before.sourceTagName, "Billionaire CEO");
      assert.equal(audit.after.targetTagName, "CEO");
    });

    it("updateAdminTagServer propagates tag renaming across all titles", async () => {
      const res = await updateAdminTagServer("tag-revenge", {
        name: "Bitter Revenge",
        slug: "bitter-revenge",
      });

      assert.ok(res.ok);
      assert.equal(res.value?.name, "Bitter Revenge");

      const t2 = mockTitles.find((t) => t.id === "t-2");
      assert.ok(t2.tags.includes("Bitter Revenge"));
      assert.ok(!t2.tags.includes("Revenge"));

      const audit = mockAuditLogs.find((l) => l.action === "taxonomy.tag_update");
      assert.ok(audit, "Must record taxonomy.tag_update in audit log");
    });
  });
});
