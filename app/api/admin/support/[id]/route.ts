import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { isUuid } from "@/lib/validation/drama";
import {
  getAdminSupportTicketByIdServer,
  updateAdminSupportTicketServer,
} from "@/lib/server/admin-support";
import { validateUpdateSupportTicket } from "@/lib/validation/support";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({
    roles: ["admin"],
    permission: "support:read",
  });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id || !isUuid(id)) {
    return apiError("VALIDATION_ERROR", "Invalid support ticket UUID.", 400);
  }

  const result = await getAdminSupportTicketByIdServer(id);
  if (!result.ok) {
    return apiError("NOT_FOUND", result.error, 404);
  }

  return apiSuccess(result.value);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin({
    roles: ["admin"],
    permission: "support:write",
  });
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!id || !isUuid(id)) {
    return apiError("VALIDATION_ERROR", "Invalid support ticket UUID.", 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Malformed JSON request body.", 400);
  }

  const validation = validateUpdateSupportTicket(body);
  if (!validation.ok) {
    return apiError("VALIDATION_ERROR", validation.error, 400);
  }

  const result = await updateAdminSupportTicketServer(
    id,
    validation.value,
    { id: auth.user.id, email: auth.user.email }
  );

  if (!result.ok) {
    return apiError("DATABASE_ERROR", result.error, 500);
  }

  return apiSuccess(result.value);
}
