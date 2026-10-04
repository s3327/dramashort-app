/**
 * Open-redirect protection for post-login destinations (`returnUrl`).
 *
 * Only same-origin relative paths are accepted. Anything else — absolute URLs,
 * protocol-relative `//host`, backslash tricks (`/\host`), control characters,
 * non-string input — resolves to the fallback.
 */

const BASE = "http://same-origin.invalid";

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function getSafeRedirect(value: unknown, fallback = "/home"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return fallback;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  if (CONTROL_CHARS.test(value)) {
    return fallback;
  }

  let parsed: URL;
  try {
    parsed = new URL(value, BASE);
  } catch {
    return fallback;
  }
  if (parsed.origin !== BASE) {
    return fallback;
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/**
 * Admin variant: destination must stay inside the admin console and must not be
 * the login page itself (which would loop for an authenticated admin).
 */
export function getSafeAdminRedirect(value: unknown, fallback = "/admin/dashboard"): string {
  const path = getSafeRedirect(value, fallback);
  const pathname = path.split(/[?#]/)[0];
  const insideAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  if (!insideAdmin || pathname === "/admin/login") {
    return fallback;
  }
  return path;
}
