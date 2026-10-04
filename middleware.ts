import { NextRequest, NextResponse } from "next/server";
import { getUserRole } from "@/lib/auth/roles";
import { apiError } from "@/lib/api/responses";
import { updateSession } from "@/lib/supabase/middleware";
import {
  decideRoute,
  resolveRoute,
  type SessionState,
} from "@/lib/middleware/route-decision";

/**
 * 1. Resolve the effective path (admin.* hosts serve the console from /admin;
 *    /api, /auth and /_next pass through unchanged).
 * 2. Refresh the Supabase session; verify the user only where access depends on it.
 * 3. Apply the decision from lib/middleware/route-decision.ts, carrying any
 *    refreshed auth cookies on the response.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;
  const route = resolveRoute(request.headers.get("host"), pathname);

  const session = await updateSession(request, { verify: route.requiresSession });

  let state: SessionState = "none";
  if (session.user) {
    state = getUserRole(session.user) === "admin" ? "admin" : "user";
  }

  const decision = decideRoute(route, state, search, searchParams.get("returnUrl"));
  const forwardedRequest = { request: { headers: request.headers } };

  switch (decision.type) {
    case "json":
      return session.withSessionCookies(apiError(decision.code, decision.message, decision.status));
    case "redirect":
      return session.withSessionCookies(NextResponse.redirect(new URL(decision.location, request.url)));
    case "rewrite":
      return session.withSessionCookies(
        NextResponse.rewrite(new URL(decision.pathname, request.url), forwardedRequest)
      );
    case "next":
    default:
      return session.withSessionCookies(NextResponse.next(forwardedRequest));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
