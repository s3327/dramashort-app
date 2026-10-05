/**
 * Shared generic Result<T, E> type for consistent error handling across services.
 * Replaces silent error swallowing and mock data substitutions with explicit outcomes.
 */

export type Result<T, E = string> =
  | { success: true; data: T; error?: null }
  | { success: false; data?: null; error: E };

/**
 * Creates a successful Result containing data.
 */
export function ok<T>(data: T): Result<T, never> {
  return { success: true, data, error: null };
}

/**
 * Creates an error Result containing an error message or error object.
 */
export function err<T = never, E = string>(error: E): Result<T, E> {
  return { success: false, data: null, error };
}

/**
 * Type guard checking if a Result is successful.
 */
export function isOk<T, E>(result: Result<T, E>): result is { success: true; data: T; error?: null } {
  return result.success === true;
}

/**
 * Type guard checking if a Result is an error.
 */
export function isErr<T, E>(result: Result<T, E>): result is { success: false; data?: null; error: E } {
  return result.success === false;
}
