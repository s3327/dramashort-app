import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { setTestContentAdminClientFactory, setTestContentClient } from "@/lib/supabase/content";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import type { User } from "@supabase/supabase-js";
import {
  validateChannelPayload,
  slugifyChannelName,
} from "@/lib/validation/channel";
import {
  validateArtworkFile,
  type ArtworkType,
} from "@/lib/validation/artwork";
import {
  getAdminChannelsServer,
  getAdminChannelByIdServer,
  createAdminChannelServer,
  updateAdminChannelServer,
  deleteAdminChannelServer,
} from "@/lib/server/admin-channels";
import { GET as getChannelsPublic } from "@/app/api/channels/route";
import {
  GET as getAdminChannelsRoute,
  POST as createAdminChannelRoute,
} from "@/app/api/admin/channels/route";
import {
  GET as getSingleChannelRoute,
  PATCH as updateChannelRoute,
  DELETE as deleteChannelRoute,
} from "@/app/api/admin/channels/[id]/route";
import { NextRequest } from "next/server";

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

function createMinimalPng(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  buf[4] = 0x0d;
  buf[5] = 0x0a;
  buf[6] = 0x1a;
  buf[7] = 0x0a;
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, 4, "ascii");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8;
  buf[25] = 6;
  buf[26] = 0;
  buf[27] = 0;
  buf[28] = 0;
  buf.writeUInt32BE(0, 29);
  return buf;
}

