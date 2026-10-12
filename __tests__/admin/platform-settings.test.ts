import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateSettingsPayload,
  isValidSection,
} from "@/lib/validation/settings";
import {
  getPlatformSettingsServer,
  getPlatformSettingSectionServer,
  updatePlatformSettingSectionServer,
  isMaintenanceModeActiveServer,
  clearPlatformSettingsCache,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_USER_SETTINGS,
  DEFAULT_ADS_SETTINGS,
  DEFAULT_FEATURES_SETTINGS,
} from "@/lib/server/settings";
import { setTestContentAdminClientFactory } from "@/lib/supabase/content";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";
import { setTestMaintenanceMode, isMaintenanceModeActive } from "@/lib/middleware/maintenance";
import {
  decideRoute,
  resolveRoute,
  type RouteDecision,
} from "@/lib/middleware/route-decision";
import { GET as getSettingsHandler, PATCH as patchSettingsHandler } from "@/app/api/admin/settings/route";
import { NextRequest } from "next/server";

describe("Task 16.8: Platform Settings Persistence", () => {
  let mockDbSettings: Map<string, any> = new Map();
  let mockAuditLogs: any[] = [];

  beforeEach(() => {
    mockDbSettings = new Map();
    mockAuditLogs = [];
    clearPlatformSettingsCache();
    setTestMaintenanceMode(null);

    setTestContentAdminClientFactory(() => ({
      from: (table: string) => {
        if (table === "app_settings") {
          return {
            select: (_cols?: string) => ({
              then: (resolve: any) => {
                const rows = Array.from(mockDbSettings.entries()).map(([key, item]) => ({
                  key,
                  value: item.value,
                  updated_at: item.updated_at,
                  updated_by: item.updated_by,
                }));
                return resolve({ data: rows, error: null });
              },
            }),
            upsert: async (payload: any) => {
              mockDbSettings.set(payload.key, {
                value: payload.value,
                updated_at: payload.updated_at || new Date().toISOString(),
                updated_by: payload.updated_by || null,
              });
              return { data: null, error: null };
            },
          };
        }
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
    setTestContentAdminClientFactory(null);
    setTestUserServerClientFactory(null);
    setTestMaintenanceMode(null);
  });

  // --------------------------------------------------------------------------
  // 1. Database Schema & Migration Invariants
  // --------------------------------------------------------------------------
  describe("Database Migration Contracts", () => {
    const contentMigrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261009180000_platform_settings.sql"
    );

    it("verifies the migration file exists in the single chain", () => {
      assert.ok(fs.existsSync(contentMigrationPath), "Content migration file must exist");
    });

    it("verifies migration defines app_settings table with JSONB and timestamps", () => {
      const sql = fs.readFileSync(contentMigrationPath, "utf-8");
      assert.ok(sql.includes("CREATE TABLE IF NOT EXISTS public.app_settings"), "Must create app_settings table");
      assert.ok(sql.includes("key TEXT PRIMARY KEY"), "Must declare key TEXT PRIMARY KEY");
      assert.ok(sql.includes("value JSONB NOT NULL DEFAULT '{}'::jsonb"), "Must declare value JSONB");
      assert.ok(sql.includes("updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"), "Must declare updated_at");
    });

    it("verifies migration seeds default rows for general, site, users, ads, and features", () => {
      const sql = fs.readFileSync(contentMigrationPath, "utf-8");
      assert.ok(sql.includes("'general'"), "Must seed general configuration");
      assert.ok(sql.includes("'site'"), "Must seed site configuration");
      assert.ok(sql.includes("'users'"), "Must seed users configuration");
      assert.ok(sql.includes("'ads'"), "Must seed ads configuration");
      assert.ok(sql.includes("'features'"), "Must seed features configuration");
    });

    it("verifies migration enables RLS and grants public read with service_role write", () => {
      const sql = fs.readFileSync(contentMigrationPath, "utf-8");
      assert.ok(sql.includes("ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY"), "Must enable RLS");
      assert.ok(sql.includes("GRANT SELECT ON public.app_settings TO anon, authenticated, service_role"), "Must grant SELECT");
      assert.ok(sql.includes("GRANT ALL ON public.app_settings TO service_role"), "Must grant ALL to service_role");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Payload Validation & Section Schemas
  // --------------------------------------------------------------------------
  describe("Payload Validation & Section Schemas", () => {
    it("validates section identifiers", () => {
      assert.equal(isValidSection("general"), true);
      assert.equal(isValidSection("site"), true);
      assert.equal(isValidSection("users"), true);
      assert.equal(isValidSection("ads"), true);
      assert.equal(isValidSection("features"), true);
      assert.equal(isValidSection("unknown_section"), false);
    });

    it("validates general settings payload", () => {
      const valid = validateSettingsPayload("general", {
        siteName: "DramaHub",
        siteTagline: "Best short dramas",
        maintenanceMode: true,
      });
      assert.equal(valid.ok, true);
      assert.equal(valid.value?.siteName, "DramaHub");
      assert.equal(valid.value?.maintenanceMode, true);

      const invalidName = validateSettingsPayload("general", { siteName: "" });
      assert.equal(invalidName.ok, false);
      assert.ok(invalidName.errors.some((e) => e.field === "siteName"));
    });

    it("validates site settings bounds", () => {
      const valid = validateSettingsPayload("site", {
        historyRetentionDays: 90,
        newReleaseMaxDisplay: 36,
        showContinueWatching: false,
      });
      assert.equal(valid.ok, true);
      assert.equal(valid.value?.historyRetentionDays, 90);
      assert.equal(valid.value?.newReleaseMaxDisplay, 36);

      const invalidMax = validateSettingsPayload("site", { newReleaseMaxDisplay: 500 });
      assert.equal(invalidMax.ok, false);
      assert.ok(invalidMax.errors.some((e) => e.field === "newReleaseMaxDisplay"));
    });

    it("validates user policies and episode limits", () => {
      const valid = validateSettingsPayload("users", {
        signupEnabled: false,
        defaultFreeEpisodes: 5,
        deletionGracePeriodDays: 30,
      });
      assert.equal(valid.ok, true);
      assert.equal(valid.value?.signupEnabled, false);
      assert.equal(valid.value?.defaultFreeEpisodes, 5);

      const invalidEp = validateSettingsPayload("users", { defaultFreeEpisodes: -2 });
      assert.equal(invalidEp.ok, false);
    });

    it("validates feature flags as boolean mappings", () => {
      const valid = validateSettingsPayload("features", {
        autoplayNext: true,
        experimentalPlayer: false,
      });
      assert.equal(valid.ok, true);
      assert.equal(valid.value?.autoplayNext, true);
      assert.equal(valid.value?.experimentalPlayer, false);

      const invalid = validateSettingsPayload("features", { autoplayNext: "yes" });
      assert.equal(invalid.ok, false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Server Operations & Structured Audit Logs
  // --------------------------------------------------------------------------
  describe("Server Operations & Persistence Layer", () => {
    it("returns default settings when database has no saved rows", async () => {
      const settings = await getPlatformSettingsServer();
      assert.equal(settings.general.siteName, DEFAULT_GENERAL_SETTINGS.siteName);
      assert.equal(settings.general.maintenanceMode, false);
      assert.equal(settings.site.trendingPeriod, DEFAULT_SITE_SETTINGS.trendingPeriod);
      assert.equal(settings.users.signupEnabled, DEFAULT_USER_SETTINGS.signupEnabled);
      assert.equal(settings.ads.enabled, DEFAULT_ADS_SETTINGS.enabled);
    });

    it("persists section updates, clears cache, and records audit trail", async () => {
      const actor = { id: "admin-actor-uuid", email: "admin@dramashort.com", ip: "127.0.0.1" };
      const updated = await updatePlatformSettingSectionServer(
        "general",
        { siteName: "DramaShort Enterprise", maintenanceMode: true },
        actor
      );

      assert.equal(updated.siteName, "DramaShort Enterprise");
      assert.equal(updated.maintenanceMode, true);

      // Verify DB persistence
      assert.ok(mockDbSettings.has("general"));
      assert.equal(mockDbSettings.get("general").value.siteName, "DramaShort Enterprise");

      // Verify audit log entry
      const audit = mockAuditLogs.find((l) => l.action === "settings.update");
      assert.ok(audit, "Must record settings.update audit entry");
      assert.equal(audit.actor_id, "admin-actor-uuid");
      assert.equal(audit.entity_type, "settings");
      assert.equal(audit.entity_id, "general");
      assert.equal(audit.after.siteName, "DramaShort Enterprise");
      assert.equal(audit.after.maintenanceMode, true);

      // Verify subsequent read returns updated value
      const refreshed = await getPlatformSettingsServer();
      assert.equal(refreshed.general.siteName, "DramaShort Enterprise");
      assert.equal(refreshed.general.maintenanceMode, true);

      // Verify isMaintenanceModeActiveServer returns true
      const isMaint = await isMaintenanceModeActiveServer();
      assert.equal(isMaint, true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Maintenance Mode & Route Decision Matrix
  // --------------------------------------------------------------------------
  describe("Maintenance Mode & Route Decision Verification", () => {
    it("passes public traffic normally when maintenance mode is inactive", () => {
      const route = resolveRoute("dramashort.app", "/drama/ceo-wife");
      const decision = decideRoute(route, "none", "", null, false);
      assert.equal(decision.type, "next", "Public routes pass normally when maintenance is off");
    });

    it("redirects public routes to /maintenance when maintenance mode is active", () => {
      const publicRoutes = ["/", "/home", "/drama/ceo-wife", "/genres", "/trending", "/search", "/account"];
      for (const p of publicRoutes) {
        const route = resolveRoute("dramashort.app", p);
        const decision = decideRoute(route, "none", "", null, true);
        assert.equal(
          decision.type,
          "redirect",
          `Route ${p} must redirect to /maintenance during maintenance mode`
        );
        if (decision.type === "redirect") {
          assert.equal(decision.location, "/maintenance");
        }
      }
    });

    it("serves /maintenance without redirection loop when maintenance mode is active", () => {
      const route = resolveRoute("dramashort.app", "/maintenance");
      const decision = decideRoute(route, "none", "", null, true);
      assert.equal(decision.type, "next", "/maintenance page must be served without loop");
    });

    it("allows critical system passthroughs during maintenance mode", () => {
      const passthroughs = ["/api/health", "/_next/static/chunk.js", "/favicon.ico", "/icon.png"];
      for (const p of passthroughs) {
        const route = resolveRoute("dramashort.app", p);
        const decision = decideRoute(route, "none", "", null, true);
        assert.equal(decision.type, "next", `Critical asset ${p} must pass through`);
      }
    });

    it("CRITICAL: keeps admin console fully accessible for administrators during maintenance mode", () => {
      // Admin dashboard on admin subdomain (served via rewrite to /admin/dashboard)
      const adminRoute = resolveRoute("admin.dramashort.app", "/dashboard");
      const adminDecision = decideRoute(adminRoute, "admin", "", null, true);
      assert.notEqual(adminDecision.type, "redirect", "Admin dashboard must not be redirected to /maintenance");
      assert.equal(adminDecision.type, "rewrite");

      // Admin settings route on main domain with /admin path
      const settingsRoute = resolveRoute("dramashort.app", "/admin/settings");
      const settingsDecision = decideRoute(settingsRoute, "admin", "", null, true);
      assert.equal(settingsDecision.type, "next", "Admin settings must remain accessible during maintenance");

      // Admin API endpoint
      const apiRoute = resolveRoute("dramashort.app", "/api/admin/settings");
      const apiDecision = decideRoute(apiRoute, "admin", "", null, true);
      assert.equal(apiDecision.type, "next", "Admin API must remain accessible during maintenance");
    });
  });

  // --------------------------------------------------------------------------
  // 5. REST API Route Handlers & RBAC Guards
  // --------------------------------------------------------------------------
  describe("API Route Handlers & Role Enforcement", () => {
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

    it("permits staff (editor and admin) to read settings with HTTP 200", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "editor-id", email: "editor@dramashort.com", app_metadata: { role: "editor" } } },
            error: null,
          }),
        },
      }));

      const req = createMockRequest("/api/admin/settings");
      const res = await getSettingsHandler(req);
      assert.equal(res.status, 200);

      const json = await res.json();
      assert.ok(json.data.general, "Must return general settings");
      assert.ok(json.data.site, "Must return site settings");
    });

    it("DENIES editor access to modify settings with 403 FORBIDDEN", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "editor-id", email: "editor@dramashort.com", app_metadata: { role: "editor" } } },
            error: null,
          }),
        },
      }));

      const req = createMockRequest("/api/admin/settings", "PATCH", {
        section: "general",
        values: { siteName: "Hacked Site" },
      });
      const res = await patchSettingsHandler(req);
      assert.equal(res.status, 403, "Editor must receive 403 FORBIDDEN when modifying settings");
    });

    it("DENIES unauthenticated guests with 401 UNAUTHORIZED", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: { message: "No session" } }),
        },
      }));

      const req = createMockRequest("/api/admin/settings", "PATCH", {
        section: "general",
        values: { siteName: "Guest Edit" },
      });
      const res = await patchSettingsHandler(req);
      assert.equal(res.status, 401, "Guest must receive 401 UNAUTHORIZED");
    });

    it("AUTHORIZES admin to modify settings and sets maintenance cookie on general update", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: { user: { id: "admin-id", email: "admin@dramashort.com", app_metadata: { role: "admin" } } },
            error: null,
          }),
        },
      }));

      const req = createMockRequest("/api/admin/settings", "PATCH", {
        section: "general",
        values: { maintenanceMode: true, siteName: "DramaShort V2" },
      });
      const res = await patchSettingsHandler(req);
      assert.equal(res.status, 200, "Admin must receive 200 OK");

      const json = await res.json();
      assert.equal(json.data.values.siteName, "DramaShort V2");
      assert.equal(json.data.values.maintenanceMode, true);

      // Verify response cookie was set
      const cookieHeader = res.headers.get("set-cookie");
      assert.ok(cookieHeader && cookieHeader.includes("ds_maint=1"), "Must set ds_maint cookie on maintenance toggle");
    });
  });
});
