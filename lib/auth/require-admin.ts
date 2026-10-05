import type { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { apiError } from "@/lib/api/responses";
import { getUserRole, type Role } from "./roles";

export interface RequireAdminOptions {
  /**
   * Roles permitted to access the resource.
   * Defaults to ["admin"].
   */
  roles?: Role[];
  /**
   * Optional custom Supabase client (useful for unit testing or custom session contexts)
   */
  client?: any;
}

export type RequireAdminResult =
  | { authorized: true; user: User; role: Role }
  | { authorized: false; response: NextResponse };

/**
 * Server-side guard for Route Handlers and Server Actions.
 *
 * Enforces:
 * 1. An active, valid Supabase authentication session verified by auth.getUser().
 * 2. An authoritative role present in app_metadata (never user_metadata).
 *
 * Returns either { authorized: true, user, role } or an unauthorized/forbidden NextResponse.
 */
export async function requireAdmin(
  options: RequireAdminOptions = {}
): Promise<RequireAdminResult> {
  const allowedRoles = options.roles || ["admin"];

  try {
    const supabase = options.client ?? (await createUserServerClient());

    // Critical security check: ALWAYS call auth.getUser() on the server, NEVER auth.getSession()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        authorized: false,
        response: apiError("UNAUTHORIZED", "Authentication session required.", 401),
      };
    }

    const role = getUserRole(user);

    if (!role || !allowedRoles.includes(role)) {
      return {
        authorized: false,
        response: apiError("FORBIDDEN", "Administrator privileges required.", 403),
      };
    }

    return { authorized: true, user, role };
  } catch (err) {
    console.error("[requireAdmin] Unexpected auth verification failure:", err);
    return {
      authorized: false,
      response: apiError(
        "AUTH_VERIFICATION_ERROR",
        "Internal authentication verification failure.",
        500
      ),
    };
  }
}