describe("Task 16.5: Channels Management", () => {
  let mockChannels: any[] = [];
  let mockTitles: any[] = [];
  let mockAuditLogs: any[] = [];

  function setupMockClients() {
    setTestContentAdminClientFactory(() => ({
      from: (table: string) => {
        let currentTable = table;
        let selectedRows: any[] = [];

        function getTargetStore() {
          if (currentTable === "channels") return mockChannels;
          if (currentTable === "titles") return mockTitles;
          if (currentTable === "admin_audit_log") return mockAuditLogs;
          return [];
        }

        const qb: any = {
          select: (cols = "*") => {
            selectedRows = [...getTargetStore()];
            return qb;
          },
          order: () => qb,
          eq: (field: string, val: any) => {
            selectedRows = selectedRows.filter((row) => row[field] === val);
            return qb;
          },
          neq: (field: string, val: any) => {
            selectedRows = selectedRows.filter((row) => row[field] !== val);
            return qb;
          },
          or: (condition: string) => {
            // rudimentary OR parsing for channel_id / channel_name
            const parts = condition.split(",");
            selectedRows = selectedRows.filter((row) => {
              return parts.some((p) => {
                if (p.includes("channel_id.eq.")) {
                  const idVal = p.replace("channel_id.eq.", "").trim();
                  return row.channel_id === idVal;
                }
                if (p.includes("channel_name.eq.")) {
                  const nameVal = p.replace("channel_name.eq.", "").replace(/"/g, "").trim();
                  return row.channel_name === nameVal;
                }
                return false;
              });
            });
            return qb;
          },
          single: async () => {
            if (selectedRows.length === 0) return { data: null, error: { message: "Not found" } };
            return { data: selectedRows[0], error: null };
          },
          maybeSingle: async () => {
            if (selectedRows.length === 0) return { data: null, error: null };
            return { data: selectedRows[0], error: null };
          },
          then: (resolve: any) =>
            resolve({ data: selectedRows, count: selectedRows.length, error: null }),
          insert: (data: any) => {
            const arr = Array.isArray(data) ? data : [data];
            const store = getTargetStore();
            const inserted = arr.map((item) => {
              const row = {
                id: item.id || `chan-${Math.random().toString(36).substring(2, 9)}`,
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
            };
          },
          update: (updates: any) => {
            return {
              eq: (field: string, val: any) => {
                const store = getTargetStore();
                let updatedRow: any = null;
                for (const row of store) {
                  if (row[field] === val) {
                    Object.assign(row, updates);
                    updatedRow = row;
                  }
                }
                return {
                  select: () => ({
                    single: async () => ({ data: updatedRow, error: null }),
                  }),
                };
              },
            };
          },
          delete: () => {
            return {
              eq: (field: string, val: any) => {
                const store = getTargetStore();
                const idx = store.findIndex((r) => r[field] === val);
                if (idx !== -1) {
                  store.splice(idx, 1);
                }
                return { error: null };
              },
            };
          },
        };

        return qb;
      },
    } as any));

    // Also mock public content client
    setTestContentClient({
      from: (table: string) => {
        let rows = table === "channels" ? mockChannels : [];
        const qb: any = {
          select: () => qb,
          order: () => qb,
          eq: (field: string, val: any) => {
            rows = rows.filter((r) => r[field] === val);
            return qb;
          },
          maybeSingle: async () => ({ data: rows[0] || null, error: null }),
          then: (resolve: any) => resolve({ data: rows, error: null }),
        };
        return qb;
      },
    } as any);
  }

  beforeEach(() => {
    mockChannels = [
      {
        id: "chan-1",
        name: "DramaShort Originals",
        slug: "dramashort-originals",
        code: "DSO",
        description: "In-house flagship productions",
        avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        banner_url: "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=1200",
        created_at: "2026-09-01T00:00:00Z",
      },
      {
        id: "chan-2",
        name: "Velvet Frame",
        slug: "velvet-frame",
        code: "VF",
        description: "Romantic melodrama studio",
        avatar_url: null,
        banner_url: null,
        created_at: "2026-09-02T00:00:00Z",
      },
    ];

    mockTitles = [
      {
        id: "title-1",
        title: "Reborn to Ruin Him",
        slug: "reborn-to-ruin-him-vf",
        channel_id: "chan-2",
        channel_name: "Velvet Frame",
        channel_code: "VF",
      },
      {
        id: "title-2",
        title: "Hidden Billionaire Heir",
        slug: "hidden-billionaire-heir-vf",
        channel_id: "chan-2",
        channel_name: "Velvet Frame",
        channel_code: "VF",
      },
    ];

    mockAuditLogs = [];
    setupMockClients();
  });

  // 1. SQL Migrations & Database Constraints
  test("1. defines channels operations migration with updated_at, indexes, and triggers", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261009150000_channels_operations.sql"
    );
    assert.ok(fs.existsSync(migrationPath), "Content migration file must exist");
    const sql = fs.readFileSync(migrationPath, "utf8");

    assert.match(sql, /ALTER\s+TABLE\s+public\.channels\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+updated_at/i);
    assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_channels_slug\s+ON\s+public\.channels\s*\(slug\)/i);
    assert.match(sql, /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_channels_code\s+ON\s+public\.channels\s*\(code\)/i);
    assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.set_channels_updated_at/i);
    assert.match(sql, /CREATE\s+TRIGGER\s+trg_set_channels_updated_at/i);

  });

  // 2. Channel Payload Validation
  test("2. validateChannelPayload enforces validation rules and auto-slug generation", () => {
    // Missing required fields on create
    const emptyRes = validateChannelPayload({}, "create");
    assert.equal(emptyRes.ok, false);

    // Auto slug derivation from name
    const validCreate = validateChannelPayload(
      {
        name: "Golden Hour Studios",
        code: "GHS",
        description: "Warm atmospheric short dramas",
      },
      "create"
    );
    assert.equal(validCreate.ok, true);
    if (validCreate.ok) {
      assert.equal(validCreate.value.name, "Golden Hour Studios");
      assert.equal(validCreate.value.code, "GHS");
      assert.equal(validCreate.value.slug, "golden-hour-studios");
      assert.equal(validCreate.value.description, "Warm atmospheric short dramas");
    }

    // Invalid code (too short or special characters)
    const invalidCode = validateChannelPayload(
      { name: "My Studio", code: "X" },
      "create"
    );
    assert.equal(invalidCode.ok, false);

    // Invalid slug (spaces or uppercase)
    const invalidSlug = validateChannelPayload(
      { name: "My Studio", code: "MS", slug: "Invalid Slug!" },
      "create"
    );
    assert.equal(invalidSlug.ok, false);

    // Image URL validation against allowed domain
    const validUrlPayload = validateChannelPayload(
      {
        name: "My Studio",
        code: "MS",
        avatarUrl: "https://images.unsplash.com/photo-1234?w=400",
      },
      "create"
    );
    assert.equal(validUrlPayload.ok, true);

    const invalidUrlPayload = validateChannelPayload(
      {
        name: "My Studio",
        code: "MS",
        avatarUrl: "https://disallowed-malicious-domain.com/evil.jpg",
      },
      "create"
    );
    assert.equal(invalidUrlPayload.ok, false);
  });

  // 3. Avatar Artwork Validation
  test("3. validateArtworkFile accepts ~1:1 square avatars and rejects non-square/undersized files", () => {
    // Valid square 200x200 PNG
    const validAvatar = createMinimalPng(200, 200);
    const validRes = validateArtworkFile(validAvatar, "image/png", "avatar");
    assert.equal(validRes.ok, true);

    // Rejects 16:9 banner buffer as avatar (aspect ratio mismatch)
    const wideBanner = createMinimalPng(640, 360);
    const wideRes = validateArtworkFile(wideBanner, "image/png", "avatar");
    assert.equal(wideRes.ok, false);
    if (!wideRes.ok) {
      assert.match(wideRes.error, /Invalid avatar aspect ratio/i);
    }

    // Rejects undersized avatar (50x50 < 100x100 min)
    const smallAvatar = createMinimalPng(50, 50);
    const smallRes = validateArtworkFile(smallAvatar, "image/png", "avatar");
    assert.equal(smallRes.ok, false);
    if (!smallRes.ok) {
      assert.match(smallRes.error, /too small/i);
    }
  });

  // 4. Server-Side Channels Operations Layer
  test("4. getAdminChannelsServer aggregates live drama counts from database", async () => {
    const list = await getAdminChannelsServer();
    assert.equal(list.length, 2);

    const dso = list.find((c) => c.slug === "dramashort-originals");
    const vf = list.find((c) => c.slug === "velvet-frame");

    assert.ok(dso, "DramaShort Originals must exist");
    assert.equal(dso.dramaCount, 0, "DSO should have 0 dramas");

    assert.ok(vf, "Velvet Frame must exist");
    assert.equal(vf.dramaCount, 2, "Velvet Frame should have 2 dramas");
  });

  test("5. createAdminChannelServer creates channel and enforces unique slug and code", async () => {
    // Conflict on duplicate slug
    const duplicateSlugRes = await createAdminChannelServer({
      name: "Duplicate Velvet",
      slug: "velvet-frame",
      code: "DV",
    });
    assert.equal(duplicateSlugRes.ok, false);

    // Conflict on duplicate code
    const duplicateCodeRes = await createAdminChannelServer({
      name: "Different Name",
      slug: "different-slug",
      code: "VF",
    });
    assert.equal(duplicateCodeRes.ok, false);

    // Successful creation
    const successRes = await createAdminChannelServer(
      {
        name: "Golden Hour Studios",
        code: "GHS",
        description: "Cinematic short dramas",
      },
      "admin@dramashort.com"
    );
    assert.equal(successRes.ok, true);
    if (successRes.ok) {
      assert.equal(successRes.value.name, "Golden Hour Studios");
      assert.equal(successRes.value.code, "GHS");
      assert.equal(successRes.value.slug, "golden-hour-studios");
      assert.equal(successRes.value.dramaCount, 0);
    }

    // Audit log recorded
    assert.equal(mockAuditLogs.length, 1);
    assert.equal(mockAuditLogs[0].action, "channel.create");
    assert.equal(mockAuditLogs[0].entity_type, "channel");
    assert.equal(mockAuditLogs[0].actor_email, "admin@dramashort.com");
  });

  test("6. updateAdminChannelServer updates metadata and logs audit trail", async () => {
    const updateRes = await updateAdminChannelServer(
      "chan-2",
      {
        name: "Velvet Frame Studios",
        code: "VFS",
      },
      "admin@dramashort.com"
    );

    assert.equal(updateRes.ok, true);
    if (updateRes.ok) {
      assert.equal(updateRes.value.name, "Velvet Frame Studios");
      assert.equal(updateRes.value.code, "VFS");
    }

    // Audit log recorded
    assert.equal(mockAuditLogs.length, 1);
    assert.equal(mockAuditLogs[0].action, "channel.update");
    assert.equal(mockAuditLogs[0].entity_id, "chan-2");
    assert.equal(mockAuditLogs[0].actor_email, "admin@dramashort.com");
  });

  test("7. deleteAdminChannelServer safeguards against deleting channels with assigned dramas", async () => {
    // Chan-2 has 2 active titles in mockTitles: deletion must be BLOCKED
    const blockedRes = await deleteAdminChannelServer("chan-2", "admin@dramashort.com");
    assert.equal(blockedRes.ok, false);
    if (!blockedRes.ok) {
      assert.match(blockedRes.error.message, /assigned to 2 dramas/i);
    }

    // DSO (chan-1) has 0 titles: deletion must SUCCEED
    const successRes = await deleteAdminChannelServer("chan-1", "admin@dramashort.com");
    assert.equal(successRes.ok, true);

    // Audit log recorded
    assert.equal(mockAuditLogs.length, 1);
    assert.equal(mockAuditLogs[0].action, "channel.delete");
    assert.equal(mockAuditLogs[0].entity_id, "chan-1");

    // Verify removed from store
    assert.equal(mockChannels.length, 1);
    assert.equal(mockChannels[0].id, "chan-2");
  });

  // 5. API Route Handlers
  test("8. GET /api/channels public endpoint returns cached channels", async () => {
    const res = await getChannelsPublic();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.channels));
    assert.equal(body.channels.length, 2);
    assert.equal(body.channels[0].name, "DramaShort Originals");
  });

  test("9. Admin API route handlers enforce admin authorization (401/403)", async () => {
    // Unauthenticated request
    setTestUserServerClientFactory(() => ({
      auth: {
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as any));

    const unauthRes = await getAdminChannelsRoute();
    assert.equal(unauthRes.status, 401);

    // Non-admin request
    setTestUserServerClientFactory(() => ({
      auth: {
        getUser: async () => ({ data: { user: mockRegularUser }, error: null }),
      },
    } as any));

    const forbiddenRes = await getAdminChannelsRoute();
    assert.equal(forbiddenRes.status, 403);
  });

  test("10. Admin API channel CRUD routes create, retrieve, update, and safely delete", async () => {
    // Authenticate as Admin
    setTestUserServerClientFactory(() => ({
      auth: {
        getUser: async () => ({ data: { user: mockAdminUser }, error: null }),
      },
    } as any));

    // 1. GET /api/admin/channels
    const getRes = await getAdminChannelsRoute();
    assert.equal(getRes.status, 200);
    const getBody = await getRes.json();
    assert.equal(getBody.success, true);
    assert.equal(getBody.data.channels.length, 2);

    // 2. POST /api/admin/channels
    const postReq = new NextRequest("http://localhost/api/admin/channels", {
      method: "POST",
      body: JSON.stringify({
        name: "Night Owls",
        code: "NO",
      }),
    });
    const postRes = await createAdminChannelRoute(postReq);
    assert.equal(postRes.status, 201);
    const postBody = await postRes.json();
    assert.equal(postBody.success, true);
    assert.equal(postBody.data.name, "Night Owls");
    const newChanId = postBody.data.id;

    // 3. GET /api/admin/channels/[id]
    const singleRes = await getSingleChannelRoute(
      new NextRequest(`http://localhost/api/admin/channels/${newChanId}`),
      { params: Promise.resolve({ id: newChanId }) }
    );
    assert.equal(singleRes.status, 200);
    const singleBody = await singleRes.json();
    assert.equal(singleBody.data.code, "NO");

    // 4. PATCH /api/admin/channels/[id]
    const patchReq = new NextRequest(`http://localhost/api/admin/channels/${newChanId}`, {
      method: "PATCH",
      body: JSON.stringify({
        description: "Late night suspense productions",
      }),
    });
    const patchRes = await updateChannelRoute(patchReq, {
      params: Promise.resolve({ id: newChanId }),
    });
    assert.equal(patchRes.status, 200);
    const patchBody = await patchRes.json();
    assert.equal(patchBody.data.description, "Late night suspense productions");

    // 5. DELETE /api/admin/channels/chan-2 (has 2 dramas -> 409 Conflict)
    const deleteBlockedRes = await deleteChannelRoute(
      new NextRequest("http://localhost/api/admin/channels/chan-2"),
      { params: Promise.resolve({ id: "chan-2" }) }
    );
    assert.equal(deleteBlockedRes.status, 409);
    const deleteBlockedBody = await deleteBlockedRes.json();
    assert.equal(deleteBlockedBody.error.code, "CONFLICT");

    // 6. DELETE /api/admin/channels/[newChanId] (has 0 dramas -> 200 OK)
    const deleteSuccessRes = await deleteChannelRoute(
      new NextRequest(`http://localhost/api/admin/channels/${newChanId}`),
      { params: Promise.resolve({ id: newChanId }) }
    );
    assert.equal(deleteSuccessRes.status, 200);
    const deleteSuccessBody = await deleteSuccessRes.json();
    assert.equal(deleteSuccessBody.data.deleted, true);
  });
});
