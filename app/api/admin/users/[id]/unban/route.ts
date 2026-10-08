import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { validateUnbanUserPayload } from "@/lib/validation/user-admin";
import { unbanUserServer } from "@/lib/server/admin-users";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/unban
 * Unbans a user account, lifting all authentication restrictions.
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

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const validation = validateUnbanUserPayload(body);
  if (!validation.ok || !validation.value) {
    return apiError("VALIDATION_ERROR", validation.errors[0]?.message || "Invalid unban parameters.", 400, {
      errors: validation.errors,
    });
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;

  try {
    const updatedUser = await unbanUserServer(id, validation.value, {
      id: auth.user.id,
      email: auth.user.email,
      ip,
    });

    return apiSuccess(updatedUser);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to unban user.";
    if (message.includes("not found")) {
      return apiError("NOT_FOUND", message, 404);
    }

    console.error(`[POST /api/admin/users/${id}/unban] Error:`, err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
