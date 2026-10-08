import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isUuid } from "@/lib/validation/drama";
import {
  validateSingleEpisodePayload,
  validateBulkRangePayload,
  validateBulkMediaPayload,
  validateReorderPayload,
} from "@/lib/validation/episode";
import {
  getAdminEpisodesServer,
  createAdminEpisodeServer,
  bulkCreateAdminEpisodesServer,
  bulkAssignMediaServer,
  reorderAdminEpisodesServer,
  updateFreeEpisodesCountServer,
} from "@/lib/server/admin-episodes";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";

/**
 * GET /api/admin/dramas/[id]/episodes
 * Lists all episodes for a drama with joined media status. Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "episodes:read" });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("INVALID_ID", "Drama id must be a UUID.", 400);
  }

  try {
    const res = await getAdminEpisodesServer(id);
    if (!res.ok) {
      return apiError("DATABASE_ERROR", res.error, 500);
    }

    return apiSuccess(res.value);
  } catch (err: unknown) {
    console.error("[GET /api/admin/dramas/:id/episodes] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/dramas/${id}/episodes`,
      method: "GET",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to load episodes.", 500);
  }
}

/**
 * POST /api/admin/dramas/[id]/episodes
 * Handles single episode creation, bulk range generation, bulk media assignment,
 * episode reordering, and updating free episode count. Admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "episodes:write" });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("INVALID_ID", "Drama id must be a UUID.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object") {
    return apiError("VALIDATION_ERROR", "Request body must be a JSON object.", 400);
  }

  const mode = (body as Record<string, unknown>).mode || "single";
  const actor = {
    id: auth.user.id,
    email: auth.user.email,
    ip: request.headers.get("x-forwarded-for") || undefined,
  };

  try {
    // 1. Single Episode Creation
    if (mode === "single") {
      const validation = validateSingleEpisodePayload(body, "create");
      if (!validation.ok) {
        return apiError("VALIDATION_ERROR", "Invalid episode payload.", 400, validation.errors);
      }

      const res = await createAdminEpisodeServer(id, validation.value, actor);
      if (!res.ok) {
        return apiError("DATABASE_ERROR", res.error, 400);
      }

      return apiSuccess(res.value, 201);
    }

    // 2. Bulk Range Generation
    if (mode === "bulk_range") {
      const validation = validateBulkRangePayload(body);
      if (!validation.ok) {
        return apiError("VALIDATION_ERROR", "Invalid bulk range payload.", 400, validation.errors);
      }

      const res = await bulkCreateAdminEpisodesServer(id, validation.value, actor);
      if (!res.ok) {
        return apiError("DATABASE_ERROR", res.error, 400);
      }

      return apiSuccess(res.value, 201);
    }

    // 3. Bulk Media Assignment
    if (mode === "bulk_media") {
      const validation = validateBulkMediaPayload(body);
      if (!validation.ok) {
        return apiError("VALIDATION_ERROR", "Invalid bulk media payload.", 400, validation.errors);
      }

      const res = await bulkAssignMediaServer(id, validation.value);
      if (!res.ok) {
        return apiError("DATABASE_ERROR", res.error, 400);
      }

      return apiSuccess(res.value);
    }

    // 4. Reorder Episodes
    if (mode === "reorder") {
      const validation = validateReorderPayload(body);
      if (!validation.ok) {
        return apiError("VALIDATION_ERROR", "Invalid reorder payload.", 400, validation.errors);
      }

      const res = await reorderAdminEpisodesServer(id, validation.value.orderedEpisodeIds, actor);
      if (!res.ok) {
        return apiError("DATABASE_ERROR", res.error, 400);
      }

      return apiSuccess(res.value);
    }

    // 5. Update Free Episodes Count
    if (mode === "update_free_count") {
      const count = Number((body as Record<string, unknown>).freeEpisodesCount);
      if (!Number.isInteger(count) || count < 0) {
        return apiError("VALIDATION_ERROR", "freeEpisodesCount must be an integer >= 0.", 400, [
          { field: "freeEpisodesCount", message: "freeEpisodesCount must be an integer >= 0." },
        ]);
      }

      const syncExisting = (body as Record<string, unknown>).syncExistingEpisodes !== false;
      const res = await updateFreeEpisodesCountServer(id, count, syncExisting);
      if (!res.ok) {
        return apiError("DATABASE_ERROR", res.error, 400);
      }

      return apiSuccess(res.value);
    }

    return apiError("VALIDATION_ERROR", `Unsupported operation mode: ${String(mode)}`, 400);
  } catch (err: unknown) {
    console.error("[POST /api/admin/dramas/:id/episodes] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/dramas/${id}/episodes`,
      method: "POST",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to process episode operation.", 500);
  }
}
