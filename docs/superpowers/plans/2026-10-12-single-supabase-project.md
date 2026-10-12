# Single Supabase Project (Singapore) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run DramaShort on one new Supabase project in Singapore (`ap-southeast-1`), with every table in `public`, one migration chain, and three environment variables, so that dramashort-content (`czkkzoiuyqybafacpgsp`) and dramashort-user (`bpidsbcrvpkavvdvtpgh`) can be deleted.

**Architecture:** The user-side schema from the dramashort-user chain is ported into the dramashort-content chain as new migrations, and a schema fingerprint comparison proves that every object ends up identical to the side that owns it. The combined chain is applied to a new, empty project in Singapore and the catalog rows are copied over from dramashort-content. The Supabase client code collapses onto one set of credentials that browser bundles can inline (this also fixes broken browser sign-in). Live changes happen only in Phase 2, one confirmed step at a time.

**Tech Stack:** Next.js 15.5, `@supabase/supabase-js` / `@supabase/ssr`, Supabase CLI 2.118.0 (local stacks in Docker), PostgreSQL 17, `node:test` via `tsx`, Playwright 1.64.

**Spec:** [docs/adr/0005-single-supabase-project.md](../../adr/0005-single-supabase-project.md)

## Global Constraints

- The single project is a new project named `dramashort` in `ap-southeast-1` (Singapore), created in Task 10. Nothing in this plan writes to dramashort-content `czkkzoiuyqybafacpgsp` or dramashort-user `bpidsbcrvpkavvdvtpgh`; they are only read and exported (the owner may pause dramashort-user after its export to stay within the free plan).
- No command that changes a live database or live project settings runs without the project owner's go-ahead for that specific step (Phase 2).
- Every application table, view, and function lives in `public`. No `content` schema.
- Environment variable names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Nothing reads `NEXT_PUBLIC_CONTENT_SUPABASE_*`, `NEXT_PUBLIC_USER_SUPABASE_*`, `CONTENT_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_CONTENT_SERVICE_ROLE_KEY`, `USER_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_TOPOLOGY`, or `NEXT_PUBLIC_SUPABASE_TOPOLOGY` afterwards.
- Browser-reachable code reads the two public variables only as literal `process.env.NEXT_PUBLIC_SUPABASE_URL` / `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` expressions.
- The 20 existing dramashort-content migration files keep their file names. Ported migrations use versions `20261012100000` and later.
- No ported migration may grant `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE` on catalog tables to `anon` or `authenticated` (that would undo `20261011110000_revoke_client_write_grants.sql`).
- Supabase CLI version 2.118.0 (the `supabase` dev dependency); Postgres major version 17.
- Exports containing data (auth users, password hashes) are stored outside the repository and never committed.
- Tests run through `npm test` or `npm run test:file -- <file>` (both preload the `server-only` stub).
- Commits: repository style `type(scope): summary (Task 13.7)`, no `Co-Authored-By` or other AI attribution line.
- Phase 1 commits are not pushed to `dramashort-app` until Task 14 Step 1 is done: a deployment of Phase 1 code needs the three new variables on Vercel, and between Tasks 3 and 4 the CI database job fails by design. Pushing earlier is fine only to a branch the owner confirms Vercel does not deploy.
- Every task appends an entry to `CHANGELOG-DEV.md` (append-only; Verification lists only what actually ran) and updates Task 13.7 in `ROADMAP.md`.

## Review Focus

1. **Browser code that still reads public variables indirectly.** Any client module that reads `NEXT_PUBLIC_*` through a variable gets `undefined` in the browser and silently falls back to a local address; sign-in then fails with "Failed to fetch". Pinned by the bundle test in Task 5 and the browser sign-in check in Task 7.
2. **Client write grants coming back on catalog tables.** The dramashort-user chain's `grant_permissions` migration grants `ALL ON ALL TABLES` to `authenticated`. Pinned by the `table_grant` facts in the fingerprint comparison (Task 4) and by `verify-catalog-rls.sql`.
3. **Signup on the merged database.** A new account must get a `profiles` row through `on_auth_user_created`, with the role `user` and no way to raise it. Pinned by `verify-user-side-rls.sql` (Task 4) and the local browser sign-up (Task 7).
4. **Admin lockout after the switch.** The admin area checks `profiles.role` in the single project, which starts with no accounts. Pinned by the admin sign-in smoke check in Task 14, which runs only after `npm run admin:create`.
5. **A deployment that still has only the old variable names.** The build must fail with a message naming the missing new variable, not run against a local fallback. Pinned by the validator tests in Task 5.

## Prerequisites (project owner)

- Start Docker Desktop and leave it running for Phase 1 and the exports in Phase 2 (`docker info` must succeed).
- Be logged in to the Supabase CLI (`npx supabase projects list` lists both projects).
- Have the database passwords of both existing projects at hand (Supabase dashboard → Project Settings → Database); the CLI may ask for them when exporting (Task 9). The new project's password is set when it is created (Task 10).
- Know the organization's plan. On the free plan only two projects can be active, so dramashort-user is paused after its export (Task 10) before the Singapore project is created.

---

## Phase 1 — Local only (no live changes)

### Task 1: Schema fingerprint tool

A fingerprint is a sorted list of `kind|object|detail` lines describing tables, columns, constraints, indexes, RLS, policies, grants, functions, triggers, views, and default privileges. Comparing fingerprints proves the merged database matches the two databases it replaces.

**Files:**
- Create: `scripts/db/schema-fingerprint.sql`
- Create: `scripts/db/compare-fingerprints.mjs`
- Create: `scripts/db/merge-ownership.json`
- Create: `scripts/db/merge-allowed-differences.json`
- Test: `__tests__/database/fingerprint-compare.test.ts`

**Interfaces:**
- Produces: `parseFingerprint(text: string): Map<string, string>` (key `kind|object`, value `detail`); `subjectOf(key: string): string`; `compareFingerprints({ merged, content, user?, ownership?, allowed? }): Array<{ type: "missing" | "changed" | "unexpected"; key: string; expected?: string; actual?: string }>`; CLI `node scripts/db/compare-fingerprints.mjs --merged <file> --content <file> [--user <file>]` exiting 1 on any problem.

- [ ] **Step 1: Write the failing test**

`__tests__/database/fingerprint-compare.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:file -- __tests__/database/fingerprint-compare.test.ts`
Expected: FAIL, `Cannot find module '@/scripts/db/compare-fingerprints.mjs'`.

- [ ] **Step 3: Write the comparison module**

`scripts/db/compare-fingerprints.mjs`:

