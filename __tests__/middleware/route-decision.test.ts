import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  decideRoute,
  isAdminHost,
  resolveRoute,
  type RouteDecision,
  type SessionState,
} from "@/lib/middleware/route-decision";

const MAIN = "dramashort.app";
const ADMIN = "admin.dramashort.app";

function decide(
  host: string,
  pathname: string,
  session: SessionState,
  search = "",
  returnUrl: string | null = null
): RouteDecision {
  return decideRoute(resolveRoute(host, pathname), session, search, returnUrl);
}

const next: RouteDecision = { type: "next" };
const rewrite = (pathname: string): RouteDecision => ({ type: "rewrite", pathname });
const redirect = (location: string): RouteDecision => ({ type: "redirect", location });
const json401: RouteDecision = { type: "json", status: 401, code: "UNAUTHORIZED", message: "Authentication session required." };
const json403: RouteDecision = { type: "json", status: 403, code: "FORBIDDEN", message: "Administrator privileges required." };

const LOGIN_REQUIRED = (returnUrl: string) =>
  redirect(`/admin/login?${new URLSearchParams({ returnUrl, error: "session_required" }).toString()}`);
const UNAUTHORIZED = redirect("/admin/login?error=unauthorized");

describe("resolveRoute (Task 10.4)", () => {
  it("detects admin hosts case-insensitively", () => {
    assert.equal(isAdminHost("Admin.DramaShort.app"), true);
    assert.equal(isAdminHost("dramashort.app"), false);
    assert.equal(isAdminHost(null), false);
    assert.equal(isAdminHost("notadmin.dramashort.app"), false);
  });

  it("maps admin-host paths under /admin, but passes /api, /auth, /_next through", () => {
    assert.deepEqual(resolveRoute(ADMIN, "/"), { effectivePath: "/admin", rewrite: true, area: "admin", requiresSession: true });
    assert.equal(resolveRoute(ADMIN, "/dashboard").effectivePath, "/admin/dashboard");
    assert.equal(resolveRoute(ADMIN, "/admin/dramas").rewrite, false);
    assert.deepEqual(resolveRoute(ADMIN, "/api/admin/dramas"), {
      effectivePath: "/api/admin/dramas",
      rewrite: false,
      area: "admin-api",
      requiresSession: true,
    });
    assert.equal(resolveRoute(ADMIN, "/auth/callback").effectivePath, "/auth/callback");
    assert.equal(resolveRoute(ADMIN, "/_next/data/x.json").rewrite, false);
  });

  it("does not treat look-alike prefixes as protected areas", () => {
    assert.equal(resolveRoute(MAIN, "/administrator").area, "public");
    assert.equal(resolveRoute(MAIN, "/accounts-help").area, "public");
    assert.equal(resolveRoute(MAIN, "/api/administrative").area, "public");
  });

  it("only requires a verified session outside public pages", () => {
    assert.equal(resolveRoute(MAIN, "/home").requiresSession, false);
    assert.equal(resolveRoute(MAIN, "/account/history").requiresSession, true);
  });
});

describe("decideRoute host × path × session matrix (Task 10.4)", () => {
  const cases: Array<[string, string, SessionState, RouteDecision, string?, string?]> = [
    // main host — admin API
    [MAIN, "/api/admin/dramas", "none", json401],
    [MAIN, "/api/admin/dramas", "user", json403],
    [MAIN, "/api/admin/dramas", "admin", next],
    // main host — admin pages
    [MAIN, "/admin/dashboard", "none", LOGIN_REQUIRED("/admin/dashboard")],
    [MAIN, "/admin/dramas", "none", LOGIN_REQUIRED("/admin/dramas?page=2"), "?page=2"],
    [MAIN, "/admin/dashboard", "user", UNAUTHORIZED],
    [MAIN, "/admin/dashboard", "admin", next],
    [MAIN, "/admin", "admin", redirect("/admin/dashboard")],
    [MAIN, "/admin/login", "none", next],
    [MAIN, "/admin/login", "user", next],
    [MAIN, "/admin/login", "admin", redirect("/admin/dramas"), "", "/admin/dramas"],
    [MAIN, "/admin/login", "admin", redirect("/admin/dashboard"), "", "//evil.example"],
    [MAIN, "/admin/login", "admin", redirect("/admin/dashboard"), "", "/home"],
    [MAIN, "/admin/login", "admin", redirect("/admin/dashboard"), "", "/admin/login"],
    // main host — account and public
    [MAIN, "/account", "none", redirect("/login?returnUrl=%2Faccount")],
    [MAIN, "/account/history", "user", next],
    [MAIN, "/account/settings", "admin", next],
    [MAIN, "/home", "none", next],
    [MAIN, "/drama/some-slug", "user", next],
    // admin host — the original bypass: /dashboard used to render without login
    [ADMIN, "/dashboard", "none", LOGIN_REQUIRED("/admin/dashboard")],
    [ADMIN, "/dashboard", "user", UNAUTHORIZED],
    [ADMIN, "/dashboard", "admin", rewrite("/admin/dashboard")],
    [ADMIN, "/dramas", "admin", rewrite("/admin/dramas?q=ceo"), "?q=ceo"],
    [ADMIN, "/", "none", LOGIN_REQUIRED("/admin")],
    [ADMIN, "/", "admin", redirect("/admin/dashboard")],
    [ADMIN, "/login", "none", rewrite("/admin/login")],
    [ADMIN, "/admin/dashboard", "admin", next],
    // admin host — public site paths stay inside the console (login first, then 404)
    [ADMIN, "/home", "none", LOGIN_REQUIRED("/admin/home")],
    [ADMIN, "/account", "user", UNAUTHORIZED],
    // admin host — API and auth callbacks are not rewritten
    [ADMIN, "/api/admin/dramas", "none", json401],
    [ADMIN, "/api/admin/dramas", "user", json403],
    [ADMIN, "/api/admin/dramas", "admin", next],
    [ADMIN, "/auth/callback", "none", next],
  ];

  for (const [host, path, session, expected, search = "", returnUrl = null] of cases) {
    it(`${host} ${path}${search} as ${session}${returnUrl ? ` (returnUrl=${returnUrl})` : ""}`, () => {
      assert.deepEqual(decide(host, path, session, search, returnUrl), expected);
    });
  }
});
