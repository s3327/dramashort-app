import { getSafeAdminRedirect } from "@/lib/navigation/safe-redirect";

/**
 * Pure routing/authorization decisions for middleware.ts (Task 10.4).
 *
 * No Next.js or Supabase imports, so every host × path × session combination can
 * be unit-tested. middleware.ts resolves the session, calls decideRoute(), and
 * turns the result into a NextResponse (carrying refreshed auth cookies).
 */

export type SessionState = "none" | "user" | "admin";

export type RouteArea = "admin-api" | "admin" | "account" | "public";

export interface ResolvedRoute {
  /** Path the request is checked and served as (admin hosts map "/x" to "/admin/x"). */
  effectivePath: string;
  /** True when the effective path differs from the requested one (serve via rewrite). */
  rewrite: boolean;
  area: RouteArea;
  /** Whether the decision needs a verified user (auth.getUser()). */
  requiresSession: boolean;
}

export type RouteDecision =
  | { type: "next" }
  | { type: "rewrite"; pathname: string }
  | { type: "redirect"; location: string }
  | { type: "json"; status: 401 | 403; code: "UNAUTHORIZED" | "FORBIDDEN"; message: string };

/** Paths served as-is on the admin host: APIs and auth callbacks are host-agnostic. */
const ADMIN_HOST_PASSTHROUGH = [/^\/api(\/|$)/, /^\/auth(\/|$)/, /^\/_next(\/|$)/];

export function isAdminHost(host: string | null | undefined): boolean {
  return (host ?? "").toLowerCase().startsWith("admin.");
}

function startsWithSegment(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function resolveRoute(host: string | null | undefined, pathname: string): ResolvedRoute {
  let effectivePath = pathname;

  if (
    isAdminHost(host) &&
    !startsWithSegment(pathname, "/admin") &&
    !ADMIN_HOST_PASSTHROUGH.some((re) => re.test(pathname))
  ) {
    effectivePath = pathname === "/" ? "/admin" : `/admin${pathname}`;
  }

  let area: RouteArea = "public";
  if (startsWithSegment(effectivePath, "/api/admin")) area = "admin-api";
  else if (startsWithSegment(effectivePath, "/admin")) area = "admin";
  else if (startsWithSegment(effectivePath, "/account")) area = "account";

  return {
    effectivePath,
    rewrite: effectivePath !== pathname,
    area,
    requiresSession: area !== "public",
  };
}

function serve(route: ResolvedRoute, search: string): RouteDecision {
  return route.rewrite ? { type: "rewrite", pathname: `${route.effectivePath}${search}` } : { type: "next" };
}

/**
 * @param search  the request's query string including "?" (or "")
 * @param returnUrlParam  the `returnUrl` query value, used on /admin/login
 */
export function decideRoute(
  route: ResolvedRoute,
  session: SessionState,
  search: string = "",
  returnUrlParam: string | null = null
): RouteDecision {
  const path = route.effectivePath;

  switch (route.area) {
    case "admin-api":
      if (session === "none") {
        return { type: "json", status: 401, code: "UNAUTHORIZED", message: "Authentication session required." };
      }
      if (session !== "admin") {
        return { type: "json", status: 403, code: "FORBIDDEN", message: "Administrator privileges required." };
      }
      return serve(route, search);

    case "admin": {
      const isLogin = path === "/admin/login";

      if (session === "none") {
        if (isLogin) return serve(route, search);
        const params = new URLSearchParams({ returnUrl: `${path}${search}`, error: "session_required" });
        return { type: "redirect", location: `/admin/login?${params.toString()}` };
      }

      if (session === "user") {
        if (isLogin) return serve(route, search);
        return { type: "redirect", location: "/admin/login?error=unauthorized" };
      }

      // admin
      if (isLogin) {
        return { type: "redirect", location: getSafeAdminRedirect(returnUrlParam) };
      }
      if (path === "/admin") {
        return { type: "redirect", location: "/admin/dashboard" };
      }
      return serve(route, search);
    }

    case "account":
      if (session === "none") {
        const params = new URLSearchParams({ returnUrl: path });
        return { type: "redirect", location: `/login?${params.toString()}` };
      }
      return serve(route, search);

    case "public":
    default:
      return serve(route, search);
  }
}
