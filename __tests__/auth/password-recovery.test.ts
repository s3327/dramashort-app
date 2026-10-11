import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readReturnUrl } from "@/lib/navigation/safe-redirect";

describe("Password Recovery & Reset Password Flow (Task 11.2)", () => {
  const recoveryTemplatePath = path.resolve(
    process.cwd(),
    "supabase/user/supabase/templates/recovery.html"
  );
  const configPath = path.resolve(
    process.cwd(),
    "supabase/user/supabase/config.toml"
  );

  describe("Recovery Email Template Validation", () => {
    it("exists on disk and contains expected HTML structure", () => {
      assert.ok(fs.existsSync(recoveryTemplatePath), "recovery.html template exists");
      const html = fs.readFileSync(recoveryTemplatePath, "utf-8");
      assert.ok(html.includes("DramaShort"), "Template contains brand header");
      assert.ok(html.includes("Reset your password"), "Template has reset header");
    });

    it("contains OTP placeholder {{ .Token }} for 6-digit code entry", () => {
      const html = fs.readFileSync(recoveryTemplatePath, "utf-8");
      assert.ok(html.includes("{{ .Token }}"), "Template must contain {{ .Token }}");
    });

    it("contains direct link with token_hash, type=recovery, and next=/reset-password", () => {
      const html = fs.readFileSync(recoveryTemplatePath, "utf-8");
      assert.ok(
        html.includes("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password"),
        "Template link must include token_hash, recovery type, and /reset-password destination"
      );
    });
  });

  describe("Supabase Configuration Binding", () => {
    it("configures [auth.email.template.recovery] in config.toml", () => {
      assert.ok(fs.existsSync(configPath), "config.toml exists");
      const config = fs.readFileSync(configPath, "utf-8");
      assert.ok(
        config.includes("[auth.email.template.recovery]"),
        "config.toml defines [auth.email.template.recovery]"
      );
      assert.ok(
        config.includes('content_path = "./supabase/templates/recovery.html"'),
        "config.toml binds content_path to ./supabase/templates/recovery.html"
      );
    });

    it("every email template content_path resolves from the CLI workdir (supabase/user)", () => {
      // The Supabase CLI resolves content_path against the --workdir, not against
      // the folder holding config.toml. A path that does not resolve makes every
      // CLI command for this database fail with DbConfigLoadError.
      const config = fs.readFileSync(configPath, "utf-8");
      const workdir = path.join(process.cwd(), "supabase", "user");
      const paths = [...config.matchAll(/^content_path\s*=\s*"([^"]+)"/gm)].map((m) => m[1]);
      assert.ok(paths.length >= 2, "confirmation and recovery templates are configured");
      for (const p of paths) {
        assert.ok(fs.existsSync(path.resolve(workdir, p)), `${p} resolves to an existing file from supabase/user`);
      }
    });
  });

  describe("Auth Navigation Protection for /reset-password", () => {
    it("treats /reset-password as an auth page in readReturnUrl to prevent loops", () => {
      const q = new URLSearchParams("returnUrl=%2Freset-password");
      assert.equal(
        readReturnUrl(q, "/home"),
        "/home",
        "/reset-password must fall back to /home to prevent login redirect loops"
      );
    });
  });

  describe("Password Reset Business Logic Contracts", () => {
    it("simulates resetPasswordForEmail enumeration defense", () => {
      // Logic simulation: user not found error is suppressed to prevent enumeration
      const sanitizeResetError = (err: { message: string; status?: number }) => {
        const lower = err.message.toLowerCase();
        if (
          lower.includes("rate") ||
          lower.includes("frequency") ||
          err.status === 429
        ) {
          return err.message;
        }
        return null; // Suppressed for account enumeration defense
      };

      assert.equal(
        sanitizeResetError({ message: "User not found with this email", status: 400 }),
        null,
        "User not found error should be suppressed"
      );

      assert.equal(
        sanitizeResetError({ message: "For security purposes, you can only request this once every 60 seconds", status: 429 }),
        "For security purposes, you can only request this once every 60 seconds",
        "Rate limit errors should be passed through"
      );
    });

    it("simulates password validation requirements", () => {
      const validateNewPassword = (pwd: string, confirm: string) => {
        if (pwd.length < 8) return "Password must be at least 8 characters long.";
        if (pwd !== confirm) return "Passwords do not match.";
        return null;
      };

      assert.equal(
        validateNewPassword("short", "short"),
        "Password must be at least 8 characters long."
      );
      assert.equal(
        validateNewPassword("Password123!", "PasswordDifferent!"),
        "Passwords do not match."
      );
      assert.equal(validateNewPassword("StrongPassword123!", "StrongPassword123!"), null);
    });
  });
});
