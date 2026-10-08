import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";
import { ARTWORK_LIMITS, type ArtworkType } from "@/lib/validation/artwork";

export const dynamic = "force-dynamic";

interface SignedUrlRequest {
  type: ArtworkType;
  filename: string;
  mimeType: string;
  fileSize?: number;
}

/**
 * POST /api/admin/artwork/signed-url
 * Generates a signed upload URL for direct-to-storage artwork upload.
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  let body: SignedUrlRequest;
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid JSON body.", 400);
  }

  const { type, filename, mimeType, fileSize } = body;

  if (type !== "poster" && type !== "banner") {
    return apiError(
      "VALIDATION_ERROR",
      "Artwork type must be 'poster' or 'banner'.",
      400,
      [{ field: "type", message: "Type must be 'poster' or 'banner'." }]
    );
  }

  const normalizedMime = (mimeType || "").toLowerCase().trim();
  if (!(ARTWORK_LIMITS.allowedMimeTypes as readonly string[]).includes(normalizedMime)) {
    return apiError(
      "VALIDATION_ERROR",
      `Unsupported mimeType (${mimeType}). Supported: JPEG, PNG, WebP.`,
      400,
      [{ field: "mimeType", message: "Must be image/jpeg, image/png, or image/webp." }]
    );
  }

  if (typeof fileSize === "number" && fileSize > ARTWORK_LIMITS.maxSizeBytes) {
    return apiError(
      "VALIDATION_ERROR",
      `File size exceeds ${ARTWORK_LIMITS.maxSizeBytes / (1024 * 1024)} MB limit.`,
      400,
      [{ field: "fileSize", message: "Exceeds max file size limit." }]
    );
  }

  try {
    let ext = "jpg";
    if (normalizedMime === "image/png") ext = "png";
    else if (normalizedMime === "image/webp") ext = "webp";
    else if (filename && filename.includes(".")) {
      const parts = filename.split(".");
      const candidateExt = parts[parts.length - 1].toLowerCase();
      if (["jpg", "jpeg", "png", "webp"].includes(candidateExt)) {
        ext = candidateExt === "jpeg" ? "jpg" : candidateExt;
      }
    }

    const storagePath = `${type}s/${Date.now()}-${randomUUID()}.${ext}`;
    const adminClient = getContentAdminClient();

    const { data, error } = await adminClient.storage
      .from("artwork")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error("[POST /api/admin/artwork/signed-url] Supabase error:", error);
      return apiError("DATABASE_ERROR", "Failed to generate signed upload URL.", 500);
    }

    const { data: publicUrlData } = adminClient.storage
      .from("artwork")
      .getPublicUrl(storagePath);

    return apiSuccess(
      {
        signedUrl: data.signedUrl,
        token: data.token,
        path: storagePath,
        publicUrl: publicUrlData.publicUrl,
        type,
      },
      200
    );
  } catch (err: unknown) {
    console.error("[POST /api/admin/artwork/signed-url] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/artwork/signed-url",
      method: "POST",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("INTERNAL_ERROR", "Failed to create signed URL.", 500);
  }
}
