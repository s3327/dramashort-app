import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import {
  createDramaSlug,
  getDramaSlugCandidate,
  generateUniqueDramaSlug,
  getChannelCode,
} from "@/lib/slug";
import {
  validateDramaPayload,
  formatTagCase,
  KNOWN_ACRONYMS,
} from "@/lib/validation/drama";
import {
  escapePostgrestValue,
  mapTitleRowToTitle,
} from "@/lib/services/content.service";
import type { Database } from "@/types/supabase";

type TitleRow = Database["public"]["Tables"]["titles"]["Row"];

describe("Task 12.7: Content Data Integrity Rules", () => {
  describe("1. Deterministic Unique Slug Generation & Collision Policy", () => {
    test("derives correct channel code for known and fallback channels", () => {
      assert.equal(getChannelCode("DramaShort Originals"), "ds");
      assert.equal(getChannelCode("Velvet Frame"), "vf");
      assert.equal(getChannelCode("Golden Hour Studios"), "ghs");
      assert.equal(getChannelCode("Nightingale Pictures"), "np");
      assert.equal(getChannelCode("Moonlight Pictures"), "mp");
      assert.equal(getChannelCode("Apex"), "ape");
    });

    test("generates deterministic <title>-<channel_code> base slug", () => {
      const slug1 = createDramaSlug("The CEO's Secret Wife", "DramaShort Originals");
      assert.equal(slug1, "the-ceos-secret-wife-ds");

      const slug2 = createDramaSlug("Revenge & Redemption!", "Velvet Frame");
      assert.equal(slug2, "revenge-redemption-vf");

      const slug3 = createDramaSlug("Love_in_the_City---", "ghs");
      assert.equal(slug3, "love-in-the-city-ghs");
    });

    test("generates sequential candidates on conflict (-2, -3, ...)", () => {
      const attempt1 = getDramaSlugCandidate("The CEO's Secret Wife", "ds", 1);
      assert.equal(attempt1, "the-ceos-secret-wife-ds");

      const attempt2 = getDramaSlugCandidate("The CEO's Secret Wife", "ds", 2);
      assert.equal(attempt2, "the-ceos-secret-wife-ds-2");

      const attempt3 = getDramaSlugCandidate("The CEO's Secret Wife", "ds", 3);
      assert.equal(attempt3, "the-ceos-secret-wife-ds-3");
    });

    test("resolves slug immediately when candidate does not exist in DB", async () => {
      const mockClient = {
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: (field: string, val: string) => ({
                maybeSingle: async () => {
                  assert.equal(field, "slug");
                  assert.equal(val, "unique-drama-ds");
                  return { data: null, error: null };
                },
              }),
            }),
          };
        },
      };

      const slug = await generateUniqueDramaSlug(mockClient, "Unique Drama", "ds");
      assert.equal(slug, "unique-drama-ds");
    });

    test("retries with numeric increment when initial slug collides", async () => {
      const existingSlugs = new Set(["popular-title-ds", "popular-title-ds-2"]);

      const mockClient = {
        from: () => ({
          select: () => ({
            eq: (_field: string, candidate: string) => ({
              maybeSingle: async () => {
                if (existingSlugs.has(candidate)) {
                  return { data: { id: "existing-id" }, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        }),
      };

      const slug = await generateUniqueDramaSlug(mockClient, "Popular Title", "ds");
      assert.equal(slug, "popular-title-ds-3");
    });

    test("excludes current drama id during collision check for edits", async () => {
      let neqChecked = false;
      const currentDramaId = "drama-uuid-self";

      const mockClient = {
        from: () => ({
          select: () => ({
            eq: (_field: string, _candidate: string) => ({
              neq: (idField: string, idVal: string) => {
                assert.equal(idField, "id");
                assert.equal(idVal, currentDramaId);
                neqChecked = true;
                return {
                  maybeSingle: async () => ({ data: null, error: null }),
                };
              },
            }),
          }),
        }),
      };

      const slug = await generateUniqueDramaSlug(mockClient, "My Title", "ds", currentDramaId);
      assert.equal(slug, "my-title-ds");
      assert.equal(neqChecked, true);
    });

    test("handles non-alphanumeric or empty titles with safe fallback", () => {
      assert.equal(createDramaSlug("", "ds"), "drama-ds");
      assert.equal(createDramaSlug("   ", "ds"), "drama-ds");
      assert.equal(createDramaSlug("???", "ds"), "drama-ds");
    });

    test("handles missing or empty channel codes safely", () => {
      assert.equal(createDramaSlug("My Drama", ""), "my-drama-ds");
      assert.equal(createDramaSlug("My Drama", undefined as any), "my-drama-ds");
    });

    test("generateUniqueDramaSlug terminates early on database error", async () => {
      let queryCount = 0;
      const mockClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => {
                queryCount++;
                return { data: null, error: new Error("DB Connection Error") };
              },
            }),
          }),
        }),
      };

      const slug = await generateUniqueDramaSlug(mockClient, "My Title", "ds");
      assert.equal(queryCount, 1);
      assert.match(slug, /^my-title-ds-/);
    });
  });

  describe("2. Tag Normalization with Title Case & Acronym Preservation", () => {
    test("preserves known acronyms regardless of input casing", () => {
      assert.equal(formatTagCase("ceo"), "CEO");
      assert.equal(formatTagCase("CEO"), "CEO");
      assert.equal(formatTagCase("vip"), "VIP");
      assert.equal(formatTagCase("VIP"), "VIP");
      assert.equal(formatTagCase("md"), "MD");
      assert.equal(formatTagCase("dna"), "DNA");
      assert.equal(formatTagCase("fbi"), "FBI");
      assert.equal(formatTagCase("ai"), "AI");
    });

    test("handles possessive acronyms (e.g. CEO's)", () => {
      assert.equal(formatTagCase("ceo's"), "CEO's");
      assert.equal(formatTagCase("vip's"), "VIP's");
    });

    test("converts standard words to Title Case", () => {
      assert.equal(formatTagCase("romance"), "Romance");
      assert.equal(formatTagCase("contract marriage"), "Contract Marriage");
      assert.equal(formatTagCase("secret identity"), "Secret Identity");
      assert.equal(formatTagCase("fake-marriage"), "Fake-Marriage");
      assert.equal(formatTagCase("second-chance love"), "Second-Chance Love");
    });

    test("formats mixed strings containing both words and acronyms", () => {
      assert.equal(formatTagCase("the ceo's revenge"), "The CEO's Revenge");
      assert.equal(formatTagCase("vip guest in city"), "VIP Guest In City");
    });

    test("handles smart/curly apostrophes and slash-separated acronym tropes", () => {
      assert.equal(formatTagCase("the ceo’s revenge"), "The CEO’s Revenge");
      assert.equal(formatTagCase("fl/ml"), "FL/ML");
      assert.equal(formatTagCase("he/be"), "HE/BE");
      assert.equal(formatTagCase("bl/gl"), "BL/GL");
    });

    test("validateDramaPayload normalizes, trims, and deduplicates tags case-insensitively", () => {
      const res = validateDramaPayload(
        {
          title: "Test Drama",
          tags: ["ceo", "CEO", "  Contract Marriage  ", "contract marriage", "VIP", "vip"],
        },
        "create"
      );

      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.deepEqual(res.value.tags, ["CEO", "Contract Marriage", "VIP"]);
    });

    test("normalizes comma-separated string tags identically", () => {
      const res = validateDramaPayload(
        {
          title: "Test Drama",
          tags: "revenge, ceo, CEO, fake marriage, Fake Marriage, MD",
        },
        "create"
      );

      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.deepEqual(res.value.tags, ["Revenge", "CEO", "Fake Marriage", "MD"]);
    });
  });

  describe("3. Poster and Banner Host Allow-List Validation", () => {
    test("accepts valid banner URL on allowed hosts", () => {
      const res = validateDramaPayload(
        {
          title: "Valid Banner Drama",
          banner_url: "https://images.unsplash.com/photo-banner-123?w=1600",
        },
        "create"
      );

      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.equal(res.value.bannerUrl, "https://images.unsplash.com/photo-banner-123?w=1600");
    });

    test("rejects banner URL from disallowed hosts", () => {
      const res = validateDramaPayload(
        {
          title: "Disallowed Banner Drama",
          banner: "https://unauthorized-domain.com/banner.png",
        },
        "create"
      );

      assert.equal(res.ok, false);
      if (res.ok) return;
      assert.equal(res.errors[0]?.field, "banner");
      assert.match(res.errors[0]?.message, /allowed image host/i);
    });

    test("accepts Supabase storage public URLs for poster and banner", () => {
      const res = validateDramaPayload(
        {
          title: "Supabase Media Drama",
          poster: "https://czkkzoiuyqybafacpgsp.supabase.co/storage/v1/object/public/posters/p1.jpg",
          banner: "https://czkkzoiuyqybafacpgsp.supabase.co/storage/v1/object/public/banners/b1.jpg",
        },
        "create"
      );

      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.equal(
        res.value.posterUrl,
        "https://czkkzoiuyqybafacpgsp.supabase.co/storage/v1/object/public/posters/p1.jpg"
      );
      assert.equal(
        res.value.bannerUrl,
        "https://czkkzoiuyqybafacpgsp.supabase.co/storage/v1/object/public/banners/b1.jpg"
      );
    });
  });

  describe("4. PostgREST Filter Value Escaping (escapePostgrestValue)", () => {
    test("leaves standard alphanumeric values unchanged", () => {
      assert.equal(escapePostgrestValue("Romance"), "Romance");
      assert.equal(escapePostgrestValue("DramaShort Originals"), "DramaShort Originals");
    });

    test("escapes double quotes to prevent breaking PostgREST .or() filter syntax", () => {
      assert.equal(escapePostgrestValue('Dark "Romance"'), 'Dark \\"Romance\\"');
      assert.equal(escapePostgrestValue('"CEO"'), '\\"CEO\\"');
    });

    test("escapes backslashes", () => {
      assert.equal(escapePostgrestValue("Action\\Thriller"), "Action\\\\Thriller");
    });

    test("replaces newlines with spaces to prevent malformed query strings", () => {
      assert.equal(escapePostgrestValue("Suspense\nThriller"), "Suspense Thriller");
      assert.equal(escapePostgrestValue("Line1\r\nLine2"), "Line1 Line2");
    });

    test("handles complex malicious injection attempts safely", () => {
      const dirty = 'Romance",channel_name.eq."injected\\value\n';
      const escaped = escapePostgrestValue(dirty);
      assert.equal(escaped, 'Romance\\",channel_name.eq.\\"injected\\\\value ');
    });

    test("handles null, undefined, and non-string inputs safely without crashing", () => {
      assert.equal(escapePostgrestValue(null), "");
      assert.equal(escapePostgrestValue(undefined), "");
      assert.equal(escapePostgrestValue(123 as any), "");
    });
  });

  describe("5. episodes_available & Channel FK Mapping (mapTitleRowToTitle)", () => {
    test("maps episodes_available to episodesAvailable in Title domain model", () => {
      const row: TitleRow = {
        banner_url: null,
        external_id: null,
        external_source: null,
        featured_rank: null,
        free_episodes_count: 5,
        genre_id: null,
        has_been_published: true,
        hero_tagline: null,
        publish_at: null,
        id: "d-1",
        title: "Test",
        slug: "test-ds",
        poster_url: "https://example.com/p.jpg",
        synopsis: "Synopsis",
        channel_id: "ch-1",
        channel_name: "DramaShort Originals",
        channel_code: "ds",
        genre: "Romance",
        tags: ["CEO"],
        total_episodes: 40,
        episodes_available: 18,
        rating: 4.5,
        views_count: 100,
        release_year: 2026,
        status: "Published",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };

      const title = mapTitleRowToTitle(row);
      assert.equal(title.episodesAvailable, 18);
      assert.equal(title.totalEpisodes, 40);
      assert.equal(title.channel, "DramaShort Originals");
    });

    test("prefers joined channels relation name over cached channel_name if present", () => {
      const rowWithJoin = {
        id: "d-2",
        title: "Joined Test",
        slug: "joined-test-vf",
        poster_url: "https://example.com/p.jpg",
        synopsis: "Synopsis",
        channel_id: "ch-2",
        channel_name: "Old Stale Channel Name",
        channel_code: "vf",
        genre: "Drama",
        tags: [],
        total_episodes: 20,
        episodes_available: 5,
        rating: null,
        views_count: 0,
        release_year: 2026,
        status: "Published",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        channels: {
          name: "Fresh Renamed Channel",
          slug: "fresh-renamed-channel",
          code: "vf",
        },
      } as unknown as TitleRow;

      const title = mapTitleRowToTitle(rowWithJoin);
      assert.equal(title.channel, "Fresh Renamed Channel");
    });

    test("handles array-shaped channels relation gracefully", () => {
      const rowWithArrayJoin = {
        id: "d-3",
        title: "Array Test",
        slug: "array-test-ghs",
        poster_url: "https://example.com/p.jpg",
        synopsis: "Synopsis",
        channel_id: "ch-3",
        channel_name: "Stale Fallback Name",
        channel_code: "ghs",
        genre: "Romance",
        tags: [],
        total_episodes: 10,
        episodes_available: 2,
        channels: [
          {
            name: "Joined Channel Array Name",
            slug: "joined-channel-array",
            code: "ghs",
          },
        ],
      } as unknown as TitleRow;

      const title = mapTitleRowToTitle(rowWithArrayJoin);
      assert.equal(title.channel, "Joined Channel Array Name");
    });
  });

  describe("6. Database Migration Contracts (20261006150000_content_data_integrity.sql)", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261006150000_content_data_integrity.sql"
    );

    test("migration file exists in content repository", () => {
      assert.equal(fs.existsSync(migrationPath), true);
    });

    test("defines episodes_available column on titles with default 0", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /ALTER\s+TABLE\s+public\.titles/i);
      assert.match(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+episodes_available\s+INT\s+NOT\s+NULL\s+DEFAULT\s+0/i);
    });

    test("defines trigger to automatically compute episodes_available on episode mutations", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.sync_title_episodes_available/i);
      assert.match(sql, /CREATE\s+TRIGGER\s+trg_sync_title_episodes_available/i);
      assert.match(sql, /AFTER\s+INSERT\s+OR\s+UPDATE\s+OR\s+DELETE\s+ON\s+public\.episodes/i);
    });

    test("defines trigger to synchronize channel_name and channel_code when channels update", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.sync_channel_to_titles/i);
      assert.match(sql, /CREATE\s+TRIGGER\s+trg_sync_channel_to_titles/i);
      assert.match(sql, /AFTER\s+UPDATE\s+OF\s+name,\s*code\s+ON\s+public\.channels/i);
    });

    test("defines trigger to auto-populate channel details from channel_id on titles", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.sync_title_channel_from_fk/i);
      assert.match(sql, /CREATE\s+TRIGGER\s+trg_sync_title_channel_from_fk/i);
      assert.match(sql, /BEFORE\s+INSERT\s+OR\s+UPDATE\s+OF\s+channel_id\s+ON\s+public\.titles/i);
    });

    test("defines trigger enforcing published drama slug immutability", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.enforce_title_slug_immutability/i);
      assert.match(sql, /CREATE\s+TRIGGER\s+trg_enforce_title_slug_immutability/i);
      assert.match(sql, /BEFORE\s+UPDATE\s+OF\s+slug\s+ON\s+public\.titles/i);
      assert.match(sql, /OLD\.status\s*=\s*'Published'/i);
      assert.match(sql, /RAISE\s+EXCEPTION\s+'Slug cannot be modified once a drama has been published'/i);
    });

    test("grants SELECT permission on episodes_available to anon and authenticated roles", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /GRANT\s+SELECT\s*\(episodes_available\)\s+ON\s+TABLE\s+public\.titles\s+TO\s+anon,\s*authenticated/i);
    });
  });

  describe("7. Admin Route Handlers: Slug Creation & Immutability Enforcement", () => {
    const adminUser = {
      id: "admin-uuid-test",
      email: "admin@dramashort.com",
      app_metadata: { role: "admin" },
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    test("POST /api/admin/dramas creates drama with deterministic slug and channel code", async () => {
      const { POST: postDrama } = await import("@/app/api/admin/dramas/route");
      const { setTestUserServerClientFactory } = await import("@/lib/supabase/user-server");
      const { setTestContentAdminClientFactory } = await import("@/lib/supabase/content");

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: adminUser as any }, error: null }),
        },
      }));

      let insertedPayload: any = null;

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          if (table === "channels") {
            return {
              select: () => ({
                ilike: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: { id: "chan-1", name: "Velvet Frame", code: "vf", slug: "velvet-frame" },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "titles") {
            return {
              select: () => ({
                eq: (_col: string, _val: string) => ({
                  maybeSingle: async () => ({ data: null, error: null }), // unique slug
                }),
              }),
              insert: (row: any) => {
                insertedPayload = row;
                return {
                  select: () => ({
                    single: async () => ({
                      data: {
                        id: "11111111-1111-1111-1111-111111111111",
                        ...row,
                        episodes_available: 0,
                        views_count: 0,
                        rating: null,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      },
                      error: null,
                    }),
                  }),
                };
              },
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "The Billionaire's Secret",
          channel: "Velvet Frame",
          genre: "Romance",
          tags: ["CEO", "Billionaire"],
        }),
      });

      const res = await postDrama(req);
      assert.equal(res.status, 201);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(insertedPayload.slug, "the-billionaires-secret-vf");
      assert.equal(insertedPayload.channel_code, "vf");

      setTestUserServerClientFactory(null);
      setTestContentAdminClientFactory(null);
    });

    test("PATCH /api/admin/dramas/[id] rejects slug modification for Published drama", async () => {
      const { PATCH: patchDrama } = await import("@/app/api/admin/dramas/[id]/route");
      const { setTestUserServerClientFactory } = await import("@/lib/supabase/user-server");
      const { setTestContentAdminClientFactory } = await import("@/lib/supabase/content");

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: adminUser as any }, error: null }),
        },
      }));

      const publishedDrama = {
        id: "22222222-2222-2222-2222-222222222222",
        title: "Published Drama",
        slug: "published-drama-ds",
        status: "Published",
        channel_name: "DramaShort Originals",
        channel_code: "ds",
        channel_id: "c-1",
        genre: "Romance",
        total_episodes: 40,
        episodes_available: 40,
        poster_url: "https://images.unsplash.com/photo-1",
        synopsis: "Already published.",
        tags: ["Romance"],
      };

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: publishedDrama, error: null }),
              }),
            }),
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas/22222222-2222-2222-2222-222222222222", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "tampered-new-slug-ds",
        }),
      });

      const res = await patchDrama(req, {
        params: Promise.resolve({ id: "22222222-2222-2222-2222-222222222222" }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "VALIDATION_ERROR");
      assert.match(body.error?.message, /Slug cannot be modified once a drama has been published/i);

      setTestUserServerClientFactory(null);
      setTestContentAdminClientFactory(null);
    });

    test("PATCH /api/admin/dramas/[id] allows slug modification for Draft drama", async () => {
      const { PATCH: patchDrama } = await import("@/app/api/admin/dramas/[id]/route");
      const { setTestUserServerClientFactory } = await import("@/lib/supabase/user-server");
      const { setTestContentAdminClientFactory } = await import("@/lib/supabase/content");

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: adminUser as any }, error: null }),
        },
      }));

      const draftDrama = {
        id: "33333333-3333-3333-3333-333333333333",
        title: "Draft Drama",
        slug: "draft-drama-ds",
        status: "Draft",
        channel_name: "DramaShort Originals",
        channel_code: "ds",
        channel_id: "c-1",
        genre: "Romance",
        total_episodes: 40,
        episodes_available: 0,
        poster_url: "https://images.unsplash.com/photo-1",
        synopsis: "Work in progress.",
        tags: ["Romance"],
      };

      let updatedData: any = null;

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: draftDrama, error: null }),
              }),
            }),
            update: (payload: any) => {
              updatedData = payload;
              return {
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () => ({
                      data: { ...draftDrama, ...payload },
                      error: null,
                    }),
                  }),
                }),
              };
            },
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas/33333333-3333-3333-3333-333333333333", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "updated-draft-slug-ds",
        }),
      });

      const res = await patchDrama(req, {
        params: Promise.resolve({ id: "33333333-3333-3333-3333-333333333333" }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(updatedData.slug, "updated-draft-slug-ds");

      setTestUserServerClientFactory(null);
      setTestContentAdminClientFactory(null);
    });

    test("PATCH /api/admin/dramas/[id] permits updating other fields for Published drama without modifying slug", async () => {
      const { PATCH: patchDrama } = await import("@/app/api/admin/dramas/[id]/route");
      const { setTestUserServerClientFactory } = await import("@/lib/supabase/user-server");
      const { setTestContentAdminClientFactory } = await import("@/lib/supabase/content");

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: adminUser as any }, error: null }),
        },
      }));

      const publishedDrama = {
        id: "44444444-4444-4444-4444-444444444444",
        title: "Original Title",
        slug: "immutable-slug-ds",
        status: "Published",
        channel_name: "DramaShort Originals",
        channel_code: "ds",
        channel_id: "c-1",
        genre: "Romance",
        total_episodes: 40,
        episodes_available: 40,
        poster_url: "https://images.unsplash.com/photo-1",
        synopsis: "Original synopsis.",
        tags: ["Romance"],
      };

      let updatedData: any = null;

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: publishedDrama, error: null }),
              }),
            }),
            update: (payload: any) => {
              updatedData = payload;
              return {
                eq: () => ({
                  select: () => ({
                    maybeSingle: async () => ({
                      data: { ...publishedDrama, ...payload },
                      error: null,
                    }),
                  }),
                }),
              };
            },
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas/44444444-4444-4444-4444-444444444444", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          synopsis: "Updated storyline description without touching slug.",
        }),
      });

      const res = await patchDrama(req, {
        params: Promise.resolve({ id: "44444444-4444-4444-4444-444444444444" }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(updatedData.synopsis, "Updated storyline description without touching slug.");
      assert.equal(updatedData.slug, undefined); // slug was not modified

      setTestUserServerClientFactory(null);
      setTestContentAdminClientFactory(null);
    });

    test("PATCH /api/admin/dramas/[id] maps database duplicate key constraint to 400 VALIDATION_ERROR", async () => {
      const { PATCH: patchDrama } = await import("@/app/api/admin/dramas/[id]/route");
      const { setTestUserServerClientFactory } = await import("@/lib/supabase/user-server");
      const { setTestContentAdminClientFactory } = await import("@/lib/supabase/content");

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: adminUser as any }, error: null }),
        },
      }));

      const draftDrama = {
        id: "55555555-5555-5555-5555-555555555555",
        title: "Draft Drama",
        slug: "draft-drama-ds",
        status: "Draft",
        channel_name: "DramaShort Originals",
        channel_code: "ds",
        channel_id: "c-1",
        genre: "Romance",
        total_episodes: 40,
        episodes_available: 0,
        poster_url: "https://images.unsplash.com/photo-1",
        synopsis: "Original draft.",
        tags: ["Romance"],
      };

      setTestContentAdminClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "titles");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: draftDrama, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: {
                      code: "23505",
                      message: 'duplicate key value violates unique constraint "titles_slug_key"',
                    },
                  }),
                }),
              }),
            }),
          };
        },
      }));

      const req = new NextRequest("http://localhost:3000/api/admin/dramas/55555555-5555-5555-5555-555555555555", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "colliding-slug-ds",
        }),
      });

      const res = await patchDrama(req, {
        params: Promise.resolve({ id: "55555555-5555-5555-5555-555555555555" }),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "VALIDATION_ERROR");
      assert.match(body.error?.message, /already exists/i);

      setTestUserServerClientFactory(null);
      setTestContentAdminClientFactory(null);
    });
  });
});