```js
#!/usr/bin/env node
/**
 * Compares the schema fingerprint of the merged database with the fingerprints of
 * the databases it replaces (ADR-0005). Every fact must equal the reference of the
 * side that owns it; anything else is reported.
 *
 * Usage:
 *   node scripts/db/compare-fingerprints.mjs --merged <file> --content <file> [--user <file>]
 *     [--ownership scripts/db/merge-ownership.json] [--allowed scripts/db/merge-allowed-differences.json]
 * Without --user, every fact must equal the content reference.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** "kind|object|detail" lines -> Map("kind|object" -> detail). */
export function parseFingerprint(text) {
  const facts = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const first = line.indexOf("|");
    const second = line.indexOf("|", first + 1);
    if (first < 0 || second < 0) throw new Error(`Malformed fingerprint line: ${line}`);
    facts.set(line.slice(0, second), line.slice(second + 1));
  }
  return facts;
}

/** Table or function a fact belongs to: "column|profiles.id" -> "profiles". */
export function subjectOf(key) {
  const object = key.slice(key.indexOf("|") + 1);
  return object.split(/[.(]/, 1)[0];
}

function ownerResolver(ownership, user, content) {
  const contentSubjects = new Set([...content.keys()].map(subjectOf));
  const userSubjects = new Set([...user.keys()].map(subjectOf));
  return (key) => {
    const subject = subjectOf(key);
    if (ownership.user.includes(subject)) return "user";
    if (ownership.content.includes(subject)) return "content";
    if (userSubjects.has(subject) && !contentSubjects.has(subject)) return "user";
    return "content";
  };
}

/**
 * @param {{
 *   merged: Map<string, string>,
 *   content: Map<string, string>,
 *   user?: Map<string, string>,
 *   ownership?: { user: string[], content: string[] },
 *   allowed?: Record<string, string>,
 * }} input
 * @returns {Array<{ type: "missing" | "changed" | "unexpected", key: string, expected?: string, actual?: string }>}
 */
export function compareFingerprints({ merged, content, user = new Map(), ownership = { user: [], content: [] }, allowed = {} }) {
  const owner = ownerResolver(user.size ? ownership : { user: [], content: [] }, user, content);
  const expected = new Map();
  for (const [key, detail] of content) if (owner(key) === "content") expected.set(key, detail);
  for (const [key, detail] of user) if (owner(key) === "user") expected.set(key, detail);

  const problems = [];
  for (const [key, detail] of expected) {
    if (!merged.has(key)) problems.push({ type: "missing", key, expected: detail });
    else if (merged.get(key) !== detail) problems.push({ type: "changed", key, expected: detail, actual: merged.get(key) });
  }
  for (const [key, detail] of merged) {
    if (!expected.has(key)) problems.push({ type: "unexpected", key, actual: detail });
  }
  return problems.filter((p) => !Object.prototype.hasOwnProperty.call(allowed, p.key));
}

function readArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

function main() {
  const args = readArgs(process.argv.slice(2));
  if (!args.merged || !args.content) {
    console.error("Usage: compare-fingerprints.mjs --merged <file> --content <file> [--user <file>]");
    process.exit(2);
  }
  const read = (file) => parseFingerprint(fs.readFileSync(file, "utf8"));
  const readJson = (file, fallback) => (file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback);
  const problems = compareFingerprints({
    merged: read(args.merged),
    content: read(args.content),
    user: args.user ? read(args.user) : new Map(),
    ownership: readJson(args.ownership ?? "scripts/db/merge-ownership.json", { user: [], content: [] }),
    allowed: readJson(args.allowed ?? "scripts/db/merge-allowed-differences.json", {}),
  });
  for (const p of problems) {
    console.log(`${p.type.toUpperCase()} ${p.key}`);
    if (p.expected !== undefined) console.log(`    expected: ${p.expected}`);
    if (p.actual !== undefined) console.log(`    actual:   ${p.actual}`);
  }
  console.log(problems.length ? `\n${problems.length} difference(s)` : "Fingerprints match.");
  process.exit(problems.length ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
```

`scripts/db/merge-ownership.json` (tables and functions that exist in both projects today and take the dramashort-user definition, per ADR-0005 §6):

```json
{
  "user": [
    "wallets", "coin_transactions", "daily_checkins", "user_unlocked_episodes", "support_tickets",
    "credit_wallet_coins", "debit_wallet_coins", "ensure_user_wallet", "unlock_episode_with_coins",
    "claim_daily_checkin", "fn_sync_wallet_to_profile"
  ],
  "content": []
}
```

`scripts/db/merge-allowed-differences.json`:

```json
{}
```

- [ ] **Step 4: Write the fingerprint query**

`scripts/db/schema-fingerprint.sql`:

```sql
-- Schema fingerprint (ADR-0005): one "kind|object|detail" line per fact, sorted.
-- Usage: docker exec -i <db container> psql -U postgres -d postgres -q -A -t -v ON_ERROR_STOP=1 < scripts/db/schema-fingerprint.sql
WITH facts(kind, obj, detail) AS (
  SELECT 'column', c.table_name || '.' || c.column_name,
         c.data_type || ' null=' || c.is_nullable || ' default=' || coalesce(c.column_default, '')
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
UNION ALL
  SELECT 'constraint', cl.relname || '.' || con.conname, pg_get_constraintdef(con.oid)
  FROM pg_constraint con
  JOIN pg_class cl ON cl.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public'
UNION ALL
  SELECT 'index', i.tablename || '.' || i.indexname, i.indexdef
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
UNION ALL
  SELECT 'rls', cl.relname, 'enabled=' || cl.relrowsecurity || ' forced=' || cl.relforcerowsecurity
  FROM pg_class cl
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE n.nspname = 'public' AND cl.relkind IN ('r', 'p')
UNION ALL
  SELECT 'policy', p.tablename || '.' || p.policyname,
         p.cmd || ' roles=' || array_to_string(p.roles, ',') ||
         ' using=' || coalesce(p.qual, '') || ' check=' || coalesce(p.with_check, '')
  FROM pg_policies p
  WHERE p.schemaname = 'public'
UNION ALL
  SELECT 'table_grant', cl.relname || '.' || r.rolname,
         string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
  FROM pg_class cl
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  CROSS JOIN LATERAL aclexplode(coalesce(cl.relacl, acldefault('r', cl.relowner))) a
  JOIN pg_roles r ON r.oid = a.grantee
  WHERE n.nspname = 'public' AND cl.relkind IN ('r', 'p', 'v', 'm', 'S')
    AND r.rolname IN ('anon', 'authenticated', 'service_role')
  GROUP BY cl.relname, r.rolname
UNION ALL
  SELECT 'column_grant', cl.relname || '.' || att.attname || '.' || r.rolname,
         string_agg(a.privilege_type, ',' ORDER BY a.privilege_type)
  FROM pg_attribute att
  JOIN pg_class cl ON cl.oid = att.attrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  CROSS JOIN LATERAL aclexplode(att.attacl) a
  JOIN pg_roles r ON r.oid = a.grantee
  WHERE n.nspname = 'public' AND att.attacl IS NOT NULL
    AND r.rolname IN ('anon', 'authenticated', 'service_role')
  GROUP BY cl.relname, att.attname, r.rolname
UNION ALL
  SELECT 'function', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
         'returns=' || pg_get_function_result(p.oid) || ' secdef=' || p.prosecdef ||
         ' config=' || coalesce(array_to_string(p.proconfig, ';'), '') || ' body=' || md5(p.prosrc)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
UNION ALL
  SELECT 'function_grant', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ').' || r.rolname,
         CASE WHEN has_function_privilege(r.oid, p.oid, 'EXECUTE') THEN 'EXECUTE' ELSE 'none' END
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  CROSS JOIN pg_roles r
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND r.rolname IN ('anon', 'authenticated', 'service_role')
UNION ALL
  SELECT 'trigger', cl.relname || '.' || t.tgname, pg_get_triggerdef(t.oid)
  FROM pg_trigger t
  JOIN pg_class cl ON cl.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = cl.relnamespace
  WHERE NOT t.tgisinternal
    AND (n.nspname = 'public' OR (n.nspname = 'auth' AND cl.relname = 'users'))
UNION ALL
  SELECT 'view', v.table_name, md5(v.view_definition)
  FROM information_schema.views v
  WHERE v.table_schema = 'public'
UNION ALL
  SELECT 'default_acl',
         pg_get_userbyid(d.defaclrole) || '.' || coalesce(dn.nspname, '*') || '.' || d.defaclobjtype,
         array_to_string(d.defaclacl, ',')
  FROM pg_default_acl d
  LEFT JOIN pg_namespace dn ON dn.oid = d.defaclnamespace
)
SELECT kind || '|' || obj || '|' || detail FROM facts ORDER BY 1;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:file -- __tests__/database/fingerprint-compare.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/db __tests__/database/fingerprint-compare.test.ts
git commit -m "feat(database): schema fingerprint and comparison tool for the single-project merge (Task 13.7)"
```

