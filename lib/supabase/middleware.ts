import type { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-user";

const userUrl =
  process.env.NEXT_PUBLIC_USER_SUPABASE_URL || "https://placeholder.supabase.co";
const userAnonKey =
  process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || "placeholder-anon-key";

type PendingCookie = { name: string; value: string; options: CookieOptions };

export interface MiddlewareSession {
  /** Verified user (only when `verify: true`); null otherwise. */
  user: User | null;
  /** Copies refreshed auth cookies onto any response (next, rewrite, redirect, JSON). */
  withSessionCookies<T extends NextResponse>(response: T): T;
}

/** True when the request carries a Supabase auth cookie (possibly chunked). */
export function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
}

/**
 * Refreshes the Supabase session for this request (Task 10.4).
 *
 * - `verify: true`: calls auth.getUser() (Auth server round trip) — required for
 *   any authorization decision.
 * - `verify: false`: refreshes an expiring token via auth.getSession() only when
 *   an auth cookie exists; guests cost no network call. The result is never used
 *   for authorization.
 *
 * Refreshed cookies are written to the forwarded request (so Server Components
 * and route handlers see the new session) and replayed onto the final response.
 */
export async function updateSession(
  request: NextRequest,
  { verify }: { verify: boolean }
): Promise<MiddlewareSession> {
  const pending: PendingCookie[] = [];

  const supabase = createServerClient<Database>(userUrl, userAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pending.push({ name, value, options });
        });
      },
    },
  });

  let user: User | null = null;
  if (verify) {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } else if (hasAuthCookie(request)) {
    await supabase.auth.getSession();
  }

  return {
    user,
    withSessionCookies(response) {
      pending.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    },
  };
}
