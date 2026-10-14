import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Restores the guide checks that lived in topology-consolidation.test.ts §5, for the single
// `public` schema of ADR-0005.
const ROOT = process.cwd();
const guidePath = path.join(ROOT, "docs/architecture/reusable-content-api.md");
const runbookPath = path.join(ROOT, "docs/operations/operational-readiness.md");
const read = (p: string) => fs.readFileSync(p, "utf8");

describe("Reusable catalog API guide (ADR-0005)", () => {
  it("exists and is a substantial document", () => {
    assert.ok(fs.statSync(guidePath).size > 4000);
  });

  it("documents the client boundaries the migrations create", () => {
    const text = read(guidePath);
    for (const s of ["episode_media", "video_url", "verify-catalog-rls.sql", "verify-user-side-rls.sql", "anon"]) {
      assert.ok(text.includes(s), s);
    }
  });

  it("provides TypeScript, cURL and Python samples", () => {
    const text = read(guidePath);
    assert.ok(text.includes("```typescript"));
    assert.ok(text.includes("curl "));
    assert.ok(text.includes("```python"));
  });

  it("documents caching, rate limiting and scaling", () => {
    const text = read(guidePath);
    for (const s of ["revalidate = 300", "Cache-Control", "429", "Read Replica", "Supavisor"]) {
      assert.ok(text.includes(s), s);
    }
  });

  it("describes no content-schema access, there or in the README", () => {
    const text = read(guidePath);
    assert.doesNotMatch(text, /Accept-Profile: content|schema: ["']content["']|ClientOptions\(schema="content"\)/);
    assert.doesNotMatch(read(path.join(ROOT, "README.md")), /Multi-schema catalog access/);
  });

  it("links to ADR-0005 and the README, and the README links back", () => {
    assert.ok(read(guidePath).includes("../adr/0005-single-supabase-project.md"));
    assert.ok(read(guidePath).includes("../../README.md"));
    assert.ok(read(path.join(ROOT, "README.md")).includes("docs/architecture/reusable-content-api.md"));
  });

  it("has no broken relative links in the guide or the operations runbook", () => {
    for (const doc of [guidePath, runbookPath]) {
      for (const m of read(doc).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
        const target = m[1].split("#")[0];
        if (!target || /^(https?:|mailto:)/.test(m[1])) continue;
        assert.ok(fs.existsSync(path.resolve(path.dirname(doc), target)), `${path.basename(doc)}: ${m[1]}`);
      }
    }
  });
});
