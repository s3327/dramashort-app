import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSafeAdminRedirect, getSafeRedirect } from "@/lib/navigation/safe-redirect";

describe("getSafeRedirect (open-redirect protection)", () => {
  it("keeps same-origin relative paths with query and hash", () => {
    assert.equal(getSafeRedirect("/account/history"), "/account/history");
    assert.equal(getSafeRedirect("/search?q=ceo&page=2#top"), "/search?q=ceo&page=2#top");
    assert.equal(getSafeRedirect("/%2F%2Fevil.example"), "/%2F%2Fevil.example");
  });

  it("rejects off-site and malformed destinations", () => {
    for (const value of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "%2F%2Fevil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "evil.example",
      "",
      null,
      undefined,
      42,
      "/" + "a".repeat(3000),
    ]) {
      assert.equal(getSafeRedirect(value, "/home"), "/home", JSON.stringify(value));
    }
  });
});

describe("getSafeAdminRedirect", () => {
  it("allows destinations inside the admin console", () => {
    assert.equal(getSafeAdminRedirect("/admin/dramas?page=2"), "/admin/dramas?page=2");
    assert.equal(getSafeAdminRedirect("/admin"), "/admin");
  });

  it("falls back for public pages, look-alikes, the login page, and unsafe values", () => {
    for (const value of ["/home", "/administrator", "/admin/login", "/admin/login?x=1", "//evil.example", null]) {
      assert.equal(getSafeAdminRedirect(value), "/admin/dashboard", JSON.stringify(value));
    }
  });
});
