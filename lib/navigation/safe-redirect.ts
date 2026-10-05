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

/** Auth pages are never useful post-login destinations (they would show the form again). */
const AUTH_PAGES = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

interface SearchParamsLike {
  get(name: string): string | null;
}

/**
 * Reads the post-login destination from `returnUrl`, falling back to the legacy
 * `redirect` parameter (kept for one release), and validates it. Auth pages
 * resolve to the fallback.
 */
export function readReturnUrl(searchParams: SearchParamsLike, fallback = "/home"): string {
  const raw = searchParams.get("returnUrl") ?? searchParams.get("redirect");
  const path = getSafeRedirect(raw, fallback);
  const pathname = path.split(/[?#]/)[0];
  return AUTH_PAGES.includes(pathname) ? fallback : path;
}

/**
 * Builds `?returnUrl=...` for links into the auth pages, or "" when the
 * destination is missing, unsafe, or the default.
 */
export function returnUrlQuery(value: string | null | undefined, fallback = "/home"): string {
  const path = readReturnUrl({ get: (name) => (name === "returnUrl" ? value ?? null : null) }, fallback);
  return path === fallback ? "" : `?${new URLSearchParams({ returnUrl: path }).toString()}`;
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
