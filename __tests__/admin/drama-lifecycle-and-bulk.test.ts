import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as postBulkDramasRoute } from "@/app/api/admin/dramas/bulk/route";
import { POST as postDuplicateDramaRoute } from "@/app/api/admin/dramas/[id]/duplicate/route";
import { GET as getDramaPreviewRoute } from "@/app/api/admin/dramas/[id]/preview/route";
import { DELETE as deleteDramaRoute } from "@/app/api/admin/dramas/[id]/route";
import { generatePreviewToken, verifyPreviewToken } from "@/lib/auth/preview-token";
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

describe("Task 16.4: Drama Lifecycle Actions & Bulk Operations", () => {
  let mockTitles: any[] = [];
  let mockEpisodes: any[] = [];
  let mockEpisodeMedia: any[] = [];
  let mockChannels: any[] = [];
  let mockAuditLogs: any[] = [];

  function setupMockClients() {
    setTestContentAdminClientFactory(() => ({
      from: (table: string) => {
        let currentTable = table;
        let selectedRows: any[] = [];
        let filters: Array<(row: any) => boolean> = [];
        let inFilters: Record<string, any[]> = {};

        function getTargetStore() {
          if (currentTable === "titles") return mockTitles;
          if (currentTable === "episodes") return mockEpisodes;
          if (currentTable === "episode_media") return mockEpisodeMedia;
          if (currentTable === "channels") return mockChannels;
          if (currentTable === "admin_audit_log") return mockAuditLogs;
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
                id: item.id || `11111111-1111-4111-a111-${Math.random().toString(36).substring(2, 14).padEnd(12, "0")}`,
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
              error: null,
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
                  then: (resolve: any) => resolve({ data: matched, error: null }),
                  error: null,
                };
              },
              in: (col: string, vals: any[]) => {
                const store = getTargetStore();
                const matched = store.filter((r) => vals.includes(r[col]));
                matched.forEach((r) => Object.assign(r, data));
                return {
                  then: (resolve: any) => resolve({ data: matched, error: null }),
                  error: null,
                };
              },
            };
          },
          delete: () => {
            return {
              eq: (col: string, val: any) => {
                const store = getTargetStore();
                const idx = store.findIndex((r) => r[col] === val);
                if (idx !== -1) {
                  store.splice(idx, 1);
                }
                return { error: null };
              },
            };
          },
          eq: (col: string, val: any) => {
            filters.push((r) => r[col] === val);
            return qb;
          },
          in: (col: string, vals: any[]) => {
            inFilters[col] = vals;
            return qb;
          },
          ilike: (col: string, pattern: string) => {
            const cleanPattern = pattern.replace(/%/g, "").toLowerCase();
            filters.push((r) => (r[col] || "").toLowerCase().includes(cleanPattern));
            return qb;
          },
          order: () => qb,
          range: () => qb,
          limit: () => qb,
          single: async () => {
            const store = getTargetStore();
            let res = store.filter((row) => filters.every((fn) => fn(row)));
            for (const [col, vals] of Object.entries(inFilters)) {
              res = res.filter((r) => vals.includes(r[col]));
            }
            return { data: res[0] || null, error: null };
          },
          maybeSingle: async () => {
            const store = getTargetStore();
            let res = store.filter((row) => filters.every((fn) => fn(row)));
            for (const [col, vals] of Object.entries(inFilters)) {
              res = res.filter((r) => vals.includes(r[col]));
            }
            return { data: res[0] || null, error: null };
          },
          then: (resolve: any) => {
            const store = getTargetStore();
            let res = store.filter((row) => filters.every((fn) => fn(row)));
            for (const [col, vals] of Object.entries(inFilters)) {
              res = res.filter((r) => vals.includes(r[col]));
            }
            resolve({ data: res, count: res.length, error: null });
          },
        };
        return qb;
      },
    } as any));
  }

  beforeEach(() => {
    // Preview tokens have no built-in signing secret; configure one for the suite
    process.env.PREVIEW_SECRET = "test-preview-signing-secret-ds";

    mockTitles = [
      {
        id: "22222222-2222-4222-a222-222222222221",
        title: "Never Published Draft",
        slug: "never-published-draft-ds",
        status: "Draft",
        has_been_published: false,
        synopsis: "A fresh draft title",
        genre: "Romance",
        tags: ["CEO", "Love"],
        channel_name: "DramaShort Originals",
        channel_code: "DS",
        channel_id: "c-1",
        total_episodes: 20,
        episodes_available: 0,
        poster_url: "https://example.com/poster1.jpg",
        banner_url: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "22222222-2222-4222-a222-222222222222",
        title: "Previously Published Drama",
        slug: "previously-published-drama-ds",
        status: "Draft",
        has_been_published: true, // was published previously
        synopsis: "An edited published title now in draft",
        genre: "Suspense",
        tags: ["Revenge"],
        channel_name: "DramaShort Originals",
        channel_code: "DS",
        channel_id: "c-1",
        total_episodes: 30,
        episodes_available: 5,
        poster_url: "https://example.com/poster2.jpg",
        banner_url: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "22222222-2222-4222-a222-222222222223",
        title: "Currently Published Drama",
        slug: "currently-published-drama-ds",
        status: "Published",
        has_been_published: true,
        synopsis: "A live published title",
        genre: "Comedy",
        tags: ["Family"],
        channel_name: "DramaShort Originals",
        channel_code: "DS",
        channel_id: "c-1",
        total_episodes: 15,
        episodes_available: 15,
        poster_url: "https://example.com/poster3.jpg",
        banner_url: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "22222222-2222-4222-a222-222222222224",
        title: "Candidate With Ready Media",
        slug: "candidate-with-ready-media-ds",
        status: "Draft",
        has_been_published: false,
        synopsis: "Ready to publish candidate",
        genre: "Action",
        tags: ["Hero"],
        channel_name: "DramaShort Originals",
        channel_code: "DS",
        channel_id: "c-1",
        total_episodes: 10,
        episodes_available: 1,
        poster_url: "https://example.com/poster4.jpg",
        banner_url: null,
        created_at: new Date().toISOString(),
      },
    ];

    mockChannels = [
      { id: "c-1", name: "DramaShort Originals", code: "DS", slug: "dramashort-originals" },
      { id: "c-2", name: "ShortMax Global", code: "SM", slug: "shortmax-global" },
    ];

    mockEpisodes = [
      {
        id: "ep-ready-1",
        title_id: "22222222-2222-4222-a222-222222222224",
        episode_number: 1,
        title: "Ep 1",
        video_url: "https://example.com/ep1.mp4",
      },
    ];

    mockEpisodeMedia = [
      {
        id: "media-1",
        episode_id: "ep-ready-1",
        status: "ready",
        hls_url: "https://example.com/hls/1/master.m3u8",
      },
    ];

    mockAuditLogs = [];
    setupMockClients();
  });

  /* -------------------------------------------------------------------------- */
  /* Test 1: Database Migration Schema Definitions                              */
  /* -------------------------------------------------------------------------- */
  it("verifies Task 16.4 migration adds has_been_published, trigger, and admin_audit_log", () => {
    const migrationContentPath = path.resolve(
      process.cwd(),
      "supabase/content/supabase/migrations/20261009140000_drama_lifecycle_and_audit.sql"
    );
    const migrationUserPath = path.resolve(
      process.cwd(),
      "supabase/user/supabase/migrations/20261009140000_drama_lifecycle_and_audit.sql"
    );

    assert.ok(fs.existsSync(migrationContentPath), "Content migration must exist");
    assert.ok(fs.existsSync(migrationUserPath), "User migration mirror must exist");

    const sql = fs.readFileSync(migrationContentPath, "utf8");
    assert.match(sql, /has_been_published\s+BOOLEAN/i, "Must add has_been_published column");
    assert.match(sql, /sync_title_has_been_published/i, "Must define sync trigger function");
    assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.admin_audit_log/i, "Must create admin_audit_log table");
    assert.match(sql, /idx_admin_audit_log_entity/i, "Must index entity_type and entity_id");
  });

  /* -------------------------------------------------------------------------- */
  /* Test 2: Preview Token Cryptographic Verification                           */
  /* -------------------------------------------------------------------------- */
  it("has no built-in preview secret: signing throws and verification fails when unconfigured", () => {
    const names = [
      "PREVIEW_SECRET",
      "USER_SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "CONTENT_SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_CONTENT_SERVICE_ROLE_KEY",
    ];
    const saved = names.map((name) => process.env[name]);
    const token = generatePreviewToken("test-drama-id", "secret-draft-slug-ds", 60000);
    for (const name of names) delete process.env[name];
    try {
      assert.throws(() => generatePreviewToken("test-drama-id", "secret-draft-slug-ds"), /PREVIEW_SECRET/);
      const res = verifyPreviewToken(token, "secret-draft-slug-ds");
      assert.equal(res.valid, false);
    } finally {
      names.forEach((name, i) => {
        if (saved[i] === undefined) delete process.env[name];
        else process.env[name] = saved[i];
      });
    }
  });

  it("generates and verifies tamper-proof HMAC preview tokens", () => {
    const dramaId = "test-drama-id";
    const slug = "secret-draft-slug-ds";

    const token = generatePreviewToken(dramaId, slug, 60000);
    assert.ok(typeof token === "string" && token.includes("."), "Token must be base64url payload.signature");

    // Valid verification
    const verified = verifyPreviewToken(token, slug);
    assert.equal(verified.valid, true);
    if (verified.valid) {
      assert.equal(verified.dramaId, dramaId);
      assert.equal(verified.slug, slug);
    }

    // Slug mismatch
    const wrongSlug = verifyPreviewToken(token, "other-slug");
    assert.equal(wrongSlug.valid, false);

    // Tampered signature
    const parts = token.split(".");
    const tamperedSigToken = `${parts[0]}.fakeSignature123`;
    const tamperedRes = verifyPreviewToken(tamperedSigToken, slug);
    assert.equal(tamperedRes.valid, false);

    // Expired token (ttl = -1000)
    const expiredToken = generatePreviewToken(dramaId, slug, -1000);
    const expiredRes = verifyPreviewToken(expiredToken, slug);
    assert.equal(expiredRes.valid, false);
    if (!expiredRes.valid) {
      assert.equal(expiredRes.reason, "Token expired");
    }
  });

  /* -------------------------------------------------------------------------- */
  /* Test 3: GET /api/admin/dramas/[id]/preview Route                           */
  /* -------------------------------------------------------------------------- */
  it("guards preview endpoint with admin check and returns signed previewUrl", async () => {
    // Non-admin rejected with 403
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockRegularUser }, error: null }) },
    } as any));

    const req = new NextRequest("http://localhost/api/admin/dramas/22222222-2222-4222-a222-222222222221/preview");
    const resForbidden = await getDramaPreviewRoute(req, {
      params: Promise.resolve({ id: "22222222-2222-4222-a222-222222222221" }),
    });
    assert.equal(resForbidden.status, 403);

    // Admin authorized
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockAdminUser }, error: null }) },
    } as any));

    const res = await getDramaPreviewRoute(req, {
      params: Promise.resolve({ id: "22222222-2222-4222-a222-222222222221" }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.slug, "never-published-draft-ds");
    assert.match(json.data.previewUrl, /^\/drama\/never-published-draft-ds\?preview=/);

    // Verify token inside previewUrl
    const url = new URL(`http://localhost${json.data.previewUrl}`);
    const tokenFromUrl = url.searchParams.get("preview");
    const verified = verifyPreviewToken(tokenFromUrl, "never-published-draft-ds");
    assert.equal(verified.valid, true);
  });

  /* -------------------------------------------------------------------------- */
  /* Test 4: Duplicate Drama Endpoint (Metadata Only)                           */
  /* -------------------------------------------------------------------------- */
  it("duplicates an existing drama into a Draft copying metadata only", async () => {
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockAdminUser }, error: null }) },
    } as any));

    const targetId = "22222222-2222-4222-a222-222222222223"; // Currently Published Drama
    const req = new NextRequest(`http://localhost/api/admin/dramas/${targetId}/duplicate`, {
      method: "POST",
    });

    const res = await postDuplicateDramaRoute(req, {
      params: Promise.resolve({ id: targetId }),
    });

    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.title, "Currently Published Drama (Copy)");
    assert.equal(json.data.status, "Draft");
    assert.equal(json.data.episodesAvailable, 0); // episodes are not cloned
    assert.equal(json.data.totalEpisodes, 15);
    assert.equal(json.data.channel, "DramaShort Originals");
    assert.notEqual(json.data.slug, "currently-published-drama-ds");

    // Verify audit log recorded
    assert.equal(mockAuditLogs.length, 1);
    assert.equal(mockAuditLogs[0].action, "drama.duplicate");
    assert.equal(mockAuditLogs[0].entity_id, json.data.id);
  });

  /* -------------------------------------------------------------------------- */
  /* Test 5: Soft Archive (Default) vs Hard Delete on Never-Published Draft     */
  /* -------------------------------------------------------------------------- */
  it("defaults to soft archive on delete, and allows hard delete on never-published draft", async () => {
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockAdminUser }, error: null }) },
    } as any));

    // 1. Soft Delete (Archive)
    const softTargetId = "22222222-2222-4222-a222-222222222222";
    const softReq = new NextRequest(`http://localhost/api/admin/dramas/${softTargetId}`, {
      method: "DELETE",
    });

    const softRes = await deleteDramaRoute(softReq, {
      params: Promise.resolve({ id: softTargetId }),
    });
    assert.equal(softRes.status, 200);

    const softDrama = mockTitles.find((t) => t.id === softTargetId);
    assert.ok(softDrama, "Row must still exist in database");
    assert.equal(softDrama.status, "Archived", "Status must be updated to Archived");
    assert.ok(mockAuditLogs.some((l) => l.action === "drama.archive" && l.entity_id === softTargetId));

    // 2. Hard Delete on never-published draft
    const hardTargetId = "22222222-2222-4222-a222-222222222221";
    const hardReq = new NextRequest(`http://localhost/api/admin/dramas/${hardTargetId}?hard=true`, {
      method: "DELETE",
    });

    const hardRes = await deleteDramaRoute(hardReq, {
      params: Promise.resolve({ id: hardTargetId }),
    });
    assert.equal(hardRes.status, 200);

    const deletedDrama = mockTitles.find((t) => t.id === hardTargetId);
    assert.equal(deletedDrama, undefined, "Row must be completely removed from database");
    assert.ok(mockAuditLogs.some((l) => l.action === "drama.hard_delete" && l.entity_id === hardTargetId));
  });

  /* -------------------------------------------------------------------------- */
  /* Test 6: Rejection of Hard Delete on Published Drama                        */
  /* -------------------------------------------------------------------------- */
  it("rejects hard delete on previously published drama with validation error", async () => {
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockAdminUser }, error: null }) },
    } as any));

    // Try hard delete on published drama
    const publishedId = "22222222-2222-4222-a222-222222222223";
    const req = new NextRequest(`http://localhost/api/admin/dramas/${publishedId}?hard=true`, {
      method: "DELETE",
    });

    const res = await deleteDramaRoute(req, {
      params: Promise.resolve({ id: publishedId }),
    });

    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.error.message, /Published dramas cannot be permanently deleted/);
  });

  /* -------------------------------------------------------------------------- */
  /* Test 7: Bulk Operations - Publish with Ready Episode Validation            */
  /* -------------------------------------------------------------------------- */
  it("bulk publish promotes candidate with ready media and skips 0-episode candidate", async () => {
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockAdminUser }, error: null }) },
    } as any));

    const readyId = "22222222-2222-4222-a222-222222222224"; // Has 1 ready episode
    const emptyId = "22222222-2222-4222-a222-222222222221"; // Has 0 episodes

    const req = new NextRequest("http://localhost/api/admin/dramas/bulk", {
      method: "POST",
      body: JSON.stringify({
        action: "publish",
        ids: [readyId, emptyId],
      }),
    });

    const res = await postBulkDramasRoute(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.total, 2);
    assert.equal(json.data.affected, 1);
    assert.equal(json.data.skipped, 1);
    assert.equal(json.data.errors.length, 1);
    assert.match(json.data.errors[0].error, /0 ready episodes/);

    // Verify ready drama became Published
    const readyDrama = mockTitles.find((t) => t.id === readyId);
    assert.equal(readyDrama.status, "Published");
    assert.equal(readyDrama.has_been_published, true);

    // Verify audit log was recorded
    assert.ok(mockAuditLogs.some((l) => l.action === "drama.bulk_publish" && l.entity_id === readyId));
  });

  /* -------------------------------------------------------------------------- */
  /* Test 8: Bulk Operations - Unpublish & Archive                              */
  /* -------------------------------------------------------------------------- */
  it("executes bulk unpublish and bulk archive on selected dramas", async () => {
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockAdminUser }, error: null }) },
    } as any));

    const ids = [
      "22222222-2222-4222-a222-222222222222",
      "22222222-2222-4222-a222-222222222223",
    ];

    // Bulk Archive
    const reqArchive = new NextRequest("http://localhost/api/admin/dramas/bulk", {
      method: "POST",
      body: JSON.stringify({
        action: "archive",
        ids,
      }),
    });
    const resArchive = await postBulkDramasRoute(reqArchive);
    assert.equal(resArchive.status, 200);
    const jsonArchive = await resArchive.json();
    assert.equal(jsonArchive.data.affected, 2);
    assert.equal(mockTitles.find((t) => t.id === ids[0]).status, "Archived");
    assert.equal(mockTitles.find((t) => t.id === ids[1]).status, "Archived");

    // Bulk Unpublish (Draft)
    const reqUnpublish = new NextRequest("http://localhost/api/admin/dramas/bulk", {
      method: "POST",
      body: JSON.stringify({
        action: "unpublish",
        ids,
      }),
    });
    const resUnpublish = await postBulkDramasRoute(reqUnpublish);
    assert.equal(resUnpublish.status, 200);
    const jsonUnpublish = await resUnpublish.json();
    assert.equal(jsonUnpublish.data.affected, 2);
    assert.equal(mockTitles.find((t) => t.id === ids[0]).status, "Draft");
    assert.equal(mockTitles.find((t) => t.id === ids[1]).status, "Draft");
  });

  /* -------------------------------------------------------------------------- */
  /* Test 9: Bulk Operations - Move Channel                                     */
  /* -------------------------------------------------------------------------- */
  it("bulk moves selected dramas to target channel and updates channel codes", async () => {
    setTestUserServerClientFactory(() => ({
      auth: { getUser: async () => ({ data: { user: mockAdminUser }, error: null }) },
    } as any));

    const ids = [
      "22222222-2222-4222-a222-222222222221",
      "22222222-2222-4222-a222-222222222222",
    ];

    const req = new NextRequest("http://localhost/api/admin/dramas/bulk", {
      method: "POST",
      body: JSON.stringify({
        action: "move_channel",
        ids,
        channelName: "ShortMax Global",
      }),
    });

    const res = await postBulkDramasRoute(req);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.affected, 2);

    const drama1 = mockTitles.find((t) => t.id === ids[0]);
    assert.equal(drama1.channel_name, "ShortMax Global");
    assert.equal(drama1.channel_code, "SM");
    assert.equal(drama1.channel_id, "c-2");

    // Audit entries
    const moveLogs = mockAuditLogs.filter((l) => l.action === "drama.bulk_move_channel");
    assert.equal(moveLogs.length, 2);
  });

  /* -------------------------------------------------------------------------- */
  /* Test 10: Public Page Guard & Signed Preview Mode Invariants                */
  /* -------------------------------------------------------------------------- */
  it("verifies public drama pages hide unpublished drafts unless valid preview token is provided", () => {
    const dramaPageFile = fs.readFileSync(path.resolve(process.cwd(), "app/drama/[slug]/page.tsx"), "utf8");
    const watchPageFile = fs.readFileSync(path.resolve(process.cwd(), "app/watch/[slug]/page.tsx"), "utf8");

    // Both files must import verifyPreviewToken and PreviewModeBanner
    assert.match(dramaPageFile, /verifyPreviewToken/);
    assert.match(dramaPageFile, /PreviewModeBanner/);
    assert.match(watchPageFile, /verifyPreviewToken/);
    assert.match(watchPageFile, /PreviewModeBanner/);

    // Both files must trigger notFound() when status is not Published and token invalid
    assert.match(dramaPageFile, /drama\.status !== "Published"/);
    assert.match(dramaPageFile, /notFound\(\)/);
    assert.match(watchPageFile, /drama\.status !== "Published"/);
    assert.match(watchPageFile, /notFound\(\)/);
  });
});
