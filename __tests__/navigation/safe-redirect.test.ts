import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getSafeAdminRedirect,
  getSafeRedirect,
  readReturnUrl,
  returnUrlQuery,
} from "@/lib/navigation/safe-redirect";

const params = (query: string) => new URLSearchParams(query);

describe("readReturnUrl (Task 10.5)", () => {
  it("prefers returnUrl and falls back to the legacy redirect parameter", () => {
    assert.equal(readReturnUrl(params("returnUrl=%2Faccount&redirect=%2Fsearch")), "/account");
    assert.equal(readReturnUrl(params("redirect=%2Fdrama%2Fceo-secret-wife")), "/drama/ceo-secret-wife");
    assert.equal(readReturnUrl(params("")), "/home");
  });

  it("blocks the original open redirect through either parameter", () => {
    assert.equal(readReturnUrl(params("redirect=https%3A%2F%2Fevil.example")), "/home");
    assert.equal(readReturnUrl(params("returnUrl=%2F%2Fevil.example")), "/home");
    assert.equal(readReturnUrl(params("returnUrl=javascript%3Aalert(1)")), "/home");
  });

  it("never returns an auth page", () => {
    for (const page of ["/login", "/signup", "/verify-email", "/forgot-password", "/login?x=1"]) {
      assert.equal(readReturnUrl(params(`returnUrl=${encodeURIComponent(page)}`)), "/home", page);
    }
  });
});

describe("returnUrlQuery (Task 10.5)", () => {
  it("builds a returnUrl query for safe, non-default destinations", () => {
    assert.equal(returnUrlQuery("/drama/ceo-secret-wife"), "?returnUrl=%2Fdrama%2Fceo-secret-wife");
    assert.equal(returnUrlQuery("/search?q=ceo"), "?returnUrl=%2Fsearch%3Fq%3Dceo");
  });

  it("returns an empty string for missing, default, unsafe, or auth-page destinations", () => {
    for (const value of [null, undefined, "", "/home", "//evil.example", "/login"]) {
      assert.equal(returnUrlQuery(value), "", JSON.stringify(value));
    }
  });
});

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
