/**
 * Admin API Client & Session Expiry Handling (Task 12.5)
 *
 * Provides a standardized client fetch wrapper for administrative API calls.
 * When any admin API request returns HTTP 401 Unauthorized (session expired or revoked),
 * it redirects the browser to `/admin/login?returnUrl=<current path>` to prompt
 * re-authentication without losing the admin's current destination.
 */

/**
 * Builds the URL to redirect to admin login with the given returnUrl preserved.
 * Prevents loops when the caller is already on the admin login page.
 */
export function buildAdminLoginRedirectUrl(targetUrl?: string): string {
  const returnPath =
    targetUrl ||
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : "/admin/dashboard");

  const pathname = returnPath.split(/[?#]/)[0];
  if (pathname === "/admin/login") {
    return "/admin/login";
  }

  return `/admin/login?returnUrl=${encodeURIComponent(returnPath)}`;
}

/**
 * Redirects the browser to the admin login page with returnUrl preserved.
 * No-ops in non-browser environments or when already on /admin/login.
 */
export function redirectToAdminLogin(targetUrl?: string): void {
  if (typeof window === "undefined") return;

  const target = targetUrl || `${window.location.pathname}${window.location.search}`;
  const pathname = target.split(/[?#]/)[0];
  if (pathname === "/admin/login") return;

  const loginUrl = buildAdminLoginRedirectUrl(target);
  if (typeof window.location.assign === "function") {
    window.location.assign(loginUrl);
  } else {
    window.location.href = loginUrl;
  }
}

/**
 * Standard fetch wrapper for authenticated administrative API requests.
 * Catches HTTP 401 Unauthorized responses and automatically redirects the
 * browser to /admin/login?returnUrl=<current path>.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status === 401 && typeof window !== "undefined") {
    redirectToAdminLogin();
  }
  return response;
}
