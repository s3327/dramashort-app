import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";
import {
  validateArtworkFile,
  type ArtworkType,
} from "@/lib/validation/artwork";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/artwork/upload
 * Handles multipart/form-data upload of drama posters (2:3) and banners (16:9).
 * Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (err) {
    return apiError("VALIDATION_ERROR", "Invalid form data.", 400);
  }

  const file = formData.get("file");
  const rawType = formData.get("type");

  if (!file || !(file instanceof Blob)) {
    return apiError("VALIDATION_ERROR", "A valid image file is required.", 400, [
      { field: "file", message: "File missing or invalid in upload payload." },
    ]);
  }

  if (rawType !== "poster" && rawType !== "banner") {
    return apiError(
      "VALIDATION_ERROR",
      "Artwork type must be 'poster' or 'banner'.",
      400,
      [{ field: "type", message: "Type must be 'poster' or 'banner'." }]
    );
  }

  const artworkType = rawType as ArtworkType;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate size, MIME type, magic bytes, dimensions, and aspect ratio
    const validation = validateArtworkFile(buffer, file.type, artworkType);
    if (!validation.ok) {
      return apiError("VALIDATION_ERROR", validation.error, 400, [
        { field: "file", message: validation.error },
      ]);
    }

    const { width, height, format, aspectRatio, size } = validation.value;
    const adminClient = getContentAdminClient();

    // Generate clean storage path in artwork bucket
    const fileExt = format === "jpeg" ? "jpg" : format;
    const storagePath = `${artworkType}s/${Date.now()}-${randomUUID()}.${fileExt}`;

    const { error: uploadError } = await adminClient.storage
      .from("artwork")
      .upload(storagePath, buffer, {
        contentType: file.type || `image/${format}`,
        upsert: true,
      });

    if (uploadError) {
      console.error("[POST /api/admin/artwork/upload] Supabase Storage upload error:", uploadError);
      return apiError("DATABASE_ERROR", "Failed to store artwork in storage bucket.", 500);
    }

    const { data: publicUrlData } = adminClient.storage
      .from("artwork")
      .getPublicUrl(storagePath);

    return apiSuccess(
      {
        url: publicUrlData.publicUrl,
        path: storagePath,
        width,
        height,
        format,
        aspectRatio,
        size,
        type: artworkType,
      },
      201
    );
  } catch (err: unknown) {
    console.error("[POST /api/admin/artwork/upload] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/artwork/upload",
      method: "POST",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("INTERNAL_ERROR", "Failed to process artwork upload.", 500);
  }
}
