import { NextRequest, NextResponse } from "next/server";
import { getUserRole } from "@/lib/auth/roles";
import { apiError } from "@/lib/api/responses";
import { updateSession } from "@/lib/supabase/middleware";
import {
  decideRoute,
  resolveRoute,
  type SessionState,
} from "@/lib/middleware/route-decision";
import { logger, getRequestIdFromHeaders } from "@/lib/observability/logger";
import { reportError } from "@/lib/observability/error-reporter";

/**
 * 1. Generate/propagate x-request-id header for end-to-end observability (Task 13.6).
 * 2. Resolve the effective path (admin.* hosts serve the console from /admin;
 *    /api, /auth and /_next pass through unchanged).
 * 3. Refresh the Supabase session; verify the user only where access depends on it.
 * 4. Apply the decision from lib/middleware/route-decision.ts, carrying any
 *    refreshed auth cookies on the response.
 * 5. Replay x-request-id onto outgoing response and log structured JSON entry.
 */
export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestIdFromHeaders(request.headers);

  // Clone headers and propagate x-request-id downstream
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const { pathname, search, searchParams } = request.nextUrl;

  try {
    const route = resolveRoute(request.headers.get("host"), pathname);

    const session = await updateSession(request, { verify: route.requiresSession });

    let state: SessionState = "none";
    let userId: string | null = null;
    if (session.user) {
      userId = session.user.id;
      state = getUserRole(session.user) === "admin" ? "admin" : "user";
    }

    const decision = decideRoute(route, state, search, searchParams.get("returnUrl"));
    const forwardedRequest = { request: { headers: requestHeaders } };

    let response: NextResponse;
    switch (decision.type) {
      case "json":
        response = session.withSessionCookies(apiError(decision.code, decision.message, decision.status));
        break;
      case "redirect":
        response = session.withSessionCookies(NextResponse.redirect(new URL(decision.location, request.url)));
        break;
      case "rewrite":
        response = session.withSessionCookies(
          NextResponse.rewrite(new URL(decision.pathname, request.url), forwardedRequest)
        );
        break;
      case "next":
      default:
        response = session.withSessionCookies(NextResponse.next(forwardedRequest));
        break;
    }

    // Replay x-request-id onto outgoing response
    response.headers.set("x-request-id", requestId);

    // Emit structured log
    const durationMs = Date.now() - startTime;
    logger.info(`Request ${request.method} ${pathname}`, {
      requestId,
      route: pathname,
      method: request.method,
      userId,
      durationMs,
      statusCode: response.status,
    });

    return response;
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    reportError(err, {
      requestId,
      route: pathname,
      method: request.method,
      tags: { boundary: "middleware" },
    });

    logger.error(`Middleware failed for ${request.method} ${pathname}`, {
      requestId,
      route: pathname,
      method: request.method,
      durationMs,
      statusCode: 500,
      details: { error: String(err) },
    });

    const fallbackResponse = apiError("INTERNAL_ERROR", "Internal Server Error", 500);
    fallbackResponse.headers.set("x-request-id", requestId);
    return fallbackResponse;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
