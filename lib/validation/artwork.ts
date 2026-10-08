/**
 * Artwork validation engine for Posters and Banners (Task 16.2).
 * Provides zero-dependency binary parsing of image dimensions and aspect ratios.
 */

export const ARTWORK_LIMITS = {
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
  poster: {
    targetRatio: 2 / 3, // ~0.6667
    minRatio: 0.58,
    maxRatio: 0.74,
    minWidth: 300,
    minHeight: 450,
  },
  banner: {
    targetRatio: 16 / 9, // ~1.7778
    minRatio: 1.65,
    maxRatio: 1.90,
    minWidth: 640,
    minHeight: 360,
  },
  avatar: {
    targetRatio: 1, // ~1.0 square
    minRatio: 0.75,
    maxRatio: 1.33,
    minWidth: 100,
    minHeight: 100,
  },
} as const;

export type ArtworkType = "poster" | "banner" | "avatar";
export type AllowedMimeType = (typeof ARTWORK_LIMITS.allowedMimeTypes)[number];

export interface ImageDimensions {
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp";
}

export type ArtworkValidationResult =
  | {
      ok: true;
      value: {
        width: number;
        height: number;
        format: "jpeg" | "png" | "webp";
        aspectRatio: number;
        size: number;
      };
    }
  | { ok: false; error: string };

/**
 * Detects image dimensions and format directly from binary buffer.
 */
export function detectImageDimensions(buffer: Buffer): ImageDimensions | null {
  if (!buffer || buffer.length < 16) return null;

  // 1. PNG Detection: \x89PNG\r\n\x1a\n
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width > 0 && height > 0) {
        return { width, height, format: "png" };
      }
    }
  }

  // 2. JPEG Detection: \xFF\xD8\xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];

      // SOF markers: SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), etc.
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) {
          return { width, height, format: "jpeg" };
        }
      }

      // Move to next marker
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  }

  // 3. WebP Detection: RIFF....WEBP
  if (
    buffer.length >= 30 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 && // RIFF
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50 // WEBP
  ) {
    const chunkType = buffer.toString("ascii", 12, 16);

    // VP8 (Simple lossy)
    if (chunkType === "VP8 " && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      if (width > 0 && height > 0) {
        return { width, height, format: "webp" };
      }
    }

    // VP8L (Lossless)
    if (chunkType === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      if (width > 0 && height > 0) {
        return { width, height, format: "webp" };
      }
    }

    // VP8X (Extended)
    if (chunkType === "VP8X" && buffer.length >= 30) {
      const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
      const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
      if (width > 0 && height > 0) {
        return { width, height, format: "webp" };
      }
    }
  }

  return null;
}

/**
 * Validates an uploaded artwork file buffer against type requirements (poster vs banner).
 */
export function validateArtworkFile(
  buffer: Buffer,
  declaredMimeType: string,
  artworkType: ArtworkType
): ArtworkValidationResult {
  // 1. File size check
  if (!buffer || buffer.length === 0) {
    return { ok: false, error: "Empty file received." };
  }

  if (buffer.length > ARTWORK_LIMITS.maxSizeBytes) {
    const maxMb = (ARTWORK_LIMITS.maxSizeBytes / (1024 * 1024)).toFixed(0);
    const actualMb = (buffer.length / (1024 * 1024)).toFixed(2);
    return {
      ok: false,
      error: `File size exceeds the ${maxMb} MB limit (uploaded file is ${actualMb} MB).`,
    };
  }

  // 2. MIME type whitelisting
  const mime = declaredMimeType.toLowerCase().trim();
  if (!(ARTWORK_LIMITS.allowedMimeTypes as readonly string[]).includes(mime)) {
    return {
      ok: false,
      error: `Unsupported image format (${declaredMimeType}). Supported formats: JPEG, PNG, and WebP.`,
    };
  }

  // 3. Binary dimensions and magic bytes parsing
  const dimensions = detectImageDimensions(buffer);
  if (!dimensions) {
    return {
      ok: false,
      error: "Invalid or corrupted image file. Could not read image dimensions.",
    };
  }

  const { width, height, format } = dimensions;
  const aspectRatio = width / height;

  // 4. Artwork type specific constraints
  if (artworkType === "poster") {
    const spec = ARTWORK_LIMITS.poster;
    if (width < spec.minWidth || height < spec.minHeight) {
      return {
        ok: false,
        error: `Poster image is too small (${width}x${height}px). Minimum required dimensions are ${spec.minWidth}x${spec.minHeight}px.`,
      };
    }

    if (aspectRatio < spec.minRatio || aspectRatio > spec.maxRatio) {
      return {
        ok: false,
        error: `Invalid poster aspect ratio. Posters must have approximately a 2:3 vertical aspect ratio (uploaded ratio: ${aspectRatio.toFixed(2)} [${width}x${height}px]).`,
      };
    }
  } else if (artworkType === "banner") {
    const spec = ARTWORK_LIMITS.banner;
    if (width < spec.minWidth || height < spec.minHeight) {
      return {
        ok: false,
        error: `Banner image is too small (${width}x${height}px). Minimum required dimensions are ${spec.minWidth}x${spec.minHeight}px.`,
      };
    }

    if (aspectRatio < spec.minRatio || aspectRatio > spec.maxRatio) {
      return {
        ok: false,
        error: `Invalid banner aspect ratio. Banners must have approximately a 16:9 landscape aspect ratio (uploaded ratio: ${aspectRatio.toFixed(2)} [${width}x${height}px]).`,
      };
    }
  } else if (artworkType === "avatar") {
    const spec = ARTWORK_LIMITS.avatar;
    if (width < spec.minWidth || height < spec.minHeight) {
      return {
        ok: false,
        error: `Avatar image is too small (${width}x${height}px). Minimum required dimensions are ${spec.minWidth}x${spec.minHeight}px.`,
      };
    }

    if (aspectRatio < spec.minRatio || aspectRatio > spec.maxRatio) {
      return {
        ok: false,
        error: `Invalid avatar aspect ratio. Avatars must be approximately square (~1:1) (uploaded ratio: ${aspectRatio.toFixed(2)} [${width}x${height}px]).`,
      };
    }
  } else {
    return {
      ok: false,
      error: `Unknown artwork type '${String(artworkType)}'. Must be 'poster', 'banner', or 'avatar'.`,
    };
  }

  return {
    ok: true,
    value: {
      width,
      height,
      format,
      aspectRatio,
      size: buffer.length,
    },
  };
}
