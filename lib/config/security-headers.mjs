/**
 * HTTP Security Headers & Content Security Policy (Task 10.8)
 *
 * Configures enterprise-grade security headers applied across all routes via next.config.mjs.
 *
 * Directives:
 * - Content-Security-Policy: Restricts executable scripts, styles, images, and network connections.
 *   - Allows Supabase DB / Storage (*.supabase.co), Unsplash images, HLS streaming CDNs (Mux, Cloudflare, Bunny).
 *   - Allows Telegram WebApp script & widget (telegram.org) and framing (web.telegram.org) per FUTURE_PLAN.md §5.4.
 *   - Allows Cloudflare Turnstile CAPTCHA (challenges.cloudflare.com).
 * - Strict-Transport-Security: Enforces HTTPS with preload.
 * - X-Content-Type-Options: Prevents MIME-sniffing exploits.
 * - Referrer-Policy: Prevents leaking path details to external origins.
 * - Permissions-Policy: Disables unneeded browser capabilities (camera, mic, geolocation).
 */

export function buildContentSecurityPolicy() {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://telegram.org https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://*.telegram.org https://commondatastorage.googleapis.com",
    "media-src 'self' blob: data: https://*.supabase.co https://commondatastorage.googleapis.com https://*.mux.com https://*.cloudflarestream.com https://*.b-cdn.net",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.telegram.org https://challenges.cloudflare.com https://commondatastorage.googleapis.com",
    "frame-src 'self' https://oauth.telegram.org https://challenges.cloudflare.com",
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join("; ");
}

export function getSecurityHeaders() {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(),
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "on",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains; preload",
    },
  ];
}
