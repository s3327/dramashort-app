import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isUuid } from "@/lib/validation/drama";
import { validateSingleEpisodePayload } from "@/lib/validation/episode";
import {
  updateAdminEpisodeServer,
  deleteAdminEpisodeServer,
} from "@/lib/server/admin-episodes";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";

/**
 * PATCH /api/admin/episodes/[episodeId]
 * Updates episode metadata and associated media assets. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { episodeId } = await params;
  if (!isUuid(episodeId)) {
    return apiError("INVALID_ID", "Episode id must be a UUID.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const validation = validateSingleEpisodePayload(body, "update");
  if (!validation.ok) {
    return apiError("VALIDATION_ERROR", "Invalid episode payload.", 400, validation.errors);
  }

  try {
    const res = await updateAdminEpisodeServer(episodeId, validation.value);
    if (!res.ok) {
      return apiError("DATABASE_ERROR", res.error, 400);
    }

    return apiSuccess(res.value);
  } catch (err: unknown) {
    console.error("[PATCH /api/admin/episodes/:episodeId] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/episodes/${episodeId}`,
      method: "PATCH",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to update episode.", 500);
  }
}

/**
 * DELETE /api/admin/episodes/[episodeId]
 * Deletes an episode and renumbers remaining episodes under UNIQUE(title_id, episode_number). Admin only.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ episodeId: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { episodeId } = await params;
  if (!isUuid(episodeId)) {
    return apiError("INVALID_ID", "Episode id must be a UUID.", 400);
  }

  try {
    const res = await deleteAdminEpisodeServer(episodeId);
    if (!res.ok) {
      return apiError("DATABASE_ERROR", res.error, 400);
    }

    return apiSuccess({ deleted: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/admin/episodes/:episodeId] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/episodes/${episodeId}`,
      method: "DELETE",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to delete episode.", 500);
  }
}
