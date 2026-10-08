import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getAdminUserDetailServer } from "@/lib/server/admin-users";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/[id]
 * Retrieves single user detail including engagement counters and providers.
 * Restricted strictly to the "admin" role.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({ roles: ["admin"] });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "User ID is required.", 400);
  }

  try {
    const userDetail = await getAdminUserDetailServer(id);
    if (!userDetail) {
      return apiError("NOT_FOUND", `User ${id} not found.`, 404);
    }

    return apiSuccess(userDetail);
  } catch (err: unknown) {
    console.error(`[GET /api/admin/users/${id}] Error:`, err);
    return apiError("INTERNAL_ERROR", "Failed to load user details.", 500);
  }
}
