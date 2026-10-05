import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSafeRedirect,
  getSafeAdminRedirect,
  readReturnUrl,
  returnUrlQuery,
} from "@/lib/navigation/safe-redirect";

describe("Open Redirect Security Matrix (Task 10.9)", () => {
  describe("Exhaustive malicious URL vectors against getSafeRedirect()", () => {
    const maliciousVectors = [
      // Standard absolute URLs
      "https://evil.com",
      "http://attacker.org",
      "ftp://malicious.net",
      "//evil.com",
      "//evil.com/phishing",
      "///evil.com",
      "////evil.com",

      // Backslash variations (RFC vs Windows browser URL normalization)
      "/\\evil.com",
      "\\/evil.com",
      "\\\\evil.com",
      "\\evil.com",
      "/\\/evil.com",

      // URL Encoded bypass attempts
      "%2F%2Fevil.com",
      "%5C%5Cevil.com",
      "%2f%2fevil.com",

      // Whitespace, newline and tab injections
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r/evil.com",
      " /evil.com",

      // Pseudo-protocols / script execution
      "javascript:alert(1)",
      "JAVASCRIPT:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",

      // Host spoofing & lookalikes
      "https://dramashort.app.evil.com",
      "https://admin.dramashort.app.evil.com",
      "//dramashort.app.evil.com",
      "dramashort.app",
      "evil.com",

      // Buffer overflow / DoS length payloads
      "/" + "A".repeat(4096),
    ];

    for (const vector of maliciousVectors) {
      it(`blocks dangerous target: ${JSON.stringify(vector)}`, () => {
        const safe = getSafeRedirect(vector, "/fallback");
        assert.equal(safe, "/fallback");
      });
    }
  });

  describe("Legitimate internal routes preservation in getSafeRedirect()", () => {
    const safeInternalRoutes = [
      "/home",
      "/drama/ceo-secret-wife",
      "/watch/ceo-secret-wife?ep=1",
      "/search?q=ceo&genre=romance",
      "/account/history",
      "/account/favorite",
      "/account/settings",
      "/drama/ceo-secret-wife#episodes",
    ];

    for (const route of safeInternalRoutes) {
      it(`preserves legitimate route: ${route}`, () => {
        assert.equal(getSafeRedirect(route, "/home"), route);
      });
    }
  });

  describe("getSafeAdminRedirect() admin console confinement", () => {
    it("confines destination to /admin routes", () => {
      assert.equal(getSafeAdminRedirect("/admin/dramas"), "/admin/dramas");
      assert.equal(getSafeAdminRedirect("/admin/dashboard"), "/admin/dashboard");
      assert.equal(getSafeAdminRedirect("/admin/dramas/edit"), "/admin/dramas/edit");
    });

    it("rejects public routes, lookalike routes, and login loops", () => {
      const forbiddenForAdmin = [
        "/home",
        "/drama/test",
        "/account",
        "/administrator", // Lookalike prefix
        "/admin-settings", // Lookalike prefix
        "/admin/login", // Self-redirect login loop
        "/admin/login?returnUrl=/admin",
        "//evil.com",
        "https://evil.com/admin",
      ];

      for (const target of forbiddenForAdmin) {
        assert.equal(getSafeAdminRedirect(target), "/admin/dashboard", `Target ${target} must fall back`);
      }
    });
  });

  describe("readReturnUrl() parameter extraction and defense", () => {
    it("prioritizes returnUrl over legacy redirect", () => {
      const q = new URLSearchParams("returnUrl=%2Faccount%2Fhistory&redirect=%2Fsearch");
      assert.equal(readReturnUrl(q), "/account/history");
    });

    it("falls back to /home if returnUrl attempts open-redirect", () => {
      const q = new URLSearchParams("returnUrl=https%3A%2F%2Fevil.com");
      assert.equal(readReturnUrl(q), "/home");
    });

    it("falls back to /home if returnUrl targets an auth page (login loop)", () => {
      for (const authPage of ["/login", "/signup", "/verify-email", "/forgot-password"]) {
        const q = new URLSearchParams(`returnUrl=${encodeURIComponent(authPage)}`);
        assert.equal(readReturnUrl(q), "/home", `Target ${authPage} must not loop`);
      }
    });
  });

  describe("returnUrlQuery() formatting", () => {
    it("generates sanitized query string for valid target", () => {
      assert.equal(returnUrlQuery("/drama/ep-1"), "?returnUrl=%2Fdrama%2Fep-1");
    });

    it("returns empty string for default, empty, or dangerous targets", () => {
      assert.equal(returnUrlQuery("/home"), "");
      assert.equal(returnUrlQuery("/login"), "");
      assert.equal(returnUrlQuery("//evil.com"), "");
      assert.equal(returnUrlQuery(null), "");
      assert.equal(returnUrlQuery(undefined), "");
    });
  });
});
