import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  getAdminChannelsServer,
  createAdminChannelServer,
} from "@/lib/server/admin-channels";
import type { CreateChannelInput } from "@/types/content";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/channels
 * Lists all channels with live database drama counts. Admin only.
 */
export async function GET() {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "channels:read" });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const channels = await getAdminChannelsServer();
    return apiSuccess({ channels });
  } catch (err: unknown) {
    console.error("[GET /api/admin/channels] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to load admin channels.", 500);
  }
}

/**
 * POST /api/admin/channels
 * Creates a new channel with slug & code uniqueness and audit logging. Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "channels:write" });
  if (!auth.authorized) {
    return auth.response;
  }

  let body: CreateChannelInput;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  try {
    const result = await createAdminChannelServer(body, auth.user.email);
    if (!result.ok) {
      return apiError(
        "VALIDATION_ERROR",
        result.error[0]?.message || "Validation failed.",
        400,
        result.error
      );
    }

    return apiSuccess(result.value, 201);
  } catch (err: unknown) {
    console.error("[POST /api/admin/channels] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to create channel.", 500);
  }
}
