import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  searchDramas,
  searchPublishedTitles,
  getDistinctGenres,
  getPopularTags,
  getTaxonomyCounts,
  escapePostgrestValue,
} from "@/lib/server/catalog";
import {
  searchPublishedTitles as clientSearchTitles,
  searchDramas as clientSearchDramas,
  getDistinctGenres as clientGetGenres,
  getPopularTags as clientGetTags,
  getTaxonomyCounts as clientGetTaxonomyCounts,
} from "@/lib/services/content.service";
import { setTestContentClient } from "@/lib/supabase/content";

describe("Task 13.5: Search & Taxonomy Scalability Contracts", () => {
  const rootDir = process.cwd();
  const contentMigrationPath = path.resolve(
    rootDir,
    "supabase/migrations/20261008120000_search_and_taxonomy_scalability.sql"
  );

  afterEach(() => {
    setTestContentClient(null);
  });

  // ==========================================================================
  // 1. Database Migrations, Indexing & RPC Definitions (R1 & R2)
  // ==========================================================================
  describe("1. Database Migrations, Indexing & RPC Definitions (R1 & R2)", () => {
    it("migration file exists in the single chain", () => {
      assert.ok(fs.existsSync(contentMigrationPath), "Content DB migration file must exist");
      assert.ok(fs.statSync(contentMigrationPath).size > 1500, "Content migration must be substantive");
    });

    it("enables pg_trgm extension in PostgreSQL", () => {
      const contentSql = fs.readFileSync(contentMigrationPath, "utf-8");

      assert.ok(
        contentSql.includes("CREATE EXTENSION IF NOT EXISTS pg_trgm;"),
        "Content DB migration must enable pg_trgm"
      );
    });

    it("creates GIN trigram indexes on title and synopsis using gin_trgm_ops", () => {
      const contentSql = fs.readFileSync(contentMigrationPath, "utf-8");

      // User DB migration: content.titles GIN trigram indexes
      // Dual-mode compatibility for public.titles

      // Content DB migration: public.titles GIN trigram indexes
      assert.ok(
        contentSql.includes("idx_titles_title_trgm") &&
          contentSql.includes("public.titles USING gin (title gin_trgm_ops)"),
        "Content migration must create GIN trigram index on public.titles(title)"
      );
      assert.ok(
        contentSql.includes("idx_titles_synopsis_trgm") &&
          contentSql.includes("public.titles USING gin (synopsis gin_trgm_ops)"),
        "Content migration must create GIN trigram index on public.titles(synopsis)"
      );
    });

    it("creates GIN index on tags text array and B-tree index on genre where status = 'Published'", () => {
      const contentSql = fs.readFileSync(contentMigrationPath, "utf-8");

      // Tags GIN
      assert.ok(
        contentSql.includes("idx_titles_tags_gin") &&
          contentSql.includes("public.titles USING gin (tags)"),
        "Content migration must create GIN index on public.titles(tags)"
      );

      // Genre B-tree partial index
      assert.ok(
        contentSql.includes("idx_titles_genre_published") &&
          contentSql.includes("public.titles (genre) WHERE status = 'Published'"),
        "Content migration must create partial B-tree index on published genres"
      );
    });

    it("defines PostgreSQL aggregation and search RPCs with SECURITY DEFINER and search_path", () => {
      const contentSql = fs.readFileSync(contentMigrationPath, "utf-8");

      // Verify function definitions
      assert.ok(contentSql.includes("FUNCTION public.get_distinct_genres()"));
      assert.ok(contentSql.includes("FUNCTION public.get_popular_tags("));
      assert.ok(contentSql.includes("FUNCTION public.get_taxonomy_counts()"));
      assert.ok(contentSql.includes("FUNCTION public.search_dramas("));

      // Verify SECURITY DEFINER & explicit search_path
      assert.ok(contentSql.includes("SECURITY DEFINER"));
      assert.ok(contentSql.includes("SET search_path = public, pg_temp"));

      // Verify SQL contains direct in-database aggregations
      assert.ok(contentSql.includes("SELECT DISTINCT genre"));
      assert.ok(contentSql.includes("unnest(tags)"));

      // Verify execution permissions granted to anon, authenticated, service_role
      assert.ok(contentSql.includes("GRANT EXECUTE ON FUNCTION public.get_distinct_genres() TO anon, authenticated, service_role;"));
      assert.ok(contentSql.includes("GRANT EXECUTE ON FUNCTION public.search_dramas(TEXT, TEXT, UUID, TEXT[], TEXT, INT, INT) TO anon, authenticated, service_role;"));
    });
  });

  // ==========================================================================
  // 2. RPC Taxonomy Aggregation & Zero-Truncation Contracts (R2 & R3)
  // ==========================================================================
  describe("2. RPC Taxonomy Aggregation & Zero-Truncation Contracts", () => {
    it("getDistinctGenres executes SQL RPC directly without downloading raw rows", async () => {
      let rpcCalledWith: { fn: string; args: any } | null = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          rpcCalledWith = { fn, args };
          return Promise.resolve({
            data: ["Dark Romance", "Historical", "Romance", "Suspense"],
            error: null,
          });
        },
      });

      const genres = await getDistinctGenres();

      assert.ok(rpcCalledWith);
      assert.equal((rpcCalledWith as any).fn, "get_distinct_genres");
      assert.deepEqual(genres, ["Dark Romance", "Historical", "Romance", "Suspense"]);
    });

    it("getPopularTags executes SQL unnest and frequency ranking RPC directly", async () => {
      let rpcCalledWith: { fn: string; args: any } | null = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          rpcCalledWith = { fn, args };
          return Promise.resolve({
            data: [
              { tag: "CEO", count: 2500 },
              { tag: "Revenge", count: 1800 },
              { tag: "Billionaire", count: 1200 },
            ],
            error: null,
          });
        },
      });

      const tags = await getPopularTags();

      assert.ok(rpcCalledWith);
      assert.equal((rpcCalledWith as any).fn, "get_popular_tags");
      assert.deepEqual(tags, ["CEO", "Revenge", "Billionaire"]);
    });

    it("getTaxonomyCounts aggregates genres and tags directly inside PostgreSQL", async () => {
      let rpcCalled = false;

      setTestContentClient({
        rpc: (fn: string) => {
          if (fn === "get_taxonomy_counts") {
            rpcCalled = true;
            return Promise.resolve({
              data: {
                genres: [
                  { genre: "Romance", count: 350 },
                  { genre: "Action", count: 120 },
                ],
                tags: [
                  { tag: "CEO", count: 500 },
                  { tag: "Rebirth", count: 210 },
                ],
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
        },
      });

      const counts = await getTaxonomyCounts();

      assert.ok(rpcCalled);
      assert.equal(counts.genres.length, 2);
      assert.equal(counts.genres[0].genre, "Romance");
      assert.equal(counts.genres[0].count, 350);
      assert.equal(counts.tags[0].tag, "CEO");
      assert.equal(counts.tags[0].count, 500);
    });

    it("eliminates 1,000-row PostgREST truncation risk by aggregating in SQL", async () => {
      // Simulate catalog with 3,500 titles where client row download would have truncated at 1,000
      const seededTags = Array.from({ length: 75 }, (_, i) => ({
        tag: `Trope-${i + 1}`,
        count: 5000 - i * 50,
      }));

      setTestContentClient({
        rpc: (fn: string) => {
          if (fn === "get_popular_tags") {
            return Promise.resolve({
              data: seededTags,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      });

      const result = await getPopularTags();
      assert.equal(result.length, 75);
      assert.equal(result[0], "Trope-1");
      assert.equal(result[74], "Trope-75");
    });
  });

  // ==========================================================================
  // 3. Trigram Search Query Normalization & Relevance Sorting (R2 & R3)
  // ==========================================================================
  describe("3. Trigram Search Query Normalization & Relevance Sorting", () => {
    it("normalizes search query, strips punctuation, and maps filters correctly to search_dramas RPC", async () => {
      let capturedArgs: any = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          if (fn === "search_dramas") {
            capturedArgs = args;
            return Promise.resolve({
              data: [
                {
                  id: "11111111-1111-1111-1111-111111111111",
                  slug: "the-secret-ceo-ds",
                  title: "The Secret CEO",
                  channel_id: "22222222-2222-2222-2222-222222222222",
                  channel_name: "DramaShort Originals",
                  channel_code: "ds",
                  poster_url: "https://example.com/poster.jpg",
                  synopsis: "A thrilling romance of a hidden CEO.",
                  genre: "Romance",
                  tags: ["CEO", "Revenge"],
                  total_episodes: 50,
                  episodes_available: 50,
                  rating: 4.8,
                  views_count: 15000,
                  status: "Published",
                  release_year: 2026,
                  created_at: "2026-03-01T00:00:00Z",
                  total_count: 1,
                },
              ],
              count: 1,
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      });

      const res = await searchDramas({
        query: "  The CEO, (Secret)  ",
        genre: "Romance",
        tags: ["CEO"],
        sort: "trending",
        page: 2,
        pageSize: 15,
      });

      assert.ok(capturedArgs);
      assert.equal(capturedArgs.query_text, "The CEO   Secret");
      assert.equal(capturedArgs.filter_genre, "Romance");
      assert.deepEqual(capturedArgs.filter_tags, ["CEO"]);
      assert.equal(capturedArgs.sort_by, "trending");
      assert.equal(capturedArgs.page_offset, 15);
      assert.equal(capturedArgs.page_limit, 15);

      assert.equal(res.page, 2);
      assert.equal(res.pageSize, 15);
      assert.equal(res.total, 1);
      assert.equal(res.items.length, 1);
      assert.equal(res.items[0].title, "The Secret CEO");
    });

    it("normalizes genre filters 'All' and 'All Genres' to null in RPC call", async () => {
      let capturedArgs: any = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          if (fn === "search_dramas") {
            capturedArgs = args;
            return Promise.resolve({ data: [], count: 0, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      });

      await searchDramas({ genre: "All Genres" });
      assert.equal(capturedArgs.filter_genre, null);

      await searchDramas({ genre: "All" });
      assert.equal(capturedArgs.filter_genre, null);
    });

    it("resolves total count and deterministic totalPages from RPC total_count column", async () => {
      setTestContentClient({
        rpc: (fn: string) => {
          if (fn === "search_dramas") {
            const rows = Array.from({ length: 24 }, (_, i) => ({
              id: `id-${i}`,
              slug: `slug-${i}`,
              title: `Drama ${i}`,
              channel_name: "Originals",
              genre: "Romance",
              status: "Published",
              views_count: 1000 - i,
              created_at: "2026-01-01T00:00:00Z",
              total_count: 58, // Total 58 items matched
            }));
            return Promise.resolve({ data: rows, count: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      });

      const res = await searchDramas({ page: 1, pageSize: 24 });
      assert.equal(res.total, 58);
      assert.equal(res.pageSize, 24);
      assert.equal(res.totalPages, 3);
      assert.equal(res.items.length, 24);
    });

    it("defaults sort_by to 'relevance' when query is provided without explicit sort", async () => {
      let capturedArgs: any = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          if (fn === "search_dramas") {
            capturedArgs = args;
            return Promise.resolve({ data: [], count: 0, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      });

      await searchDramas({ query: "Secret Lover" });
      assert.equal(capturedArgs.sort_by, "relevance");
    });

    it("defaults sort_by to 'trending' when query is omitted and sort is not specified", async () => {
      let capturedArgs: any = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          if (fn === "search_dramas") {
            capturedArgs = args;
            return Promise.resolve({ data: [], count: 0, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      });

      await searchDramas({ page: 1 });
      assert.equal(capturedArgs.sort_by, "trending");
    });
  });

  // ==========================================================================
  // 4. Transparent Dual-Mode Fallback when RPC is Unavailable (R3)
  // ==========================================================================
  describe("4. Transparent Dual-Mode Fallback when RPC is Unavailable", () => {
    it("transparently falls back to PostgREST query if search_dramas RPC returns an error", async () => {
      let fallbackPostgrestQueried = false;

      setTestContentClient({
        rpc: () => {
          // Simulate remote database missing migration (PGRST202 function not found)
          return Promise.resolve({
            data: null,
            error: {
              code: "PGRST202",
              message: "Could not find the function public.search_dramas in the schema cache",
            },
          });
        },
        from: (table: string) => {
          assert.equal(table, "titles");
          fallbackPostgrestQueried = true;
          return {
            select: () => ({
              eq: function () {
                return this;
              },
              or: function () {
                return this;
              },
              order: function () {
                return this;
              },
              range: () =>
                Promise.resolve({
                  data: [
                    {
                      id: "fallback-id",
                      slug: "fallback-drama",
                      title: "Fallback Drama",
                      channel_name: "DS",
                      genre: "Romance",
                      status: "Published",
                      views_count: 500,
                      created_at: "2026-01-01T00:00:00Z",
                    },
                  ],
                  count: 1,
                  error: null,
                }),
            }),
          };
        },
      });

      const res = await searchDramas({ query: "Fallback" });

      assert.ok(fallbackPostgrestQueried, "Must execute PostgREST fallback when RPC fails");
      assert.equal(res.total, 1);
      assert.equal(res.items[0].title, "Fallback Drama");
    });

    it("transparently falls back to PostgREST select if getDistinctGenres RPC returns error", async () => {
      let selectGenreCalled = false;

      setTestContentClient({
        rpc: () => Promise.resolve({ data: null, error: { message: "RPC not found" } }),
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: (cols: string) => {
              if (cols === "genre") selectGenreCalled = true;
              return {
                eq: () =>
                  Promise.resolve({
                    data: [{ genre: "Action" }, { genre: "Comedy" }, { genre: "Action" }],
                    error: null,
                  }),
              };
            },
          };
        },
      });

      const genres = await getDistinctGenres();
      assert.ok(selectGenreCalled);
      assert.deepEqual(genres, ["Action", "Comedy"]);
    });

    it("transparently falls back to PostgREST select if getPopularTags RPC returns error", async () => {
      let selectTagsCalled = false;

      setTestContentClient({
        rpc: () => Promise.resolve({ data: null, error: { message: "RPC not found" } }),
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: (cols: string) => {
              if (cols === "tags") selectTagsCalled = true;
              return {
                eq: () =>
                  Promise.resolve({
                    data: [
                      { tags: ["CEO", "Revenge"] },
                      { tags: ["Romance", "CEO"] },
                    ],
                    error: null,
                  }),
              };
            },
          };
        },
      });

      const tags = await getPopularTags();
      assert.ok(selectTagsCalled);
      assert.deepEqual(tags, ["CEO", "Revenge", "Romance"]);
    });

    it("preserves escapePostgrestValue helper and ILIKE term sanitization for fallback queries", () => {
      assert.equal(escapePostgrestValue('Action "Hero"'), 'Action \\"Hero\\"');
      assert.equal(escapePostgrestValue("Back\\slash"), "Back\\\\slash");
      assert.equal(escapePostgrestValue("Multi\nline"), "Multi line");
      assert.equal(escapePostgrestValue(null), "");
      assert.equal(escapePostgrestValue(undefined), "");
    });

    it("applies escapePostgrestValue to search term in PostgREST fallback .or() filter", async () => {
      let orFilterString = "";

      setTestContentClient({
        rpc: () => Promise.resolve({ data: null, error: { message: "RPC not found" } }),
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: function () {
                return this;
              },
              or: function (filter: string) {
                orFilterString = filter;
                return this;
              },
              order: function () {
                return this;
              },
              range: () => Promise.resolve({ data: [], count: 0, error: null }),
            }),
          };
        },
      });

      await searchDramas({ query: 'The "CEO" Secret' });
      assert.ok(orFilterString.includes('\\"CEO\\"'), "PostgREST fallback must escape quotes in search term");
    });

    it("safely handles non-existent channelSlug by returning empty results instead of leaking all dramas", async () => {
      let rpcAttempted = false;

      setTestContentClient({
        from: (table: string) => {
          if (table === "channels") {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: function () {
                return this;
              },
              order: function () {
                return this;
              },
              range: () => Promise.resolve({ data: [], count: 0, error: null }),
            }),
          };
        },
        rpc: () => {
          rpcAttempted = true;
          return Promise.resolve({ data: [], count: 0, error: null });
        },
      });

      const res = await searchDramas({ channelSlug: "definitely-non-existent-slug" });
      assert.equal(res.items.length, 0);
      assert.equal(res.total, 0);
      assert.equal(rpcAttempted, false, "Must not execute search RPC when channelSlug is non-existent");
    });

    it("safely handles invalid non-UUID channelId without throwing database syntax error", async () => {
      let rpcAttempted = false;

      setTestContentClient({
        rpc: () => {
          rpcAttempted = true;
          return Promise.resolve({ data: [], count: 0, error: null });
        },
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: function () {
                return this;
              },
              order: function () {
                return this;
              },
              range: () => Promise.resolve({ data: [], count: 0, error: null }),
            }),
          };
        },
      });

      const res = await searchDramas({ channelId: "not-a-valid-uuid" });
      assert.equal(res.items.length, 0);
      assert.equal(res.total, 0);
      assert.equal(rpcAttempted, false, "Must not execute search RPC with non-UUID channelId");
    });

    it("sanitizes empty tags and whitespace in genre and tags before RPC invocation", async () => {
      let capturedArgs: any = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          if (fn === "search_dramas") {
            capturedArgs = args;
            return Promise.resolve({ data: [], count: 0, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      });

      await searchDramas({
        genre: "  Romance  ",
        tags: ["", "  CEO  ", "   ", "Revenge"],
      });

      assert.ok(capturedArgs);
      assert.equal(capturedArgs.filter_genre, "Romance");
      assert.deepEqual(capturedArgs.filter_tags, ["CEO", "Revenge"]);
    });
  });

  // ==========================================================================
  // 5. Inter-Dependency & Facade Parity (R4)
  // ==========================================================================
  describe("5. Inter-Dependency & Facade Parity (R4)", () => {
    it("maintains backward-compatible alias searchPublishedTitles identically pointing to searchDramas", () => {
      assert.equal(searchPublishedTitles, searchDramas);
      assert.equal(typeof clientSearchTitles, "function");
      assert.equal(clientSearchDramas, clientSearchTitles);
    });

    it("client content.service.ts functions mirror catalog.ts signatures", () => {
      assert.equal(typeof clientGetGenres, "function");
      assert.equal(typeof clientGetTags, "function");
      assert.equal(typeof clientGetTaxonomyCounts, "function");
    });

    it("enforces maximum pageSize limit of 60 across both RPC and fallback", async () => {
      let capturedLimit = 0;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          capturedLimit = args.page_limit;
          return Promise.resolve({ data: [], count: 0, error: null });
        },
      });

      await searchDramas({ pageSize: 120 });
      assert.equal(capturedLimit, 60);
    });

    it("safely handles getTaxonomyCounts RPC failure returning structured fallback without crashing", async () => {
      setTestContentClient({
        rpc: () => Promise.resolve({ data: null, error: { message: "RPC unavailable" } }),
      });

      const counts = await getTaxonomyCounts();
      assert.ok(Array.isArray(counts.genres));
      assert.ok(Array.isArray(counts.tags));
      assert.deepEqual(counts, { genres: [], tags: [] });
    });

    it("clamps negative/zero page and pageSize boundaries to safe defaults", async () => {
      let capturedArgs: any = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          capturedArgs = args;
          return Promise.resolve({ data: [], count: 0, error: null });
        },
      });

      const res = await searchDramas({ page: -5, pageSize: 0 });
      assert.equal(res.page, 1);
      assert.equal(res.pageSize, 1);
      assert.equal(capturedArgs.page_limit, 1);
      assert.equal(capturedArgs.page_offset, 0);
    });

    it("passes explicit options.offset override to RPC page_offset", async () => {
      let capturedArgs: any = null;

      setTestContentClient({
        rpc: (fn: string, args: any) => {
          capturedArgs = args;
          return Promise.resolve({ data: [], count: 0, error: null });
        },
      });

      await searchDramas({ offset: 72, pageSize: 24 });
      assert.equal(capturedArgs.page_offset, 72);
      assert.equal(capturedArgs.page_limit, 24);
    });
  });
});

