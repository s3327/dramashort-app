import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { bulkUpdateDramasServer, type BulkDramaAction } from "@/lib/server/admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";

/**
 * POST /api/admin/dramas/bulk
 * Executes bulk operations on selected dramas (publish, unpublish, archive, move_channel).
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const { action, ids, channelName } = body || {};

  if (!action || typeof action !== "string") {
    return apiError("VALIDATION_ERROR", "action is required.", 400);
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return apiError("VALIDATION_ERROR", "ids must be a non-empty array of drama UUIDs.", 400);
  }

  try {
    const res = await bulkUpdateDramasServer({
      action: action as BulkDramaAction,
      ids,
      channelName,
      actor: {
        id: auth.user.id,
        email: auth.user.email,
        ip: request.headers.get("x-forwarded-for") || undefined,
      },
    });

    if (!res.ok) {
      return apiError("VALIDATION_ERROR", res.error, 400);
    }

    return apiSuccess(res.value);
  } catch (err) {
    console.error("[POST /api/admin/dramas/bulk] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/dramas/bulk",
      method: "POST",
      requestId: request.headers.get("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to execute bulk operation.", 500);
  }
}
