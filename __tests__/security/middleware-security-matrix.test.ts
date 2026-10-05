import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideRoute,
  isAdminHost,
  resolveRoute,
  type RouteDecision,
  type SessionState,
} from "@/lib/middleware/route-decision";

describe("Middleware Security Matrix (Task 10.9)", () => {
  const MAIN_HOST = "dramashort.app";
  const ADMIN_HOST = "admin.dramashort.app";

  describe("Host Classification & Spoofing Defense", () => {
    it("recognizes exact and case-insensitive admin hostnames", () => {
      assert.equal(isAdminHost("admin.dramashort.app"), true);
      assert.equal(isAdminHost("Admin.DramaShort.app"), true);
      assert.equal(isAdminHost("ADMIN.DRAMASHORT.APP:443"), true);
      assert.equal(isAdminHost("admin.dramashort.app:3000"), true);
    });

    it("rejects non-admin hostnames", () => {
      assert.equal(isAdminHost("evil-admin.dramashort.app"), false);
      assert.equal(isAdminHost("admin-dramashort.app"), false);
      assert.equal(isAdminHost("notadmin.dramashort.app"), false);
      assert.equal(isAdminHost("dramashort.app"), false);
      assert.equal(isAdminHost(null), false);
      assert.equal(isAdminHost(undefined), false);
    });
  });

  describe("Route Resolution & Boundary Checks", () => {
    it("classifies route areas accurately", () => {
      assert.equal(resolveRoute(MAIN_HOST, "/api/admin/dramas").area, "admin-api");
      assert.equal(resolveRoute(MAIN_HOST, "/admin/dashboard").area, "admin");
      assert.equal(resolveRoute(MAIN_HOST, "/account/history").area, "account");
      assert.equal(resolveRoute(MAIN_HOST, "/home").area, "public");
      assert.equal(resolveRoute(MAIN_HOST, "/drama/test").area, "public");
    });

    it("prevents prefix-collision bypasses", () => {
      // e.g. /administrator or /api/administrative must not be treated as admin routes
      assert.equal(resolveRoute(MAIN_HOST, "/administrator").area, "public");
      assert.equal(resolveRoute(MAIN_HOST, "/admin-panel").area, "public");
      assert.equal(resolveRoute(MAIN_HOST, "/accounts-info").area, "public");
      assert.equal(resolveRoute(MAIN_HOST, "/api/administrative").area, "public");
    });

    it("maps admin subdomain paths cleanly without double-prefixing", () => {
      assert.equal(resolveRoute(ADMIN_HOST, "/dashboard").effectivePath, "/admin/dashboard");
      assert.equal(resolveRoute(ADMIN_HOST, "/").effectivePath, "/admin");
      assert.equal(resolveRoute(ADMIN_HOST, "/admin/dashboard").effectivePath, "/admin/dashboard");
    });

    it("does not rewrite critical API, auth, or static assets on admin subdomain", () => {
      assert.equal(resolveRoute(ADMIN_HOST, "/api/admin/dramas").rewrite, false);
      assert.equal(resolveRoute(ADMIN_HOST, "/auth/callback").rewrite, false);
      assert.equal(resolveRoute(ADMIN_HOST, "/_next/data/file.json").rewrite, false);
    });
  });

  describe("decideRoute Security Decision Table", () => {
    const testCases: Array<{
      host: string;
      path: string;
      session: SessionState;
      expectedType: RouteDecision["type"];
      expectedStatus?: number;
      label: string;
    }> = [
      // Admin API protection
      {
        host: MAIN_HOST,
        path: "/api/admin/dramas",
        session: "none",
        expectedType: "json",
        expectedStatus: 401,
        label: "Admin API denies unauthenticated request with 401 JSON",
      },
      {
        host: MAIN_HOST,
        path: "/api/admin/dramas",
        session: "user",
        expectedType: "json",
        expectedStatus: 403,
        label: "Admin API denies regular user with 403 JSON",
      },
      {
        host: MAIN_HOST,
        path: "/api/admin/dramas",
        session: "admin",
        expectedType: "next",
        label: "Admin API allows admin session to proceed",
      },

      // Admin console pages on main host
      {
        host: MAIN_HOST,
        path: "/admin/dashboard",
        session: "none",
        expectedType: "redirect",
        label: "Admin page redirects unauthenticated visitor to /admin/login",
      },
      {
        host: MAIN_HOST,
        path: "/admin/dashboard",
        session: "user",
        expectedType: "redirect",
        label: "Admin page redirects regular user with error=unauthorized",
      },
      {
        host: MAIN_HOST,
        path: "/admin/dashboard",
        session: "admin",
        expectedType: "next",
        label: "Admin page allows authenticated admin",
      },

      // Subdomain bypass prevention (The historical vulnerability)
      {
        host: ADMIN_HOST,
        path: "/dashboard",
        session: "none",
        expectedType: "redirect",
        label: "Subdomain /dashboard requires session (blocks unauthenticated bypass)",
      },
      {
        host: ADMIN_HOST,
        path: "/dashboard",
        session: "user",
        expectedType: "redirect",
        label: "Subdomain /dashboard blocks regular user",
      },
      {
        host: ADMIN_HOST,
        path: "/dashboard",
        session: "admin",
        expectedType: "rewrite",
        label: "Subdomain /dashboard rewrites to /admin/dashboard for admin",
      },

      // Account page protection
      {
        host: MAIN_HOST,
        path: "/account/settings",
        session: "none",
        expectedType: "redirect",
        label: "Account settings redirects unauthenticated user to /login",
      },
      {
        host: MAIN_HOST,
        path: "/account/settings",
        session: "user",
        expectedType: "next",
        label: "Account settings allows logged in user",
      },

      // Public site access
      {
        host: MAIN_HOST,
        path: "/home",
        session: "none",
        expectedType: "next",
        label: "Public home is accessible to guests",
      },
      {
        host: MAIN_HOST,
        path: "/drama/alpha-slug",
        session: "none",
        expectedType: "next",
        label: "Public drama detail is accessible to guests",
      },
    ];

    for (const tc of testCases) {
      it(tc.label, () => {
        const route = resolveRoute(tc.host, tc.path);
        const decision = decideRoute(route, tc.session);
        assert.equal(decision.type, tc.expectedType);

        if (tc.expectedStatus && decision.type === "json") {
          assert.equal(decision.status, tc.expectedStatus);
        }
      });
    }
  });
});
