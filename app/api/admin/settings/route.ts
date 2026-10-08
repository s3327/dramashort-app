import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { validateSettingsPayload, isValidSection } from "@/lib/validation/settings";
import {
  getPlatformSettingsServer,
  updatePlatformSettingSectionServer,
} from "@/lib/server/settings";
import type { SettingsSection } from "@/types/settings";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/settings
 * Retrieves full platform settings or a specific section.
 * Accessible to authorized staff (admin & editor).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin({ roles: ["admin", "editor"] });
  if (!auth.authorized) {
    return auth.response;
  }

  const section = request.nextUrl.searchParams.get("section");

  try {
    const settings = await getPlatformSettingsServer();

    if (section && isValidSection(section)) {
      return apiSuccess(settings[section]);
    }

    return apiSuccess(settings);
  } catch (err: unknown) {
    console.error("[GET /api/admin/settings] Error:", err);
    return apiError("INTERNAL_ERROR", "Failed to retrieve platform settings.", 500);
  }
}

/**
 * PATCH /api/admin/settings
 * Updates a specific settings section and writes structured audit logs.
 * Restricted strictly to the "admin" role (editor receives 403).
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin({ roles: ["admin"] });
  if (!auth.authorized) {
    return auth.response;
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Request body must be valid JSON.", 400);
  }

  const raw = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const section = raw.section as string;
  const values = raw.values;

  const validation = validateSettingsPayload(section, values);
  if (!validation.ok || !validation.value) {
    return apiError(
      "VALIDATION_ERROR",
      validation.errors[0]?.message || "Invalid settings payload.",
      400,
      { errors: validation.errors }
    );
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;

  try {
    const updated = await updatePlatformSettingSectionServer(
      section as SettingsSection,
      validation.value,
      {
        id: auth.user.id,
        email: auth.user.email,
        ip,
      }
    );

    const response = apiSuccess({ section, values: updated });

    // If general section was updated, set fast maintenance cookie
    if (section === "general" && typeof validation.value.maintenanceMode === "boolean") {
      response.cookies.set("ds_maint", validation.value.maintenanceMode ? "1" : "0", {
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        maxAge: 300, // 5 minutes
      });
    }

    return response;
  } catch (err: unknown) {
    console.error(`[PATCH /api/admin/settings] Error updating section "${section}":`, err);
    return apiError("INTERNAL_ERROR", "Failed to update platform settings.", 500);
  }
}
