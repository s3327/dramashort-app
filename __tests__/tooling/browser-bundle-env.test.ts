import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Judges the last build, which only means something right after `npm run build` with the
// same NEXT_PUBLIC_SUPABASE_URL. CI runs it that way (VERIFY_BUILD_ENV=1 after its build
// step); a plain `npm test` skips it, because the last local build may use another URL.
const requested = process.env.VERIFY_BUILD_ENV === "1";

describe("browser bundle carries the Supabase project URL (ADR-0005)", () => {
  it(
    "inlines NEXT_PUBLIC_SUPABASE_URL into the client chunks of the last build",
    { skip: requested ? false : "set VERIFY_BUILD_ENV=1 right after `npm run build` to check that build" },
    () => {
      assert.ok(url, "NEXT_PUBLIC_SUPABASE_URL must be the URL the build was made with");
      const staticDir = path.join(process.cwd(), ".next", "static");
      assert.ok(fs.existsSync(staticDir), "run `npm run build` before this test");
      const files = (fs.readdirSync(staticDir, { recursive: true }) as string[]).filter((f) => f.endsWith(".js"));
      const found = files.some((f) => fs.readFileSync(path.join(staticDir, f), "utf8").includes(url as string));
      assert.ok(found, `no client chunk contains ${url}; browser code would fall back to the local address`);
    }
  );
});
