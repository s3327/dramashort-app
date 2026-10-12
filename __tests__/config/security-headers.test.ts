import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
} from "@/lib/config/security-headers.mjs";

describe("HTTP Security Headers & CSP Configuration (Task 10.8)", () => {
  it("buildContentSecurityPolicy produces strict baseline directives", () => {
    const csp = buildContentSecurityPolicy();

    assert.ok(csp.includes("default-src 'self'"), "Must restrict default-src to 'self'");
    assert.ok(csp.includes("object-src 'none'"), "Must disable object-src plugins");
    assert.ok(csp.includes("base-uri 'self'"), "Must restrict base-uri to 'self'");
    assert.ok(csp.includes("form-action 'self'"), "Must restrict form-action to 'self'");
  });

  it("CSP allows Supabase endpoints and real-time WebSockets", () => {
    const csp = buildContentSecurityPolicy();

    assert.ok(csp.includes("https://*.supabase.co"), "Must allow Supabase REST API & Storage");
    assert.ok(csp.includes("wss://*.supabase.co"), "Must allow Supabase Realtime WebSockets");
  });

  it("CSP supports Telegram Login Widget, WebApp scripts, and framing per FUTURE_PLAN.md §5.4", () => {
    const csp = buildContentSecurityPolicy();

    assert.ok(csp.includes("https://telegram.org"), "Must allow telegram.org scripts");
    assert.ok(csp.includes("https://oauth.telegram.org"), "Must allow Telegram OAuth frame");
    assert.ok(csp.includes("https://api.telegram.org"), "Must allow Telegram Bot API connect");
    assert.ok(
      csp.includes("frame-ancestors 'self' https://web.telegram.org https://*.telegram.org"),
      "Must restrict frame-ancestors to self and Telegram web client"
    );
  });

  it("CSP supports Cloudflare Turnstile CAPTCHA and streaming video CDNs", () => {
    const csp = buildContentSecurityPolicy();

    assert.ok(csp.includes("https://challenges.cloudflare.com"), "Must allow Cloudflare Turnstile");
    assert.ok(csp.includes("https://*.cloudflarestream.com"), "Must allow Cloudflare Stream");
    assert.ok(csp.includes("https://*.mux.com"), "Must allow Mux Video");
    assert.ok(csp.includes("https://*.b-cdn.net"), "Must allow Bunny Stream CDN");
  });

  it("getSecurityHeaders returns all mandatory OWASP security headers", () => {
    const headers = getSecurityHeaders();
    const map = new Map(headers.map((h: { key: string; value: string }) => [h.key, h.value]));

    assert.ok(map.has("Content-Security-Policy"), "Missing Content-Security-Policy");
    assert.equal(map.get("X-Content-Type-Options"), "nosniff");
    assert.equal(map.get("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.ok(map.get("Permissions-Policy")?.includes("camera=()"));
    assert.ok(map.get("Permissions-Policy")?.includes("microphone=()"));
    assert.ok(map.get("Permissions-Policy")?.includes("geolocation=()"));
    assert.ok(map.get("Strict-Transport-Security")?.includes("max-age=31536000"));
    assert.ok(map.get("Strict-Transport-Security")?.includes("preload"));
  });

  it("ADR-0005: CSP allows a local Supabase stack's origin and adds nothing for *.supabase.co", () => {
    const local = buildContentSecurityPolicy({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" });
    const connect = local.split("; ").find((d) => d.startsWith("connect-src")) ?? "";
    assert.ok(connect.includes("http://127.0.0.1:54321"));
    assert.ok(connect.includes("ws://127.0.0.1:54321"));
    const hosted = buildContentSecurityPolicy({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co" });
    assert.equal(hosted, buildContentSecurityPolicy({}));
  });
});
