import { NextResponse } from "next/server";

/**
 * Uniform JSON envelope for API route handlers.
 *
 * Success: { success: true, data }
 * Failure: { success: false, error: { code, message, details? } }
 *
 * Raw database error messages must never be passed as `message`; log them
 * server-side and return a generic message instead.
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "PAYMENT_REQUIRED"
  | "AUTH_VERIFICATION_ERROR"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "INVALID_ID"
  | "NOT_FOUND"
  | "STREAM_UNAVAILABLE"
  | "DATABASE_ERROR"
  | "REAUTHENTICATION_REQUIRED"
  | "DELETION_FAILED"
  | "INVALID_CREDENTIALS"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true as const, data }, { status });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: unknown
) {
  const body: ApiErrorBody = {
    success: false,
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return NextResponse.json(body, { status });
}
