import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  getAdminGenreByIdServer,
  updateAdminGenreServer,
  deleteAdminGenreServer,
} from "@/lib/server/admin-taxonomy";
import type { UpdateGenreInput } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/taxonomy/genres/[id]
 * Retrieves details and drama count for a single genre. Admin only.
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
    return apiError("VALIDATION_ERROR", "Genre ID is required.", 400);
  }

  try {
    const genre = await getAdminGenreByIdServer(id);
    if (!genre) {
      return apiError("NOT_FOUND", "Genre not found.", 404);
    }

    return apiSuccess(genre);
  } catch (err: unknown) {
    console.error("[GET /api/admin/taxonomy/genres/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load genre.", 500);
  }
}

/**
 * PATCH /api/admin/taxonomy/genres/[id]
 * Updates genre metadata with rename propagation across titles. Admin only.
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
    return apiError("VALIDATION_ERROR", "Genre ID is required.", 400);
  }

  let body: UpdateGenreInput;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const result = await updateAdminGenreServer(id, body, {
      id: auth.user.id,
      email: auth.user.email,
    });

    if (!result.ok) {
      return apiError(
        "VALIDATION_ERROR",
        result.error.message || "Failed to update genre.",
        400,
        result.error
      );
    }

    return apiSuccess(result.value);
  } catch (err: unknown) {
    console.error("[PATCH /api/admin/taxonomy/genres/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to update genre.", 500);
  }
}

/**
 * DELETE /api/admin/taxonomy/genres/[id]
 * Deletes a genre. Prevents deletion if any active dramas belong to it unless ?force=true.
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
    return apiError("VALIDATION_ERROR", "Genre ID is required.", 400);
  }

  const force = request.nextUrl.searchParams.get("force") === "true";

  try {
    const result = await deleteAdminGenreServer(
      id,
      { id: auth.user.id, email: auth.user.email },
      { force }
    );

    if (!result.ok) {
      if (result.error.code === "CONFLICT") {
        return apiError("CONFLICT", result.error.message, 409, {
          dramaCount: result.error.count,
        });
      }
      return apiError("VALIDATION_ERROR", result.error.message, 400);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/admin/taxonomy/genres/[id]] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to delete genre.", 500);
  }
}
