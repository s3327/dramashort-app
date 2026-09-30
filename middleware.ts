import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase-user";

const userUrl =
  process.env.NEXT_PUBLIC_USER_SUPABASE_URL || "https://placeholder.supabase.co";
const userAnonKey =
  process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || "placeholder-anon-key";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";
  const url = request.nextUrl.clone();

  // 1. Subdomain Routing: rewrite admin.yourdomain.com into /admin
  const isAdminHost = hostname.startsWith("admin.");
  if (isAdminHost && !url.pathname.startsWith("/admin")) {
    url.pathname = url.pathname === "/" ? "/admin" : `/admin${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // 2. Admin Route Protection (/admin/*)
  if (url.pathname.startsWith("/admin")) {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient<Database>(userUrl, userAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    // Verify session user from Supabase Auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isLoginPage = url.pathname === "/admin/login";

    // If unauthenticated:
    if (!user) {
      if (!isLoginPage) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("returnUrl", url.pathname);
        loginUrl.searchParams.set("error", "session_required");
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    // Check if user has admin privileges
    const metadataRole =
      user.app_metadata?.role || user.user_metadata?.role;
    let isAdmin = metadataRole === "admin";

    if (!isAdmin) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      isAdmin = profile?.role === "admin";
    }

    // Authenticated non-admin trying to access admin pages
    if (!isAdmin) {
      if (!isLoginPage) {
        const loginUrl = new URL("/admin/login", request.url);
        loginUrl.searchParams.set("error", "unauthorized");
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    // If authenticated admin visits /admin/login, redirect to /admin/dashboard
    if (isLoginPage) {
      const returnUrl = url.searchParams.get("returnUrl") || "/admin/dashboard";
      return NextResponse.redirect(new URL(returnUrl, request.url));
    }

    return response;
  }

  // 3. User Account Route Protection (/account, /account/*)
  if (url.pathname === "/account" || url.pathname.startsWith("/account/")) {
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient<Database>(userUrl, userAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If unauthenticated guest visits /account/*, redirect to /login with returnUrl
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnUrl", url.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
