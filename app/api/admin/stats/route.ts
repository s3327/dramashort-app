import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiSuccess } from "@/lib/api/responses";
import { getAdminDashboardStats } from "@/lib/services/analytics.service";

/**
 * GET /api/admin/stats
 * Returns consolidated live platform metrics and episode retention curves for the Admin Dashboard.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin({ roles: ["admin", "editor"], permission: "stats:read" });
  if (!auth.authorized) {
    return auth.response;
  }

  const url = request ? new URL(request.url) : new URL("http://localhost/api/admin/stats");
  const slug = url.searchParams.get("slug")?.trim() || undefined;

  const stats = await getAdminDashboardStats(slug);
  return apiSuccess(stats);
}
