import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as confirmRoute } from "@/app/auth/confirm/route";
import { setTestUserServerClientFactory } from "@/lib/supabase/user-server";

describe("Email Verification & Confirmation Link (Task 11.1)", () => {
  afterEach(() => {
    setTestUserServerClientFactory(null);
  });

  describe("GET /auth/confirm Route Handler", () => {
    it("successfully verifies valid token_hash and redirects to safe next destination", async () => {
      let verifyCalledWith: unknown = null;

      setTestUserServerClientFactory(() => ({
        auth: {
          verifyOtp: async (params: unknown) => {
            verifyCalledWith = params;
            return { data: { user: { id: "u-1" }, session: {} }, error: null };
          },
        },
      }));

      const req = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=valid_hash_123&type=email&next=%2Faccount%2Fhistory"
      );

      const res = await confirmRoute(req);
      assert.equal(res.status, 307);

      const location = res.headers.get("location");
      assert.ok(location);
      assert.ok(location.endsWith("/account/history"));
      assert.deepEqual(verifyCalledWith, {
        token_hash: "valid_hash_123",
        type: "email",
      });
    });

    it("prevents open redirect via next parameter and redirects safely to /home", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          verifyOtp: async () => ({
            data: { user: { id: "u-1" }, session: {} },
            error: null,
          }),
        },
      }));

      const maliciousTargets = [
        "https://evil.com",
        "//evil.com",
        "/\\evil.com",
        "javascript:alert(1)",
      ];

      for (const target of maliciousTargets) {
        const req = new NextRequest(
          `http://localhost:3000/auth/confirm?token_hash=valid_hash_123&type=email&next=${encodeURIComponent(target)}`
        );

        const res = await confirmRoute(req);
        assert.equal(res.status, 307);

        const location = res.headers.get("location");
        assert.ok(location);
        assert.ok(location.endsWith("/home"), `Target ${target} must fall back to /home`);
      }
    });

    // Supabase's default templates link to /auth/v1/verify, which confirms the address and
    // returns here with a PKCE code instead of token_hash (seen on the hosted project, 2026-10-13).
    it("accepts the default template's ?code= link: exchanges it and redirects to next", async () => {
      let exchangedCode: unknown = null;
      setTestUserServerClientFactory(() => ({
        auth: {
          exchangeCodeForSession: async (code: unknown) => {
            exchangedCode = code;
            return { data: { session: {} }, error: null };
          },
        },
      }));

      const req = new NextRequest(
        "http://localhost:3000/auth/confirm?type=recovery&next=%2Freset-password&code=pkce-code-123"
      );
      const res = await confirmRoute(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.endsWith("/reset-password"));
      assert.equal(exchangedCode, "pkce-code-123");
    });

    it("redirects to /login?error=verification_failed when the code exchange fails", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          exchangeCodeForSession: async () => ({ data: { session: null }, error: { message: "invalid flow state" } }),
        },
      }));

      const res = await confirmRoute(new NextRequest("http://localhost:3000/auth/confirm?code=expired"));
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/login?error=verification_failed"));
    });

    it("redirects to /login?error=verification_failed if token_hash is missing", async () => {
      const req = new NextRequest(
        "http://localhost:3000/auth/confirm?type=email&next=%2Fhome"
      );

      const res = await confirmRoute(req);
      assert.equal(res.status, 307);

      const location = res.headers.get("location");
      assert.ok(location);
      assert.ok(location.includes("/login?error=verification_failed"));
    });

    it("redirects to /login?error=verification_failed if type is missing", async () => {
      const req = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=hash_123&next=%2Fhome"
      );

      const res = await confirmRoute(req);
      assert.equal(res.status, 307);

      const location = res.headers.get("location");
      assert.ok(location);
      assert.ok(location.includes("/login?error=verification_failed"));
    });

    it("redirects to /login?error=verification_failed when Supabase verifyOtp returns an error", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          verifyOtp: async () => ({
            data: { user: null, session: null },
            error: new Error("Token expired or invalid"),
          }),
        },
      }));

      const req = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=expired_hash&type=email"
      );

      const res = await confirmRoute(req);
      assert.equal(res.status, 307);

      const location = res.headers.get("location");
      assert.ok(location);
      assert.ok(location.includes("/login?error=verification_failed"));
    });

    it("handles server-side exceptions gracefully with error redirect", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          verifyOtp: async () => {
            throw new Error("Supabase network crash");
          },
        },
      }));

      const req = new NextRequest(
        "http://localhost:3000/auth/confirm?token_hash=valid_hash&type=email"
      );

      const res = await confirmRoute(req);
      assert.equal(res.status, 307);

      const location = res.headers.get("location");
      assert.ok(location);
      assert.ok(location.includes("/login?error=verification_failed"));
    });
  });

  describe("Supabase Email Template & Auth Configuration", () => {
    const rootDir = process.cwd();
    const configPath = path.join(rootDir, "supabase", "config.toml");
    const templatePath = path.join(rootDir, "supabase", "templates", "confirmation.html");

    it("verifies config.toml enables email confirmations", () => {
      const config = fs.readFileSync(configPath, "utf8");
      assert.match(config, /enable_confirmations\s*=\s*true/i);
    });

    it("verifies config.toml binds the confirmation email template", () => {
      const config = fs.readFileSync(configPath, "utf8");
      assert.match(config, /\[auth\.email\.template\.confirmation\]/i);
      assert.match(config, /content_path\s*=\s*"[^"]*confirmation\.html"/i);
    });

    it("verifies confirmation.html template contains 6-digit OTP code and direct link", () => {
      const template = fs.readFileSync(templatePath, "utf8");
      // Must contain {{ .Token }} for the 6-digit OTP
      assert.match(template, /\{\{\s*\.Token\s*\}\}/);
      // Must contain link fallback to /auth/confirm with TokenHash
      assert.match(template, /\{\{\s*\.SiteURL\s*\}\}\/auth\/confirm/);
      assert.match(template, /token_hash=\{\{\s*\.TokenHash\s*\}\}/);
    });
  });
});