(Append the CHANGELOG-DEV entry and the ROADMAP Task 13.7 progress line before committing; this applies to every task.)

### Task 2: Reference fingerprints of both current chains

Captured from the current two migration folders before anything moves. They are build artifacts, not committed.

**Files:**
- Modify: `.gitignore` (add `/tmp/`)
- Output (not committed): `tmp/db-merge/content-ref.txt`, `tmp/db-merge/user-ref.txt`

**Interfaces:**
- Consumes: `scripts/db/schema-fingerprint.sql` (Task 1).
- Produces: the two reference files used by Tasks 3 and 4.

- [ ] **Step 1: Ignore the work folder**

Append to `.gitignore`:

```
# merge work files (ADR-0005)
/tmp/
```

- [ ] **Step 2: Fingerprint the content chain**

```bash
mkdir -p tmp/db-merge
npx supabase start --workdir supabase/content
docker exec -i supabase_db_content psql -U postgres -d postgres -q -A -t -v ON_ERROR_STOP=1 \
  < scripts/db/schema-fingerprint.sql > tmp/db-merge/content-ref.txt
npx supabase stop --workdir supabase/content --no-backup
```

Expected: `content-ref.txt` has several hundred lines and includes `column|titles.id|` and `table_grant|titles.anon|SELECT`.

- [ ] **Step 3: Fingerprint the user chain**

```bash
npx supabase start --workdir supabase/user
docker exec -i supabase_db_user psql -U postgres -d postgres -q -A -t -v ON_ERROR_STOP=1 \
  < scripts/db/schema-fingerprint.sql > tmp/db-merge/user-ref.txt
npx supabase stop --workdir supabase/user --no-backup
```

Expected: `user-ref.txt` includes `column|profiles.role|` and `trigger|users.on_auth_user_created|`.

- [ ] **Step 4: Sanity-check the tool against itself**

