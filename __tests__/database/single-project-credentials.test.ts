import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSupabaseCredentials, getServiceRoleKey } from "@/lib/supabase/credentials";
import { validateEnvironment } from "@/lib/config/env-validator.mjs";
import { createContentClient } from "@/lib/supabase/content";

const PROD = { NODE_ENV: "production" };
const PROJECT_URL = "https://abcdefghijklmnopqrst.supabase.co";

describe("single-project credentials (ADR-0005)", () => {
  it("returns the configured project URL and anon key", () => {
    assert.deepEqual(
      getSupabaseCredentials({ NEXT_PUBLIC_SUPABASE_URL: PROJECT_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-123" }),
      { url: PROJECT_URL, anonKey: "anon-123" }
    );
  });

  it("falls back to the local stack outside production", () => {
    assert.deepEqual(getSupabaseCredentials({}), { url: "http://127.0.0.1:54321", anonKey: "dev-anon-key" });
  });

  it("names NEXT_PUBLIC_SUPABASE_URL when production has only the old variable names", () => {
    assert.throws(
      () => getSupabaseCredentials({ ...PROD, NEXT_PUBLIC_CONTENT_SUPABASE_URL: PROJECT_URL, NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY: "k" }),
      /NEXT_PUBLIC_SUPABASE_URL/
    );
  });

  it("rejects placeholder values in production", () => {
    assert.throws(
      () => getSupabaseCredentials({ ...PROD, NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }),
      /NEXT_PUBLIC_SUPABASE_URL/
    );
  });

  it("requires SUPABASE_SERVICE_ROLE_KEY and ignores the old service key names", () => {
    assert.equal(getServiceRoleKey({ SUPABASE_SERVICE_ROLE_KEY: "svc" }), "svc");
    assert.throws(() => getServiceRoleKey({ CONTENT_SUPABASE_SERVICE_ROLE_KEY: "svc" }), /SUPABASE_SERVICE_ROLE_KEY/);
    assert.throws(() => getServiceRoleKey({ ...PROD, SUPABASE_SERVICE_ROLE_KEY: "placeholder-service-role-key" }), /placeholder/i);
  });

  it("reads the public variables as literal process.env expressions so Next.js inlines them", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/supabase/credentials.ts"), "utf8");
    assert.ok(src.includes("process.env.NEXT_PUBLIC_SUPABASE_URL"));
    assert.ok(src.includes("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  });

  it("the build-time validator requires the new names and reports them by name", () => {
    const { valid, errors } = validateEnvironment({ NODE_ENV: "production", PAYMENT_WEBHOOK_SECRET: "a", CRON_SECRET: "b" }, { throws: false });
    assert.equal(valid, false);
    assert.ok(errors.some((e: string) => e.includes("NEXT_PUBLIC_SUPABASE_URL")));
    assert.ok(errors.some((e: string) => e.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY")));
  });

  // Both browser clients now target one project. The catalog client reads anonymously, as it
  // did against dramashort-content; sharing the user client's storage key made auth-js warn
  // about multiple GoTrueClient instances and tie both clients to one session.
  it("the catalog client keeps no session and has its own auth storage key", () => {
    const client = createContentClient({ NEXT_PUBLIC_SUPABASE_URL: PROJECT_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-123" });
    const auth = client.auth as unknown as {
      persistSession: boolean;
      autoRefreshToken: boolean;
      detectSessionInUrl: boolean;
      storageKey: string;
    };
    assert.equal(auth.persistSession, false);
    assert.equal(auth.autoRefreshToken, false);
    assert.equal(auth.detectSessionInUrl, false);
    assert.notEqual(auth.storageKey, "sb-abcdefghijklmnopqrst-auth-token");
  });

  // Without it a deployment builds, then payments, cron, /contact and account deletion
  // fail at runtime and admin pages silently read through the anon key.
  it("a production build also requires SUPABASE_SERVICE_ROLE_KEY", () => {
    const { valid, errors } = validateEnvironment(
      { ...PROD, NEXT_PUBLIC_SUPABASE_URL: PROJECT_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-123", PAYMENT_WEBHOOK_SECRET: "a", CRON_SECRET: "b" },
      { throws: false }
    );
    assert.equal(valid, false);
    assert.ok(errors.some((e: string) => e.includes("SUPABASE_SERVICE_ROLE_KEY")), errors.join("\n"));
  });

  it("nothing outside tests reads the old variable names", () => {
    const roots = ["app", "lib", "components", "hooks", "contexts", "scripts"];
    const old = /NEXT_PUBLIC_(CONTENT|USER)_SUPABASE|(CONTENT|USER)_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_CONTENT_SERVICE_ROLE_KEY|SUPABASE_DATABASE_TOPOLOGY|NEXT_PUBLIC_SUPABASE_TOPOLOGY/;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|tsx|mjs|cjs|js)$/.test(entry.name) && old.test(fs.readFileSync(p, "utf8"))) offenders.push(p);
      }
    };
    roots.forEach((r) => walk(path.join(process.cwd(), r)));
    for (const f of ["middleware.ts", "next.config.mjs", ".env.example", ".github/workflows/ci.yml"]) {
      if (old.test(fs.readFileSync(path.join(process.cwd(), f), "utf8"))) offenders.push(f);
    }
    assert.deepEqual(offenders, []);
  });
});
