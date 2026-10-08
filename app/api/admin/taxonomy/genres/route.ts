import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  getAdminGenresServer,
  createAdminGenreServer,
} from "@/lib/server/admin-taxonomy";
import type { CreateGenreInput } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/taxonomy/genres
 * Lists all genres with live database drama counts. Admin only.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const genres = await getAdminGenresServer();
    return apiSuccess(genres);
  } catch (err: unknown) {
    console.error("[GET /api/admin/taxonomy/genres] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load admin genres.", 500);
  }
}

/**
 * POST /api/admin/taxonomy/genres
 * Creates a new genre. Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  let body: CreateGenreInput;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const result = await createAdminGenreServer(body, {
      id: auth.user.id,
      email: auth.user.email,
    });

    if (!result.ok) {
      return apiError(
        "VALIDATION_ERROR",
        result.error.message || "Failed to create genre.",
        400,
        result.error
      );
    }

    return apiSuccess(result.value, 201);
  } catch (err: unknown) {
    console.error("[POST /api/admin/taxonomy/genres] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to create genre.", 500);
  }
}
