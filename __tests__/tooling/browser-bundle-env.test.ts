import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

describe("browser bundle carries the Supabase project URL (ADR-0005)", () => {
  it(
    "inlines NEXT_PUBLIC_SUPABASE_URL into the client chunks of the last build",
    { skip: url ? false : "NEXT_PUBLIC_SUPABASE_URL is not set in this environment" },
    () => {
      const staticDir = path.join(process.cwd(), ".next", "static");
      assert.ok(fs.existsSync(staticDir), "run `npm run build` before this test");
      const files = (fs.readdirSync(staticDir, { recursive: true }) as string[]).filter((f) => f.endsWith(".js"));
      const found = files.some((f) => fs.readFileSync(path.join(staticDir, f), "utf8").includes(url as string));
      assert.ok(found, `no client chunk contains ${url}; browser code would fall back to the local address`);
    }
  );
});
