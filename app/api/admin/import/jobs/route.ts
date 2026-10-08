import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getImportJobsServer } from "@/lib/server/admin-import";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin({
    roles: ["admin", "editor"],
    permission: "import:read",
  });
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);

  const result = await getImportJobsServer({ page, pageSize });

  if (!result.ok) {
    return apiError("DATABASE_ERROR", result.error, 500);
  }

  return apiSuccess(result.value);
}
