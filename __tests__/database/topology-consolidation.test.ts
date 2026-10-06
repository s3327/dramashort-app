import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isUnifiedContentMode,
  getContentSchemaName,
  getContentCredentials,
  createContentClient,
  getContentAdminClient,
  resetContentClient,
} from "@/lib/supabase/content";
import { getUserClientCredentials } from "@/lib/supabase/user-client";
import { getUserServerCredentials } from "@/lib/supabase/user-server";
import {
  MIGRATION_TABLE_ORDER,
  migrateContentData,
  isDirectCliExecution,
} from "@/scripts/migrate-content-to-unified";

describe("Topology Consolidation & Headless Reusability Contracts (Task 13.2)", () => {
  const rootDir = process.cwd();
  const migrationPath = path.resolve(
    rootDir,
    "supabase/user/supabase/migrations/20261007120000_consolidate_content_schema.sql"
  );
  const reusabilityDocPath = path.resolve(
    rootDir,
    "docs/architecture/reusable-content-api.md"
  );
  const adr3Path = path.resolve(rootDir, "docs/adr/0003-database-topology.md");
  const readmePath = path.resolve(rootDir, "README.md");

  // ==========================================================================
  // 1. Unified `content` Schema Database Migration Contracts (R1)
  // ==========================================================================
  describe("1. Unified `content` Schema Migration Contracts (R1)", () => {
    it("migration file exists in primary User DB migrations directory", () => {
      assert.ok(fs.existsSync(migrationPath), "Migration file must exist on disk");
      const stat = fs.statSync(migrationPath);
      assert.ok(stat.size > 2000, "Migration file must be comprehensive (>2KB)");
    });

    it("creates content schema and grants base usage privileges", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");
      assert.ok(
        sql.includes("CREATE SCHEMA IF NOT EXISTS content;"),
        "Migration must create content schema"
      );
      assert.ok(
        sql.includes("GRANT USAGE ON SCHEMA content TO anon, authenticated, service_role;"),
        "Migration must grant schema USAGE to standard Supabase roles"
      );
    });

    it("defines content.channels, content.titles, content.episodes, and content.episode_media", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS content.channels"),
        "Must define content.channels"
      );
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS content.titles"),
        "Must define content.titles"
      );
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS content.episodes"),
        "Must define content.episodes"
      );
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS content.episode_media"),
        "Must define content.episode_media"
      );

      // Foreign keys within content schema
      assert.ok(
        sql.includes("REFERENCES content.channels(id) ON DELETE SET NULL"),
        "content.titles must reference content.channels"
      );
      assert.ok(
        sql.includes("REFERENCES content.titles(id) ON DELETE CASCADE"),
        "content.episodes must reference content.titles"
      );
      assert.ok(
        sql.includes("REFERENCES content.episodes(id) ON DELETE CASCADE"),
        "content.episode_media must reference content.episodes"
      );
    });

    it("creates performance indexes on content schema tables", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      assert.ok(
        sql.includes("idx_content_titles_slug"),
        "Must index content.titles(slug)"
      );
      assert.ok(
        sql.includes("idx_content_titles_channel_code"),
        "Must index content.titles(channel_code)"
      );
      assert.ok(
        sql.includes("idx_content_titles_genre"),
        "Must index content.titles(genre)"
      );
      assert.ok(
        sql.includes("idx_content_titles_status_views"),
        "Must index content.titles(status, views_count)"
      );
      assert.ok(
        sql.includes("idx_content_titles_status_created"),
        "Must index content.titles(status, created_at)"
      );
      assert.ok(
        sql.includes("idx_content_episodes_title_id"),
        "Must index content.episodes(title_id)"
      );
      assert.ok(
        sql.includes("idx_content_episode_media_episode_id"),
        "Must index content.episode_media(episode_id)"
      );
    });

    it("defines all required integrity triggers and sync functions in content schema", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      // episodes_available sync
      assert.ok(
        sql.includes("content.sync_title_episodes_available"),
        "Must define content.sync_title_episodes_available function"
      );
      assert.ok(
        sql.includes("trg_sync_title_episodes_available"),
        "Must define trg_sync_title_episodes_available trigger on content.episodes"
      );

      // channel name & code sync
      assert.ok(
        sql.includes("content.sync_channel_to_titles"),
        "Must define content.sync_channel_to_titles function"
      );
      assert.ok(
        sql.includes("trg_sync_channel_to_titles"),
        "Must define trg_sync_channel_to_titles trigger on content.channels"
      );

      // channel name auto-populate from FK
      assert.ok(
        sql.includes("content.sync_title_channel_from_fk"),
        "Must define content.sync_title_channel_from_fk function"
      );
      assert.ok(
        sql.includes("trg_sync_title_channel_from_fk"),
        "Must define trg_sync_title_channel_from_fk trigger on content.titles"
      );

      // published slug immutability
      assert.ok(
        sql.includes("content.enforce_title_slug_immutability"),
        "Must define content.enforce_title_slug_immutability function"
      );
      assert.ok(
        sql.includes("trg_enforce_title_slug_immutability"),
        "Must define trg_enforce_title_slug_immutability trigger on content.titles"
      );
    });

    it("configures Row Level Security and locks down episode_media strictly to service_role", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      assert.ok(
        sql.includes("ALTER TABLE content.channels ENABLE ROW LEVEL SECURITY;"),
        "RLS must be enabled on content.channels"
      );
      assert.ok(
        sql.includes("ALTER TABLE content.titles ENABLE ROW LEVEL SECURITY;"),
        "RLS must be enabled on content.titles"
      );
      assert.ok(
        sql.includes("ALTER TABLE content.episodes ENABLE ROW LEVEL SECURITY;"),
        "RLS must be enabled on content.episodes"
      );
      assert.ok(
        sql.includes("ALTER TABLE content.episode_media ENABLE ROW LEVEL SECURITY;"),
        "RLS must be enabled on content.episode_media"
      );

      // Public policies
      assert.ok(
        sql.includes("Public read channels"),
        "Must define Public read channels policy"
      );
      assert.ok(
        sql.includes("Public read published titles"),
        "Must define Public read published titles policy"
      );
      assert.ok(
        sql.includes("Public read episodes of published titles"),
        "Must define Public read episodes of published titles policy"
      );

      // episode_media lockdown
      assert.ok(
        sql.includes("GRANT ALL ON TABLE content.episode_media TO postgres, service_role;"),
        "Must grant ALL on episode_media to service_role and postgres"
      );
      assert.ok(
        sql.includes("REVOKE ALL ON TABLE content.episode_media FROM anon, authenticated;"),
        "Must REVOKE ALL on episode_media from anon and authenticated"
      );

      // episodes column restriction
      assert.ok(
        sql.includes("REVOKE SELECT ON TABLE content.episodes FROM anon, authenticated;"),
        "Must revoke full table select on content.episodes from anon"
      );
      assert.ok(
        sql.includes("GRANT SELECT (") && sql.includes("ON TABLE content.episodes TO anon, authenticated;"),
        "Must grant column-level select on safe metadata columns of content.episodes"
      );
    });
  });

  // ==========================================================================
  // 2. Native Foreign Key Constraints on User Tables (R2)
  // ==========================================================================
  describe("2. Native Foreign Key Constraints on User Tables (R2)", () => {
    it("adds title_id UUID and backfills from title_slug on favorites", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      assert.ok(
        sql.includes("ALTER TABLE public.favorites ADD COLUMN IF NOT EXISTS title_id UUID;"),
        "Must add title_id to public.favorites"
      );
      assert.ok(
        sql.includes("UPDATE public.favorites f") && sql.includes("FROM content.titles t"),
        "Must backfill public.favorites.title_id from content.titles"
      );
      assert.ok(
        sql.includes("DELETE FROM public.favorites WHERE title_id IS NULL;"),
        "Must prune orphaned favorites rows"
      );
      assert.ok(
        sql.includes("ALTER TABLE public.favorites ALTER COLUMN title_id SET NOT NULL;"),
        "Must enforce NOT NULL on favorites.title_id"
      );
      assert.ok(
        sql.includes("fk_favorites_title_id") &&
          sql.includes("REFERENCES content.titles(id) ON DELETE CASCADE"),
        "Must apply FOREIGN KEY ON DELETE CASCADE referencing content.titles"
      );
      assert.ok(
        sql.includes("CREATE INDEX IF NOT EXISTS idx_favorites_title_id ON public.favorites(title_id);"),
        "Must index favorites.title_id for cascading delete performance"
      );
      assert.ok(
        sql.includes("uq_favorites_user_id_title_id UNIQUE (user_id, title_id)"),
        "Must add unique constraint on (user_id, title_id)"
      );
    });

    it("adds title_id UUID and backfills from title_slug on watch_history", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      assert.ok(
        sql.includes("ALTER TABLE public.watch_history ADD COLUMN IF NOT EXISTS title_id UUID;"),
        "Must add title_id to public.watch_history"
      );
      assert.ok(
        sql.includes("UPDATE public.watch_history w") && sql.includes("FROM content.titles t"),
        "Must backfill public.watch_history.title_id from content.titles"
      );
      assert.ok(
        sql.includes("DELETE FROM public.watch_history WHERE title_id IS NULL;"),
        "Must prune orphaned watch_history rows"
      );
      assert.ok(
        sql.includes("ALTER TABLE public.watch_history ALTER COLUMN title_id SET NOT NULL;"),
        "Must enforce NOT NULL on watch_history.title_id"
      );
      assert.ok(
        sql.includes("fk_watch_history_title_id") &&
          sql.includes("REFERENCES content.titles(id) ON DELETE CASCADE"),
        "Must apply FOREIGN KEY ON DELETE CASCADE on watch_history"
      );
      assert.ok(
        sql.includes("CREATE INDEX IF NOT EXISTS idx_watch_history_title_id ON public.watch_history(title_id);"),
        "Must index watch_history.title_id"
      );
      assert.ok(
        sql.includes("uq_watch_history_user_id_title_id UNIQUE (user_id, title_id)"),
        "Must add unique constraint on watch_history(user_id, title_id)"
      );
    });

    it("adds title_id UUID and backfills from title_slug on custom_list_items", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      assert.ok(
        sql.includes("ALTER TABLE public.custom_list_items ADD COLUMN IF NOT EXISTS title_id UUID;"),
        "Must add title_id to public.custom_list_items"
      );
      assert.ok(
        sql.includes("UPDATE public.custom_list_items c") && sql.includes("FROM content.titles t"),
        "Must backfill public.custom_list_items.title_id from content.titles"
      );
      assert.ok(
        sql.includes("DELETE FROM public.custom_list_items WHERE title_id IS NULL;"),
        "Must prune orphaned custom_list_items rows"
      );
      assert.ok(
        sql.includes("ALTER TABLE public.custom_list_items ALTER COLUMN title_id SET NOT NULL;"),
        "Must enforce NOT NULL on custom_list_items.title_id"
      );
      assert.ok(
        sql.includes("fk_custom_list_items_title_id") &&
          sql.includes("REFERENCES content.titles(id) ON DELETE CASCADE"),
        "Must apply FOREIGN KEY ON DELETE CASCADE on custom_list_items"
      );
      assert.ok(
        sql.includes("CREATE INDEX IF NOT EXISTS idx_custom_list_items_title_id ON public.custom_list_items(title_id);"),
        "Must index custom_list_items.title_id"
      );
      assert.ok(
        sql.includes("uq_custom_list_items_list_id_title_id UNIQUE (list_id, title_id)"),
        "Must add unique constraint on custom_list_items(list_id, title_id)"
      );
    });

    it("retains dual-mode unique slug constraints and configures bidirectional sync triggers", () => {
      const sql = fs.readFileSync(migrationPath, "utf8");

      // Backward compatible unique slug constraints
      assert.ok(
        sql.includes("favorites_user_id_title_slug_key UNIQUE (user_id, title_slug)"),
        "Must retain unique constraint on favorites(user_id, title_slug)"
      );
      assert.ok(
        sql.includes("watch_history_user_id_title_slug_key UNIQUE (user_id, title_slug)"),
        "Must retain unique constraint on watch_history(user_id, title_slug)"
      );
      assert.ok(
        sql.includes("custom_list_items_list_id_title_slug_key UNIQUE (list_id, title_slug)"),
        "Must retain unique constraint on custom_list_items(list_id, title_slug)"
      );

      // Auto-population sync triggers
      assert.ok(
        sql.includes("public.sync_user_engagement_title_id()"),
        "Must define public.sync_user_engagement_title_id function"
      );
      assert.ok(
        sql.includes("SECURITY DEFINER") && sql.includes("sync_user_engagement_title_id"),
        "sync_user_engagement_title_id must be SECURITY DEFINER to bypass table RLS across drama statuses"
      );
      assert.ok(
        sql.includes("IF EXISTS (SELECT 1 FROM content.titles LIMIT 1)"),
        "Must guard orphan pruning behind catalog data existence check to avoid wiping user tables on clean migration"
      );
      assert.ok(
        sql.includes("REVOKE ALL ON TABLE public.profiles, public.favorites, public.watch_history, public.custom_lists, public.custom_list_items FROM anon;"),
        "Must explicitly quarantine user tables from anon role"
      );
      assert.ok(
        sql.includes("trg_sync_favorites_title_id"),
        "Must define trg_sync_favorites_title_id trigger on favorites"
      );
      assert.ok(
        sql.includes("trg_sync_watch_history_title_id"),
        "Must define trg_sync_watch_history_title_id trigger on watch_history"
      );
      assert.ok(
        sql.includes("trg_sync_custom_list_items_title_id"),
        "Must define trg_sync_custom_list_items_title_id trigger on custom_list_items"
      );

      // Slug rename sync from content.titles
      assert.ok(
        sql.includes("content.sync_title_slug_to_user_tables()"),
        "Must define content.sync_title_slug_to_user_tables function"
      );
      assert.ok(
        sql.includes("trg_sync_title_slug_to_user_tables"),
        "Must define trg_sync_title_slug_to_user_tables trigger on content.titles"
      );
    });

    it("types/supabase-user.ts defines title_id column and foreign key relations for user tables", () => {
      const userTypesPath = path.resolve(rootDir, "types/supabase-user.ts");
      const typesContent = fs.readFileSync(userTypesPath, "utf8");

      assert.ok(
        typesContent.includes("title_id?: string | null"),
        "types/supabase-user.ts must type title_id as optional string | null for dual-mode support"
      );
      assert.ok(
        typesContent.includes("foreignKeyName: \"fk_favorites_title_id\""),
        "favorites must declare foreignKeyName fk_favorites_title_id"
      );
      assert.ok(
        typesContent.includes("foreignKeyName: \"fk_watch_history_title_id\""),
        "watch_history must declare foreignKeyName fk_watch_history_title_id"
      );
      assert.ok(
        typesContent.includes("foreignKeyName: \"fk_custom_list_items_title_id\""),
        "custom_list_items must declare foreignKeyName fk_custom_list_items_title_id"
      );
      assert.ok(
        typesContent.includes("content: ContentDatabase[\"public\"]"),
        "Database type must expose content schema for multi-schema access"
      );
    });
  });

  // ==========================================================================
  // 3. Unified Client Support with Seamless Dual-Mode Fallback (R4)
  // ==========================================================================
  describe("3. Unified Client Dual-Mode Operation (R4)", () => {
    it("detects unified topology mode when explicit topology variable is set", () => {
      assert.equal(
        isUnifiedContentMode({ SUPABASE_DATABASE_TOPOLOGY: "unified" }),
        true
      );
      assert.equal(
        isUnifiedContentMode({ NEXT_PUBLIC_SUPABASE_TOPOLOGY: "unified" }),
        true
      );
      assert.equal(
        isUnifiedContentMode({ SUPABASE_DATABASE_TOPOLOGY: "dual" }),
        false
      );
      assert.equal(
        isUnifiedContentMode({ SUPABASE_DATABASE_TOPOLOGY: "split" }),
        false
      );
    });

    it("detects unified mode when NEXT_PUBLIC_SUPABASE_URL is provided", () => {
      assert.equal(
        isUnifiedContentMode({
          NEXT_PUBLIC_SUPABASE_URL: "https://unified.supabase.co",
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        }),
        true
      );
    });

    it("detects unified mode when content and user URLs are identical", () => {
      assert.equal(
        isUnifiedContentMode({
          NEXT_PUBLIC_CONTENT_SUPABASE_URL: "https://unified.supabase.co",
          NEXT_PUBLIC_USER_SUPABASE_URL: "https://unified.supabase.co",
        }),
        true
      );
    });

    it("detects unified mode when only user URL is provided", () => {
      assert.equal(
        isUnifiedContentMode({
          NEXT_PUBLIC_USER_SUPABASE_URL: "https://unified.supabase.co",
        }),
        true
      );
    });

    it("falls back to dual-project mode when distinct content URL is specified", () => {
      assert.equal(
        isUnifiedContentMode({
          NEXT_PUBLIC_CONTENT_SUPABASE_URL: "https://czkkzoiuyqybafacpgsp.supabase.co",
          NEXT_PUBLIC_USER_SUPABASE_URL: "https://bpidsbcrvpkavvdvtpgh.supabase.co",
        }),
        false
      );
    });

    it("returns schema 'content' in unified mode and 'public' in dual mode", () => {
      assert.equal(
        getContentSchemaName({ SUPABASE_DATABASE_TOPOLOGY: "unified" }),
        "content"
      );
      assert.equal(
        getContentSchemaName({
          NEXT_PUBLIC_CONTENT_SUPABASE_URL: "https://czkkzoiuyqybafacpgsp.supabase.co",
          NEXT_PUBLIC_USER_SUPABASE_URL: "https://bpidsbcrvpkavvdvtpgh.supabase.co",
        }),
        "public"
      );
    });

    it("resolves unified client credentials and options properly", () => {
      const mockEnv = {
        NEXT_PUBLIC_SUPABASE_URL: "https://unified.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "unified-anon-key",
      };
      const creds = getContentCredentials(mockEnv);
      assert.equal(creds.url, "https://unified.supabase.co");
      assert.equal(creds.anonKey, "unified-anon-key");
      assert.equal(creds.schema, "content");
      assert.equal(creds.isUnified, true);
    });

    it("resolves dual client credentials properly", () => {
      const mockEnv = {
        NEXT_PUBLIC_CONTENT_SUPABASE_URL: "https://czkkzoiuyqybafacpgsp.supabase.co",
        NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY: "content-anon-key",
        NEXT_PUBLIC_USER_SUPABASE_URL: "https://bpidsbcrvpkavvdvtpgh.supabase.co",
        NEXT_PUBLIC_USER_SUPABASE_ANON_KEY: "user-anon-key",
      };
      const creds = getContentCredentials(mockEnv);
      assert.equal(creds.url, "https://czkkzoiuyqybafacpgsp.supabase.co");
      assert.equal(creds.anonKey, "content-anon-key");
      assert.equal(creds.schema, "public");
      assert.equal(creds.isUnified, false);
    });

    it("createContentClient instantiates client targeting content schema in unified mode", () => {
      const client = createContentClient({
        SUPABASE_DATABASE_TOPOLOGY: "unified",
        NEXT_PUBLIC_SUPABASE_URL: "https://unified.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "dev-key",
      });
      assert.ok(client, "Client instance must be returned");
      assert.equal(typeof client.from, "function");
    });

    it("getContentAdminClient uses SUPABASE_SERVICE_ROLE_KEY in unified mode", () => {
      const adminClient = getContentAdminClient({
        SUPABASE_DATABASE_TOPOLOGY: "unified",
        NEXT_PUBLIC_SUPABASE_URL: "https://unified.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "unified-service-key",
      });
      assert.ok(adminClient, "Admin client instance must be returned");
      assert.equal(typeof adminClient.from, "function");
    });

    it("getUserClientCredentials and getUserServerCredentials support unified URL fallback", () => {
      const unifiedEnv = {
        NEXT_PUBLIC_SUPABASE_URL: "https://unified.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "unified-anon-key",
      };
      const userClientCreds = getUserClientCredentials(unifiedEnv);
      assert.equal(userClientCreds.url, "https://unified.supabase.co");
      assert.equal(userClientCreds.anonKey, "unified-anon-key");

      const userServerCreds = getUserServerCredentials(unifiedEnv);
      assert.equal(userServerCreds.url, "https://unified.supabase.co");
      assert.equal(userServerCreds.anonKey, "unified-anon-key");
    });
  });

  // ==========================================================================
  // 4. Data Migration Automation Utility Contracts (R5)
  // ==========================================================================
  describe("4. Data Migration Utility Contracts (R5)", () => {
    it("orders migration tables to satisfy foreign key dependencies", () => {
      assert.deepEqual(MIGRATION_TABLE_ORDER, [
        "channels",
        "titles",
        "episodes",
        "episode_media",
      ]);
    });

    it("executes simulated dry-run migration extracting rows without writing", async () => {
      const mockChannels = [
        { id: "c1", name: "Channel 1", slug: "ch-1", code: "c1" },
      ];
      const mockTitles = [
        { id: "t1", title: "Drama 1", slug: "drama-1", channel_id: "c1" },
      ];
      const mockEpisodes = [
        { id: "e1", title_id: "t1", episode_number: 1, title: "Ep 1" },
      ];
      const mockMedia = [
        { id: "m1", episode_id: "e1", provider: "custom", status: "ready" },
      ];

      const sourceStore: Record<string, any[]> = {
        channels: mockChannels,
        titles: mockTitles,
        episodes: mockEpisodes,
        episode_media: mockMedia,
      };

      const mockSourceClient: any = {
        from: (table: string) => ({
          select: () => ({
            range: (from: number, to: number) => ({
              order: () => Promise.resolve({
                data: (sourceStore[table] || []).slice(from, to + 1),
                error: null,
              }),
            }),
          }),
        }),
      };

      let destUpsertCalls = 0;
      const mockDestClient: any = {
        schema: () => ({
          from: () => ({
            upsert: async () => {
              destUpsertCalls++;
              return { error: null };
            },
          }),
        }),
      };

      const result = await migrateContentData({
        sourceClient: mockSourceClient,
        destClient: mockDestClient,
        dryRun: true,
      });

      assert.equal(result.success, true);
      assert.equal(destUpsertCalls, 0, "Dry run must NOT write to destination");
      assert.equal(result.counts.channels.extracted, 1);
      assert.equal(result.counts.titles.extracted, 1);
      assert.equal(result.counts.episodes.extracted, 1);
      assert.equal(result.counts.episode_media.extracted, 1);
      assert.equal(result.counts.channels.loaded, 0);
    });

    it("executes live cutover migration with chunked upserts and conflict handling", async () => {
      const mockChannels = [
        { id: "c1", name: "Velvet", slug: "velvet", code: "vf" },
        { id: "c2", name: "DramaSpark", slug: "dramaspark", code: "ds" },
      ];

      const insertedRows: Record<string, any[]> = {};

      const mockSourceClient: any = {
        from: (table: string) => ({
          select: () => ({
            range: (from: number, to: number) => ({
              order: () => Promise.resolve({
                data: table === "channels" ? mockChannels.slice(from, to + 1) : [],
                error: null,
              }),
            }),
          }),
        }),
      };

      const mockDestClient: any = {
        schema: (schemaName: string) => {
          assert.equal(schemaName, "content", "Target must be 'content' schema");
          return {
            from: (table: string) => ({
              upsert: async (chunk: any[], opts: any) => {
                assert.equal(opts.onConflict, "id", "Must handle conflict on id primary key");
                insertedRows[table] = (insertedRows[table] || []).concat(chunk);
                return { error: null };
              },
            }),
          };
        },
      };

      const result = await migrateContentData({
        sourceClient: mockSourceClient,
        destClient: mockDestClient,
        dryRun: false,
        batchSize: 1, // Test batching across multiple iterations
      });

      assert.equal(result.success, true);
      assert.equal(result.counts.channels.extracted, 2);
      assert.equal(result.counts.channels.loaded, 2);
      assert.equal(insertedRows.channels?.length, 2);
    });

    it("isDirectCliExecution correctly identifies direct CLI invocation vs module import", () => {
      // Loose substring in unrelated test runner path must NOT trigger direct execution
      assert.equal(
        isDirectCliExecution(
          "/app/__tests__/migrate-content-to-unified.test.ts",
          "file:///app/scripts/migrate-content-to-unified.ts"
        ),
        false
      );
      assert.equal(
        isDirectCliExecution(
          undefined,
          "file:///app/scripts/migrate-content-to-unified.ts"
        ),
        false
      );
      assert.equal(
        isDirectCliExecution(
          "/app/other-script.ts",
          "file:///app/scripts/migrate-content-to-unified.ts"
        ),
        false
      );

      // Exact matching file path should return true
      const targetPath = path.resolve(rootDir, "scripts/migrate-content-to-unified.ts");
      const targetUrl = new URL(`file://${targetPath.replace(/\\/g, "/")}`).href;
      assert.equal(isDirectCliExecution(targetPath, targetUrl), true);
    });
  });

  // ==========================================================================
  // 5. Cross-Project Reusability Architecture & Implementation Guide (R3)
  // ==========================================================================
  describe("5. Reusability Architecture Guide Completeness (R3)", () => {
    it("verifies reusable-content-api.md exists and contains substantial architecture specs", () => {
      assert.ok(fs.existsSync(reusabilityDocPath), "Architecture guide must exist");
      const stat = fs.statSync(reusabilityDocPath);
      assert.ok(stat.size > 2000, "Architecture guide must be comprehensive (>2KB)");
    });

    it("documents strict PostgreSQL security boundaries and role grants", () => {
      const content = fs.readFileSync(reusabilityDocPath, "utf8");

      assert.ok(
        content.includes("GRANT USAGE ON SCHEMA content TO anon"),
        "Must specify granting USAGE on content schema to anon"
      );
      assert.ok(
        content.includes("GRANT SELECT ON TABLE content.channels TO anon"),
        "Must specify granting SELECT on content.channels to anon"
      );
      assert.ok(
        content.includes("GRANT SELECT ON TABLE content.titles TO anon"),
        "Must specify granting SELECT on content.titles to anon"
      );
      assert.ok(
        content.includes("REVOKE ALL ON TABLE content.episode_media FROM anon"),
        "Must specify revoking episode_media from anon"
      );
      assert.ok(
        content.includes("REVOKE ALL ON TABLE public.profiles FROM anon"),
        "Must specify revoking public.profiles from anon"
      );
      assert.ok(
        content.includes("REVOKE ALL ON TABLE public.favorites FROM anon"),
        "Must specify revoking public.favorites from anon"
      );
    });

    it("provides concrete external client integration samples in TypeScript, cURL, and Python", () => {
      const content = fs.readFileSync(reusabilityDocPath, "utf8");

      assert.ok(
        content.includes("TypeScript") || content.includes("JavaScript"),
        "Must provide TypeScript sample"
      );
      assert.ok(
        content.includes("schema: \"content\"") || content.includes("schema: 'content'"),
        "TypeScript sample must specify db: { schema: 'content' }"
      );
      assert.ok(
        content.includes("curl") || content.includes("cURL"),
        "Must provide cURL sample"
      );
      assert.ok(
        content.includes("Accept-Profile: content"),
        "cURL sample must demonstrate Accept-Profile: content header"
      );
      assert.ok(
        content.includes("Python") || content.includes("python"),
        "Must provide Python sample"
      );
    });

    it("documents performance caching (ISR/CDN), rate limiting, and independent scaling", () => {
      const content = fs.readFileSync(reusabilityDocPath, "utf8");

      assert.ok(
        content.includes("ISR") || content.includes("Incremental Static Regeneration"),
        "Must document ISR caching"
      );
      assert.ok(
        content.includes("revalidate = 300"),
        "Must document revalidate = 300 TTL"
      );
      assert.ok(
        content.includes("CDN") || content.includes("Cache-Control"),
        "Must document CDN caching headers"
      );
      assert.ok(
        content.includes("Rate Limit") || content.includes("rate limit"),
        "Must document rate limiting policies"
      );
      assert.ok(
        content.includes("Read Replica") || content.includes("read replica"),
        "Must document dedicated read replica scaling"
      );
      assert.ok(
        content.includes("Supavisor"),
        "Must document Supavisor connection pooling"
      );
    });

    it("verifies bi-directional cross-links with ADR-0003 and README.md", () => {
      const docText = fs.readFileSync(reusabilityDocPath, "utf8");
      const adr3Text = fs.readFileSync(adr3Path, "utf8");
      const readmeText = fs.readFileSync(readmePath, "utf8");

      // Architecture guide links back to ADR-0003 and README
      assert.ok(
        docText.includes("../adr/0003-database-topology.md"),
        "Architecture guide must link to ADR-0003"
      );
      assert.ok(
        docText.includes("../../README.md"),
        "Architecture guide must link to root README.md"
      );

      // ADR-0003 links to reusable-content-api.md
      assert.ok(
        adr3Text.includes("../architecture/reusable-content-api.md"),
        "ADR-0003 must link to reusable-content-api.md"
      );

      // README.md links to reusable-content-api.md
      assert.ok(
        readmeText.includes("docs/architecture/reusable-content-api.md"),
        "README.md must link to reusable-content-api.md"
      );
    });

    it("verifies zero broken markdown links within reusable-content-api.md", () => {
      const text = fs.readFileSync(reusabilityDocPath, "utf8");
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match: RegExpExecArray | null;

      while ((match = linkRegex.exec(text)) !== null) {
        const target = match[2].trim();
        if (
          target.startsWith("http://") ||
          target.startsWith("https://") ||
          target.startsWith("#")
        ) {
          continue;
        }
        const cleanTarget = target.split("#")[0];
        if (!cleanTarget) continue;
        const resolved = path.resolve(path.dirname(reusabilityDocPath), cleanTarget);
        assert.ok(
          fs.existsSync(resolved),
          `Broken link in reusable-content-api.md: "${target}" -> "${resolved}" does not exist`
        );
      }
    });
  });
});
