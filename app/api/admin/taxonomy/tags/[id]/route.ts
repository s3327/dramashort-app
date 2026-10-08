import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  getAdminTagByIdServer,
  updateAdminTagServer,
  deleteAdminTagServer,
} from "@/lib/server/admin-taxonomy";
import type { UpdateTagInput } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/taxonomy/tags/[id]
 * Retrieves details and usage count for a single tag. Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "taxonomy:read" });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Tag ID is required.", 400);
  }

  try {
    const tag = await getAdminTagByIdServer(id);
    if (!tag) {
      return apiError("NOT_FOUND", "Tag not found.", 404);
    }

    return apiSuccess(tag);
  } catch (err: unknown) {
    console.error("[GET /api/admin/taxonomy/tags/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load tag.", 500);
  }
}

/**
 * PATCH /api/admin/taxonomy/tags/[id]
 * Updates tag metadata with rename propagation across titles.tags. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "taxonomy:write" });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Tag ID is required.", 400);
  }

  let body: UpdateTagInput;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const result = await updateAdminTagServer(id, body, {
      id: auth.user.id,
      email: auth.user.email,
    });

    if (!result.ok) {
      return apiError(
        "VALIDATION_ERROR",
        result.error.message || "Failed to update tag.",
        400,
        result.error
      );
    }

    return apiSuccess(result.value);
  } catch (err: unknown) {
    console.error("[PATCH /api/admin/taxonomy/tags/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to update tag.", 500);
  }
}

/**
 * DELETE /api/admin/taxonomy/tags/[id]
 * Deletes a tag. Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "taxonomy:write" });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id) {
    return apiError("VALIDATION_ERROR", "Tag ID is required.", 400);
  }

  const removeFromTitles =
    request.nextUrl.searchParams.get("removeFromTitles") === "true";

  try {
    const result = await deleteAdminTagServer(
      id,
      { id: auth.user.id, email: auth.user.email },
      { removeFromTitles }
    );

    if (!result.ok) {
      return apiError("VALIDATION_ERROR", result.error.message, 400);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/admin/taxonomy/tags/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to delete tag.", 500);
  }
}
