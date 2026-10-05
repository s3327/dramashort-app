import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildAdminLoginRedirectUrl,
  redirectToAdminLogin,
  adminFetch,
} from "@/lib/api/admin-fetch";
import {
  decideRoute,
  resolveRoute,
  type RouteDecision,
} from "@/lib/middleware/route-decision";

describe("Admin Session Lifecycle (Task 12.5)", () => {
  describe("buildAdminLoginRedirectUrl", () => {
    it("builds /admin/login with URL-encoded returnUrl", () => {
      const url = buildAdminLoginRedirectUrl("/admin/dashboard");
      assert.equal(url, "/admin/login?returnUrl=%2Fadmin%2Fdashboard");
    });

    it("encodes query parameters in returnUrl correctly", () => {
      const url = buildAdminLoginRedirectUrl("/admin/dramas?page=2&q=billionaire");
      assert.equal(
        url,
        "/admin/login?returnUrl=%2Fadmin%2Fdramas%3Fpage%3D2%26q%3Dbillionaire"
      );
    });

    it("prevents self-redirect loop when already on /admin/login", () => {
      assert.equal(buildAdminLoginRedirectUrl("/admin/login"), "/admin/login");
      assert.equal(buildAdminLoginRedirectUrl("/admin/login?error=session_required"), "/admin/login");
    });
  });

  describe("redirectToAdminLogin & adminFetch in browser environment", () => {
    let originalWindow: typeof globalThis.window | undefined;
    let originalFetch: typeof globalThis.fetch | undefined;
    let assignedUrls: string[] = [];

    beforeEach(() => {
      assignedUrls = [];
      originalWindow = (globalThis as any).window;
      originalFetch = globalThis.fetch;

      // Mock browser window.location
      const mockLocation: any = {
        pathname: "/admin/dramas",
        search: "?page=3",
        href: "http://localhost:3000/admin/dramas?page=3",
        assign: (url: string) => {
          assignedUrls.push(url);
          mockLocation.href = url;
        },
      };

      (globalThis as any).window = {
        location: mockLocation,
      };
    });

    afterEach(() => {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
      globalThis.fetch = originalFetch!;
    });

    it("redirects to /admin/login with current pathname and search query", () => {
      redirectToAdminLogin();
      assert.equal(assignedUrls.length, 1);
      assert.equal(
        assignedUrls[0],
        "/admin/login?returnUrl=%2Fadmin%2Fdramas%3Fpage%3D3"
      );
    });

    it("does not redirect if already on /admin/login", () => {
      (globalThis as any).window.location.pathname = "/admin/login";
      (globalThis as any).window.location.search = "";

      redirectToAdminLogin();
      assert.equal(assignedUrls.length, 0);
    });

    it("adminFetch passes through 200 OK without triggering redirect", async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });

      const res = await adminFetch("/api/admin/dramas");
      assert.equal(res.status, 200);
      assert.equal(assignedUrls.length, 0);
    });

    it("adminFetch passes through 404 or 500 without triggering admin login redirect", async () => {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: "Not Found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });

      const res = await adminFetch("/api/admin/dramas/non-existent");
      assert.equal(res.status, 404);
      assert.equal(assignedUrls.length, 0);
    });

    it("adminFetch catches 401 Unauthorized and redirects to /admin/login?returnUrl=...", async () => {
      globalThis.fetch = async () =>
        new Response(
          JSON.stringify({
            code: "UNAUTHORIZED",
            message: "Authentication session required.",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }
        );

      const res = await adminFetch("/api/admin/dramas");
      assert.equal(res.status, 401);
      assert.equal(assignedUrls.length, 1);
      assert.equal(
        assignedUrls[0],
        "/admin/login?returnUrl=%2Fadmin%2Fdramas%3Fpage%3D3"
      );
    });
  });

  describe("Server-side /admin route redirects (middleware route decision)", () => {
    it("redirects authenticated admin from /admin to /admin/dashboard server-side", () => {
      const route = resolveRoute("dramashort.app", "/admin");
      const decision = decideRoute(route, "admin");
      assert.deepEqual(decision, {
        type: "redirect",
        location: "/admin/dashboard",
      });
    });

    it("redirects authenticated admin from /admin/ (trailing slash) to /admin/dashboard server-side", () => {
      const route = resolveRoute("dramashort.app", "/admin/");
      const decision = decideRoute(route, "admin");
      assert.deepEqual(decision, {
        type: "redirect",
        location: "/admin/dashboard",
      });
    });

    it("redirects unauthenticated visitor from /admin to /admin/login with returnUrl and session_required", () => {
      const route = resolveRoute("dramashort.app", "/admin");
      const decision = decideRoute(route, "none");
      assert.deepEqual(decision, {
        type: "redirect",
        location: "/admin/login?returnUrl=%2Fadmin&error=session_required",
      });
    });

    it("redirects standard non-admin user from /admin to /admin/login?error=unauthorized", () => {
      const route = resolveRoute("dramashort.app", "/admin");
      const decision = decideRoute(route, "user");
      assert.deepEqual(decision, {
        type: "redirect",
        location: "/admin/login?error=unauthorized",
      });
    });
  });

  describe("Static code invariants & contracts", () => {
    it("AdminSidebar awaits logout(), uses router.replace('/admin/login') and router.refresh()", () => {
      const sidebarPath = path.resolve(
        process.cwd(),
        "components/admin/AdminSidebar.tsx"
      );
      const content = fs.readFileSync(sidebarPath, "utf-8");

      assert.ok(
        content.includes("await logout()"),
        "AdminSidebar must await logout()"
      );
      assert.ok(
        content.includes('router.replace("/admin/login")'),
        "AdminSidebar must replace route to /admin/login to prevent back-button loops"
      );
      assert.ok(
        content.includes("router.refresh()"),
        "AdminSidebar must call router.refresh() to purge cached server credentials"
      );
      assert.ok(
        !content.includes("logout();\n    router.push"),
        "AdminSidebar must not call synchronous logout() followed immediately by router.push"
      );
      assert.ok(
        content.includes("isLoggingOut"),
        "AdminSidebar must track logout in-flight loading state"
      );
    });

    it("app/admin/page.tsx performs immediate server-side redirect to /admin/dashboard", () => {
      const pagePath = path.resolve(process.cwd(), "app/admin/page.tsx");
      const content = fs.readFileSync(pagePath, "utf-8");

      assert.ok(
        content.includes('redirect("/admin/dashboard")'),
        "AdminRootPage must perform server redirect to /admin/dashboard"
      );
      assert.ok(
        !content.includes('"use client"'),
        "AdminRootPage must not be a client-side component (avoids redirect flash)"
      );
      assert.ok(
        !content.includes("useEffect"),
        "AdminRootPage must not rely on client-side useEffect for redirection"
      );
    });

    it("lib/services/content.service.ts uses adminFetch for administrative endpoints", () => {
      const servicePath = path.resolve(
        process.cwd(),
        "lib/services/content.service.ts"
      );
      const content = fs.readFileSync(servicePath, "utf-8");

      assert.ok(
        content.includes('import { adminFetch } from "@/lib/api/admin-fetch"'),
        "content.service.ts must import adminFetch"
      );
      assert.ok(
        content.includes("await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}`)"),
        "getDramaById must use adminFetch"
      );
      assert.ok(
        content.includes("await adminFetch(`/api/admin/dramas${queryString}`)"),
        "getAdminDramas must use adminFetch"
      );
      assert.ok(
        content.includes("await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}`, {"),
        "updateDrama must use adminFetch"
      );
      assert.ok(
        content.includes('await adminFetch("/api/admin/dramas", {'),
        "createDrama must use adminFetch"
      );
    });
  });
});
