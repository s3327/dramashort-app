/**
 * Backward-compatible facade module for User services (Task 13.4).
 * Re-exports browser-safe client operations from lib/client/user.ts.
 *
 * For server-only cookie-supported operations in Server Components or Route Handlers,
 * import directly from "@/lib/server/user".
 */

export * from "@/lib/client/user";
