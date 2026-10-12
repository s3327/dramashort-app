# ADR-0005: Single Supabase Project in Singapore

[← Back to ADR Registry](README.md)

## Status
Accepted (supersedes the merge direction and the `content` schema layout of [ADR-0003](0003-database-topology.md); ADR-0003's case for running on one project still stands)

## Date
2026-10-12

## Context

ADR-0003 (2026-10-06) decided to merge the two Supabase projects into one, with the catalog moved into a `content` schema of the User project. Task 13.2 prepared that move (a `content` schema migration in the User project, client code that switches to the `content` schema in "unified" mode, and `scripts/migrate-content-to-unified.ts`) but it was never carried out:

- `.env.local` still points at two projects, and the app reads the catalog from dramashort-content.
- dramashort-user's API does not expose a `content` schema (`PGRST106`).
- dramashort-user's `content` tables never received the Phase 16 columns, and the catalog security work of 2026-10-10/11 exists only in dramashort-content.

Live state on 2026-10-12 (read-only checks with the service role keys and `supabase projects list`):

| | dramashort-content `czkkzoiuyqybafacpgsp` | dramashort-user `bpidsbcrvpkavvdvtpgh` |
|---|---|---|
| Region | `ap-south-1` (Mumbai) | `ap-southeast-2` (Sydney) |
| Catalog | `titles` 35, `episodes` 175, `episode_media` 175, `channels` 4, `genres` 9, `tags` 31, `app_settings` 5 | none in `public` |
| User tables | `wallets`, `coin_transactions`, `daily_checkins`, `user_unlocked_episodes`, `support_tickets` exist, all empty | `profiles` 2; every other user table empty |
| Auth accounts | 0 | 2 |
| Auth providers enabled | email | email (Google is not enabled on either) |
| Storage | `artwork` (public, empty), the bucket the app uploads to | `artwork` (public, empty), unused |
| Migrations applied | 20 of 20 | 24 of 24 |

Both projects belong to one organization. Supabase's free plan allows two active projects per organization; paused projects do not count.

Two defects found while preparing this decision bear on it:

1. **Browser sign-in is broken in production builds.** Since `f4d9c76` (2026-10-07, Task 13.2) the browser Supabase client reads `NEXT_PUBLIC_*` variables through a variable (`const env = customEnv || process.env`). Next.js only inlines literal `process.env.NEXT_PUBLIC_*` references, so the built browser code contains neither project URL and falls back to `http://127.0.0.1:54322`. A login attempt on `next start` is refused by the Content-Security-Policy and shows "Failed to fetch".
2. **Maintenance mode never reads the real settings.** `lib/middleware/maintenance.ts` reads `NEXT_PUBLIC_SUPABASE_URL`, which the two-project configuration does not set, so it queries `http://127.0.0.1:54321` (established from the code and `.env.local`; not reproduced at runtime).

## Problem Statement

The project owner wants one database, so that there is no doubt about where data lives, and wants it close to the audience in Southeast Asia. Neither existing project is in Southeast Asia, and a Supabase project cannot change region. The existing single-project code assumes a layout (catalog in a `content` schema of dramashort-user) that is not wanted, so it cannot simply be switched on.

## Options Considered

### Option A: Keep ADR-0003's direction (merge the catalog into dramashort-user, Sydney)
Requires bringing dramashort-user's `content` schema up to date with every catalog migration and security change, exposing the schema, and copying the catalog. Region stays Sydney.

### Option B: Merge into dramashort-content (Mumbai), everything in `public`
Port the user-side schema into dramashort-content; the catalog stays in place. Region stays Mumbai.

### Option C: New project in Singapore, everything in `public` (chosen)
Create a new project in `ap-southeast-1`, apply one combined migration chain (dramashort-content's chain plus the ported user-side migrations), copy the catalog rows from dramashort-content, recreate the two development accounts. Both old projects are retired.

## Comparative Trade-Off Matrix

| Dimension | Option A | Option B | Option C |
|---|---|---|---|
| Region for a Southeast Asian audience | Sydney | Mumbai | **Singapore** |
| Data to move | Whole catalog | 2 development accounts (recreated) | Catalog rows (≈440) + 2 accounts (recreated) |
| Schema work | Re-apply ~15 catalog migrations into `content` | Port 9 user-side migrations | Same as B, applied to an empty database |
| Risk to existing data | Catalog moves into a schema it was not built for | Additive changes on the live catalog | Old projects only read; new project starts empty |
| Rollback | Restore old environment | Restore old environment | Restore old environment; old projects untouched |
| Free-plan project cap | No new project | No new project | Needs one old project paused first (unless on a paid plan) |

## Decision Criteria

1. Database close to the audience (Southeast Asia).
2. One place for every table, so that nobody has to ask which project or schema a table lives in.
3. The existing projects stay intact until the app has been verified on the new one, so the switch can be undone by restoring the old environment variables.

## Recommendation / Decision

**Option C.**

1. **One project**: a new project named `dramashort` in `ap-southeast-1` (Singapore). dramashort-content (`czkkzoiuyqybafacpgsp`) and dramashort-user (`bpidsbcrvpkavvdvtpgh`) are only read and exported during the move; the owner deletes them after the app has run on the new project and passed the stabilization checks. If the organization is on the free plan, dramashort-user is paused (after its export) to make room for the new project.
2. **One schema**: every application table, view, and function in `public`. No `content` schema.
3. **Fresh accounts**: the two accounts in dramashort-user are not migrated. The admin account is recreated with `npm run admin:create`. No user data is copied; every user table except `profiles` (2 rows) is empty.
4. **Catalog copied**: the rows of dramashort-content's catalog tables (`channels`, `titles`, `episodes`, `episode_media`, `genres`, `tags`, `app_settings`, and any non-empty catalog table at copy time) are copied into the new project with triggers disabled, so audit and publication triggers do not fire on the copy.
5. **One migration chain** in `supabase/migrations/`, with the repository root as the Supabase CLI workdir: dramashort-content's 20 migrations (same file names) followed by the user-side migrations ported as versions `20261012100000` and later. dramashort-user's folder, its `20261007120000_consolidate_content_schema.sql`, and `scripts/migrate-content-to-unified.ts` are removed from the tree (git history keeps them).
6. **Ownership of tables that exist in both projects today** (the definition the app depends on wins):

   | Table | Read and written through | Definition kept |
   |---|---|---|
   | `admin_audit_log`, `app_settings`, `genres`, `tags`, `import_jobs` | content clients | dramashort-content's |
   | `wallets`, `coin_transactions`, `daily_checkins`, `user_unlocked_episodes`, `support_tickets` | user clients | dramashort-user's (ported) |

   Functions present in both projects follow the same rule: wallet, check-in, and unlock functions take dramashort-user's definition; search and taxonomy functions (including `get_distinct_genres`) keep dramashort-content's.
7. **Environment**: three variables, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The six `*_CONTENT_*` / `*_USER_*` names are no longer read. Browser code reads the two public names as literal `process.env.NEXT_PUBLIC_*` references so Next.js inlines them.
8. **Authentication settings** on the new project take dramashort-user's values: minimum password length 8 with `lower_upper_letters_digits`, email confirmations on, secure password change on, the redirect URL list in `supabase/config.toml`, and the confirmation and recovery templates.
9. **Content-Security-Policy** additionally allows the origin of the configured `NEXT_PUBLIC_SUPABASE_URL` when it is not a `*.supabase.co` host, so a local Supabase stack works in the browser.
10. **Types**: one generated file, `types/supabase.ts`.
11. **Hosting**: the app is first deployed to Vercel (functions in `sin1`, next to the database) to verify functionality and security; a later move to a self-managed server stays possible because nothing Vercel-specific is adopted.

## Implementation Roadmap

The step-by-step plan, with tests and the order of live operations, is [docs/superpowers/plans/2026-10-12-single-supabase-project.md](../superpowers/plans/2026-10-12-single-supabase-project.md). Outline:

1. Local, no live changes: schema fingerprint tool; reference fingerprints of both current chains; single workdir; ported user migrations verified against the references; credentials rewrite; types; local rehearsal; docs.
2. Live, each step confirmed by the project owner: exports of both projects; new Singapore project; migrations pushed; catalog copied; authentication settings; environment switch locally and on Vercel; admin recreated; smoke checks.
3. Later, by the project owner: delete dramashort-content and dramashort-user.

## Consequences

### Positive
- One project, one schema, one migration chain, three environment variables.
- Database in Singapore, close to the audience; Vercel functions can run next to it.
- The old projects are never modified, so the switch can be undone until they are deleted.
- Browser sign-in and maintenance mode work again (defects 1 and 2 above).
- CI starts one local Supabase stack instead of two.

### Negative & Mitigations
- **Everyone is signed out and the two development accounts are gone.** Accepted by the owner; the admin is recreated.
- **Catalog rows must be copied.** About 440 rows; counts are compared table by table after the copy, and the source stays untouched.
- **Authentication settings must be re-entered in the dashboard.** A checklist with exact values is part of the plan; `supabase config push` is not used because `config.toml`'s `site_url` is the local address.
- **Free-plan cap of two active projects.** dramashort-user is paused after its export when the organization is on the free plan.
- **Deployments break if Vercel still has only the old variable names.** The new names are added before the code change is deployed; the build fails fast with a named missing variable otherwise.
- **The old projects' migration histories are abandoned.** They remain readable in git history and in the saved exports.
