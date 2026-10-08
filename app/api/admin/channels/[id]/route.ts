import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  getAdminChannelByIdServer,
  updateAdminChannelServer,
  deleteAdminChannelServer,
} from "@/lib/server/admin-channels";
import type { UpdateChannelInput } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/channels/[id]
 * Retrieves details and drama count for a single channel. Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Channel ID is required.", 400);
  }

  try {
    const channel = await getAdminChannelByIdServer(id);
    if (!channel) {
      return apiError("NOT_FOUND", "Channel not found.", 404);
    }

    return apiSuccess(channel);
  } catch (err: unknown) {
    console.error("[GET /api/admin/channels/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load channel.", 500);
  }
}

/**
 * PATCH /api/admin/channels/[id]
 * Updates channel metadata with cascade updates to titles and audit log. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Channel ID is required.", 400);
  }

  let body: UpdateChannelInput;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const result = await updateAdminChannelServer(id, body, auth.user.email);
    if (!result.ok) {
      const isNotFound = result.error.some((e) => e.message === "Channel not found.");
      return apiError(
        isNotFound ? "NOT_FOUND" : "VALIDATION_ERROR",
        result.error[0]?.message || "Failed to update channel.",
        isNotFound ? 404 : 400,
        result.error
      );
    }

    return apiSuccess(result.value);
  } catch (err: unknown) {
    console.error("[PATCH /api/admin/channels/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to update channel.", 500);
  }
}

/**
 * DELETE /api/admin/channels/[id]
 * Safely deletes a channel. Blocks deletion with 409 Conflict if active dramas exist. Admin only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Channel ID is required.", 400);
  }

  try {
    const result = await deleteAdminChannelServer(id, auth.user.email);
    if (!result.ok) {
      if (result.error.count && result.error.count > 0) {
        return apiError("CONFLICT", result.error.message, 409, [
          { field: "dramas", message: result.error.message },
        ]);
      }
      return apiError("NOT_FOUND", result.error.message, 404);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/admin/channels/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to delete channel.", 500);
  }
}
