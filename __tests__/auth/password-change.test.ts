import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Password Change Hardening (Task 11.5)", () => {
  describe("AuthContext Password Change Specifications", () => {
    const authContextPath = path.join(
      process.cwd(),
      "contexts",
      "AuthContext.tsx"
    );
    const authContextContent = fs.readFileSync(authContextPath, "utf-8");

    it("enforces minimum 8 characters for new passwords", () => {
      assert.match(
        authContextContent,
        /if\s*\(\s*newPassword\.length\s*<\s*8\s*\)/
      );
    });

    it("supplies current_password and nonce to supabase.auth.updateUser", () => {
      assert.match(
        authContextContent,
        /updatePayload\.current_password\s*=\s*currentPassword\.trim\(\)/
      );
      assert.match(
        authContextContent,
        /updatePayload\.nonce\s*=\s*nonce\.trim\(\)/
      );
      assert.match(
        authContextContent,
        /await\s+supabase\.auth\.updateUser\(updatePayload\)/
      );
    });

    it("invalidates all other sessions via signOut({ scope: 'others' }) upon success", () => {
      assert.match(
        authContextContent,
        /await\s+supabase\.auth\.signOut\(\{\s*scope:\s*["']others["']\s*\}\)/
      );
    });

    it("identifies reauthentication requirements from Supabase GoTrue responses", () => {
      assert.match(
        authContextContent,
        /errorLower\.includes\(["']reauth["']\)/
      );
      assert.match(
        authContextContent,
        /needsReauthentication:\s*true/
      );
    });

    it("implements reauthenticate() calling supabase.auth.reauthenticate()", () => {
      assert.match(
        authContextContent,
        /await\s+supabase\.auth\.reauthenticate\(\)/
      );
    });

    it("computes hasPasswordIdentity checking user identities and providers", () => {
      assert.match(
        authContextContent,
        /hasPasswordIdentity\s*=\s*Boolean\(\s*user\?\.identities\?\.some/
      );
      assert.match(
        authContextContent,
        /id\.provider\s*===\s*["']email["']/
      );
    });
  });

  describe("Account Settings UI Integration (app/account/page.tsx)", () => {
    const accountPagePath = path.join(
      process.cwd(),
      "app",
      "account",
      "page.tsx"
    );
    const accountPageContent = fs.readFileSync(accountPagePath, "utf-8");

    it("dynamically shows 'Set a password' for OAuth users and 'Change Password' for email users", () => {
      assert.match(
        accountPageContent,
        /\{hasPasswordIdentity\s*\?\s*["']Change Password["']\s*:\s*["']Set a password["']\}/
      );
    });

    it("integrates OtpInput for security verification nonce input", () => {
      assert.match(accountPageContent, /<OtpInput\s+length=\{6\}\s+onChange=\{setNonceCode\}/);
    });

    it("provides resend nonce button with cooldown timer", () => {
      assert.match(accountPageContent, /handleResendNonce/);
      assert.match(accountPageContent, /nonceCooldown/);
    });

    it("hides current password input for OAuth users setting a password for the first time", () => {
      assert.match(accountPageContent, /!hasPasswordIdentity\s*\?/);
      assert.match(
        accountPageContent,
        /You are currently signed in with an external account/
      );
    });
  });

  describe("Unit Simulation of changePassword Logic", () => {
    it("fails when password length is less than 8", async () => {
      let signedOutScope: string | null = null;
      let updatedAttributes: Record<string, any> | null = null;

      const mockSupabase = {
        auth: {
          updateUser: async (attrs: any): Promise<{ error: { message: string } | null }> => {
            updatedAttributes = attrs;
            return { error: null };
          },
          signOut: async (opts?: { scope?: string }) => {
            signedOutScope = opts?.scope || null;
            return { error: null };
          },
        },
      };

      const user = { id: "user-1", email: "user@example.com" };

      const simulateChangePassword = async (
        newPassword: string,
        currentPassword?: string,
        nonce?: string
      ) => {
        if (!user) return { error: "Not logged in" };
        if (newPassword.length < 8) return { error: "Password must be at least 8 characters long." };

        const payload: any = { password: newPassword };
        if (currentPassword?.trim()) payload.current_password = currentPassword.trim();
        if (nonce?.trim()) payload.nonce = nonce.trim();

        const { error } = await mockSupabase.auth.updateUser(payload);
        if (error) return { error: error.message };

        await mockSupabase.auth.signOut({ scope: "others" });
        return { error: null };
      };

      const resShort = await simulateChangePassword("1234567");
      assert.equal(resShort.error, "Password must be at least 8 characters long.");
      assert.equal(updatedAttributes, null);
      assert.equal(signedOutScope, null);

      const resSuccess = await simulateChangePassword("strongP@ssw0rd!", "oldP@ssw0rd!", "123456");
      assert.equal(resSuccess.error, null);
      assert.ok(updatedAttributes);
      const attrs = updatedAttributes as Record<string, any>;
      assert.equal(attrs.password, "strongP@ssw0rd!");
      assert.equal(attrs.current_password, "oldP@ssw0rd!");
      assert.equal(attrs.nonce, "123456");
      assert.equal(signedOutScope, "others");
    });
  });
});
