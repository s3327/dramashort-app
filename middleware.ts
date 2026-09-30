import { NextRequest, NextResponse } from "next/server";

// In production, admin.yourdomain.com should point at this same app.
// This middleware detects that hostname and rewrites requests into the
// /admin route group internally, so the codebase stays a single Next.js
// app instead of a separate deployment.
//
// Locally (no real subdomain DNS), just visit /admin directly — the
// rewrite below only fires when the hostname actually starts with "admin.".
export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const url = request.nextUrl;

  const isAdminHost = hostname.startsWith("admin.");

  if (isAdminHost && !url.pathname.startsWith("/admin")) {
    url.pathname = url.pathname === "/" ? "/admin" : `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
