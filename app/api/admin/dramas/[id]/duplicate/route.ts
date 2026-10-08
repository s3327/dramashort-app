import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { duplicateDramaServer } from "@/lib/server/admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";
import { isUuid } from "@/lib/validation/drama";

/**
 * POST /api/admin/dramas/[id]/duplicate
 * Clones metadata of an existing drama into a new Draft drama.
 * Admin only.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("INVALID_ID", "Drama id must be a valid UUID.", 400);
  }

  try {
    const res = await duplicateDramaServer(id, {
      id: auth.user.id,
      email: auth.user.email,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    if (!res.ok) {
      if (res.error === "Drama not found") {
        return apiError("NOT_FOUND", "Drama not found.", 404);
      }
      return apiError("DATABASE_ERROR", res.error, 500);
    }

    return apiSuccess(res.value, 201);
  } catch (err) {
    console.error("[POST /api/admin/dramas/:id/duplicate] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/dramas/${id}/duplicate`,
      method: "POST",
      requestId: request.headers.get("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to duplicate drama.", 500);
  }
}
