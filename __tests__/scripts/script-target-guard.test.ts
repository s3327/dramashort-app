import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isLocalSupabaseUrl } from "@/scripts/lib/supabase-target";

// The scripts read .env.local, which points at the hosted project after the switch
// (ADR-0005). Only a local stack may be changed without --confirm-production.
// `.invalid` never resolves, so a script that gets past its guard cannot reach anything.
const HOSTED_ENV = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: "https://hosted.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

function runScript(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", ...args], {
    cwd: process.cwd(),
    env: HOSTED_ENV,
    encoding: "utf8",
    timeout: 60_000,
  });
}

describe("Script target guard (ADR-0005 final review)", () => {
  it("recognises only a local Supabase stack as local", () => {
    assert.equal(isLocalSupabaseUrl("http://127.0.0.1:54321"), true);
    assert.equal(isLocalSupabaseUrl("http://localhost:54321"), true);
    assert.equal(isLocalSupabaseUrl("http://[::1]:54321"), true);
    assert.equal(isLocalSupabaseUrl("https://abcdefghijklmnopqrst.supabase.co"), false);
    assert.equal(isLocalSupabaseUrl("https://127.0.0.1.example.com"), false);
    assert.equal(isLocalSupabaseUrl("not a url"), false);
    assert.equal(isLocalSupabaseUrl(undefined), false);
  });

  it("db:clean:dev refuses a hosted project without --confirm-production", () => {
    const result = runScript(["scripts/seed-dev-content.ts", "--clean"]);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /SAFETY REFUSAL/);
    assert.doesNotMatch(result.stdout, /Tables cleared/);
  });

  it("admin:create --revoke refuses a hosted project without --confirm-production", () => {
    const result = runScript(["scripts/create-admin.ts", "--email", "someone@example.com", "--revoke"]);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stderr, /SAFETY REFUSAL/);
    assert.doesNotMatch(result.stdout, /Searching for existing user/);
  });
});
