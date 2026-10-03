import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { getUserRole, type Role } from "./roles";

export interface RequireAdminOptions {
  /**
   * Roles permitted to access the resource.
   * Defaults to ["admin"].
   */
  roles?: Role[];
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
    const supabase = await createUserServerClient();

    // Critical security check: ALWAYS call auth.getUser() on the server, NEVER auth.getSession()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            success: false,
            error: {
              code: "UNAUTHORIZED",
              message: "Authentication session required.",
            },
          },
          { status: 401 }
        ),
      };
    }

    const role = getUserRole(user);

    if (!role || !allowedRoles.includes(role)) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Administrator privileges required.",
            },
          },
          { status: 403 }
        ),
      };
    }

    return { authorized: true, user, role };
  } catch (err) {
    console.error("[requireAdmin] Unexpected auth verification failure:", err);
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error: {
            code: "AUTH_VERIFICATION_ERROR",
            message: "Internal authentication verification failure.",
          },
        },
        { status: 500 }
      ),
    };
  }
}
