import crypto from "crypto";

export interface PreviewTokenPayload {
  dramaId: string;
  slug: string;
  exp: number; // Unix timestamp in milliseconds
}

export type VerifyPreviewResult =
  | { valid: true; dramaId: string; slug: string }
  | { valid: false; reason: string };

/**
 * Returns the secret used to sign draft-preview tokens, or null when none is
 * configured. Prefers a dedicated PREVIEW_SECRET and otherwise derives from a
 * server-only service role key. There is deliberately no built-in default: a
 * secret that ships in the source code lets anyone forge preview links.
 */
function getPreviewSecret(): string | null {
  const secret =
    process.env.PREVIEW_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  return secret && secret.trim() ? secret : null;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

function computeSignature(payloadB64: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates a signed, time-limited preview token for viewing unpublished drafts.
 * Default expiration is 1 hour (3600000 ms).
 */
export function generatePreviewToken(
  dramaId: string,
  slug: string,
  ttlMs = 3600000
): string {
  const payload: PreviewTokenPayload = {
    dramaId,
    slug,
    exp: Date.now() + ttlMs,
  };
  const secret = getPreviewSecret();
  if (!secret) {
    throw new Error("PREVIEW_SECRET is not configured; cannot sign preview tokens.");
  }
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = computeSignature(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a signed preview token. Validates HMAC signature, expiration time,
 * and optionally validates against the expected drama slug.
 */
export function verifyPreviewToken(
  token: string | null | undefined,
  expectedSlug?: string
): VerifyPreviewResult {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "Missing token" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "Malformed token" };
  }

  const secret = getPreviewSecret();
  if (!secret) {
    return { valid: false, reason: "Preview secret not configured" };
  }

  const [payloadB64, signature] = parts;
  const expectedSignature = computeSignature(payloadB64, secret);

  // Constant-time signature comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return { valid: false, reason: "Invalid signature" };
  }

  try {
    const jsonStr = base64UrlDecode(payloadB64);
    const payload: PreviewTokenPayload = JSON.parse(jsonStr);

    if (!payload.dramaId || !payload.slug || typeof payload.exp !== "number") {
      return { valid: false, reason: "Invalid payload shape" };
    }

    if (Date.now() > payload.exp) {
      return { valid: false, reason: "Token expired" };
    }

    if (expectedSlug && payload.slug !== expectedSlug) {
      return { valid: false, reason: "Slug mismatch" };
    }

    return {
      valid: true,
      dramaId: payload.dramaId,
      slug: payload.slug,
    };
  } catch {
    return { valid: false, reason: "Failed to decode payload" };
  }
}
