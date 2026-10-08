/**
 * Pluggable Error Reporting Engine (Task 13.6)
 *
 * Normalizes and captures runtime exceptions from Server Components, Route Handlers,
 * and Client Error Boundaries.
 *
 * Dispatches to registered external providers (Sentry, Datadog, Webhooks) while
 * guaranteeing safe local fallback via structured JSON logging.
 */

import { logger } from "./logger";

export interface ErrorReportContext {
  name?: string;
  message?: string;
  stack?: string;
  digest?: string;
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  tags?: Record<string, string | number | boolean>;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ErrorPayload {
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  requestId?: string;
  userId?: string;
  route?: string;
  method?: string;
  tags?: Record<string, string | number | boolean>;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface ErrorReportingProvider {
  name: string;
  report: (payload: ErrorPayload) => void | Promise<void>;
}

// Registry of external monitoring sinks
const providers = new Map<string, ErrorReportingProvider>();

/**
 * Registers an external error reporting sink (e.g. Sentry / Webhook).
 * Returns an unregister cleanup function.
 */
export function registerErrorProvider(provider: ErrorReportingProvider): () => void {
  providers.set(provider.name, provider);
  return () => {
    providers.delete(provider.name);
  };
}

/**
 * Unregisters a provider by name.
 */
export function unregisterErrorProvider(providerName: string): boolean {
  return providers.delete(providerName);
}

/**
 * Clears all registered providers (primarily for unit test isolation).
 */
export function clearErrorProviders(): void {
  providers.clear();
}

/**
 * Returns currently registered providers.
 */
export function getErrorProviders(): ErrorReportingProvider[] {
  return Array.from(providers.values());
}

/**
 * Normalizes arbitrary error inputs into a canonical ErrorPayload.
 * Defensive against circular objects, accessor errors, and exotic non-Error values.
 */
export function formatErrorPayload(error: unknown, context?: ErrorReportContext): ErrorPayload {
  let name = "Error";
  let message = "Unknown error occurred";
  let stack: string | undefined;
  let digest: string | undefined = context?.digest;

  try {
    if (error instanceof Error) {
      try {
        name = error.name || "Error";
      } catch {
        name = "Error";
      }

      try {
        message = error.message || "Unknown error";
      } catch {
        message = "Unknown error";
      }

      try {
        stack = error.stack;
      } catch {
        // Safe no-op
      }

      try {
        if ("digest" in error && typeof (error as any).digest === "string") {
          digest = (error as any).digest;
        }
      } catch {
        // Safe no-op
      }
    } else if (typeof error === "string") {
      message = error;
    } else if (error && typeof error === "object") {
      try {
        name = (error as any).name || (error as any).constructor?.name || "ErrorObject";
      } catch {
        name = "ErrorObject";
      }

      if ("message" in (error as any) && typeof (error as any).message === "string") {
        message = (error as any).message;
      } else {
        try {
          message = JSON.stringify(error);
        } catch {
          message = String(error);
        }
      }

      try {
        stack = (error as any).stack;
      } catch {
        // Safe no-op
      }

      try {
        if ("digest" in error && typeof (error as any).digest === "string") {
          digest = (error as any).digest;
        }
      } catch {
        // Safe no-op
      }
    } else if (error !== null && error !== undefined) {
      message = String(error);
    }
  } catch {
    name = "Error";
    message = "Unknown error occurred";
  }

  // Explicit context overrides
  if (context?.name) name = context.name;
  if (context?.message) message = context.message;
  if (context?.stack) stack = context.stack;
  if (context?.digest) digest = context.digest;

  return {
    name,
    message,
    stack,
    digest,
    requestId: context?.requestId,
    userId: context?.userId,
    route: context?.route,
    method: context?.method,
    tags: context?.tags,
    details: context?.details,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Dispatches an error to all registered providers and emits a structured log entry.
 * Guaranteed safe local fallback: never throws or crashes caller execution.
 */
export function reportError(
  error: unknown,
  context?: ErrorReportContext
): ErrorPayload {
  let payload: ErrorPayload;
  try {
    payload = formatErrorPayload(error, context);
  } catch {
    payload = {
      name: "Error",
      message: "Unserializable error caught in reportError",
      timestamp: new Date().toISOString(),
    };
  }

  // Safe local structured logging fallback
  try {
    logger.error(`[ErrorReport] ${payload.name}: ${payload.message}`, {
      requestId: payload.requestId || null,
      route: payload.route || null,
      method: payload.method || null,
      userId: payload.userId || null,
      details: {
        stack: payload.stack,
        digest: payload.digest,
        tags: payload.tags,
        ...(payload.details || {}),
      },
    });
  } catch (logErr) {
    console.error("[ErrorReport Fallback Logging Failed]", logErr);
  }

  // Dispatch to external sinks safely (handles both Promises and thenables)
  const currentProviders = Array.from(providers.values());
  for (const provider of currentProviders) {
    const providerName = (() => {
      try {
        return provider.name;
      } catch {
        return "unknown-provider";
      }
    })();

    try {
      const outcome = provider.report(payload);
      if (outcome && typeof (outcome as any).then === "function") {
        Promise.resolve(outcome).catch((providerErr) => {
          logger.warn(`[ErrorReport] Provider "${providerName}" async failure:`, {
            details: { error: String(providerErr) },
          });
        });
      }
    } catch (providerErr) {
      logger.warn(`[ErrorReport] Provider "${providerName}" sync exception:`, {
        details: { error: String(providerErr) },
      });
    }
  }

  return payload;
}
