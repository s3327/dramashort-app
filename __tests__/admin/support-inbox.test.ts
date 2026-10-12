import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseSupportTicketsQueryParams,
  validateUpdateSupportTicket,
  validateReplySupportTicket,
} from "@/lib/validation/support";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getAdminSupportTicketsServer,
  getAdminSupportTicketByIdServer,
  updateAdminSupportTicketServer,
  replyAdminSupportTicketServer,
  mapSupportTicketRowToItem,
} from "@/lib/server/admin-support";

describe("Task 16.10: Support Inbox & Admin Responsiveness", () => {
  describe("Database Migration Integrity (20261009200000_support_inbox_and_admin_features.sql)", () => {
    test("migration files exist in User and Content DB directories", () => {
      const userMigPath = path.resolve(
        process.cwd(),
        "supabase/user/supabase/migrations/20261009200000_support_inbox_and_admin_features.sql"
      );
      const contentMigPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261009200000_support_inbox_and_admin_features.sql"
      );

      assert.ok(fs.existsSync(userMigPath), "User DB migration file must exist");
      assert.ok(fs.existsSync(contentMigPath), "Content DB migration file must exist");

      const userSql = fs.readFileSync(userMigPath, "utf-8");
      const contentSql = fs.readFileSync(contentMigPath, "utf-8");

      for (const sql of [userSql, contentSql]) {
        assert.ok(sql.includes("assigned_to"), "Must add assigned_to column");
        assert.ok(sql.includes("assigned_email"), "Must add assigned_email column");
        assert.ok(sql.includes("priority"), "Must add priority column");
        assert.ok(sql.includes("admin_notes"), "Must add admin_notes column");
        assert.ok(sql.includes("resolved_at"), "Must add resolved_at column");
        assert.ok(sql.includes("resolved_by"), "Must add resolved_by column");
        assert.ok(sql.includes("updated_at"), "Must add updated_at column");
        assert.ok(sql.includes("idx_support_tickets_assigned_to"), "Must create assigned_to index");
        assert.ok(sql.includes("idx_support_tickets_priority"), "Must create priority index");
        assert.ok(sql.includes("trg_support_tickets_updated_at"), "Must create updated_at trigger");
        assert.ok(sql.includes("ENABLE ROW LEVEL SECURITY"), "Must enable RLS");
        assert.ok(sql.includes("GRANT ALL ON TABLE public.support_tickets TO service_role"), "Must grant service_role permissions");
      }
    });
  });

  describe("Permissions Matrix & Security Contracts", () => {
    test("verifies admin role has support:read and support:write permissions", () => {
      assert.strictEqual(hasPermission("admin", "support:read"), true);
      assert.strictEqual(hasPermission("admin", "support:write"), true);
    });

    test("verifies editor role is blocked from support permissions (protecting user PII)", () => {
      assert.strictEqual(hasPermission("editor", "support:read"), false);
      assert.strictEqual(hasPermission("editor", "support:write"), false);
    });

    test("verifies regular user or null role has zero support permissions", () => {
      assert.strictEqual(hasPermission("user" as any, "support:read"), false);
      assert.strictEqual(hasPermission("user" as any, "support:write"), false);
      assert.strictEqual(hasPermission(null, "support:read"), false);
      assert.strictEqual(hasPermission(undefined, "support:write"), false);
    });
  });

  describe("Query Parsing & Validation Engine", () => {
    test("parseSupportTicketsQueryParams normalizes defaults and valid params", () => {
      const parsed = parseSupportTicketsQueryParams({
        page: "2",
        pageSize: "15",
        status: "open",
        category: "playback",
        priority: "urgent",
        search: "  video lag  ",
      });

      assert.strictEqual(parsed.page, 2);
      assert.strictEqual(parsed.pageSize, 15);
      assert.strictEqual(parsed.status, "open");
      assert.strictEqual(parsed.category, "playback");
      assert.strictEqual(parsed.priority, "urgent");
      assert.strictEqual(parsed.search, "video lag");
    });

    test("parseSupportTicketsQueryParams clamps page and pageSize safely", () => {
      const parsed = parseSupportTicketsQueryParams({
        page: "-5",
        pageSize: "500",
        status: "invalid_status",
        category: "fake_category",
        priority: "unknown",
      });

      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.pageSize, 100); // Max clamped to 100
      assert.strictEqual(parsed.status, "all"); // Fallback to all
      assert.strictEqual(parsed.category, "all");
      assert.strictEqual(parsed.priority, "all");
    });

    test("validateUpdateSupportTicket validates input mutations", () => {
      const valid = validateUpdateSupportTicket({
        status: "resolved",
        priority: "high",
        adminNotes: "Investigated stream CDN issue.",
      });
      assert.strictEqual(valid.ok, true);
      if (valid.ok) {
        assert.strictEqual(valid.value.status, "resolved");
        assert.strictEqual(valid.value.priority, "high");
        assert.strictEqual(valid.value.adminNotes, "Investigated stream CDN issue.");
      }

      const invalidStatus = validateUpdateSupportTicket({ status: "not_a_status" });
      assert.strictEqual(invalidStatus.ok, false);

      const invalidPriority = validateUpdateSupportTicket({ priority: "critical" });
      assert.strictEqual(invalidPriority.ok, false);

      const invalidType = validateUpdateSupportTicket("not-an-object");
      assert.strictEqual(invalidType.ok, false);
    });

    test("validateReplySupportTicket validates reply payloads", () => {
      const valid = validateReplySupportTicket({
        replyMessage: "We have patched the audio stream for episode 3.",
        newStatus: "resolved",
      });
      assert.strictEqual(valid.ok, true);
      if (valid.ok) {
        assert.strictEqual(valid.value.replyMessage, "We have patched the audio stream for episode 3.");
        assert.strictEqual(valid.value.newStatus, "resolved");
      }

      const tooShort = validateReplySupportTicket({ replyMessage: "Hi" });
      assert.strictEqual(tooShort.ok, false);

      const missing = validateReplySupportTicket({});
      assert.strictEqual(missing.ok, false);
    });
  });

  describe("Server Operations & Mock Data Layer", () => {
    const mockTicketsDb: any[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "user-123",
        email: "alice@example.com",
        category: "playback",
        subject: "Video freezing on Episode 4",
        message: "The video stops playing around 1 minute 45 seconds.",
        context: {
          titleSlug: "the-billionaire-secret",
          titleName: "The Billionaire Secret",
          episodeNumber: 4,
          playbackTime: 105,
        },
        status: "open",
        priority: "high",
        assigned_to: null,
        assigned_email: null,
        admin_notes: null,
        resolved_at: null,
        resolved_by: null,
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        user_id: null,
        email: "guest@example.com",
        category: "general",
        subject: "Question about subtitle options",
        message: "Do you support Spanish subtitles?",
        context: {},
        status: "in_progress",
        priority: "normal",
        assigned_to: "admin-1",
        assigned_email: "admin@dramashort.com",
        admin_notes: "Checked with localization team.",
        resolved_at: null,
        resolved_by: null,
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        user_id: "user-456",
        email: "bob@example.com",
        category: "billing",
        subject: "Double coin charge refund",
        message: "I was charged twice when unlocking episode 10.",
        context: {},
        status: "resolved",
        priority: "urgent",
        assigned_to: "admin-1",
        assigned_email: "admin@dramashort.com",
        admin_notes: "Refunded duplicate coin purchase via wallet service.",
        resolved_at: new Date(Date.now() - 600000).toISOString(),
        resolved_by: "admin-1",
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 600000).toISOString(),
      },
    ];

    function createMockClient() {
      return {
        from: (table: string) => {
          if (table === "support_tickets") {
            let filterStatus: string | null = null;
            let filterCategory: string | null = null;
            let filterPriority: string | null = null;
            let filterId: string | null = null;
            let updatePayload: any = null;

            const builder: any = {
              select: (_cols?: string, _opts?: any) => builder,
              eq: (col: string, val: any) => {
                if (col === "status") filterStatus = val;
                if (col === "category") filterCategory = val;
                if (col === "priority") filterPriority = val;
                if (col === "id") filterId = val;
                return builder;
              },
              is: (_col: string, _val: any) => builder,
              or: (_expr: string) => builder,
              order: (_col: string, _opts?: any) => builder,
              range: (_from: number, _to: number) => {
                let filtered = [...mockTicketsDb];
                if (filterStatus) filtered = filtered.filter((t) => t.status === filterStatus);
                if (filterCategory) filtered = filtered.filter((t) => t.category === filterCategory);
                if (filterPriority) filtered = filtered.filter((t) => t.priority === filterPriority);
                return Promise.resolve({
                  data: filtered,
                  count: filtered.length,
                  error: null,
                });
              },
              update: (payload: any) => {
                updatePayload = payload;
                return builder;
              },
              single: () => {
                const target = mockTicketsDb.find((t) => t.id === filterId);
                const updated = target ? { ...target, ...updatePayload } : null;
                return Promise.resolve({ data: updated, error: null });
              },
              maybeSingle: () => {
                const target = mockTicketsDb.find((t) => t.id === filterId);
                return Promise.resolve({ data: target || null, error: null });
              },
              then: (resolve: any) => {
                // Return status array for count querying
                resolve({
                  data: mockTicketsDb.map((t) => ({ status: t.status })),
                  error: null,
                });
              },
            };
            return builder;
          }
          if (table === "admin_audit_log") {
            return {
              insert: () => Promise.resolve({ data: null, error: null }),
            };
          }
          throw new Error(`Unexpected table: ${table}`);
        },
      };
    }

    test("mapSupportTicketRowToItem parses row context and fields accurately", () => {
      const item = mapSupportTicketRowToItem(mockTicketsDb[0]);
      assert.strictEqual(item.id, "11111111-1111-4111-8111-111111111111");
      assert.strictEqual(item.email, "alice@example.com");
      assert.strictEqual(item.category, "playback");
      assert.strictEqual(item.status, "open");
      assert.strictEqual(item.priority, "high");
      assert.strictEqual(item.context.titleSlug, "the-billionaire-secret");
      assert.strictEqual(item.context.episodeNumber, 4);
    });

    test("getAdminSupportTicketsServer filters by status and aggregates counts", async () => {
      const client = createMockClient();
      const result = await getAdminSupportTicketsServer({ status: "open" }, client);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.items.length, 1);
        assert.strictEqual(result.value.items[0].email, "alice@example.com");
        assert.strictEqual(result.value.counts.total, 3);
        assert.strictEqual(result.value.counts.open, 1);
        assert.strictEqual(result.value.counts.inProgress, 1);
        assert.strictEqual(result.value.counts.resolved, 1);
      }
    });

    test("getAdminSupportTicketByIdServer returns requested ticket", async () => {
      const client = createMockClient();
      const result = await getAdminSupportTicketByIdServer(
        "11111111-1111-4111-8111-111111111111",
        client
      );

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.id, "11111111-1111-4111-8111-111111111111");
        assert.strictEqual(result.value.subject, "Video freezing on Episode 4");
      }
    });

    test("updateAdminSupportTicketServer updates status and notes and records audit trail", async () => {
      const client = createMockClient();
      const result = await updateAdminSupportTicketServer(
        "11111111-1111-4111-8111-111111111111",
        { status: "resolved", adminNotes: "Fixed encoding transcode." },
        { id: "admin-1", email: "admin@dramashort.com", ip: "127.0.0.1" },
        client
      );

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.status, "resolved");
        assert.strictEqual(result.value.adminNotes, "Fixed encoding transcode.");
        assert.ok(result.value.resolvedAt, "Must populate resolvedAt");
      }
    });

    test("replyAdminSupportTicketServer appends reply message and advances status", async () => {
      const client = createMockClient();
      const result = await replyAdminSupportTicketServer(
        "11111111-1111-4111-8111-111111111111",
        { replyMessage: "Please reload the page; episode 4 has been fixed." },
        { id: "admin-1", email: "support@dramashort.com" },
        client
      );

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.ok(result.value.adminNotes?.includes("Please reload the page"));
        assert.ok(result.value.adminNotes?.includes("support@dramashort.com"));
        assert.strictEqual(result.value.status, "in_progress");
      }
    });
  });

  describe("Admin Responsive Navigation & UI Contracts", () => {
    test("verifies AdminSidebar exports mobile drawer trigger and Support item", () => {
      const sidebarPath = path.resolve(
        process.cwd(),
        "components/admin/AdminSidebar.tsx"
      );
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.ok(content.includes('label: "Support"'), "AdminSidebar must include Support item");
      assert.ok(content.includes('href: "/admin/support"'), "AdminSidebar must link to /admin/support");
      assert.ok(content.includes("isMobileOpen"), "AdminSidebar must track mobile drawer state");
      assert.ok(content.includes("md:hidden"), "AdminSidebar must render mobile top bar and drawer");
      assert.ok(content.includes("Menu"), "AdminSidebar must render hamburger menu icon");
      assert.ok(content.includes("await logout()"), "AdminSidebar must preserve awaited logout");
    });

    test("verifies Support Inbox page exists and links drama and episode context", () => {
      const pagePath = path.resolve(process.cwd(), "app/admin/support/page.tsx");
      assert.ok(fs.existsSync(pagePath), "app/admin/support/page.tsx must exist");

      const content = fs.readFileSync(pagePath, "utf-8");
      assert.ok(content.includes("AdminSidebar"), "Support page must render AdminSidebar");
      assert.ok(content.includes("/drama/"), "Support page must link to public drama page");
      assert.ok(content.includes("/watch/"), "Support page must link to watch episode page");
      assert.ok(content.includes("mailto:"), "Support page must provide mailto email client link");
      assert.ok(content.includes("Support Inbox"), "Support page must display Support Inbox title");
    });
  });
});
