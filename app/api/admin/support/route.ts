import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { getAdminSupportTicketsServer } from "@/lib/server/admin-support";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin({
    roles: ["admin"],
    permission: "support:read",
  });
  if (!auth.authorized) {
    return auth.response;
  }

  const searchParams = req.nextUrl.searchParams;
  const result = await getAdminSupportTicketsServer(searchParams);

  if (!result.ok) {
    return apiError("DATABASE_ERROR", result.error, 500);
  }

  return apiSuccess(result.value);
}
