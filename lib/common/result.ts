/**
 * Standardized type-safe Result<T, E> pattern (Task 13.4).
 * Discriminated union isolating success values { ok: true; value: T }
 * from error states { ok: false; error: E }.
 */

export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Creates a successful Result containing a value.
 */
export function ok(): Result<void, never>;
export function ok<T>(value: T): Result<T, never>;
export function ok<T>(value?: T): Result<T | void, never> {
  return { ok: true, value: value as T };
}

/**
 * Creates a failure Result containing an error.
 */
export function err<E = string>(error?: E): Result<never, E> {
  return { ok: false, error: (error !== undefined ? error : ("Unknown error" as unknown as E)) };
}

/**
 * Type guard asserting whether a Result is successful.
 */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return Boolean(result && typeof result === "object" && result.ok === true);
}

/**
 * Type guard asserting whether a Result is a failure.
 */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return Boolean(result && typeof result === "object" && result.ok === false);
}

/**
 * Unwraps the value of a successful Result, or throws the contained error.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result || typeof result !== "object") {
    throw new Error("Cannot unwrap invalid Result object");
  }
  if (result.ok) {
    return result.value;
  }
  if (result.error instanceof Error) {
    throw result.error;
  }
  if (result.error && typeof result.error === "object") {
    if ("message" in result.error && typeof (result.error as any).message === "string") {
      throw new Error((result.error as any).message);
    }
    try {
      throw new Error(JSON.stringify(result.error));
    } catch {
      throw new Error(String(result.error));
    }
  }
  throw new Error(String(result.error));
}

/**
 * Returns the value if successful, or fallback if error.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  if (!result || typeof result !== "object") {
    return fallback;
  }
  return result.ok ? result.value : fallback;
}

/**
 * Transforms the contained value of a Result if successful.
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  if (!result || typeof result !== "object") {
    return err("Invalid Result object" as unknown as E);
  }
  if (result.ok) {
    return ok(fn(result.value));
  }
  return err(result.error);
}

/**
 * Transforms the contained error of a Result if failed.
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  if (!result || typeof result !== "object") {
    return err(fn("Invalid Result object" as unknown as E));
  }
  if (result.ok) {
    return ok(result.value);
  }
  return err(fn(result.error));
}

/**
 * Wraps an async Promise into a type-safe Result<T, Error>.
 */
export async function fromPromise<T>(
  promise: Promise<T>
): Promise<Result<T, Error>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Backward compatibility adapter: converts standardized Result<T, E> to legacy { success, data, error }.
 */
export function toLegacyResult<T, E>(
  result: Result<T, E>
): { success: true; data: T; error: null } | { success: false; data: null; error: E } {
  if (!result || typeof result !== "object") {
    return { success: false, data: null, error: ("Invalid result object" as unknown as E) };
  }
  if (result.ok) {
    return { success: true, data: result.value, error: null };
  }
  return { success: false, data: null, error: result.error };
}

/**
 * Backward compatibility adapter: converts legacy { success, data, error } to standardized Result<T, E>.
 */
export function fromLegacyResult<T, E = string>(
  legacy: { success: boolean; data?: T | null; error?: E | null }
): Result<T, E> {
  if (!legacy || typeof legacy !== "object") {
    return err("Invalid legacy result" as unknown as E);
  }
  if (legacy.success) {
    return ok((legacy.data !== undefined ? legacy.data : null) as T);
  }
  return err((legacy.error ?? ("Operation failed" as unknown as E)) as E);
}


