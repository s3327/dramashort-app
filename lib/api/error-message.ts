/**
 * Client-safe helpers for reading API error payloads (no next/server import).
 *
 * Accepts the current `{ error: { code, message, details? } }` envelope from
 * lib/api/responses.ts and a legacy plain-string `{ error: "..." }`.
 */

interface FieldErrorLike {
  field?: unknown;
  message?: unknown;
}

export function getApiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || !("error" in payload)) {
    return fallback;
  }

  const error = (payload as { error: unknown }).error;
  if (typeof error === "string") {
    return error.trim() || fallback;
  }
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const { message, details } = error as { message?: unknown; details?: unknown };
  const base = typeof message === "string" && message.trim() ? message.trim() : fallback;

  if (Array.isArray(details)) {
    const fieldMessages = details
      .map((d: FieldErrorLike) => (typeof d?.message === "string" ? d.message : null))
      .filter((m): m is string => !!m);
    if (fieldMessages.length > 0) {
      return `${base} ${fieldMessages.join(" ")}`;
    }
  }
  return base;
}

/** Parses a fetch Response body as JSON, returning null for non-JSON bodies. */
export async function readJsonSafely(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
