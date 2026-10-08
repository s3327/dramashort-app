/**
 * Structured Logger & Request Tracing (Task 13.6)
 *
 * Emits standardized JSON logs conforming to the operational schema:
 * - requestId: string | null
 * - timestamp: ISO-8601 string
 * - level: "info" | "warn" | "error"
 * - route: string | null
 * - method: string | null
 * - userId: string | null
 * - durationMs: number | null
 * - statusCode: number | null
 * - message: string
 * - details: unknown
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  userId?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
  details?: unknown;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  requestId: string | null;
  timestamp: string;
  level: LogLevel;
  route: string | null;
  method: string | null;
  userId: string | null;
  durationMs: number | null;
  statusCode: number | null;
  message: string;
  details: unknown;
}

export type LogListener = (entry: StructuredLogEntry, jsonString: string) => void;

const listeners = new Set<LogListener>();

/**
 * Register a listener to inspect emitted structured logs (primarily for unit testing and sinks).
 */
export function subscribeToLogs(listener: LogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Formats a log payload into the standardized structured log schema.
 * Extracts standard schema keys and aggregates extra context properties into details.
 */
export function formatLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext
): StructuredLogEntry {
  let details: unknown = context?.details !== undefined ? context.details : null;

  if (context) {
    const {
      requestId: _r,
      route: _ro,
      method: _m,
      userId: _u,
      durationMs: _d,
      statusCode: _s,
      details: _dt,
      ...extra
    } = context;

    if (Object.keys(extra).length > 0) {
      if (details !== null && typeof details === "object" && !Array.isArray(details)) {
        details = { ...(details as Record<string, unknown>), ...extra };
      } else if (details === null) {
        details = extra;
      } else {
        details = { details, ...extra };
      }
    }
  }

  const durationMs =
    typeof context?.durationMs === "number" && Number.isFinite(context.durationMs)
      ? context.durationMs
      : null;
  const statusCode =
    typeof context?.statusCode === "number" && Number.isFinite(context.statusCode)
      ? context.statusCode
      : null;

  return {
    requestId: context?.requestId ?? null,
    timestamp: new Date().toISOString(),
    level,
    route: context?.route ?? null,
    method: context?.method ?? null,
    userId: context?.userId ?? null,
    durationMs,
    statusCode,
    message,
    details,
  };
}

/**
 * Emits a structured log entry via console and dispatches to registered listeners.
 */
function emitLog(entry: StructuredLogEntry): void {
  const json = JSON.stringify(entry);

  // Notify test/runtime subscribers
  for (const listener of listeners) {
    try {
      listener(entry, json);
    } catch {
      // Safe no-op for misbehaving listeners
    }
  }

  // Console output mapped to corresponding severity
  switch (entry.level) {
    case "error":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    case "info":
    default:
      console.log(json);
      break;
  }
}

/**
 * Generates a unique UUID v4 request ID for tracing.
 * Operates across Node.js, Web Crypto, and edge runtimes.
 */
export function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Helper to extract or generate x-request-id from standard Headers.
 */
export function getRequestIdFromHeaders(headers: Headers): string {
  const existing = headers.get("x-request-id");
  return existing && existing.trim().length > 0 ? existing.trim() : generateRequestId();
}

export interface LoggerInstance {
  info(message: string, context?: LogContext): StructuredLogEntry;
  warn(message: string, context?: LogContext): StructuredLogEntry;
  error(message: string, context?: LogContext): StructuredLogEntry;
  child(defaultContext: LogContext): LoggerInstance;
}

function mergeContexts(base?: LogContext, override?: LogContext): LogContext | undefined {
  if (!base) return override;
  if (!override) return base;

  const mergedDetails =
    base.details && typeof base.details === "object" && !Array.isArray(base.details) &&
    override.details && typeof override.details === "object" && !Array.isArray(override.details)
      ? { ...(base.details as Record<string, unknown>), ...(override.details as Record<string, unknown>) }
      : (override.details !== undefined ? override.details : base.details);

  return {
    ...base,
    ...override,
    details: mergedDetails,
  };
}

function createLoggerInstance(defaultContext?: LogContext): LoggerInstance {
  return {
    info(message: string, context?: LogContext): StructuredLogEntry {
      const merged = mergeContexts(defaultContext, context);
      const entry = formatLogEntry("info", message, merged);
      emitLog(entry);
      return entry;
    },
    warn(message: string, context?: LogContext): StructuredLogEntry {
      const merged = mergeContexts(defaultContext, context);
      const entry = formatLogEntry("warn", message, merged);
      emitLog(entry);
      return entry;
    },
    error(message: string, context?: LogContext): StructuredLogEntry {
      const merged = mergeContexts(defaultContext, context);
      const entry = formatLogEntry("error", message, merged);
      emitLog(entry);
      return entry;
    },
    child(childContext: LogContext): LoggerInstance {
      return createLoggerInstance(mergeContexts(defaultContext, childContext));
    },
  };
}

export const logger = {
  ...createLoggerInstance(),
  formatLogEntry,
  subscribe: subscribeToLogs,
};
