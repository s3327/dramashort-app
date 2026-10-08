import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { mergeTagsServer } from "@/lib/server/admin-taxonomy";
import type { MergeTagsInput } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/taxonomy/tags/merge
 * Merges sourceTag into targetTag, updating all titles.tags and deleting sourceTag. Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  let body: MergeTagsInput;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const result = await mergeTagsServer(body, {
      id: auth.user.id,
      email: auth.user.email,
    });

    if (!result.ok) {
      return apiError(
        "VALIDATION_ERROR",
        result.error.message || "Failed to merge tags.",
        400,
        result.error
      );
    }

    return apiSuccess(result.value);
  } catch (err: unknown) {
    console.error("[POST /api/admin/taxonomy/tags/merge] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to merge tags.", 500);
  }
}