Run: `node scripts/db/compare-fingerprints.mjs --merged tmp/db-merge/content-ref.txt --content tmp/db-merge/content-ref.txt`
Expected: `Fingerprints match.` and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add .gitignore CHANGELOG-DEV.md ROADMAP.md
git commit -m "chore(database): capture reference fingerprints of both migration chains (Task 13.7)"
```

### Task 3: One Supabase workdir at the repository root

Moves the dramashort-content chain to `supabase/migrations`, merges the two `config.toml` files (the user project's auth settings win), and points CI at one stack. User-side migrations are untouched in this task.

**Files:**
- Move: `supabase/content/supabase/migrations/*` → `supabase/migrations/`
- Move: `supabase/user/supabase/config.toml` → `supabase/config.toml` (then edit `project_id`)
- Move: `supabase/user/supabase/templates/` → `supabase/templates/`
- Move: `supabase/content/supabase/tests/content_rls.test.sql`, `supabase/user/supabase/tests/user_rls.test.sql` → `supabase/tests/`
- Delete: `supabase/content/supabase/config.toml`
- Move: `scripts/sql/verify-content-db-rls.sql` → `scripts/sql/verify-catalog-rls.sql`; `scripts/sql/verify-user-db-rls.sql` → `scripts/sql/verify-user-side-rls.sql`
- Modify: `package.json` (db scripts), `.github/workflows/ci.yml` (database job)
- Modify tests: `__tests__/tooling/bundle-budget-and-tooling.test.ts`, `__tests__/auth/password-recovery.test.ts`, `__tests__/auth/email-verification.test.ts`, `__tests__/security/rls-contract.test.ts`, and every test that reads `supabase/content/supabase/migrations/...` (10 files, listed in Step 5)

**Interfaces:**
- Produces: CLI workdir = repository root; local DB container `supabase_db_dramashort`; scripts `db:push`, `db:start`, `db:stop`; verification scripts `scripts/sql/verify-catalog-rls.sql`, `scripts/sql/verify-user-side-rls.sql`.

- [ ] **Step 1: Update the CI test first (failing test)**

In `__tests__/tooling/bundle-budget-and-tooling.test.ts`, replace the test `"database verification scripts stop on the first failure and the stacks do not overlap"` with:

```ts
    test("database verification runs on one local stack and stops on the first failure", () => {
      const db = jobBlock("supabase-rls-verification");
      assert.equal((db.match(/ON_ERROR_STOP=1/g) || []).length, 2, "both psql runs must use ON_ERROR_STOP");
      assert.doesNotMatch(db, /\|\|/, "no fallback may mask a failing verification");
      assert.doesNotMatch(db, /--workdir/, "the repository root is the only Supabase workdir");
      assert.match(db, /supabase start\b/);
      assert.match(db, /supabase_db_dramashort/);
      assert.match(db, /verify-user-side-rls\.sql/);
      assert.match(db, /verify-catalog-rls\.sql/);
    });
```

Run: `npm run test:file -- __tests__/tooling/bundle-budget-and-tooling.test.ts`
Expected: FAIL on `the repository root is the only Supabase workdir`.

- [ ] **Step 2: Move the files**

```bash
mkdir -p supabase/migrations supabase/tests
git mv supabase/content/supabase/migrations/* supabase/migrations/
git mv supabase/user/supabase/config.toml supabase/config.toml
git mv supabase/user/supabase/templates supabase/templates
git mv supabase/content/supabase/tests/content_rls.test.sql supabase/tests/content_rls.test.sql
git mv supabase/user/supabase/tests/user_rls.test.sql supabase/tests/user_rls.test.sql
git rm supabase/content/supabase/config.toml
git mv scripts/sql/verify-content-db-rls.sql scripts/sql/verify-catalog-rls.sql
git mv scripts/sql/verify-user-db-rls.sql scripts/sql/verify-user-side-rls.sql
```

In `supabase/config.toml` change the first line to `project_id = "dramashort"`. The template paths (`./supabase/templates/confirmation.html`, `./supabase/templates/recovery.html`) stay as they are: the CLI resolves them against the workdir, which is now the repository root.

In the header comments of both `scripts/sql/verify-*.sql`, replace the container names `supabase_db_user` / `supabase_db_content` with `supabase_db_dramashort` and the file names with the new ones.

`supabase/user/supabase/migrations/` stays for Task 4.

- [ ] **Step 3: package.json scripts**

Replace `db:content:push` and `db:user:push` with:

```json
    "db:start": "supabase start",
    "db:stop": "supabase stop --no-backup",
    "db:push": "supabase db push",
```

- [ ] **Step 4: CI database job**

In `.github/workflows/ci.yml`, replace the steps of `supabase-rls-verification` after `Setup Supabase CLI` with:

```yaml
      - name: Start Supabase & Run Migrations
        run: supabase start

      # psql exits non-zero on the first failed check (ON_ERROR_STOP).
      - name: Verify user-side RLS policies
        run: |
          docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 \
            < scripts/sql/verify-user-side-rls.sql

      - name: Verify catalog RLS policies
        run: |
          docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 \
            < scripts/sql/verify-catalog-rls.sql

      - name: Stop Supabase
        if: always()
        run: supabase stop --no-backup
```

(The user-side script fails until Task 4 adds the user tables; that is expected inside this task and is why Step 7 runs only the catalog script.)

- [ ] **Step 5: Repoint tests at the moved files**

```bash
grep -rlE "supabase/content/supabase/migrations" __tests__ | xargs sed -i 's#supabase/content/supabase/migrations#supabase/migrations#g'
sed -i 's#path.join(rootDir, "supabase", "content", "supabase", "migrations"#path.join(rootDir, "supabase", "migrations"#g' __tests__/security/rls-contract.test.ts
```

Affected files: `content/content-data-integrity`, `search/taxonomy-search-scalability`, `admin/drama-lifecycle-and-bulk`, `admin/channels-management`, `admin/taxonomy-management`, `admin/user-management`, `admin/platform-settings`, `admin/audit-log-and-role-model`, `admin/support-inbox`, `admin/bulk-import-pipeline`, `security/rls-contract`.

In `__tests__/auth/password-recovery.test.ts`: the template path becomes `supabase/templates/recovery.html`, the config path `supabase/config.toml`, the workdir `process.cwd()` (repository root), and the test title `"every email template content_path resolves from the CLI workdir (repository root)"`.

In `__tests__/auth/email-verification.test.ts` line 146: `path.join(rootDir, "supabase", "config.toml")`.

- [ ] **Step 6: Run the unit tests**

Run: `npm test`
Expected: all pass (the user-chain files have not moved yet, so tests reading them are unaffected). A failure here is a missed path; fix it.

- [ ] **Step 7: Start the single stack with the catalog chain only and compare**

```bash
npx supabase start
docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 < scripts/sql/verify-catalog-rls.sql
docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -A -t -v ON_ERROR_STOP=1 \
  < scripts/db/schema-fingerprint.sql > tmp/db-merge/step3.txt
node scripts/db/compare-fingerprints.mjs --merged tmp/db-merge/step3.txt --content tmp/db-merge/content-ref.txt
```

Expected: the verification prints only `PASS` notices and exits 0; the comparison prints `Fingerprints match.`

- [ ] **Step 8: Commit**

```bash
git add -A supabase scripts/sql package.json .github/workflows/ci.yml __tests__ CHANGELOG-DEV.md ROADMAP.md
git commit -m "refactor(database): one Supabase workdir at the repository root (Task 13.7)"
```

### Task 4: Port the user-side schema into the single chain

**Files:**
- Move and edit (new versions, in this order): see the table in Step 2
- Create: `supabase/migrations/20261012100700_profile_columns_for_admin_and_wallets.sql`, `supabase/migrations/20261012100900_lock_down_ported_functions.sql`
- Delete: the rest of `supabase/user/` (tracked files)
- Modify tests: `account/account-deletion`, `watch/watch-progress-semantics`, `security/rls-contract`, `admin/user-management`, `admin/platform-settings`, `admin/taxonomy-management`, `admin/audit-log-and-role-model`, `admin/channels-management`, `admin/bulk-import-pipeline`, `admin/support-inbox`, `admin/drama-lifecycle-and-bulk`, `search/taxonomy-search-scalability`, `docs/adr-topology`

**Interfaces:**
- Consumes: references from Task 2; the single workdir from Task 3.
- Produces: a migration chain whose local database fingerprint matches both references by ownership.

- [ ] **Step 1: Write the failing check**

```bash
npx supabase db reset
docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -A -t -v ON_ERROR_STOP=1 \
  < scripts/db/schema-fingerprint.sql > tmp/db-merge/merged.txt
node scripts/db/compare-fingerprints.mjs --merged tmp/db-merge/merged.txt \
  --content tmp/db-merge/content-ref.txt --user tmp/db-merge/user-ref.txt
```

Expected: exit 1 with `MISSING column|profiles.id`, `MISSING trigger|users.on_auth_user_created`, `MISSING column|payment_orders...` and similar lines.

- [ ] **Step 2: Move the user-side migrations into the chain**

| Source (`supabase/user/supabase/migrations/`) | Destination (`supabase/migrations/`) | Edit |
|---|---|---|
| `20260930150000_user_schema.sql` | `20261012100000_user_schema.sql` | header only |
| `20260930163000_grant_permissions.sql` | `20261012100100_user_table_grants.sql` | header; delete the two `... ON ALL TABLES IN SCHEMA public ...` lines and the comment above them; sequences line becomes `GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;` |
| `20261004120000_harden_rls_and_grants.sql` | `20261012100200_harden_rls_and_grants.sql` | header only |
| `20261005160000_support_tickets.sql` | `20261012100300_support_tickets.sql` | header; append the foreign key block below |
| `20261006120000_watch_progress_semantics.sql` | `20261012100400_watch_progress_semantics.sql` | header only |
| `20261008170000_playback_events.sql` | `20261012100500_playback_events.sql` | header only |
| `20261008180000_analytics_rollups.sql` | `20261012100600_analytics_rollups.sql` | header only |
| `20261010100000_payment_orders.sql` | `20261012100800_payment_orders.sql` | header only |

```bash
cd supabase/user/supabase/migrations
git mv 20260930150000_user_schema.sql ../../../migrations/20261012100000_user_schema.sql
git mv 20260930163000_grant_permissions.sql ../../../migrations/20261012100100_user_table_grants.sql
git mv 20261004120000_harden_rls_and_grants.sql ../../../migrations/20261012100200_harden_rls_and_grants.sql
git mv 20261005160000_support_tickets.sql ../../../migrations/20261012100300_support_tickets.sql
git mv 20261006120000_watch_progress_semantics.sql ../../../migrations/20261012100400_watch_progress_semantics.sql
git mv 20261008170000_playback_events.sql ../../../migrations/20261012100500_playback_events.sql
git mv 20261008180000_analytics_rollups.sql ../../../migrations/20261012100600_analytics_rollups.sql
git mv 20261010100000_payment_orders.sql ../../../migrations/20261012100800_payment_orders.sql
cd -
```

Header for each moved file (first lines, with its original name):

```sql
-- Ported from the dramashort-user chain (<original file name>) by ADR-0005.
-- The single project is built from this chain (ADR-0005); this file runs after the catalog chain.
```

For `20261012100100_user_table_grants.sql`, add a third header line: `-- The two schema-wide grants of the original are omitted: they would re-grant client writes on catalog tables (see 20261011110000).`

Append to `20261012100300_support_tickets.sql`:

```sql
-- The catalog chain's copy of Task 16.10 (20261009200000) already created
-- support_tickets without this foreign key, so CREATE TABLE IF NOT EXISTS above was a no-op.
ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
```

- [ ] **Step 3: Re-run the profile statements the catalog chain skipped**

`supabase/migrations/20261012100700_profile_columns_for_admin_and_wallets.sql`:

```sql
-- ADR-0005: 20261009170000 and 20261009220000 guard their public.profiles statements
-- with to_regclass('public.profiles'), which is NULL when they run (the catalog chain comes first). profiles
-- exists now (20261012100000), so the same statements run here.

-- From 20261009170000_admin_user_management.sql (Task 16.7)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'editor', 'admin'));
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ban_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned);
GRANT ALL ON TABLE public.profiles TO service_role;

-- From 20261009220000_monetization_wallets_and_entitlements.sql (Task 8.1)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coin_balance INTEGER NOT NULL DEFAULT 0 CHECK (coin_balance >= 0),
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;
```

Before saving, diff these statements against the guarded blocks in `supabase/migrations/20261009170000_admin_user_management.sql` (lines 10–31) and `supabase/migrations/20261009220000_monetization_wallets_and_entitlements.sql` (lines 17–25); they must match statement for statement.

- [ ] **Step 4: Re-apply the function lock-down to the ported functions**

```bash
cp supabase/migrations/20261010110000_lock_down_function_execute.sql supabase/migrations/20261012100900_lock_down_ported_functions.sql
```

Prepend:

```sql
-- ADR-0005: copy of 20261010110000_lock_down_function_execute.sql. The functions it
-- locks that come from the dramashort-user chain (fulfill_payment_order,
-- rollup_daily_playback_stats) are created by the ported migrations above, after the
-- original runs in this chain, so its statements are applied again here.
```

- [ ] **Step 5: Remove the rest of the old user chain**

```bash
git rm -r supabase/user
```

This removes `20261007120000_consolidate_content_schema.sql` (the `content` schema of ADR-0003), the user-side copies of the 15 shared migrations, and `20261011100000_fix_distinct_genres_in_user_db.sql` (`get_distinct_genres` keeps the catalog definition, which reads `public.titles`).

- [ ] **Step 6: Apply and compare**

```bash
npx supabase db reset
docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -A -t -v ON_ERROR_STOP=1 \
  < scripts/db/schema-fingerprint.sql > tmp/db-merge/merged.txt
node scripts/db/compare-fingerprints.mjs --merged tmp/db-merge/merged.txt \
  --content tmp/db-merge/content-ref.txt --user tmp/db-merge/user-ref.txt
```

Expected: `Fingerprints match.` For each reported difference, fix the port so the merged database matches the owner's reference. Add an entry to `scripts/db/merge-allowed-differences.json` (`"kind|object": "reason"`) only when matching would be wrong, for example a `function_grant` where the user reference gives clients `EXECUTE` on a function the lock-down is meant to deny. Every allowed entry is listed in the CHANGELOG entry for the owner to review.

- [ ] **Step 7: Run both verification scripts and the pgTAP files**

```bash
docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 < scripts/sql/verify-user-side-rls.sql
docker exec -i supabase_db_dramashort psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 < scripts/sql/verify-catalog-rls.sql
```

Expected: both exit 0 with only `PASS` notices. If the second fails because of rows the first inserted, run `npx supabase db reset` between them and record that in the CI job (reset step between the two scripts).

- [ ] **Step 8: Repoint or drop tests of the removed user chain**

- `account/account-deletion.test.ts`: path → `supabase/migrations/20261012100000_user_schema.sql`.
- `watch/watch-progress-semantics.test.ts`: path → `supabase/migrations/20261012100400_watch_progress_semantics.sql`.
- `security/rls-contract.test.ts`: `userMigrationsDir` → `path.join(rootDir, "supabase", "migrations")`; delete the test that reads `20261011100000_fix_distinct_genres_in_user_db.sql`; add:

```ts
    it("ADR-0005: no ported migration grants schema-wide table access to client roles", () => {
      const dir = path.join(rootDir, "supabase", "migrations");
      for (const file of fs.readdirSync(dir).filter((f) => f >= "20261012100000")) {
        const sql = fs.readFileSync(path.join(dir, file), "utf8");
        assert.doesNotMatch(sql, /GRANT\s+[^;]*ON\s+ALL\s+TABLES\s+IN\s+SCHEMA\s+public\s+TO\s+[^;]*(anon|authenticated)/i, file);
      }
    });
```

- `admin/user-management.test.ts`: `userMigrationPath` → `supabase/migrations/20261012100700_profile_columns_for_admin_and_wallets.sql`; the test `"verifies migration file exists in both User and Content database migration suites"` becomes a check that both `20261009170000_admin_user_management.sql` and `20261012100700_profile_columns_for_admin_and_wallets.sql` exist.
- `admin/platform-settings`, `admin/taxonomy-management`, `admin/audit-log-and-role-model`, `admin/channels-management`, `admin/bulk-import-pipeline`, `admin/support-inbox`, `admin/drama-lifecycle-and-bulk`: delete the variables and assertions that read `supabase/user/supabase/migrations/...` (the "mirror must exist" checks and the user-side text checks); keep every assertion on the `supabase/migrations/...` file. In `support-inbox.test.ts` the loop `for (const sql of [userSql, contentSql])` becomes `for (const sql of [contentSql])`.
- `search/taxonomy-search-scalability.test.ts`: delete `userMigrationPath` and every `userSql` assertion (they check the obsolete `content.titles` copy); the existence test checks only the `supabase/migrations/...` file.
- `docs/adr-topology.test.ts`: the two assertions that `ADR-0003` mentions `supabase/user/supabase/migrations/` stay (ADR-0003 is historical text and is not edited).

Run: `npm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add -A supabase scripts/db __tests__ .github/workflows/ci.yml CHANGELOG-DEV.md ROADMAP.md
git commit -m "feat(database): port the user-side schema into the single migration chain (Task 13.7)"
```

### Task 5: One set of credentials, inlined into browser code

**Files:**
- Create: `lib/supabase/credentials.ts`
- Modify: `lib/supabase/content.ts`, `lib/supabase/user-client.ts`, `lib/supabase/user-server.ts`, `lib/supabase/middleware.ts`, `lib/middleware/maintenance.ts:39-40`, `lib/auth/preview-token.ts:21-25`, `lib/services/content.service.ts:1139-1140,1254-1255`, `lib/env.ts`, `lib/config/env-validator.mjs`, `lib/config/security-headers.mjs`, `scripts/create-admin.ts`, `scripts/seed-dev-content.ts`, `scripts/backfill-admin-roles.ts`, `.env.example`, `.github/workflows/ci.yml` (env blocks)
- Delete: `scripts/migrate-content-to-unified.ts`, `__tests__/database/topology-consolidation.test.ts`
- Test: `__tests__/database/single-project-credentials.test.ts`, `__tests__/tooling/browser-bundle-env.test.ts`; modify `__tests__/runtime/no-mock-fallback.test.ts`, `__tests__/config/security-headers.test.ts`, `__tests__/admin/drama-lifecycle-and-bulk.test.ts`

**Interfaces:**
- Produces: `getSupabaseCredentials(env?: Record<string, string | undefined>): { url: string; anonKey: string }`; `getServiceRoleKey(env?: Record<string, string | undefined>): string`; `buildContentSecurityPolicy(env?: Record<string, string | undefined>): string`. Existing exports kept with the same names and signatures: `contentClient`, `createContentClient`, `getContentAdminClient`, `setTestContentClient`, `getTestContentClient`, `setTestContentAdminClientFactory`, `createUserClient`, `setTestUserClient`, `createUserServerClient`, `createUserServiceRoleClient`, `setTestUserServerClientFactory`, `setTestUserServiceRoleClientFactory`, `updateSession`, `hasAuthCookie`. Removed: `TopologyMode`, `isUnifiedContentMode`, `getContentSchemaName`, `getContentCredentials`, `resetContentClient`, `getUserClientCredentials`, `getUserServerCredentials`.

- [ ] **Step 1: Write the failing tests**

`__tests__/database/single-project-credentials.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getSupabaseCredentials, getServiceRoleKey } from "@/lib/supabase/credentials";
import { validateEnvironment } from "@/lib/config/env-validator.mjs";

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
```

`__tests__/tooling/browser-bundle-env.test.ts`:

```ts
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
```

In `__tests__/config/security-headers.test.ts` add:

```ts
  it("ADR-0005: CSP allows a local Supabase stack's origin and adds nothing for *.supabase.co", () => {
    const local = buildContentSecurityPolicy({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" });
    const connect = local.split("; ").find((d) => d.startsWith("connect-src")) ?? "";
    assert.ok(connect.includes("http://127.0.0.1:54321"));
    assert.ok(connect.includes("ws://127.0.0.1:54321"));
    const hosted = buildContentSecurityPolicy({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co" });
    assert.equal(hosted, buildContentSecurityPolicy({}));
  });
```

Run: `npm run test:file -- __tests__/database/single-project-credentials.test.ts __tests__/config/security-headers.test.ts`
Expected: FAIL, `Cannot find module '@/lib/supabase/credentials'`.

- [ ] **Step 2: Credentials module**

`lib/supabase/credentials.ts`:

```ts
import { isPlaceholderUrl, isPlaceholderKey } from "@/lib/config/env-validator.mjs";

type Env = Record<string, string | undefined>;

const LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_ANON_KEY = "dev-anon-key";

// Literal process.env expressions: Next.js inlines only these into browser bundles.
// Reading them through a variable leaves the browser with undefined values.
function publicEnv(): Env {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NODE_ENV: process.env.NODE_ENV,
  };
}

/** URL and anon key of the single Supabase project (ADR-0005). */
export function getSupabaseCredentials(env: Env = publicEnv()): { url: string; anonKey: string } {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (env.NODE_ENV === "production") {
    if (!url || isPlaceholderUrl(url)) {
      throw new Error(`Invalid or missing NEXT_PUBLIC_SUPABASE_URL in production: "${url ?? ""}"`);
    }
    if (!anonKey || isPlaceholderKey(anonKey)) {
      throw new Error("Invalid or placeholder NEXT_PUBLIC_SUPABASE_ANON_KEY in production.");
    }
  }

  return { url: url || LOCAL_URL, anonKey: anonKey || LOCAL_ANON_KEY };
}

