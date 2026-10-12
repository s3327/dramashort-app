import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateBanUserPayload,
  validateUnbanUserPayload,
  validateUpdateRolePayload,
  parseAdminUsersQueryParams,
} from "@/lib/validation/user-admin";
import {
  getAdminUsersServer,
  getAdminUserDetailServer,
  banUserServer,
  unbanUserServer,
  forceSignOutUserServer,
  updateUserRoleServer,
} from "@/lib/server/admin-users";
import { setTestUserServiceRoleClientFactory, setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestContentAdminClientFactory } from "@/lib/supabase/content";
import { GET as getAdminUsersHandler } from "@/app/api/admin/users/route";
import { GET as getAdminUserDetailHandler } from "@/app/api/admin/users/[id]/route";
import { POST as banUserHandler } from "@/app/api/admin/users/[id]/ban/route";
import { POST as unbanUserHandler } from "@/app/api/admin/users/[id]/unban/route";
import { POST as signOutUserHandler } from "@/app/api/admin/users/[id]/signout/route";
import { PATCH as updateRoleHandler } from "@/app/api/admin/users/[id]/role/route";
import { NextRequest } from "next/server";

describe("Task 16.7: User Management Console", () => {
  let mockAuthUsers: any[] = [];
  let mockProfiles: any[] = [];
  let mockFavorites: any[] = [];
  let mockWatchHistory: any[] = [];
  let mockAuditLogs: any[] = [];

  beforeEach(() => {
    mockAuthUsers = [
      {
        id: "u-admin-1",
        email: "superadmin@dramashort.com",
        app_metadata: { role: "admin", provider: "email" },
        user_metadata: { full_name: "Super Admin" },
        created_at: "2026-01-01T00:00:00Z",
        last_sign_in_at: "2026-10-09T00:00:00Z",
        banned_until: null,
      },
      {
        id: "u-editor-1",
        email: "editor1@dramashort.com",
        app_metadata: { role: "editor", providers: ["google"] },
        user_metadata: { full_name: "Editor One" },
        created_at: "2026-02-01T00:00:00Z",
        last_sign_in_at: "2026-10-08T00:00:00Z",
        banned_until: null,
      },
      {
        id: "u-user-1",
        email: "fan1@example.com",
        app_metadata: { role: "user", providers: ["telegram"] },
        user_metadata: { full_name: "Drama Fan" },
        created_at: "2026-03-01T00:00:00Z",
        last_sign_in_at: "2026-10-07T00:00:00Z",
        banned_until: null,
      },
      {
        id: "u-user-banned",
        email: "spammer@example.com",
        app_metadata: { role: "user" },
        user_metadata: { full_name: "Bad Actor" },
        created_at: "2026-04-01T00:00:00Z",
        last_sign_in_at: "2026-04-02T00:00:00Z",
        banned_until: "2099-01-01T00:00:00Z",
      },
    ];

    mockProfiles = [
      {
        id: "u-admin-1",
        display_name: "Super Admin",
        avatar_url: null,
        role: "admin",
        is_banned: false,
        banned_until: null,
        ban_reason: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "u-editor-1",
        display_name: "Editor One",
        avatar_url: null,
        role: "editor",
        is_banned: false,
        banned_until: null,
        ban_reason: null,
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-01T00:00:00Z",
      },
      {
        id: "u-user-1",
        display_name: "Drama Fan",
        avatar_url: null,
        role: "user",
        is_banned: false,
        banned_until: null,
        ban_reason: null,
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-03-01T00:00:00Z",
      },
      {
        id: "u-user-banned",
        display_name: "Bad Actor",
        avatar_url: null,
        role: "user",
        is_banned: true,
        banned_until: "2099-01-01T00:00:00Z",
        ban_reason: "Spamming comments",
        created_at: "2026-04-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
      },
    ];

    mockFavorites = [
      { id: "fav-1", user_id: "u-user-1", title_slug: "ceo-secret-wife-ds" },
      { id: "fav-2", user_id: "u-user-1", title_slug: "revenge-of-heiress" },
      { id: "fav-3", user_id: "u-editor-1", title_slug: "ceo-secret-wife-ds" },
    ];

    mockWatchHistory = [
      { id: "wh-1", user_id: "u-user-1", title_slug: "ceo-secret-wife-ds", episode_number: 1, updated_at: "2026-10-07T00:00:00Z" },
      { id: "wh-2", user_id: "u-user-1", title_slug: "revenge-of-heiress", episode_number: 5, updated_at: "2026-10-08T00:00:00Z" },
      { id: "wh-3", user_id: "u-user-1", title_slug: "billionaire-mask", episode_number: 2, updated_at: "2026-10-09T00:00:00Z" },
    ];

    mockAuditLogs = [];

    // Mock user service role client
    setTestUserServiceRoleClientFactory(() => {
      return {
        auth: {
          admin: {
            listUsers: async () => ({
              data: { users: mockAuthUsers.map((u) => ({ ...u })) },
              error: null,
            }),
            getUserById: async (uid: string) => {
              const found = mockAuthUsers.find((u) => u.id === uid);
              return found
                ? { data: { user: { ...found } }, error: null }
                : { data: { user: null }, error: { message: "User not found" } };
            },
            updateUserById: async (uid: string, attrs: any) => {
              const target = mockAuthUsers.find((u) => u.id === uid);
              if (!target) return { data: { user: null }, error: { message: "User not found" } };
              if (attrs.ban_duration) {
                if (attrs.ban_duration === "none") {
                  target.banned_until = null;
                } else {
                  target.banned_until = "2099-01-01T00:00:00Z";
                }
              }
              if (attrs.app_metadata) {
                target.app_metadata = { ...target.app_metadata, ...attrs.app_metadata };
              }
              return { data: { user: { ...target } }, error: null };
            },
            signOut: async (_uid: string) => ({ data: null, error: null }),
          },
        },
        from: (table: string) => {
          if (table === "profiles") {
            return {
              select: (_cols?: string) => ({
                eq: (_col: string, val: any) => ({
                  maybeSingle: async () => {
                    const item = mockProfiles.find((p) => p.id === val);
                    return { data: item ? { ...item } : null, error: null };
                  },
                }),
                then: (resolve: any) => resolve({ data: mockProfiles.map((p) => ({ ...p })), error: null }),
              }),
              update: (updates: any) => ({
                eq: async (_col: string, val: any) => {
                  const idx = mockProfiles.findIndex((p) => p.id === val);
                  if (idx >= 0) {
                    mockProfiles[idx] = { ...mockProfiles[idx], ...updates };
                  }
                  return { data: null, error: null };
                },
              }),
            };
          }
          if (table === "favorites") {
            return {
              select: (_cols?: string, _opts?: any) => ({
                in: async (_col: string, ids: string[]) => ({
                  data: mockFavorites.filter((f) => ids.includes(f.user_id)),
                  error: null,
                }),
                eq: (_col: string, val: string) => {
                  const filtered = mockFavorites.filter((f) => f.user_id === val);
                  return {
                    then: (resolve: any) => resolve({ data: filtered, count: filtered.length, error: null }),
                  };
                },
              }),
            };
          }
          if (table === "watch_history") {
            return {
              select: (_cols?: string, _opts?: any) => ({
                in: async (_col: string, ids: string[]) => ({
                  data: mockWatchHistory.filter((w) => ids.includes(w.user_id)),
                  error: null,
                }),
                eq: (_col: string, val: string) => ({
                  order: (_col2: string, _opts2: any) => ({
                    limit: async (lim: number) => {
                      const filtered = mockWatchHistory.filter((w) => w.user_id === val);
                      return { data: filtered.slice(0, lim), count: filtered.length, error: null };
                    },
                  }),
                  then: (resolve: any) => {
                    const filtered = mockWatchHistory.filter((w) => w.user_id === val);
                    return resolve({ data: filtered, count: filtered.length, error: null });
                  },
                }),
              }),
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };
    });

    // Mock Content DB for audit log
    setTestContentAdminClientFactory(() => ({
      from: (table: string) => {
        if (table === "admin_audit_log") {
          return {
            insert: async (entry: any) => {
              mockAuditLogs.push(entry);
              return { data: null, error: null };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    }));
  });

  after(() => {
    setTestUserServiceRoleClientFactory(null);
    setTestContentAdminClientFactory(null);
    setTestUserServerClientFactory(null);
  });

  // --------------------------------------------------------------------------
  // 1. Database Schema & Migration Invariants
  // --------------------------------------------------------------------------
  describe("Database Migration Contracts", () => {
    const userMigrationPath = path.join(
      process.cwd(),
      "supabase/user/supabase/migrations/20261009170000_admin_user_management.sql"
    );
    const contentMigrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261009170000_admin_user_management.sql"
    );

    it("verifies migration file exists in both User and Content database migration suites", () => {
      assert.ok(fs.existsSync(userMigrationPath), "User DB migration file must exist");
      assert.ok(fs.existsSync(contentMigrationPath), "Content DB migration file must exist");
    });

    it("verifies migration expands profiles.role check constraint to include editor", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");
      assert.ok(
        sql.includes("CHECK (role IN ('user', 'editor', 'admin'))"),
        "Migration must allow 'user', 'editor', 'admin' in profiles.role check constraint"
      );
    });

    it("verifies migration adds is_banned, banned_until, and ban_reason columns to profiles", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");
      assert.ok(sql.includes("is_banned BOOLEAN NOT NULL DEFAULT FALSE"), "Must add is_banned column");
      assert.ok(sql.includes("banned_until TIMESTAMPTZ"), "Must add banned_until column");
      assert.ok(sql.includes("ban_reason TEXT"), "Must add ban_reason column");
    });

    it("verifies migration defines performance indexes and grants service_role permissions", () => {
      const sql = fs.readFileSync(userMigrationPath, "utf-8");
      assert.ok(sql.includes("CREATE INDEX IF NOT EXISTS idx_profiles_role"), "Must index profiles.role");
      assert.ok(sql.includes("CREATE INDEX IF NOT EXISTS idx_profiles_is_banned"), "Must index profiles.is_banned");
      assert.ok(sql.includes("GRANT ALL ON TABLE public.profiles TO service_role"), "Must grant service_role privileges");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Validation Rules & Query Parsing
  // --------------------------------------------------------------------------
  describe("Payload Validation & Query Normalization", () => {
    it("validates role update payload accepting only user, editor, admin", () => {
      const validAdmin = validateUpdateRolePayload({ role: "admin" });
      assert.equal(validAdmin.ok, true);
      assert.equal(validAdmin.value?.role, "admin");

      const validEditor = validateUpdateRolePayload({ role: "editor" });
      assert.equal(validEditor.ok, true);
      assert.equal(validEditor.value?.role, "editor");

      const validUser = validateUpdateRolePayload({ role: "user" });
      assert.equal(validUser.ok, true);
      assert.equal(validUser.value?.role, "user");

      const invalidRole = validateUpdateRolePayload({ role: "superadmin" });
      assert.equal(invalidRole.ok, false);
      assert.ok(invalidRole.errors.length > 0);

      const emptyRole = validateUpdateRolePayload({});
      assert.equal(emptyRole.ok, false);
    });

    it("validates ban payload duration presets and reason constraints", () => {
      const permanentBan = validateBanUserPayload({ duration: "permanent", reason: "Policy violation" });
      assert.equal(permanentBan.ok, true);
      assert.equal(permanentBan.value?.duration, "876000h");
      assert.equal(permanentBan.value?.reason, "Policy violation");

      const hoursBan = validateBanUserPayload({ duration: "168h" });
      assert.equal(hoursBan.ok, true);
      assert.equal(hoursBan.value?.duration, "168h");

      const invalidDuration = validateBanUserPayload({ duration: "2days" });
      assert.equal(invalidDuration.ok, false);
      assert.ok(invalidDuration.errors.some((e) => e.field === "duration"));

      const excessiveReason = validateBanUserPayload({ reason: "a".repeat(501) });
      assert.equal(excessiveReason.ok, false);
      assert.ok(excessiveReason.errors.some((e) => e.field === "reason"));
    });

    it("parses query parameters with proper defaults and boundary clamping", () => {
      const emptyParams = new URLSearchParams();
      const parsedDefault = parseAdminUsersQueryParams(emptyParams);
      assert.equal(parsedDefault.page, 1);
      assert.equal(parsedDefault.pageSize, 10);
      assert.equal(parsedDefault.status, "all");
      assert.equal(parsedDefault.role, "all");
      assert.equal(parsedDefault.sortBy, "createdAt");
      assert.equal(parsedDefault.sortDir, "desc");

      const customParams = new URLSearchParams({
        page: "3",
        pageSize: "25",
        query: "alice",
        status: "active",
        role: "editor",
        sortBy: "displayName",
        sortDir: "asc",
      });
      const parsedCustom = parseAdminUsersQueryParams(customParams);
      assert.equal(parsedCustom.page, 3);
      assert.equal(parsedCustom.pageSize, 25);
      assert.equal(parsedCustom.query, "alice");
      assert.equal(parsedCustom.status, "active");
      assert.equal(parsedCustom.role, "editor");
      assert.equal(parsedCustom.sortBy, "displayName");
      assert.equal(parsedCustom.sortDir, "asc");

      // Clamping page size max 100
      const largeParams = new URLSearchParams({ pageSize: "500", page: "-5" });
      const parsedClamped = parseAdminUsersQueryParams(largeParams);
      assert.equal(parsedClamped.pageSize, 100);
      assert.equal(parsedClamped.page, 1);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Server Operations & Audit Invariants
  // --------------------------------------------------------------------------
  describe("Server Operations & RBAC Guards", () => {
    it("retrieves paginated users with joined profiles and engagement counts", async () => {
      const result = await getAdminUsersServer({ page: 1, pageSize: 10 });
      assert.equal(result.items.length, 4);
      assert.equal(result.pagination.total, 4);

      // Verify engagement count aggregations on u-user-1
      const user1 = result.items.find((u) => u.id === "u-user-1");
      assert.ok(user1, "u-user-1 must exist in list");
      assert.equal(user1.favoritesCount, 2, "u-user-1 has 2 favorites");
      assert.equal(user1.watchHistoryCount, 3, "u-user-1 has 3 watch history items");
      assert.equal(user1.role, "user");
      assert.equal(user1.isBanned, false);
      assert.deepEqual(user1.socialLogins, ["telegram"]);

      // Verify banned user detection
      const bannedUser = result.items.find((u) => u.id === "u-user-banned");
      assert.ok(bannedUser, "u-user-banned must exist");
      assert.equal(bannedUser.isBanned, true);
    });

    it("filters users by status (active vs banned) and role", async () => {
      const activeUsers = await getAdminUsersServer({ status: "active" });
      assert.equal(activeUsers.items.length, 3);
      assert.ok(!activeUsers.items.some((u) => u.isBanned));

      const bannedUsers = await getAdminUsersServer({ status: "banned" });
      assert.equal(bannedUsers.items.length, 1);
      assert.equal(bannedUsers.items[0].id, "u-user-banned");

      const editorUsers = await getAdminUsersServer({ role: "editor" });
      assert.equal(editorUsers.items.length, 1);
      assert.equal(editorUsers.items[0].id, "u-editor-1");
    });

    it("searches users by email or displayName", async () => {
      const searchEmail = await getAdminUsersServer({ query: "superadmin" });
      assert.equal(searchEmail.items.length, 1);
      assert.equal(searchEmail.items[0].id, "u-admin-1");

      const searchName = await getAdminUsersServer({ query: "Fan" });
      assert.equal(searchName.items.length, 1);
      assert.equal(searchName.items[0].id, "u-user-1");
    });

    it("bans a user, updates profiles, and writes structured audit log", async () => {
      const actor = { id: "u-admin-1", email: "superadmin@dramashort.com", ip: "127.0.0.1" };
      const banned = await banUserServer("u-user-1", { duration: "168h", reason: "TOS violation" }, actor);

      assert.equal(banned.isBanned, true);
      assert.equal(banned.banReason, "TOS violation");
      assert.ok(banned.bannedUntil !== null);

      // Verify audit log entry
      const audit = mockAuditLogs.find((l) => l.action === "user.ban");
      assert.ok(audit, "Must create user.ban audit record");
      assert.equal(audit.actor_id, "u-admin-1");
      assert.equal(audit.entity_id, "u-user-1");
      assert.equal(audit.entity_type, "user");
      assert.equal(audit.after.banReason, "TOS violation");
    });

    it("unbans a user, resets profile columns, and writes structured audit log", async () => {
      const actor = { id: "u-admin-1", email: "superadmin@dramashort.com" };
      const unbanned = await unbanUserServer("u-user-banned", { reason: "Appeal approved" }, actor);

      assert.equal(unbanned.isBanned, false);
      assert.equal(unbanned.bannedUntil, null);
      assert.equal(unbanned.banReason, null);

      const audit = mockAuditLogs.find((l) => l.action === "user.unban");
      assert.ok(audit, "Must create user.unban audit record");
      assert.equal(audit.actor_id, "u-admin-1");
      assert.equal(audit.entity_id, "u-user-banned");
    });

    it("prevents self-ban by administrative actor", async () => {
      const actor = { id: "u-admin-1", email: "superadmin@dramashort.com" };
      await assert.rejects(
        () => banUserServer("u-admin-1", { duration: "24h" }, actor),
        (err: Error) => /Cannot ban your own/i.test(err.message)
      );
    });

    it("updates user role across auth metadata and profiles table with audit trail", async () => {
      const actor = { id: "u-admin-1", email: "superadmin@dramashort.com" };
      const updated = await updateUserRoleServer("u-user-1", "editor", actor);

      assert.equal(updated.role, "editor");

      // Verify audit record
      const audit = mockAuditLogs.find((l) => l.action === "user.role_change");
      assert.ok(audit, "Must create user.role_change audit record");
      assert.equal(audit.actor_id, "u-admin-1");
      assert.equal(audit.entity_id, "u-user-1");
      assert.equal(audit.before.role, "user");
      assert.equal(audit.after.role, "editor");
    });

    it("prevents self-demotion from admin role", async () => {
      const actor = { id: "u-admin-1", email: "superadmin@dramashort.com" };
      await assert.rejects(
        () => updateUserRoleServer("u-admin-1", "user", actor),
        (err: Error) => /Cannot remove admin privileges/i.test(err.message)
      );
    });

    it("forces user sign-out and logs audit entry", async () => {
      const actor = { id: "u-admin-1", email: "superadmin@dramashort.com" };
      const res = await forceSignOutUserServer("u-user-1", actor);

      assert.equal(res.success, true);
      assert.equal(res.userId, "u-user-1");

      const audit = mockAuditLogs.find((l) => l.action === "user.force_signout");
      assert.ok(audit, "Must create user.force_signout audit record");
      assert.equal(audit.entity_id, "u-user-1");
    });

    it("retrieves detailed user profile with engagement stats", async () => {
      const detail = await getAdminUserDetailServer("u-user-1");
      assert.ok(detail, "User detail must exist");
      assert.equal(detail.id, "u-user-1");
      assert.equal(detail.watchHistoryCount, 3);
      assert.equal(detail.favoritesCount, 2);
      assert.ok(detail.recentActivity?.lastWatchedTitle, "Must have recent activity");
    });
  });

  // --------------------------------------------------------------------------
  // 4. REST API Route Handlers & RBAC Protection (Editor -> 403 Forbidden)
  // --------------------------------------------------------------------------
  describe("API Route Handlers & Security Enforcement", () => {
    function createMockRequest(url: string, method: string = "GET", body?: any): NextRequest {
      const init: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };
      if (body) {
        init.body = JSON.stringify(body);
      }
      return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
    }

    it("DENIES access with 403 FORBIDDEN when user has editor role (protects PII)", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "editor-user-id",
                email: "editor@dramashort.com",
                app_metadata: { role: "editor" },
              },
            },
            error: null,
          }),
        },
      }));

      try {
        const req = createMockRequest("/api/admin/users");
        const res = await getAdminUsersHandler(req);
        assert.equal(res.status, 403, "Editor must receive 403 FORBIDDEN for user listing");

        const json = await res.json();
        assert.equal(json.error.code, "FORBIDDEN");
        assert.match(json.error.message, /Administrator privileges required/);

        // Verify other user management endpoints also deny editor
        const banReq = createMockRequest("/api/admin/users/u-user-1/ban", "POST", { duration: "24h" });
        const banRes = await banUserHandler(banReq, { params: Promise.resolve({ id: "u-user-1" }) });
        assert.equal(banRes.status, 403, "Editor must receive 403 FORBIDDEN for ban action");

        const roleReq = createMockRequest("/api/admin/users/u-user-1/role", "PATCH", { role: "editor" });
        const roleRes = await updateRoleHandler(roleReq, { params: Promise.resolve({ id: "u-user-1" }) });
        assert.equal(roleRes.status, 403, "Editor must receive 403 FORBIDDEN for role mutation");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("DENIES unauthenticated guest requests with 401 UNAUTHORIZED", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: { message: "No session" } }),
        },
      }));

      try {
        const req = createMockRequest("/api/admin/users");
        const res = await getAdminUsersHandler(req);
        assert.equal(res.status, 401, "Unauthenticated request must receive 401");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("AUTHORIZES admin requests with HTTP 200 OK", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "admin-actor-id",
                email: "admin@dramashort.com",
                app_metadata: { role: "admin" },
              },
            },
            error: null,
          }),
        },
      }));

      try {
        const req = createMockRequest("/api/admin/users?page=1&pageSize=10");
        const res = await getAdminUsersHandler(req);
        assert.equal(res.status, 200, "Admin must be granted HTTP 200");

        const json = await res.json();
        assert.ok(Array.isArray(json.data.items), "Must return items array");
        assert.ok(json.data.pagination, "Must return pagination object");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });

    it("GET /api/admin/users/[id] returns user detail for admin", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "admin-actor-id",
                email: "admin@dramashort.com",
                app_metadata: { role: "admin" },
              },
            },
            error: null,
          }),
        },
      }));

      try {
        const req = createMockRequest("/api/admin/users/u-user-1");
        const res = await getAdminUserDetailHandler(req, { params: Promise.resolve({ id: "u-user-1" }) });
        assert.equal(res.status, 200);

        const json = await res.json();
        assert.equal(json.data.id, "u-user-1");
        assert.equal(json.data.role, "user");
      } finally {
        setTestUserServerClientFactory(null);
      }
    });
  });
});
