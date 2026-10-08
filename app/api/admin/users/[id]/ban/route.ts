import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { validateBanUserPayload } from "@/lib/validation/user-admin";
import { banUserServer } from "@/lib/server/admin-users";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/ban
 * Bans a user account for a specified duration or permanently.
 * Restricted strictly to the "admin" role. Self-ban is prohibited.
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
    // Body is optional for ban (defaults to permanent)
  }

  const validation = validateBanUserPayload(body);
  if (!validation.ok || !validation.value) {
    return apiError("VALIDATION_ERROR", validation.errors[0]?.message || "Invalid ban parameters.", 400, {
      errors: validation.errors,
    });
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;

  try {
    const updatedUser = await banUserServer(id, validation.value, {
      id: auth.user.id,
      email: auth.user.email,
      ip,
    });

    return apiSuccess(updatedUser);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to ban user.";
    if (message.includes("Cannot ban your own")) {
      return apiError("CONFLICT", message, 409);
    }
    if (message.includes("not found")) {
      return apiError("NOT_FOUND", message, 404);
    }

    console.error(`[POST /api/admin/users/${id}/ban] Error:`, err);
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