/** Service role key of the single project. Server-only callers. */
export function getServiceRoleKey(env: Env = process.env): string {
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }
  if (env.NODE_ENV === "production" && isPlaceholderKey(key)) {
    throw new Error("Placeholder SUPABASE_SERVICE_ROLE_KEY detected in production.");
  }
  return key;
}
```

- [ ] **Step 3: Clients on top of it**

`lib/supabase/content.ts` becomes:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-content";
import { getSupabaseCredentials, getServiceRoleKey } from "@/lib/supabase/credentials";

let testContentClient: any = null;

/** Test hook allowing unit tests to inject a mock catalog client. */
export function setTestContentClient(client: any) {
  testContentClient = client;
}

/** Test hook returning the injected mock catalog client. */
export function getTestContentClient() {
  return testContentClient;
}

/** Fresh anon-key client for catalog reads. */
export function createContentClient(customEnv?: Record<string, string | undefined>): ReturnType<typeof createClient<Database>> {
  const { url, anonKey } = getSupabaseCredentials(customEnv);
  return createClient<Database>(url, anonKey);
}

let defaultClient: ReturnType<typeof createClient<Database>> | null = null;

function getClientInstance() {
  if (!defaultClient) {
    defaultClient = createContentClient();
  }
  return defaultClient;
}

/**
 * Public client for catalog reads (titles, episodes, channels).
 * Safe for use in both Client Components and Server Components.
 */
export const contentClient: ReturnType<typeof createClient<Database>> = new Proxy(
  {} as any,
  {
    get(_target, prop) {
      if (testContentClient) {
        if (prop in testContentClient) {
          const val = testContentClient[prop];
          return typeof val === "function" ? val.bind(testContentClient) : val;
        }
        return undefined;
      }
      const client = getClientInstance();
      const val = Reflect.get(client, prop, client);
      return typeof val === "function" ? val.bind(client) : val;
    },
    has(_target, prop) {
      if (testContentClient) {
        return prop in testContentClient;
      }
      return prop in getClientInstance();
    },
  }
);

type ContentAdminClientFactory = () => any;
let testAdminClientFactory: ContentAdminClientFactory | null = null;

/** Test hook allowing unit tests to inject a mock privileged catalog client. */
export function setTestContentAdminClientFactory(factory: ContentAdminClientFactory | null) {
  testAdminClientFactory = factory;
}

/**
 * Service-role client for catalog writes (admin CMS, seeding).
 * MUST only be invoked from Server Actions, Route Handlers, or backend scripts.
 */
export function getContentAdminClient(customEnv?: Record<string, string | undefined>) {
  if (testAdminClientFactory) {
    return testAdminClientFactory();
  }
  const env = customEnv || process.env;
  const { url } = getSupabaseCredentials(customEnv);
  return createClient<Database>(url, getServiceRoleKey(env), {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}
```

