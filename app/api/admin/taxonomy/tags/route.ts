import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  getAdminTagsServer,
  createAdminTagServer,
} from "@/lib/server/admin-taxonomy";
import type { CreateTagInput } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/taxonomy/tags
 * Lists all tags with live database usage counts. Admin only.
 */
export async function GET() {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "taxonomy:read" });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const tags = await getAdminTagsServer();
    return apiSuccess(tags);
  } catch (err: unknown) {
    console.error("[GET /api/admin/taxonomy/tags] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load admin tags.", 500);
  }
}

/**
 * POST /api/admin/taxonomy/tags
 * Creates a new tag. Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "taxonomy:write" });
  if (!auth.authorized) {
    return auth.response;
  }

  let body: CreateTagInput;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const result = await createAdminTagServer(body, {
      id: auth.user.id,
      email: auth.user.email,
    });

    if (!result.ok) {
      return apiError(
        "VALIDATION_ERROR",
        result.error.message || "Failed to create tag.",
        400,
        result.error
      );
    }

    return apiSuccess(result.value, 201);
  } catch (err: unknown) {
    console.error("[POST /api/admin/taxonomy/tags] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to create tag.", 500);
  }
}
