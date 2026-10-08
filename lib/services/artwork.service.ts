import { adminFetch } from "@/lib/api/admin-fetch";
import { readJsonSafely, getApiErrorMessage } from "@/lib/api/error-message";
import { ARTWORK_LIMITS, type ArtworkType } from "@/lib/validation/artwork";

export interface ArtworkUploadResponse {
  url: string;
  path: string;
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp";
  aspectRatio: number;
  size: number;
  type: ArtworkType;
}

export interface ClientImageValidation {
  valid: boolean;
  width?: number;
  height?: number;
  aspectRatio?: number;
  error?: string;
}

/**
 * Inspects a client-side File using the native Image DOM API.
 * Returns exact natural dimensions and checks aspect ratio/resolution constraints.
 */
export async function validateClientImage(
  file: File,
  type: ArtworkType
): Promise<ClientImageValidation> {
  // 1. Size check
  if (file.size > ARTWORK_LIMITS.maxSizeBytes) {
    const maxMb = (ARTWORK_LIMITS.maxSizeBytes / (1024 * 1024)).toFixed(0);
    const actualMb = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size exceeds ${maxMb} MB limit (${actualMb} MB).`,
    };
  }

  // 2. MIME check
  const mime = file.type.toLowerCase().trim();
  if (!(ARTWORK_LIMITS.allowedMimeTypes as readonly string[]).includes(mime)) {
    return {
      valid: false,
      error: `Unsupported image format (${file.type || "unknown"}). Allowed: JPEG, PNG, WebP.`,
    };
  }

  // 3. Browser dimension check
  if (typeof window === "undefined") {
    return { valid: true };
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const width = img.naturalWidth;
      const height = img.naturalHeight;

      if (!width || !height) {
        resolve({
          valid: false,
          error: "Could not read image dimensions.",
        });
        return;
      }

      const aspectRatio = width / height;

      if (type === "poster") {
        const spec = ARTWORK_LIMITS.poster;
        if (width < spec.minWidth || height < spec.minHeight) {
          resolve({
            valid: false,
            width,
            height,
            aspectRatio,
            error: `Poster is too small (${width}x${height}px). Minimum required is ${spec.minWidth}x${spec.minHeight}px.`,
          });
          return;
        }

        if (aspectRatio < spec.minRatio || aspectRatio > spec.maxRatio) {
          resolve({
            valid: false,
            width,
            height,
            aspectRatio,
            error: `Poster aspect ratio must be ~2:3 vertical (current: ${aspectRatio.toFixed(2)} [${width}x${height}px]).`,
          });
          return;
        }
      } else if (type === "banner") {
        const spec = ARTWORK_LIMITS.banner;
        if (width < spec.minWidth || height < spec.minHeight) {
          resolve({
            valid: false,
            width,
            height,
            aspectRatio,
            error: `Banner is too small (${width}x${height}px). Minimum required is ${spec.minWidth}x${spec.minHeight}px.`,
          });
          return;
        }

        if (aspectRatio < spec.minRatio || aspectRatio > spec.maxRatio) {
          resolve({
            valid: false,
            width,
            height,
            aspectRatio,
            error: `Banner aspect ratio must be ~16:9 landscape (current: ${aspectRatio.toFixed(2)} [${width}x${height}px]).`,
          });
          return;
        }
      }

      resolve({
        valid: true,
        width,
        height,
        aspectRatio,
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        valid: false,
        error: "Failed to parse image file. Ensure file is a valid image.",
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Uploads an artwork file (poster or banner) to the backend API.
 */
export async function uploadArtwork(
  file: File,
  type: ArtworkType
): Promise<{ success: boolean; data?: ArtworkUploadResponse; error?: string }> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const res = await adminFetch("/api/admin/artwork/upload", {
      method: "POST",
      body: formData,
    });

    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: ArtworkUploadResponse;
      error?: string;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Upload failed with HTTP ${res.status}`),
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error during artwork upload.";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Requests a signed upload URL for direct storage upload.
 */
export async function getArtworkSignedUrl(params: {
  type: ArtworkType;
  filename: string;
  mimeType: string;
  fileSize?: number;
}): Promise<{
  success: boolean;
  data?: { signedUrl: string; token: string; path: string; publicUrl: string };
  error?: string;
}> {
  try {
    const res = await adminFetch("/api/admin/artwork/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: { signedUrl: string; token: string; path: string; publicUrl: string };
      error?: string;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Signed URL request failed with HTTP ${res.status}`),
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error requesting signed URL.";
    return {
      success: false,
      error: msg,
    };
  }
}