`lib/supabase/user-client.ts` becomes:

```ts
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase-user";
import { getSupabaseCredentials } from "@/lib/supabase/credentials";

let testUserClient: any = null;

/** Test hook allowing unit tests to inject a mock browser user client. */
export function setTestUserClient(client: any) {
  testUserClient = client;
}

/** Browser-side Supabase client for auth and user data. */
export function createUserClient(customEnv?: Record<string, string | undefined>): ReturnType<typeof createBrowserClient<Database>> {
  if (testUserClient) {
    return testUserClient as ReturnType<typeof createBrowserClient<Database>>;
  }
  const { url, anonKey } = getSupabaseCredentials(customEnv);
  return createBrowserClient<Database>(url, anonKey);
}
```

In `lib/supabase/user-server.ts`: delete `getUserServerCredentials` and the env-validator import; in `createUserServerClient` use `const { url, anonKey } = getSupabaseCredentials(customEnv);`; in `createUserServiceRoleClient` use:

```ts
  const env = customEnv || process.env;
  const { url } = getSupabaseCredentials(customEnv);
  return createClient<Database>(url, getServiceRoleKey(env), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
```

with `import { getSupabaseCredentials, getServiceRoleKey } from "@/lib/supabase/credentials";`.

In `lib/supabase/middleware.ts`: delete `getMiddlewareCredentials` and the env-validator import; replace the module-level line with `const { url: userUrl, anonKey: userAnonKey } = getSupabaseCredentials();`.

In `lib/middleware/maintenance.ts` lines 39–40: `const { url, anonKey } = getSupabaseCredentials();` (import from `@/lib/supabase/credentials`).

In `lib/auth/preview-token.ts` lines 21–25 the fallback chain becomes `process.env.PREVIEW_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY`.

In `lib/services/content.service.ts` lines 1139–1140 and 1254–1255: `process.env.SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 4: Validator, typed env, CSP**

In `lib/config/env-validator.mjs`, replace everything from `// Detect unified single-project topology` through the end of the service-role loop with:

```js
  const requiredPublicVars = [
    { name: "NEXT_PUBLIC_SUPABASE_URL", type: "url" },
    { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", type: "key" },
  ];

  for (const { name, type } of requiredPublicVars) {
    const val = env[name];
    if (!val || val.trim() === "") {
      errors.push(`Missing required environment variable: ${name}`);
      continue;
    }
    if (type === "url") {
      if (!isValidHttpUrl(val)) {
        errors.push(`Invalid URL for ${name}: "${val}"`);
      } else if (isPlaceholderUrl(val)) {
        errors.push(`Placeholder URL detected for ${name}: "${val}"`);
      }
    } else if (isPlaceholderKey(val)) {
      errors.push(`Placeholder key detected for ${name}`);
    }
  }

  if (env.SUPABASE_SERVICE_ROLE_KEY && isPlaceholderKey(env.SUPABASE_SERVICE_ROLE_KEY)) {
    errors.push("Placeholder service role key detected for SUPABASE_SERVICE_ROLE_KEY");
  }
```

In `lib/env.ts`, the six Supabase fields of `EnvConfig` and of the returned object become:

```ts
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
```

```ts
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
```

In `lib/config/security-headers.mjs`:

```js
// *.supabase.co is always allowed. A local Supabase stack (http://127.0.0.1:54321)
// needs its own origin, or the browser refuses every auth and data request.
function extraSupabaseOrigins(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.endsWith(".supabase.co")) return [];
    return [url.origin, `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`];
  } catch {
    return [];
  }
}

export function buildContentSecurityPolicy(env = process.env) {
  const supabase = extraSupabaseOrigins(env.NEXT_PUBLIC_SUPABASE_URL).join(" ");
  const withSupabase = (directive) => (supabase ? `${directive} ${supabase}` : directive);
```

and wrap the `img-src`, `media-src`, and `connect-src` strings in `withSupabase(...)`.

- [ ] **Step 5: Scripts, example env, CI**

```bash
sed -i -E 's/NEXT_PUBLIC_(CONTENT|USER)_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL/g; s/NEXT_PUBLIC_(CONTENT|USER)_SUPABASE_ANON_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY/g; s/(CONTENT|USER)_SUPABASE_SERVICE_ROLE_KEY|SUPABASE_CONTENT_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY/g' \
  scripts/create-admin.ts scripts/seed-dev-content.ts scripts/backfill-admin-roles.ts
git rm scripts/migrate-content-to-unified.ts __tests__/database/topology-consolidation.test.ts
```

