import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { parseAdminUsersQueryParams } from "@/lib/validation/user-admin";
import { getAdminUsersServer } from "@/lib/server/admin-users";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users
 * Lists managed users with pagination, filters, and engagement counts.
 * Restricted strictly to the "admin" role (blocks "editor" with 403).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin({ roles: ["admin"] });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const query = parseAdminUsersQueryParams(request.nextUrl.searchParams);
    const result = await getAdminUsersServer(query);
    return apiSuccess(result);
  } catch (err: unknown) {
    console.error("[GET /api/admin/users] Error:", err);
    return apiError("INTERNAL_ERROR", "Failed to retrieve user catalog.", 500);
  }
}
