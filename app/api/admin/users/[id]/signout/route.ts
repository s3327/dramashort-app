import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { forceSignOutUserServer } from "@/lib/server/admin-users";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/signout
 * Force revokes all active authentication sessions for a user.
 * Restricted strictly to the "admin" role.
 */
export async function POST(
  request: NextRequest,
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

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;

  try {
    const result = await forceSignOutUserServer(id, {
      id: auth.user.id,
      email: auth.user.email,
      ip,
    });

    return apiSuccess(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to force sign-out user.";
    if (message.includes("not found")) {
      return apiError("NOT_FOUND", message, 404);
    }

    console.error(`[POST /api/admin/users/${id}/signout] Error:`, err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