Then read each of the three scripts and collapse any `X || X` the substitution produced (`scripts/seed-dev-content.ts` lines 11–17: the URL is `NEXT_PUBLIC_SUPABASE_URL`, the key is `SUPABASE_SERVICE_ROLE_KEY` with no anon-key fallback, and the error message names both).

`.env.example`: replace the two Supabase sections with:

```
# ==============================================================================
# SUPABASE (single project, see docs/adr/0005-single-supabase-project.md)
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
# Server-only (admin writes, seed and admin scripts). Never expose to the browser.
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...
```

Add `"your-project.supabase.co"`, `"your-anon-key"`, and `"your-service-role-key"` to the placeholder lists in `lib/config/env-validator.mjs`.

In `.github/workflows/ci.yml`, every env block that sets the four `NEXT_PUBLIC_CONTENT_*` / `NEXT_PUBLIC_USER_*` variables sets instead:

```yaml
      NEXT_PUBLIC_SUPABASE_URL: https://ci-not-a-real-project.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon-key-not-a-real-credential
```

In `__tests__/runtime/no-mock-fallback.test.ts` replace the four old variable names with the two new ones in both env objects and expect `/Placeholder URL detected for NEXT_PUBLIC_SUPABASE_URL/`. In `__tests__/admin/drama-lifecycle-and-bulk.test.ts` rename the old variables it sets to `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 6: Run the tests**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: 0 type errors, 0 lint errors and warnings; all tests pass, with `browser-bundle-env` skipped when `NEXT_PUBLIC_SUPABASE_URL` is not set locally.

- [ ] **Step 7: Prove the bundle test against a build**

```bash
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=build-check SUPABASE_SERVICE_ROLE_KEY=build-check npm run build
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co npm run test:file -- __tests__/tooling/browser-bundle-env.test.ts
grep -rl "127.0.0.1:54322" .next/static || echo "old user fallback gone"
```

Expected: the test passes (not skipped); `old user fallback gone`.

- [ ] **Step 8: Commit**

```bash
git add -A lib scripts __tests__ .env.example .github/workflows/ci.yml CHANGELOG-DEV.md ROADMAP.md
git commit -m "fix(supabase): one credential set read literally so browser sign-in works (Task 13.7)"
```

### Task 6: One generated types file

**Files:**
- Create: `types/supabase.ts` (generated)
- Delete: `types/supabase-content.ts`, `types/supabase-user.ts`
- Modify: the 15 files importing them; `package.json` (`types` script)

**Interfaces:**
- Produces: `import type { Database } from "@/types/supabase";`

- [ ] **Step 1: Generate from the local merged stack**

```bash
npx supabase gen types typescript --local --schema public > types/supabase.ts
```

Expected: the file contains `profiles:` and `episode_media:` under `public: { Tables: {`.

- [ ] **Step 2: Switch imports and remove the old files**

```bash
grep -rlE "@/types/supabase-(content|user)" app lib components hooks contexts scripts __tests__ | xargs sed -i -E 's#@/types/supabase-(content|user)#@/types/supabase#g'
git rm types/supabase-content.ts types/supabase-user.ts
```

`package.json`: replace `types:content`, `types:user`, `types:all` with:

```json
    "types": "supabase gen types typescript --linked --schema public > types/supabase.ts",
```

- [ ] **Step 3: Typecheck and test**

Run: `npx tsc --noEmit && npm test`
Expected: 0 errors; all pass. Type errors here are real mismatches between code and the merged schema; fix the code, not the generated file.

- [ ] **Step 4: Commit**

```bash
git add -A types package.json app lib components hooks contexts scripts __tests__ CHANGELOG-DEV.md ROADMAP.md
git commit -m "refactor(types): one generated Supabase types file for the single project (Task 13.7)"
```

### Task 7: Run the app on the local merged stack

No code changes unless a check fails. Doubles as the first signed-in test of the app.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Point a shell at the local stack and seed it**

```bash
npx supabase db reset
eval "$(npx supabase status -o env | sed -E 's/^([A-Z_]+)=/export LOCAL_\1=/')"
export NEXT_PUBLIC_SUPABASE_URL="$LOCAL_API_URL" NEXT_PUBLIC_SUPABASE_ANON_KEY="$LOCAL_ANON_KEY" SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_ROLE_KEY"
npm run db:seed:dev
npm run admin:create -- --email admin@dramashort.test --password LocalAdmin2026
npm run build
```

Expected: seed reports titles and episodes inserted; admin created; build passes. (Shell variables override `.env.local`; nothing touches the live projects.)

- [ ] **Step 2: Browser checks**

Start `npm run start` and check in a browser at 390×844 and 1280×800:
1. Sign up with a new address; confirm it through the local mail viewer at `http://127.0.0.1:54324`; sign in. No "Failed to fetch".
2. Favorite a drama, sign out, sign in: the favorite is still there.
3. Submit `/contact`; it appears in `/admin/support` when signed in as `admin@dramashort.test`.
4. Sign in as admin: `/admin/dramas` lists Draft and Published titles; edit a title and save; the change persists after reload.
5. Sign in as the new viewer and open `/admin`: redirected away.

- [ ] **Step 3: Full Playwright suite against the local stack**

Run (same shell): `npx playwright test`
Expected: 27 passed (9 journeys × 3 projects), with the swipe step annotated as skipped on Mobile Safari. Journeys that write data now write to the local stack only.

- [ ] **Step 4: Record**

Append the CHANGELOG entry (every check above, with results) and update ROADMAP Task 13.7; commit with `docs(database): local rehearsal of the single-project setup (Task 13.7)`.

### Task 8: Documentation

**Files:**
- Modify: `docs/adr/README.md` (ADR-0005 row; ADR-0003 row status "Accepted — direction superseded by ADR-0005"), `docs/adr/0003-database-topology.md` (Status line only: `Accepted — merge direction and content schema superseded by [ADR-0005](0005-single-supabase-project.md) on 2026-10-12`), `README.md` (setup: one project, three variables, `npm run db:start` / `db:push` / `types`), `docs/architecture/reusable-content-api.md` and `docs/operations/operational-readiness.md` (remove `content` schema and two-project statements), `ROADMAP.md` (Task 13.2 status correction, Task 13.7), `CHANGELOG-DEV.md`.
- Test: `__tests__/docs/adr-topology.test.ts`

- [ ] **Step 1: Failing doc test**

Add to `__tests__/docs/adr-topology.test.ts`:

```ts
  describe("ADR-0005 single project", () => {
    const adr5 = path.join(process.cwd(), "docs/adr/0005-single-supabase-project.md");
    it("exists, is listed in the registry, and ADR-0003 points to it", () => {
      assert.ok(fs.existsSync(adr5));
      assert.ok(fs.readFileSync(path.join(process.cwd(), "docs/adr/README.md"), "utf8").includes("ADR-0005"));
      assert.match(fs.readFileSync(path.join(process.cwd(), "docs/adr/0003-database-topology.md"), "utf8"), /superseded by \[ADR-0005\]/);
    });
    it("names the single project and the three environment variables", () => {
      const text = fs.readFileSync(adr5, "utf8");
      for (const s of ["ap-southeast-1", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
        assert.ok(text.includes(s), s);
      }
    });
  });
```

Run: `npm run test:file -- __tests__/docs/adr-topology.test.ts`
Expected: FAIL on the registry and ADR-0003 assertions.

- [ ] **Step 2: Edit the documents listed above**

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add docs README.md ROADMAP.md CHANGELOG-DEV.md __tests__/docs/adr-topology.test.ts
git commit -m "docs(database): record the single-project decision and correct Task 13.2 (Task 13.7)"
```

---

## Phase 2 — Live (each task needs the owner's go-ahead)

### Task 9: Export both existing projects

- [ ] **Step 1:** Owner chooses a folder outside the repository, for example `C:\dramashort-backups\2026-10-12\`.
- [ ] **Step 2:** Export (the CLI may ask for each project's database password):

```bash
B="C:/dramashort-backups/2026-10-12"
npx supabase link --project-ref czkkzoiuyqybafacpgsp
npx supabase db dump --linked -f "$B/content-schema.sql"
npx supabase db dump --linked --data-only -f "$B/content-data.sql"
npx supabase db dump --linked --data-only --schema public -f "$B/content-public-data.sql"
npx supabase link --project-ref bpidsbcrvpkavvdvtpgh
npx supabase db dump --linked -f "$B/user-schema.sql"
npx supabase db dump --linked --data-only -f "$B/user-data.sql"
```

Expected: five non-empty files. `content-public-data.sql` is the catalog copy used in Task 12.
- [ ] **Step 3:** Record file names and sizes (not contents) in CHANGELOG-DEV.

### Task 10: Create the Singapore project (owner)

- [ ] **Step 1:** If the organization is on the free plan, pause dramashort-user in the dashboard (Project Settings → General → Pause project). No later step needs it; its export exists from Task 9.
- [ ] **Step 2:** Create a project in the same organization: name `dramashort`, region **Southeast Asia (Singapore)**, a new strong database password stored in the owner's password manager.
- [ ] **Step 3:** Give the assistant the new project ref (the subdomain of its URL). Then:

```bash
npx supabase link --project-ref <new-ref>
npx supabase projects list
```

Expected: the new project shows `region: ap-southeast-1`, status `ACTIVE_HEALTHY`, `linked: true`.

### Task 11: Push the single chain to the new project

- [ ] **Step 1: Dry run**

Run: `npx supabase db push --dry-run`
Expected: all 30 migrations (`20260930150000` … `20261012100900`) would be applied, nothing else.

- [ ] **Step 2: Owner runs the push**

Run: `npm run db:push`
Expected: 30 migrations applied; `npx supabase migration list` shows 30 of 30.

- [ ] **Step 3: Verify the schema against the local rehearsal**

```bash
npx supabase db dump --linked --schema public -f tmp/db-merge/live-public.sql
npx supabase db dump --local --schema public -f tmp/db-merge/local-public.sql
diff <(grep -vE '^--|^SET |^SELECT pg_catalog' tmp/db-merge/local-public.sql) <(grep -vE '^--|^SET |^SELECT pg_catalog' tmp/db-merge/live-public.sql)
```

Expected: no differences other than the platform function `rls_auto_enable` and its event trigger. The `artwork` bucket exists (created by `20261009120000_artwork_storage.sql`).

### Task 12: Copy the catalog from dramashort-content

- [ ] **Step 1:** Owner copies the new project's **Session pooler** connection string (Connect → Session pooler) and puts the password only into the current shell: `export PGPASSWORD='<new project password>'`.
- [ ] **Step 2: Restore the catalog rows with triggers disabled, in one transaction**

```bash
docker exec -i -e PGPASSWORD supabase_db_dramashort psql "<session pooler connection string without password>" \
  -v ON_ERROR_STOP=1 --single-transaction \
  -c "SET session_replication_role = replica" -f - < "C:/dramashort-backups/2026-10-12/content-public-data.sql"
unset PGPASSWORD
```

Expected: exit 0. `session_replication_role = replica` keeps the publication and audit triggers from firing on copied rows.

- [ ] **Step 3: Verify**

For every table, compare row counts between dramashort-content and the new project with the service role keys (`Prefer: count=exact`). Expected: identical (at the time of planning: `titles` 35, `episodes` 175, `episode_media` 175, `channels` 4, `genres` 9, `tags` 31, `app_settings` 5; all user-side tables 0).

Then, on the new project (SQL editor, or psql as above):

```sql
SELECT
  (SELECT count(*) FROM public.episodes e LEFT JOIN public.titles t ON t.id = e.title_id WHERE t.id IS NULL) AS episodes_without_title,
  (SELECT count(*) FROM public.episode_media m LEFT JOIN public.episodes e ON e.id = m.episode_id WHERE e.id IS NULL) AS media_without_episode;
SELECT count(*) AS rows_pointing_at_old_projects
FROM public.titles t
WHERE row_to_json(t)::text LIKE '%czkkzoiuyqybafacpgsp%' OR row_to_json(t)::text LIKE '%bpidsbcrvpkavvdvtpgh%';
```

Expected: `0 | 0` and `0`. A non-zero last count means artwork files referenced by those rows must be copied to the new `artwork` bucket and the URLs rewritten before going on.

With the new project's public anon key: `GET titles?status=eq.Published` returns the published titles; `PATCH titles` and `DELETE genres` (aimed at no row) return 401 `42501`; `episodes?select=video_url` returns `42501`; `rpc/credit_wallet_coins` and `rpc/fulfill_payment_order` return `42501`.

### Task 13: Authentication settings on the new project (owner, dashboard)

Authentication → Sign In / Providers, Emails, URL Configuration, values from `supabase/config.toml`:
- [ ] Site URL: the production address (for example `https://dramashort.com`).
- [ ] Redirect URLs: the ten entries of `additional_redirect_urls` in `supabase/config.toml`.
- [ ] Email confirmations on; secure password change on; minimum password length 8; password requirements: lowercase, uppercase letters and digits.
- [ ] Email templates: "Confirm signup" subject `Confirm your DramaShort account` with the body of `supabase/templates/confirmation.html`; "Reset password" subject `Reset your DramaShort password` with the body of `supabase/templates/recovery.html`.
- [ ] SMTP: if dramashort-user had custom SMTP configured, copy it; otherwise the default sender (low hourly limit, fine for testing).
- [ ] Afterwards the assistant reads `/auth/v1/settings` of the new project and records the result.

### Task 14: Switch the app

- [ ] **Step 1: Vercel** (owner): add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (new project) plus `PAYMENT_WEBHOOK_SECRET` and `CRON_SECRET` for Production and Preview. Leave any old variables in place until Step 6.
- [ ] **Step 2: Region**: add `"regions": ["sin1"]` to `vercel.json` so server code runs next to the database; extend `__tests__/tooling/bundle-budget-and-tooling.test.ts` with a check that `vercel.json` lists `sin1`.
- [ ] **Step 3: `.env.local`** (owner, or the assistant with approval): replace the six Supabase lines with the three new names and the new project's values.
- [ ] **Step 4: Admin**: `npm run admin:create -- --email <owner's admin address> --confirm-production`.
- [ ] **Step 5: Smoke checks** with `npm run build && npm run start` against the new project: sign up with a real address and confirm by email; sign in; a favorite survives sign-out/sign-in; a `/contact` ticket appears in `/admin/support`; admin sign-in reaches `/admin/dramas` and lists Draft titles; a viewer is redirected away from `/admin`; the six read-only Playwright journeys pass; `npm run test:file -- __tests__/tooling/browser-bundle-env.test.ts` passes (not skipped).
- [ ] **Step 6: Deploy** the branch to Vercel; repeat sign-in and admin sign-in on the deployed site; then the owner removes any old Supabase variables from Vercel.
- [ ] **Step 7:** CHANGELOG entry, ROADMAP Task 13.7 status, commit.

---

## Phase 3 — Later (owner)

### Task 15: Retire the old projects

- [ ] After the stabilization pass is complete on the new project, the owner deletes dramashort-content and dramashort-user in the Supabase dashboard. The exports from Task 9 are kept.
- [ ] `grep -rnE "czkkzoiuyqybafacpgsp|bpidsbcrvpkavvdvtpgh"` outside historical docs returns nothing (for example image host settings in `next.config.mjs`); record the deletion in CHANGELOG-DEV and ROADMAP.
