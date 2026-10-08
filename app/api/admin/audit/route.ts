import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { parseAuditLogsQueryParams } from "@/lib/validation/audit";
import { getAuditLogsServer } from "@/lib/server/audit";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/audit
 * Server-side filtered and paginated listing of administrative audit logs.
 * Strictly admin-only (superusers). Editors receive 403 Forbidden.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin({ roles: ["admin"], permission: "audit:read" });
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const query = parseAuditLogsQueryParams(request.nextUrl.searchParams);
    const result = await getAuditLogsServer(query);

    if (!result.ok) {
      return apiError("DATABASE_ERROR", result.error, 500);
    }

    return apiSuccess(result.value);
  } catch (err: unknown) {
    console.error("[GET /api/admin/audit] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/audit",
      method: "GET",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("INTERNAL_ERROR", "Failed to retrieve audit logs.", 500);
  }
}
