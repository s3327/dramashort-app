import { createHmac, timingSafeEqual } from "node:crypto";

export interface WebhookSignatureVerificationResult {
  valid: boolean;
  timestamp?: number;
  error?: string;
}

/**
 * Cryptographically verifies payment webhook signatures using constant-time comparison.
 * Supports:
 * 1. Timestamped signatures: `t=<timestamp>,v1=<hexDigest>` (e.g., Stripe, standard webhooks)
 * 2. Raw hex digests: `<hexDigest>` (e.g., `x-webhook-signature: sha256_hex`)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): WebhookSignatureVerificationResult {
  if (!signatureHeader || !secret) {
    return { valid: false, error: "Missing signature header or secret" };
  }

  // 1. Timestamped format: t=1728500000,v1=abcdef...
  if (signatureHeader.includes("t=") && signatureHeader.includes("v1=")) {
    const parts = signatureHeader.split(",");
    let tStr = "";
    let v1Sig = "";

    for (const part of parts) {
      const [k, v] = part.split("=");
      if (k?.trim() === "t") tStr = v?.trim() || "";
      if (k?.trim() === "v1") v1Sig = v?.trim() || "";
    }

    if (!tStr || !v1Sig) {
      return { valid: false, error: "Malformed timestamped signature header" };
    }

    const timestampSec = parseInt(tStr, 10);
    if (isNaN(timestampSec)) {
      return { valid: false, error: "Invalid timestamp in signature header" };
    }

    // Expected digest payload: `${timestampSec}.${rawBody}`
    const expectedHex = createHmac("sha256", secret)
      .update(`${timestampSec}.${rawBody}`)
      .digest("hex");

    let givenBuf: Buffer;
    let expectedBuf: Buffer;

    try {
      givenBuf = Buffer.from(v1Sig, "hex");
      expectedBuf = Buffer.from(expectedHex, "hex");
    } catch {
      return { valid: false, error: "Hex parsing failure" };
    }

    if (givenBuf.length !== expectedBuf.length) {
      return { valid: false, error: "Signature buffer length mismatch" };
    }

    const isValid = timingSafeEqual(givenBuf, expectedBuf);
    return {
      valid: isValid,
      timestamp: timestampSec > 1e11 ? timestampSec : timestampSec * 1000,
    };
  }

  // 2. Direct raw hex digest (e.g. x-webhook-signature: <sha256_hex>)
  try {
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    const givenBuf = Buffer.from(signatureHeader.trim(), "hex");
    const expectedBuf = Buffer.from(expectedHex, "hex");

    if (givenBuf.length !== expectedBuf.length) {
      return { valid: false, error: "Signature length mismatch" };
    }

    const isValid = timingSafeEqual(givenBuf, expectedBuf);
    return { valid: isValid };
  } catch {
    return { valid: false, error: "Hex decoding exception" };
  }
}

/**
 * Generates valid HMAC-SHA256 signature string for testing and local simulation.
 */
export function generateWebhookSignature(
  rawBody: string,
  secret: string,
  timestampMs?: number
): string {
  if (timestampMs !== undefined) {
    const timestampSec = Math.floor(timestampMs / 1000);
    const digest = createHmac("sha256", secret)
      .update(`${timestampSec}.${rawBody}`)
      .digest("hex");
    return `t=${timestampSec},v1=${digest}`;
  }

  return createHmac("sha256", secret).update(rawBody).digest("hex");
}
