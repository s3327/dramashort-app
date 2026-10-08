import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { executeImportJobServer } from "@/lib/server/admin-import";
import type { ImportSourceFormat } from "@/types/import";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin({
    roles: ["admin", "editor"],
    permission: "import:write",
  });
  if (!auth.authorized) {
    return auth.response;
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Malformed JSON request body.", 400);
  }

  const { content, format, fileName } = body || {};

  if (!content || typeof content !== "string" || !content.trim()) {
    return apiError("VALIDATION_ERROR", "Manifest content is required.", 400);
  }

  const validFormats: ImportSourceFormat[] = ["dramaboss", "custom_json", "custom_csv"];
  if (!format || !validFormats.includes(format)) {
    return apiError(
      "VALIDATION_ERROR",
      `Invalid format. Must be one of: ${validFormats.join(", ")}`,
      400
    );
  }

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
  const result = await executeImportJobServer(
    content,
    format,
    { id: auth.user.id, email: auth.user.email, ip },
    fileName
  );

  if (!result.ok) {
    return apiError("DATABASE_ERROR", result.error, 500);
  }

  return apiSuccess(result.value);
}
