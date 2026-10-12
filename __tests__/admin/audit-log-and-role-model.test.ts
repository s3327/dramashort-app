import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  hasPermission,
  getRolePermissions,
  ROLE_PERMISSIONS,
  CONTENT_ROLES,
  ADMIN_ONLY_ROLES,
  type AdminPermission,
} from "@/lib/auth/permissions";
import { requireAdmin } from "@/lib/auth/require-admin";
import { computeAuditDiff, parseAuditLogsQueryParams } from "@/lib/validation/audit";
import { recordAuditLog, getAuditLogsServer } from "@/lib/server/audit";

describe("Task 16.9: Audit Log & Role Model", () => {
  // =========================================================================
  // 1. Database Migrations & Invariants
  // =========================================================================
  describe("Database Migration Integrity", () => {
    test("verifies audit log migration file exists in content and user DBs", () => {
      const contentMigration = path.join(
        process.cwd(),
        "supabase/migrations/20261009190000_audit_log_and_roles.sql"
      );
      const userMigration = path.join(
        process.cwd(),
        "supabase/user/supabase/migrations/20261009190000_audit_log_and_roles.sql"
      );

      assert.ok(fs.existsSync(contentMigration), "Content DB migration must exist");
      assert.ok(fs.existsSync(userMigration), "User DB migration mirror must exist");

      const contentSql = fs.readFileSync(contentMigration, "utf-8");
      assert.match(contentSql, /CREATE TABLE IF NOT EXISTS public\.admin_audit_log/i);
      assert.match(contentSql, /actor_id UUID/i);
      assert.match(contentSql, /actor_email TEXT/i);
      assert.match(contentSql, /action TEXT NOT NULL/i);
      assert.match(contentSql, /entity_type TEXT NOT NULL/i);
      assert.match(contentSql, /entity_id TEXT NOT NULL/i);
      assert.match(contentSql, /before JSONB/i);
      assert.match(contentSql, /after JSONB/i);
      assert.match(contentSql, /ip TEXT/i);
      assert.match(contentSql, /created_at TIMESTAMPTZ/i);
    });

    test("verifies indexes and RLS policies on admin_audit_log", () => {
      const contentMigration = path.join(
        process.cwd(),
        "supabase/migrations/20261009190000_audit_log_and_roles.sql"
      );
      const sql = fs.readFileSync(contentMigration, "utf-8");

      assert.match(sql, /idx_admin_audit_log_entity/i);
      assert.match(sql, /idx_admin_audit_log_created_at/i);
      assert.match(sql, /idx_admin_audit_log_actor/i);
      assert.match(sql, /idx_admin_audit_log_action/i);
      assert.match(sql, /ALTER TABLE public\.admin_audit_log ENABLE ROW LEVEL SECURITY/i);
      assert.match(sql, /Service role full access on admin_audit_log/i);
      assert.match(sql, /Admins can select admin_audit_log/i);
      assert.match(sql, /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.admin_audit_log FROM anon, authenticated/i);
    });
  });

  // =========================================================================
  // 2. Permissions Matrix & Role Model
  // =========================================================================
  describe("Permissions Matrix Contracts", () => {
    test("verifies editor role has access strictly to content domains and dashboard stats", () => {
      const editorPerms = getRolePermissions("editor");
      const expectedEditorPerms: AdminPermission[] = [
        "dramas:read",
        "dramas:write",
        "episodes:read",
        "episodes:write",
        "channels:read",
        "channels:write",
        "taxonomy:read",
        "taxonomy:write",
        "stats:read",
      ];

      for (const perm of expectedEditorPerms) {
        assert.ok(editorPerms.includes(perm), `Editor should have permission ${perm}`);
        assert.equal(hasPermission("editor", perm), true);
      }

      // Prohibited permissions for editor
      const forbiddenForEditor: AdminPermission[] = [
        "users:read",
        "users:write",
        "roles:write",
        "settings:read",
        "settings:write",
        "audit:read",
        "wallet:write",
      ];

      for (const perm of forbiddenForEditor) {
        assert.equal(
          editorPerms.includes(perm),
          false,
          `Editor MUST NOT have permission ${perm}`
        );
        assert.equal(hasPermission("editor", perm), false);
      }
    });

    test("verifies admin role has unrestricted superuser permissions across all scopes", () => {
      const adminPerms = getRolePermissions("admin");
      const allPermissions: AdminPermission[] = [
        "dramas:read",
        "dramas:write",
        "episodes:read",
        "episodes:write",
        "channels:read",
        "channels:write",
        "taxonomy:read",
        "taxonomy:write",
        "stats:read",
        "users:read",
        "users:write",
        "roles:write",
        "settings:read",
        "settings:write",
        "audit:read",
        "wallet:write",
      ];

      for (const perm of allPermissions) {
        assert.ok(adminPerms.includes(perm), `Admin must have permission ${perm}`);
        assert.equal(hasPermission("admin", perm), true);
      }
    });

    test("verifies unauthenticated or null roles have zero permissions", () => {
      assert.equal(hasPermission(null, "dramas:read"), false);
      assert.equal(hasPermission(undefined, "dramas:read"), false);
      assert.equal(hasPermission("user" as any, "dramas:read"), false);
      assert.deepEqual(getRolePermissions(null), []);
      assert.deepEqual(getRolePermissions(undefined), []);
    });

    test("verifies helper role groupings", () => {
      assert.deepEqual(CONTENT_ROLES, ["admin", "editor"]);
      assert.deepEqual(ADMIN_ONLY_ROLES, ["admin"]);
    });
  });

  // =========================================================================
  // 3. requireAdmin Guard Integration
  // =========================================================================
  describe("requireAdmin Guard Permission Enforcement", () => {
    const mockUserWithRole = (role: string | null) => ({
      id: "u-1234",
      email: "user@example.com",
      app_metadata: role ? { role } : {},
      user_metadata: {},
    });

    const createMockSupabase = (user: any | null) => ({
      auth: {
        getUser: async () => ({
          data: { user },
          error: user ? null : { message: "No active session" },
        }),
      },
    });

    test("allows editor when accessing route requiring dramas:write", async () => {
      const client = createMockSupabase(mockUserWithRole("editor"));
      const res = await requireAdmin({
        permission: "dramas:write",
        client,
      });

      assert.equal(res.authorized, true);
      if (res.authorized) {
        assert.equal(res.role, "editor");
      }
    });

    test("blocks editor with 403 when accessing route requiring audit:read", async () => {
      const client = createMockSupabase(mockUserWithRole("editor"));
      const res = await requireAdmin({
        permission: "audit:read",
        client,
      });

      assert.equal(res.authorized, false);
      if (!res.authorized) {
        assert.equal(res.response.status, 403);
        const body = await res.response.json();
        assert.equal(body.error.code, "FORBIDDEN");
        assert.match(body.error.message, /Missing required permission: audit:read/);
      }
    });

    test("blocks editor with 403 when accessing route requiring users:read", async () => {
      const client = createMockSupabase(mockUserWithRole("editor"));
      const res = await requireAdmin({
        permission: "users:read",
        client,
      });

      assert.equal(res.authorized, false);
      if (!res.authorized) {
        assert.equal(res.response.status, 403);
      }
    });

    test("allows admin access to audit:read and users:read", async () => {
      const client = createMockSupabase(mockUserWithRole("admin"));
      const res1 = await requireAdmin({ permission: "audit:read", client });
      const res2 = await requireAdmin({ permission: "users:read", client });

      assert.equal(res1.authorized, true);
      assert.equal(res2.authorized, true);
    });

    test("blocks unauthenticated callers with 401 Unauthorized", async () => {
      const client = createMockSupabase(null);
      const res = await requireAdmin({
        permission: "dramas:read",
        client,
      });

      assert.equal(res.authorized, false);
      if (!res.authorized) {
        assert.equal(res.response.status, 401);
      }
    });
  });

  // =========================================================================
  // 4. Query Parsing & Diff Computation
  // =========================================================================
  describe("Audit Query Parsing & Diff Engine", () => {
    test("parseAuditLogsQueryParams normalizes search parameters correctly", () => {
      const params = new URLSearchParams({
        actorEmail: "admin@test.com",
        entityType: "DRAMA",
        action: "drama.publish",
        page: "2",
        pageSize: "50",
        search: "alpha",
        sortDir: "asc",
      });

      const parsed = parseAuditLogsQueryParams(params);
      assert.equal(parsed.actorEmail, "admin@test.com");
      assert.equal(parsed.entityType, "drama");
      assert.equal(parsed.action, "drama.publish");
      assert.equal(parsed.page, 2);
      assert.equal(parsed.pageSize, 50);
      assert.equal(parsed.search, "alpha");
      assert.equal(parsed.sortDir, "asc");
    });

    test("parseAuditLogsQueryParams clamps pagination safely", () => {
      const params = new URLSearchParams({
        page: "-5",
        pageSize: "5000",
      });

      const parsed = parseAuditLogsQueryParams(params);
      assert.equal(parsed.page, 1);
      assert.equal(parsed.pageSize, 100);
      assert.equal(parsed.sortDir, "desc");
    });

    test("computeAuditDiff accurately detects added, removed, and modified fields", () => {
      const before = {
        title: "Old Drama Title",
        status: "Draft",
        totalEpisodes: 30,
        tags: ["romance"],
        legacyField: "deprecated",
      };

      const after = {
        title: "New Drama Title",
        status: "Published",
        totalEpisodes: 30, // Unchanged
        tags: ["romance", "drama"],
        newField: "active",
      };

      const diff = computeAuditDiff(before, after);

      // Added
      assert.ok("newField" in diff.added);
      assert.equal(diff.added.newField, "active");

      // Removed
      assert.ok("legacyField" in diff.removed);
      assert.equal(diff.removed.legacyField, "deprecated");

      // Changed
      assert.ok("title" in diff.changed);
      assert.equal(diff.changed.title.before, "Old Drama Title");
      assert.equal(diff.changed.title.after, "New Drama Title");

      assert.ok("status" in diff.changed);
      assert.equal(diff.changed.status.before, "Draft");
      assert.equal(diff.changed.status.after, "Published");

      assert.ok("tags" in diff.changed);

      // Unchanged count
      assert.equal(diff.unchangedCount, 1); // totalEpisodes
    });

    test("computeAuditDiff handles null or empty snapshots gracefully", () => {
      const diff1 = computeAuditDiff(null, { title: "Created" });
      assert.equal(diff1.added.title, "Created");
      assert.equal(Object.keys(diff1.removed).length, 0);

      const diff2 = computeAuditDiff({ title: "Deleted" }, null);
      assert.equal(diff2.removed.title, "Deleted");
      assert.equal(Object.keys(diff2.added).length, 0);
    });
  });

  // =========================================================================
  // 5. Server Operations & Audit Recording
  // =========================================================================
  describe("Audit Server Operations", () => {
    const createMockAuditClient = () => {
      const logsStore: any[] = [];
      return {
        _logs: logsStore,
        from: (table: string) => {
          assert.equal(table, "admin_audit_log");
          return {
            insert: async (row: any) => {
              logsStore.push({
                id: "log-" + (logsStore.length + 1),
                created_at: new Date().toISOString(),
                ...row,
              });
              return { error: null };
            },
            select: (_columns: string, _opts: any) => {
              let filtered = [...logsStore];
              const qb = {
                ilike: (field: string, pattern: string) => {
                  const cleaned = pattern.replace(/%/g, "").toLowerCase();
                  filtered = filtered.filter((r) =>
                    String(r[field] || "").toLowerCase().includes(cleaned)
                  );
                  return qb;
                },
                eq: (field: string, val: any) => {
                  filtered = filtered.filter((r) => r[field] === val);
                  return qb;
                },
                gte: (field: string, val: string) => {
                  filtered = filtered.filter((r) => r[field] >= val);
                  return qb;
                },
                lte: (field: string, val: string) => {
                  filtered = filtered.filter((r) => r[field] <= val);
                  return qb;
                },
                or: (_expr: string) => qb,
                order: (_field: string, _opts: any) => qb,
                range: (from: number, to: number) => {
                  const sliced = filtered.slice(from, to + 1);
                  return Promise.resolve({ data: sliced, count: filtered.length, error: null });
                },
                then: (resolve: any) =>
                  resolve({ data: filtered, count: filtered.length, error: null }),
              };
              return qb;
            },
          };
        },
      };
    };

    test("recordAuditLog safely executes and persists entry to mock database", async () => {
      const mockClient = createMockAuditClient();
      const recorded = await recordAuditLog(
        {
          actorId: "00000000-0000-0000-0000-000000000001",
          actorEmail: "admin@dramashort.app",
          action: "drama.publish",
          entityType: "drama",
          entityId: "11111111-1111-1111-1111-111111111111",
          before: { status: "Draft" },
          after: { status: "Published" },
          ip: "127.0.0.1",
        },
        mockClient
      );

      assert.equal(recorded, true);
      assert.equal(mockClient._logs.length, 1);
      assert.equal(mockClient._logs[0].action, "drama.publish");
      assert.equal(mockClient._logs[0].entity_type, "drama");
      assert.deepEqual(mockClient._logs[0].before, { status: "Draft" });
      assert.deepEqual(mockClient._logs[0].after, { status: "Published" });
    });

    test("getAuditLogsServer filters and paginates logs via server layer", async () => {
      const mockClient = createMockAuditClient();

      // Seed mock records
      await recordAuditLog(
        {
          actorId: "u-1",
          actorEmail: "admin@test.com",
          action: "drama.create",
          entityType: "drama",
          entityId: "d-1",
        },
        mockClient
      );
      await recordAuditLog(
        {
          actorId: "u-1",
          actorEmail: "admin@test.com",
          action: "channel.create",
          entityType: "channel",
          entityId: "c-1",
        },
        mockClient
      );
      await recordAuditLog(
        {
          actorId: "u-2",
          actorEmail: "other@test.com",
          action: "user.ban",
          entityType: "user",
          entityId: "u-99",
        },
        mockClient
      );

      // Query entityType: drama
      const res = await getAuditLogsServer(
        {
          entityType: "drama",
          page: 1,
          pageSize: 10,
        },
        mockClient
      );

      assert.ok(res.ok);
      if (res.ok) {
        assert.equal(res.value.total, 1);
        assert.equal(res.value.entries.length, 1);
        assert.equal(res.value.entries[0].action, "drama.create");
        assert.equal(res.value.entries[0].entityType, "drama");
      }
    });
  });

  // =========================================================================
  // 6. Navigation & Sidebar Contracts
  // =========================================================================
  describe("Admin Sidebar Navigation Contracts", () => {
    test("verifies AdminSidebar includes Audit Log navigation item", () => {
      const sidebarPath = path.join(process.cwd(), "components/admin/AdminSidebar.tsx");
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.match(content, /Audit Log/i);
      assert.match(content, /\/admin\/audit/);
    });

    test("verifies Audit Viewer page exists and exports React component", () => {
      const auditPagePath = path.join(process.cwd(), "app/admin/audit/page.tsx");
      assert.ok(fs.existsSync(auditPagePath), "Audit viewer page must exist");
      const content = fs.readFileSync(auditPagePath, "utf-8");

      assert.match(content, /export default function AdminAuditPage/);
      assert.match(content, /Visual Diff/);
      assert.match(content, /Raw JSON/);
      assert.match(content, /computeAuditDiff/);
    });
  });
});
