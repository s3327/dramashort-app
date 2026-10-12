import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseFingerprint, subjectOf, compareFingerprints } from "@/scripts/db/compare-fingerprints.mjs";

const content = parseFingerprint(
  [
    "column|titles.id|uuid null=NO default=gen_random_uuid()",
    "table_grant|titles.anon|SELECT",
    "column|wallets.balance|integer null=NO default=0",
    "function|search_dramas(q text)|returns=SETOF titles secdef=false config= body=aaa",
  ].join("\n")
);
const user = parseFingerprint(
  [
    "column|profiles.id|uuid null=NO default=",
    "column|wallets.balance|integer null=NO default=0",
    "trigger|users.on_auth_user_created|CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users",
    "function|search_dramas(q text, lim integer)|returns=SETOF content.titles secdef=false config= body=bbb",
  ].join("\n")
);
const ownership = { user: ["wallets"], content: [] };

describe("schema fingerprint comparison (ADR-0005)", () => {
  it("parses kind|object|detail lines and keeps pipes inside the detail", () => {
    const facts = parseFingerprint("policy|t.p|SELECT roles=anon using=(a|b) check=\n\n");
    assert.equal(facts.get("policy|t.p"), "SELECT roles=anon using=(a|b) check=");
    assert.equal(facts.size, 1);
  });

  it("derives the owning table or function from the object name", () => {
    assert.equal(subjectOf("column|profiles.id"), "profiles");
    assert.equal(subjectOf("function|search_dramas(q text)"), "search_dramas");
    assert.equal(subjectOf("function_grant|credit_wallet_coins(uuid, integer).anon"), "credit_wallet_coins");
  });

  it("passes when every fact matches the reference of its owner", () => {
    const merged = new Map([...content, ...user]);
    merged.delete("function|search_dramas(q text, lim integer)");
    assert.deepEqual(compareFingerprints({ merged, content, user, ownership }), []);
  });

  it("reports a user-side object that is missing from the merged database", () => {
    const merged = new Map(content);
    const problems = compareFingerprints({ merged, content, user, ownership });
    assert.ok(problems.some((p) => p.type === "missing" && p.key === "column|profiles.id"));
    assert.ok(problems.some((p) => p.type === "missing" && p.key === "trigger|users.on_auth_user_created"));
  });

  it("reports a re-opened client grant on a catalog table", () => {
    const merged = new Map([...content, ...user]);
    merged.delete("function|search_dramas(q text, lim integer)");
    merged.set("table_grant|titles.anon", "DELETE,INSERT,SELECT,UPDATE");
    const problems = compareFingerprints({ merged, content, user, ownership });
    assert.deepEqual(problems, [
      { type: "changed", key: "table_grant|titles.anon", expected: "SELECT", actual: "DELETE,INSERT,SELECT,UPDATE" },
    ]);
  });

  it("keeps the content definition of an object both databases have unless ownership says user", () => {
    const merged = new Map([...content, ...user]);
    const problems = compareFingerprints({ merged, content, user, ownership });
    assert.deepEqual(problems, [
      { type: "unexpected", key: "function|search_dramas(q text, lim integer)", actual: user.get("function|search_dramas(q text, lim integer)") },
    ]);
  });

  it("without a user reference, compares every fact against the content reference", () => {
    assert.deepEqual(compareFingerprints({ merged: new Map(content), content }), []);
  });

  it("ignores differences listed as allowed", () => {
    const merged = new Map(content);
    const problems = compareFingerprints({
      merged, content, user, ownership,
      allowed: { "column|profiles.id": "r", "trigger|users.on_auth_user_created": "r" },
    });
    assert.deepEqual(problems, []);
  });
});
