import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseAdminCliArgs,
  generateSecurePassword,
  isProductionProject,
  isValidEmail,
} from "@/scripts/create-admin";

describe("Admin Provisioning Script CLI & Validation (Task 10.7)", () => {
  describe("isValidEmail", () => {
    it("accepts valid email formats", () => {
      assert.equal(isValidEmail("admin@dramashort.com"), true);
      assert.equal(isValidEmail("staff.member+test@sub.example.co.uk"), true);
    });

    it("rejects invalid email strings", () => {
      assert.equal(isValidEmail(""), false);
      assert.equal(isValidEmail("not-an-email"), false);
      assert.equal(isValidEmail("missing@domain"), false);
      assert.equal(isValidEmail("@nodomain.com"), false);
      assert.equal(isValidEmail(null as unknown as string), false);
    });
  });

  describe("isProductionProject", () => {
    // ADR-0005: the single project gets a new ref, so any hosted project counts as production.
    it("treats any hosted Supabase project as production", () => {
      assert.equal(isProductionProject("https://abcdefghijklmnopqrst.supabase.co"), true);
      assert.equal(isProductionProject("https://placeholder.supabase.co"), true);
      assert.equal(isProductionProject("https://db.example.com"), true);
    });

    it("returns false only for a local stack or a missing URL", () => {
      assert.equal(isProductionProject("http://127.0.0.1:54321"), false);
      assert.equal(isProductionProject("http://localhost:54321"), false);
      assert.equal(isProductionProject("http://[::1]:54321"), false);
      assert.equal(isProductionProject(undefined), false);
    });
  });

  describe("generateSecurePassword", () => {
    it("generates password with requested length", () => {
      const pass = generateSecurePassword(24);
      assert.equal(pass.length, 24);
    });

    it("contains uppercase, lowercase, numbers, and symbols", () => {
      const pass = generateSecurePassword(20);
      assert.match(pass, /[A-Z]/);
      assert.match(pass, /[a-z]/);
      assert.match(pass, /[0-9]/);
      assert.match(pass, /[!@#$%^&*()_+\-=\[\]{}]/);
    });

    it("generates distinct passwords across calls", () => {
      const pass1 = generateSecurePassword();
      const pass2 = generateSecurePassword();
      assert.notEqual(pass1, pass2);
    });
  });

  describe("parseAdminCliArgs", () => {
    it("throws when --email argument is missing", () => {
      assert.throws(() => parseAdminCliArgs([]), {
        message: /Missing required --email argument/,
      });
    });

    it("throws when email address format is invalid", () => {
      assert.throws(() => parseAdminCliArgs(["--email", "bad-email"]), {
        message: /Invalid email address/,
      });
    });

    it("parses minimal valid command with default admin role", () => {
      const parsed = parseAdminCliArgs(["--email", "admin@dramashort.com"]);
      assert.equal(parsed.email, "admin@dramashort.com");
      assert.equal(parsed.role, "admin");
      assert.equal(parsed.resetPassword, false);
      assert.equal(parsed.revoke, false);
      assert.equal(parsed.confirmProduction, false);
    });

    it("parses --email=value format", () => {
      const parsed = parseAdminCliArgs(["--email=staff@dramashort.com"]);
      assert.equal(parsed.email, "staff@dramashort.com");
    });

    it("supports backward-compatible positional email argument", () => {
      const parsed = parseAdminCliArgs(["editor@dramashort.com"]);
      assert.equal(parsed.email, "editor@dramashort.com");
    });

    it("parses --role editor correctly", () => {
      const parsed = parseAdminCliArgs(["--email", "editor@dramashort.com", "--role", "editor"]);
      assert.equal(parsed.role, "editor");
    });

    it("rejects unknown role", () => {
      assert.throws(
        () => parseAdminCliArgs(["--email", "editor@dramashort.com", "--role", "superadmin"]),
        {
          message: /Invalid --role "superadmin"/,
        }
      );
    });

    it("parses flags: --reset-password, --revoke, --confirm-production", () => {
      const parsed = parseAdminCliArgs([
        "--email",
        "staff@dramashort.com",
        "--reset-password",
        "--revoke",
        "--confirm-production",
      ]);

      assert.equal(parsed.resetPassword, true);
      assert.equal(parsed.revoke, true);
      assert.equal(parsed.confirmProduction, true);
    });

    it("parses custom --password and --name", () => {
      const parsed = parseAdminCliArgs([
        "--email",
        "staff@dramashort.com",
        "--password",
        "CustomSecret123!",
        "--name",
        "Alice Admin",
      ]);

      assert.equal(parsed.password, "CustomSecret123!");
      assert.equal(parsed.fullName, "Alice Admin");
    });
  });
});
