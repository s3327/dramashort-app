import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { generatePreviewToken } from "@/lib/auth/preview-token";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";
import { isUuid } from "@/lib/validation/drama";

/**
 * GET /api/admin/dramas/[id]/preview
 * Generates a signed preview token and returns the preview URL for viewing unpublished drafts.
 * Admin only.
 */
export async function GET(
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
    const adminClient = getContentAdminClient();
    const { data: drama, error } = await adminClient
      .from("titles")
      .select("id, slug, status")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/admin/dramas/:id/preview] Supabase error:", error);
      return apiError("DATABASE_ERROR", "Failed to load drama.", 500);
    }
    if (!drama) {
      return apiError("NOT_FOUND", "Drama not found.", 404);
    }

    const token = generatePreviewToken(drama.id, drama.slug);
    const previewUrl = `/drama/${drama.slug}?preview=${token}`;

    return apiSuccess({
      dramaId: drama.id,
      slug: drama.slug,
      status: drama.status,
      token,
      previewUrl,
    });
  } catch (err) {
    console.error("[GET /api/admin/dramas/:id/preview] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/dramas/${id}/preview`,
      method: "GET",
      requestId: request.headers.get("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to generate preview token.", 500);
  }
}
