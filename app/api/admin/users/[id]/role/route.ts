import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { validateUpdateRolePayload } from "@/lib/validation/user-admin";
import { updateUserRoleServer } from "@/lib/server/admin-users";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/admin/users/[id]/role
 * Updates authoritative user role (user, editor, admin) in app_metadata & profiles.
 * Restricted strictly to the "admin" role. Self-demotion is prohibited.
 */
export async function PATCH(
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
    return apiError("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  }

  const validation = validateUpdateRolePayload(body);
  if (!validation.ok || !validation.value) {
    return apiError("VALIDATION_ERROR", validation.errors[0]?.message || "Invalid role payload.", 400, {
      errors: validation.errors,
    });
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;

  try {
    const updatedUser = await updateUserRoleServer(id, validation.value.role, {
      id: auth.user.id,
      email: auth.user.email,
      ip,
    });

    return apiSuccess(updatedUser);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update user role.";
    if (message.includes("Cannot remove admin privileges")) {
      return apiError("CONFLICT", message, 409);
    }
    if (message.includes("not found")) {
      return apiError("NOT_FOUND", message, 404);
    }

    console.error(`[PATCH /api/admin/users/${id}/role] Error:`, err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
