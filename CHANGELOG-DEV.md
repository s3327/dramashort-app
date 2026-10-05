# DramaShort Developer Changelog & Implementation Audit Log

> **Protocol & Governance Rule**:
> This file is a **strictly append-only** chronological record of all technical implementation steps taken for the tasks defined in [`ROADMAP.md`](file:///c:/Telegram%20Project/dramashort/ROADMAP.md).
> 
> * **Never edit or delete previous entries** — what was done remains historically immutable.
> * **Always append new work sequentially** with timestamp, steps taken, files modified/added/deleted, diff summary, regression analysis, affected components, and test verification results.

---

## [2026-10-03] Phase 1: Build & Tooling Remediation
* **Milestone**: Phase 1 — TS2783 & ESLint Configuration
* **Goal**: Resolve TypeScript compilation failure blocking `npm run build` and eliminate interactive prompts in `npm run lint`.
* **Implementation Steps Taken**:
  1. Identified duplicate props in `app/account/favorite/page.tsx` (`TitleCard` receiving contradictory `onRemove` and `isFavorited` props).
  2. Aligned props to `TitleCardProps` definition.
  3. Created `.eslintrc.json` extending Next.js core Web Vitals.
* **Key File Diffs**:
  - `app/account/favorite/page.tsx`: Fixed prop types and removed duplicate keys.
  - `.eslintrc.json`: Created standard lint rules.
* **Regression Analysis**:
  - Checked favorites catalog rendering; zero regression to guest/user state.
* **Verification**: `npx tsc --noEmit` passed with 0 errors; `npm run lint` exited cleanly.

---

## [2026-10-03] Phase 2: Route & Link Integrity
* **Milestone**: Phase 2 — Admin Drama Edit Page & Route Consolidation
* **Goal**: Fix 404 broken links in admin tables and eliminate duplicated `/new` route.
* **Implementation Steps Taken**:
  1. Created dynamic edit page `app/admin/titles/[id]/edit/page.tsx`.
  2. Added rewrite/redirect from `/new` to `/new-release` in `next.config.mjs` and removed dead code.
* **Key File Diffs**:
  - `app/admin/titles/[id]/edit/page.tsx`: Full title editing form.
  - `next.config.mjs`: Added permanent redirect `/new` -> `/new-release`.
* **Regression Analysis**:
  - Verified navigation from `/admin/titles` table edit button; no broken routes.
* **Verification**: `npm run build` compiled all routes without 404s.

---

## [2026-10-03] Phase 3: Codebase Cleanliness & Git Initialization
* **Milestone**: Phase 3 — Cleanup of Orphaned Mocks & Version Control
* **Goal**: Delete 5 orphaned legacy mock files (~42 KB) and establish Git repository.
* **Implementation Steps Taken**:
  1. Audited imports across entire codebase for obsolete mocks (`data/admin-dramas.mock.ts`, etc.).
  2. Safely deleted dead mock files.
  3. Initialized Git tracking on branch `dramashort-app` pointing to remote `https://github.com/s3327/dramashort-app.git`.
* **Key File Diffs**:
  - Deleted: `data/admin-dramas.mock.ts`, `data/admin-channels.mock.ts`, `data/admin-users.mock.ts`, etc.
  - Updated `README.md`.
* **Regression Analysis**:
  - Full codebase grep confirmed 0 lingering import references.
* **Verification**: Build succeeded with reduced bundle footprint.

---

## [2026-10-03] Phase 4: Core Player & Auth Security (C1–C6)
* **Milestone**: Phase 4 — High-Priority Streaming & Authentication Foundations
* **Goal**: Implement high-performance vertical video player, SSR admin route guards, password change, email change OTP, Google OAuth, and dynamic watch history.
* **Implementation Steps Taken**:
  1. Built custom `WatchVideo.tsx` player supporting HLS streaming via `hls.js`, HTML5 video, vertical 9:16 mobile aspect ratio, TikTok swipe up/down episode switching, and theater mode.
  2. Configured `@supabase/ssr` server-side middleware in `middleware.ts` verifying `profiles.role === 'admin'`, eliminating client-side bypass.
  3. Implemented password update in `app/account/page.tsx` verifying current credentials via `supabase.auth.signInWithPassword()` before applying updates.
  4. Built 6-digit OTP verification flow with resend cooldown timer for email changes.
  5. Wired Google OAuth button in `app/login/page.tsx` and `app/signup/page.tsx` with `/auth/callback` code exchange.
  6. Connected `getUserWatchHistory()` in `app/account/history/page.tsx` with deletion and clear history actions.
* **Key File Diffs**:
  - `components/WatchVideo.tsx`: Core streaming engine.
  - `middleware.ts`: Server-side SSR admin role protection.
  - `app/account/page.tsx`: Password & email verification handlers.
  - `app/login/page.tsx`, `app/signup/page.tsx`: Google social login.
  - `app/account/history/page.tsx`: Supabase watch history persistence.
* **Regression Analysis**:
  - Tested unauthenticated requests to `/admin/*`: redirected cleanly to `/admin/login`.
  - Verified non-admin authenticated users cannot access `/admin/*`.
  - Verified guest users can watch videos without crash.
* **Verification**: Production build and TypeScript validation passed cleanly.

---

## [2026-10-03] Phase 5: High-Priority Persistence (H1–H6)
* **Milestone**: Phase 5 — Watch Progress, Admin DB Save, Search, and Account Guards
* **Goal**: Enable real-time progress syncing, dynamic continue watching, database-backed drama creation/editing, server-side search, and route protection.
* **Implementation Steps Taken**:
  1. Hooked `upsertWatchProgress()` into player time updates (throttled every 5s), pause, ended, and `beforeunload`. Added auto-resume prompt pill.
  2. Dynamically hydrated `components/ContinueWatching.tsx` from Supabase with next-episode advancement and finished drama exclusion.
  3. Wired admin edit and creation forms to Supabase Content DB (`titles` table) saving `title`, `desc` (`synopsis`), `genre`, `taxonomy` (`tags`), and `channel_id`.
  4. Added server-side ilike search and pagination in `getPublishedTitles()` in `lib/services/content.service.ts`.
  5. Added client-side auth guards to `/account`, `/account/favorite`, `/account/history`, `/account/settings`.
  6. Purged fake demo seeds in `FavoritesContext` (`defaultFavoriteSlugs: []`).
* **Key File Diffs**:
  - `components/WatchVideo.tsx`: Real-time progress emitter.
  - `components/ContinueWatching.tsx`: Live DB hydration.
  - `app/admin/titles/[id]/edit/page.tsx`: Supabase update mutation.
  - `lib/services/content.service.ts`: Server-side search & filtering.
  - `contexts/FavoritesContext.tsx`: Clean guest favorites storage.
* **Regression Analysis**:
  - Checked guest watch history in `localStorage`: works completely offline, auto-merges to cloud upon login.
  - Verified admin editing does not wipe out unedited episodes.
* **Verification**: `npm run build` compiled 36 static and dynamic routes.

---

## [2026-10-03] Phase 6: Medium-Priority Quality & Architecture (M1–M7)
* **Milestone**: Phase 6 — Hydration Standardization, SEO, Storage Config, Admin Nomenclature
* **Goal**: Eliminate CLS layout shifts, add dynamic OpenGraph metadata, authorize Supabase Storage, and standardize admin taxonomy to "Dramas".
* **Implementation Steps Taken**:
  1. Standardized loading skeletons across `Hero`, `TopTrending`, `NewRelease`, and detail views.
  2. Added dynamic `generateMetadata()` for drama details and channel pages with OpenGraph tags.
  3. Added `*.supabase.co` to `remotePatterns` in `next.config.mjs`.
  4. Replaced unsafe `catch (err: any)` with typed `catch (err: unknown)` and `err instanceof Error` checks in `AuthContext.tsx`.
  5. Dynamically fetched edit drama by ID via `getDramaById()`.
  6. Preserved Telegram Connect as a non-blocking toast awaiting future release.
  7. Renamed admin sidebar to "Dramas", created route alias `/admin/dramas`, and built "Add Drama" modal.
* **Key File Diffs**:
  - `components/admin/AdminSidebar.tsx`: Updated label to "Dramas".
  - `next.config.mjs`: Added redirects and storage domain.
  - `app/api/admin/dramas/route.ts`: Creation API route.
  - `app/drama/[slug]/page.tsx`: Dynamic OpenGraph tags.
* **Regression Analysis**:
  - Verified route alias `/admin/dramas` redirects to `/admin/titles` seamlessly.
* **Verification**: Next.js production build succeeded; 0 TypeScript warnings.

---

## [2026-10-03] Phase 7: Polish & Automated Testing Suite (L1–L6)
* **Milestone**: Phase 7 — Custom Hooks, Skeletons, Error Boundaries, Tokens, Test Suite
* **Goal**: Create reusable hook library, shimmer skeletons, route & root error boundaries, token audit, and automated test suite.
* **Implementation Steps Taken**:
  1. Created `hooks/useMediaQuery.ts` with SSR-safe window matching and barrel export `hooks/index.ts`.
  2. Built modular shimmer skeleton loaders in `components/skeletons/` (`DramaCardSkeleton`, `CarouselSkeleton`, `EpisodeListSkeleton`, `DramaDetailSkeleton`).
  3. Added route error boundaries: `app/drama/[slug]/error.tsx`, `app/watch/[slug]/error.tsx`, `app/search/error.tsx`.
  4. Added root in-layout `app/error.tsx` and global catastrophic `app/global-error.tsx`.
  5. Audited `design-tokens/tokens.css` against `tailwind.config.js`; normalized `@import` in `app/globals.css`.
  6. Implemented automated testing suite via `tsx --test` with 14 unit and integration tests across `content.service`, `user.service`, and `critical-journey` funnel.
* **Key File Diffs**:
  - `hooks/useMediaQuery.ts`, `hooks/index.ts`: Hook library.
  - `components/skeletons/*`: Skeleton components.
  - `app/**/error.tsx`, `app/global-error.tsx`: Error boundaries.
  - `__tests__/services/content.service.test.ts`: 5 content unit tests.
  - `__tests__/services/user.service.test.ts`: 5 user/guest unit tests.
  - `__tests__/funnel/critical-journey.test.ts`: 4 end-to-end integration tests.
  - `package.json`: Added `npm test` script.
* **Regression Analysis**:
  - Verified that error boundaries do not intercept standard Next.js 404 (`not-found.tsx`).
  - Next.js image lint fixed in `app/admin/channels/page.tsx` (`<Image>` component).
* **Verification**: `npm test` passed 14/14 tests in 1.15s; `npm run build` compiled 36 routes with exit code 0.

---

## [2026-10-03] Telegram Ecosystem Migration to `FUTURE_PLAN.md`
* **Milestone**: Architecture Separation — Future Telegram Plan
* **Goal**: Isolate upcoming Telegram Bot, Login Widget, and Mini App (TMA) features into a dedicated, actionable specification without blocking current releases.
* **Implementation Steps Taken**:
  1. Created `FUTURE_PLAN.md` containing end-to-end BotFather setup, User DB migrations (`telegram_user_id`, `telegram_link_tokens`, `telegram_subscriptions`), cryptographic HMAC-SHA256 signature verification algorithms, API routes, and Mini App WebApp integration.
  2. Conducted exhaustive regression analysis on auth collisions, dual-database separation, guest history merging, CSP headers, rate limits (30 msg/sec), and zero-dependency fallbacks.
  3. Synchronized `ROADMAP.md` and `README.md` to reference `FUTURE_PLAN.md`.
* **Key File Diffs**:
  - `FUTURE_PLAN.md`: Created (470+ lines of technical specs).
  - `ROADMAP.md`: Updated Section 10 and 11 to point to `FUTURE_PLAN.md`.
  - `README.md`: Updated project status table.
* **Verification**: `npm test` passed 14/14 tests; `npx tsc --noEmit` passed with 0 errors; committed as `12c0dda`.

---

## [2026-10-03] Roadmap Restructuring & Planning Phases 8 & 9
* **Milestone**: Master Plan Transition — `ROADMAP.md` & `CHANGELOG-DEV.md`
* **Goal**: Rename `FIXES_PLAN.md` to `ROADMAP.md` as the master plan for current development, establish `CHANGELOG-DEV.md` as the append-only implementation audit log, and integrate monetization & video player enhancements into active planning.
* **Implementation Steps Taken**:
  1. Executed `git mv FIXES_PLAN.md ROADMAP.md` preserving full version control history.
  2. Updated `ROADMAP.md` header and prioritization matrix.
  3. Added **Phase 8: Short Drama Monetization Engine ("Freemium" Coin Economy)** detailing:
     - Task 8.1: Database schema migrations in User DB (`coins_balance`, `user_unlocked_episodes`, `coin_transactions`, `daily_checkins`).
     - Task 8.2: Episode lock & paywall rules engine (Ep 1–5 Free, Ep 6+ Locked, custom free episode threshold).
     - Task 8.3: Custom player paywall gatekeeper & coin unlock modal in `WatchVideo.tsx`.
     - Task 8.4: Gamified 7-day daily check-in streak reward system (+5 to +50 coins).
     - Task 8.5: Coin top-up shop & transaction architecture.
  4. Added **Phase 9: Mobile PWA & Advanced Video Player UX** detailing:
     - Task 9.1: Progressive Web App manifest, service worker cache rules, and install banner.
     - Task 9.2: Multi-language subtitle overlay (.vtt / .srt) with customization.
     - Task 9.3: Desktop keyboard shortcuts & hotkeys (`Space`, `Up/Down`, `M`, `F`, seek).
     - Task 9.4: Picture-in-Picture & native OS `MediaSession` API metadata integration.
     - Task 9.5: Automated testing suite expansion for wallet and paywall flows.
  5. Created `CHANGELOG-DEV.md` with complete historical implementation entries and append-only governance rules.
* **Key File Diffs**:
  - `ROADMAP.md`: Renamed from `FIXES_PLAN.md`, added Phase 8 and Phase 9 specifications.
  - `CHANGELOG-DEV.md`: Created developer audit log.
* **Regression Analysis & Cross-System Impact**:
  - Verified no code imports or scripts rely on `FIXES_PLAN.md` filename (`git grep` showed 0 code dependencies).
  - Ensured Phase 8 and 9 plans strictly preserve the Dual-Database split: all coin wallets, transactions, and unlocks reside in User DB (`bpidsbcrvpkavvdvtpgh`), while Content DB remains decoupled.
  - Confirmed player modifications in Phase 8/9 will not break existing vertical swipe or HLS streaming.
* **Verification**: `npm test` executed with 14 passing tests; `npx tsc --noEmit` verified 0 errors.

---

## [2026-10-04] Platform Audit & Remediation Roadmap (Phases 10–17)
* **Milestone**: Master Plan Expansion — Audit Remediation Track
* **Goal**: Record the findings of a full-platform audit (UI/UX, user workflows, admin workflows, backend architecture) as an executable plan, and sequence it ahead of Phases 8 and 9.
* **Implementation Steps Taken**:
  1. Audited the codebase, Supabase migrations, middleware, API routes, contexts, player, and admin console. At audit time `npx tsc --noEmit`, `npm run lint`, and `npm test` (14/14) all passed.
  2. Added `ROADMAP.md` §12 **Platform Audit Remediation Track**: findings summary, execution order with phase gates, cross-task dependencies, and a corrections table for previously completed items (Tasks 4.2, 4.3, 5.1, 5.3/6.5, 6.1, 7.6, README status).
  3. Added **Phase 10: Security Hardening & Access Control** (Tasks 10.1–10.9): `app_metadata`-only roles with a shared `requireAdmin()`, `profiles` RLS and column-level grants, admin API auth and removal of the development bypass, middleware subdomain guard ordering, safe redirects, episode media lockdown with a server playback endpoint, provisioning-script hardening, Auth settings and security headers, security regression tests and CI gate.
  4. Added **Phase 11: Complete Stubbed User Flows** (Tasks 11.1–11.7): email verification, password recovery, account deletion, support pipeline, password-change hardening, real 404s and unavailable-episode states, notifications hidden until real.
  5. Added **Phase 12: Functional Bug Fixes & Data Integrity** (Tasks 12.1–12.8): server pagination for discovery pages, admin reads through the authenticated API, watch-progress semantics, removal of production mock fallbacks, admin logout, favorites/lists consistency, content integrity rules, player streaming robustness.
  6. Added **Phase 13: Backend Architecture Consolidation** (Tasks 13.1–13.6): ADR-0001 database topology decision gate and execution, server-rendered catalog, server/client service split, search and taxonomy scaling, observability and rate limiting.
  7. Added **Phase 14: Mobile-First Vertical Watch Experience & UI Polish** (Tasks 14.1–14.9), **Phase 15: Product Analytics, Engagement Tracking & Real Trending** (Tasks 15.1–15.5), **Phase 16: Admin Content Operations Console** (Tasks 16.1–16.11), and **Phase 17: Quality Engineering, CI & Documentation Integrity** (Tasks 17.1–17.4).
  8. Added a prerequisites block to Phase 8 (blocked by Phases 10, 13.1, 15, 16; server-side paywall enforcement; `coin_balance` / `coins_balance` naming conflict) and a scope-reconciliation block to Phase 9 (blocked by Phase 14; overlap with existing keyboard shortcuts and PiP).
  9. Updated the prioritization matrix (rows for Phases 10–17, blocked status on Phases 8 and 9, execution-order note) and the master workflow diagram; renumbered §12 → §21 and §13 → §22.
* **Key File Diffs**:
  - `ROADMAP.md`: Added §12–§20 (Phases 10–17), updated §1 matrix, §10 and §11 notes, and the §21 diagram.
  - `CHANGELOG-DEV.md`: Appended this entry.
* **Regression Analysis & Cross-System Impact**:
  - Documentation-only change; no application code, migrations, or configuration modified.
  - Phase IDs 8 and 9 kept unchanged so earlier changelog references stay valid; execution order is stated explicitly instead of renumbering.
  - Tasks 4.2, 4.3, 5.1, 5.3, 6.1, 6.5, and 7.6 remain ✅ for history; their gaps are tracked as new tasks per §12.3.
* **Verification**: Heading sequence and section numbering checked (§1–§22, Tasks 10.1–17.4); line endings unchanged (LF).
---

## [2026-10-04] Task 10.1: Admin Role Single Source of Truth & Shared `requireAdmin()` Guard
* **Milestone**: Phase 10 (Security Hardening) — Task 10.1
* **Goal**: Close privilege escalation vulnerability where clients could self-elevate by writing `user_metadata.role = "admin"`, centralize server-side authorization in a shared helper, and lock down all admin drama API endpoints.
* **Implementation Steps Taken**:
  1. Created `lib/auth/roles.ts`:
     - Defined `Role = "admin" | "editor"`.
     - Implemented `getUserRole(user)` reading strictly from `app_metadata.role`.
     - Explicitly ignored client-writable `user_metadata.role` and `profiles.role` for authorization decisions.
     - Implemented `hasRole(user, allowedRoles)`.
  2. Created `lib/auth/require-admin.ts`:
     - Implemented `requireAdmin({ roles?: Role[] })` server guard.
     - Enforces session verification via `supabase.auth.getUser()` (never `getSession()`).
     - Validates role against `app_metadata.role`, returning `{ authorized: true, user, role }` or typed `401` / `403` JSON responses.
     - Completely eliminated development/test authorization bypasses.
  3. Hardened `app/api/admin/dramas/route.ts`:
     - Replaced duplicate `verifyAdminAuth()` with `requireAdmin()`.
     - Protected both `GET /api/admin/dramas` and `POST /api/admin/dramas` with `requireAdmin()`.
  4. Hardened `app/api/admin/dramas/[id]/route.ts`:
     - Replaced duplicate `verifyAdminAuth()` with `requireAdmin()`.
     - Protected both `GET /api/admin/dramas/[id]` and `PATCH /api/admin/dramas/[id]` with `requireAdmin()`.
  5. Hardened `middleware.ts`:
     - Imported `getUserRole` from `@/lib/auth/roles`.
     - Replaced `user.user_metadata?.role` and `profiles.role` fallback with `getUserRole(user) === 'admin'`.
  6. Hardened `contexts/AdminAuthContext.tsx`:
     - Updated `verifyAdminRole` to use `getUserRole(authUser) === 'admin'`.
     - Removed client-side fallback to `user_metadata.role` and `profiles.role` for admin privilege determination.
  7. Created `scripts/backfill-admin-roles.ts`:
     - Built audit and sanitization script querying all auth accounts in Supabase User DB.
     - Backfills `app_metadata.role = 'admin'` and strips rogue `user_metadata.role` keys.
  8. Created automated test suite `__tests__/auth/roles.test.ts`:
     - Added 5 unit tests verifying role resolution, valid roles (`admin`, `editor`), invalid roles, and explicit protection against client self-elevation when `user_metadata.role = "admin"`.
* **Key File Diffs**:
  - `lib/auth/roles.ts`: Created role definitions and single source of truth helper.
  - `lib/auth/require-admin.ts`: Created centralized server-side guard.
  - `app/api/admin/dramas/route.ts`: Swapped `verifyAdminAuth` for `requireAdmin`; protected `GET` and `POST`.
  - `app/api/admin/dramas/[id]/route.ts`: Swapped `verifyAdminAuth` for `requireAdmin`; protected `GET` and `PATCH`.
  - `middleware.ts`: Enforced `app_metadata.role` in route guard.
  - `contexts/AdminAuthContext.tsx`: Aligned UI role state with `app_metadata`.
  - `scripts/backfill-admin-roles.ts`: Created admin audit and metadata backfill script.
  - `__tests__/auth/roles.test.ts`: Created security unit test suite.
  - `ROADMAP.md`: Marked Task 10.1 as Completed with delivered capabilities.
* **Regression Analysis & Cross-System Impact**:
  - Regular user accounts: completely unaffected for public browsing, search, favorites, and watch history.
  - Legitimate admin accounts: authenticated admins created via `npm run admin:create` already have `app_metadata.role = 'admin'` and retain seamless access.
  - Malicious actors / console injection: `supabase.auth.updateUser({ data: { role: 'admin' } })` is completely rejected by both the middleware and all admin API route handlers.
  - API integrity: Unauthenticated requests to `/api/admin/dramas` and `/api/admin/dramas/[id]` now receive HTTP `401 Unauthorized` JSON instead of leaking drafts or permitting unauthorized modifications.
* **Verification**:
  - `npm test`: 19 / 19 tests pass (14 existing + 5 new security tests) with 0 failures.
  - `npx tsc --noEmit`: 0 TypeScript compilation errors.
---

## [2026-10-04] Task 10.1 Refinements: Backfill Script Hardening & Import Cleanup
* **Milestone**: Phase 10 (Security Hardening) — Task 10.1 Refinement
* **Goal**: Correct security flaw in role backfill utility, clean up unused imports, align admin creation script, and clarify test verification scopes in documentation.
* **Implementation Steps Taken**:
  1. Rebuilt `scripts/backfill-admin-roles.ts`:
     - Changed default execution to **DRY RUN**; requires explicit `--apply` flag to execute modifications.
     - Implemented `--promote <email1,email2>` allowlist: only accounts explicitly specified are granted or confirmed with `app_metadata.role = 'admin'`.
     - Flagged accounts not in `--promote` have rogue roles revoked: `user_metadata.role` stripped, rogue `app_metadata.role` stripped, and `profiles.role` reset to `'user'`.
     - Implemented pagination loop through `supabase.auth.admin.listUsers({ page, perPage: 100 })` ensuring all user accounts across multiple pages are scanned.
  2. Cleaned Route Handler Imports:
     - `app/api/admin/dramas/route.ts`: Removed unused `createUserServerClient` import; moved `requireAdmin` import to top of file.
     - `app/api/admin/dramas/[id]/route.ts`: Removed unused `createUserServerClient` import; moved `requireAdmin` import to top of file.
  3. Sanitized Admin Provisioning Script:
     - `scripts/create-admin.ts`: Stopped writing `user_metadata.role: "admin"`. Roles are strictly written to `app_metadata.role = "admin"` and mirrored to `profiles.role`.
  4. Clarified Roadmap Verification Scope:
     - Documented that Task 10.1 has unit tests verified (19/19 passing), while full integration testing with running servers will be conducted in Task 10.9.
     - Explicitly noted that column-level write restriction on `profiles.role` will be enforced in Task 10.2 database migration.
* **Key File Diffs**:
  - `scripts/backfill-admin-roles.ts`: Rewritten with safe dry-run, whitelist promotion, revocation of unconfirmed accounts, and pagination.
  - `scripts/create-admin.ts`: Removed rogue `user_metadata.role` assignment.
  - `app/api/admin/dramas/route.ts`: Removed unused import and moved `requireAdmin` to top.
  - `app/api/admin/dramas/[id]/route.ts`: Removed unused import and moved `requireAdmin` to top.
  - `ROADMAP.md`: Clarified verification notes for Task 10.1.
* **Regression Analysis**:
  - Unused imports removed cleanly; no runtime impact.
  - Backfill script now safely prevents self-promoted accounts from being inadvertently elevated to permanent admins.
* **Verification**:
  - `npm test`: 19 / 19 tests pass (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
---

## [2026-10-04] Task 10.1 Safety & Production Safeguards: Role Backfill Engine
* **Milestone**: Phase 10 (Security Hardening) — Task 10.1 Production Safeguards
* **Goal**: Harden `scripts/backfill-admin-roles.ts` with strict production safety gates, typo protection, confirmed-email enforcement, role preservation, and batch performance optimizations.
* **Implementation Steps Taken**:
  1. Guarded Live Apply:
     - Enforced safety gate requiring `--promote <emails>`, `--revoke <emails>`, or `--revoke-all-unconfirmed` when running with `--apply`. Prevents catastrophic admin wipeouts if flags are omitted.
  2. Preserved Existing Legitimate Roles:
     - Accounts possessing authoritative `app_metadata.role = 'admin'` are preserved as admins by default unless explicitly revoked via `--revoke`.
     - Accounts possessing `app_metadata.role = 'editor'` maintain their editor role and are not stripped.
  3. Typo Protection & Email Matching:
     - Tracks matched promote/revoke emails against auth accounts. If any `--promote` email does not exist in the database, halts `--apply` with error to prevent unintended lockouts due to typos.
  4. Verified Identity Gate:
     - Promotion requires `email_confirmed_at` to be populated. Rejects unverified email accounts from elevation.
  5. Performance Optimization:
     - Replaced per-user profile queries with a single batch query (`SELECT id, role FROM profiles WHERE role = 'admin'`), eliminating N+1 round-trips.
  6. Checked Profile Updates:
     - Profile table mutations explicitly check for returned errors and log failures.
  7. Sanitized Existing User Promotion:
     - In `scripts/create-admin.ts`, explicitly removed `role` from `existingUser.user_metadata` prior to spread/update.
* **Key File Diffs**:
  - `scripts/backfill-admin-roles.ts`: Upgraded with typo protection, email confirmation check, role preservation, batch profile query, and checked error returns.
  - `scripts/create-admin.ts`: Sanitized `user_metadata` spread.
* **Verification**:
  - Executed `npx tsx scripts/backfill-admin-roles.ts` (dry run): successfully scanned real accounts, identified legitimate admins (`staff@dramashort.com`, `admin@dramashort.com`), verified email confirmations, and preserved existing roles with 0 errors.
  - `npm test`: 19 / 19 tests pass (0 failures).
  - `npx tsc --noEmit`: 0 compilation errors.
---

## [2026-10-04] Task 10.1 Two-Pass Validation Architecture & Revoke Hardening
* **Milestone**: Phase 10 (Security Hardening) — Task 10.1 Refinement
* **Goal**: Refactor `scripts/backfill-admin-roles.ts` to execute validation prior to mutations, enforce strict mutual exclusion, and implement real revocation for unlisted admins.
* **Implementation Steps Taken**:
  1. Two-Pass Architecture:
     - Pass 1 (Validation & Plan): Scans all accounts, validates email confirmations, detects missing/typo emails in `--promote`, verifies mutual exclusion, and resolves actions before touching the database. If any validation fails, halts with zero mutations performed.
     - Pass 2 (Execution): Performs database mutations strictly after Pass 1 has succeeded with zero errors.
  2. Implemented Real Revocation for `--revoke-unlisted-admins`:
     - Accounts possessing `app_metadata.role = 'admin'` that are unlisted when `--revoke-unlisted-admins` is passed have `app_metadata.role` deleted, `user_metadata.role` deleted, and `profiles.role` reset to `'user'`.
  3. Mutual Exclusion Check:
     - Detects if an email is present in both `--promote` and `--revoke` and halts with a conflict error.
  4. Profile Upsert Verification:
     - Promoted users use `profiles.upsert(...).select()` and assert that a row returned.
  5. Dry-Run Breakdown Summary:
     - Audit summary displays detailed breakdown of planned actions (admins to keep, editors to keep, admins to promote, admins to revoke, rogue accounts to sanitize).
* **Key File Diffs**:
  - `scripts/backfill-admin-roles.ts`: Refactored to two-pass engine with atomic pre-validation and verified unlisted admin revocation.
* **Verification**:
  - `npx tsx scripts/backfill-admin-roles.ts` (dry run): 2 existing admins classified, 0 validation errors.
  - `npm test`: 19 / 19 tests pass (0 failures).
  - `npx tsc --noEmit`: 0 errors.

---

## [2026-10-04] Task 10.1 Final Safeguards: Lockout Gate, Failure Exit Codes & Paged Profile Lookup
* **Milestone**: Phase 10 (Security Hardening) — Task 10.1 Refinement
* **Goal**: Close the remaining gaps found in the review of the two-pass backfill script: a possible full admin lockout, a misleading legacy flag, silent partial failures, and a profile lookup capped at 1,000 rows.
* **Implementation Steps Taken**:
  1. Lockout Gate (Safety Gate 3):
     - `--revoke-unlisted-admins` is now refused unless `--promote` names at least one admin to keep. Combined with Pass 1 validation (promote emails must exist and be confirmed), at least one valid admin always remains after an apply.
  2. Removed the `--revoke-all-unconfirmed` alias:
     - The alias had silently mapped to "revoke all unlisted admins", a destructive meaning the original flag never had. It is no longer recognized.
  3. Failure Tracking & Exit Code:
     - Added a `fail()` helper in Pass 2; all 9 error paths now increment `failureCount`.
     - Summary prints `Failed updates: N`; the script exits with code `1` when any update failed. Completed updates are not rolled back; re-running retries the rest.
  4. Accurate Sanitize Count:
     - `Sanitized rogue accounts` counts an account only when all of its updates succeeded.
  5. Paged Profile Lookup:
     - The `profiles.role = 'admin'` query pages with `.order("id").range(...)` in 1,000-row pages, so rows beyond PostgREST's default cap are no longer dropped.
  6. Header comment rule 5 updated to document the new gate.
* **Key File Diffs**:
  - `scripts/backfill-admin-roles.ts`: Safety Gate 3, alias removal, `fail()` helper and exit code, success-only sanitize count, paged profile query (+48 / −22 lines).
* **Regression Analysis & Cross-System Impact**:
  - Script-only change; no application code, migrations, or runtime routes affected.
  - Invocations using `--apply --promote <emails>` and `--revoke <emails>` behave as before. Invocations using `--revoke-all-unconfirmed` must switch to `--revoke-unlisted-admins` together with `--promote`.
* **Verification**:
  - `npx tsc --noEmit`: 0 errors.
  - `npm test`: 19 / 19 tests pass (the script itself has no automated tests).
  - Not yet executed against a database (dry run or apply) after this change; run a dry run before the next apply.

---

## [2026-10-04] Task 10.2: User Database RLS & Column-Level Privilege Hardening (Migration Written)
* **Milestone**: Phase 10 (Security Hardening) — Task 10.2
* **Goal**: Stop signed-in users from writing privileged columns (`profiles.role`, and any future wallet columns) and replace blanket grants and `FOR ALL` policies with least-privilege access.
* **Implementation Steps Taken**:
  1. Audited every client write to User DB tables. The only write to `profiles` is `updateUserProfile()` (`display_name`, `avatar_url`, `updated_at`); engagement tables use select/insert/upsert/delete on the user's own rows.
  2. Created migration `20261004120000_harden_rls_and_grants.sql`:
     - Default privileges: `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES / SEQUENCES FROM anon, authenticated`.
     - Grants: revoked all access on the five user tables and all sequences from `anon` and `authenticated`; re-granted `SELECT` + column-level `UPDATE (display_name, avatar_url, updated_at)` on `profiles`, and `SELECT, INSERT, UPDATE, DELETE` on `favorites`, `watch_history`, `custom_lists`, `custom_list_items`.
     - Policies: replaced the five `FOR ALL` policies with per-command policies (`TO authenticated`, explicit `WITH CHECK`); `profiles` has `SELECT` and `UPDATE` only; `custom_list_items` checks parent-list ownership on read, insert, update, and delete.
     - `(select auth.uid())` used in every policy (evaluated once per statement).
     - `handle_new_user()` recreated with `SET search_path = ''`; body unchanged and fully schema-qualified.
     - All `DROP POLICY IF EXISTS` statements make the migration re-runnable.
  3. Updated `ROADMAP.md` Task 10.2 status to 🟡 Implemented and the Phase 10 matrix row to 🚧 In progress.
* **Key File Diffs**:
  - `supabase/user/supabase/migrations/20261004120000_harden_rls_and_grants.sql`: Created.
  - `ROADMAP.md`: Task 10.2 status and implementation progress; Phase 10 matrix status.
* **Regression Analysis & Cross-System Impact**:
  - App code unchanged. `getUserProfile()` (`select("*")`) keeps `SELECT` on all `profiles` columns; `updateUserProfile()` writes only granted columns.
  - Upserts on `favorites`, `watch_history`, `custom_list_items` need `INSERT` + `UPDATE` and matching policies; both are granted.
  - `service_role` grants are untouched, so `scripts/create-admin.ts`, `scripts/backfill-admin-roles.ts`, and admin API routes keep working.
  - Any future migration that adds a table to `public` (Phase 8 wallet, Phase 15 events, `FUTURE_PLAN.md` Telegram tables) must now grant access explicitly.
  - No `types/supabase-user.ts` regeneration needed (no shape change).
* **Verification**:
  - Not yet applied to any database. Docker is installed but Docker Desktop was not running, so the local `supabase db start` test could not run.
  - Pending checks after applying: a user cannot `update profiles set role = 'admin'` (expect permission denied); a user cannot read or modify another user's favorites, history, lists, or list items; `anon` cannot select from user tables; signup still creates a profile row; favorite, history, and list flows still work in the app.
  - No application code changed, so `tsc`, lint, and unit tests are unaffected and were not re-run.

---

## [2026-10-04] Task 10.2: Local Verification of User DB RLS Hardening
* **Milestone**: Phase 10 (Security Hardening) — Task 10.2 Verification
* **Goal**: Prove on a real Postgres instance that migration `20261004120000_harden_rls_and_grants.sql` closes the `profiles.role` escalation without breaking app flows, before deploying to the User DB.
* **Implementation Steps Taken**:
  1. Started a local Supabase Postgres (`supabase_db_user`, image `supabase/postgres:17.6.1.171`) with `npx supabase db start --workdir supabase/user`.
  2. The CLI hung after starting Postgres (connection retries logged "invalid length of startup packet"; no migrations applied after ~18 minutes). Stopped the CLI and applied the three user migrations manually with `psql` as the `postgres` role, in order: `20260930150000_user_schema.sql`, `20260930163000_grant_permissions.sql`, `20261004120000_harden_rls_and_grants.sql` — all exited 0.
  3. Wrote `scripts/sql/verify-user-db-rls.sql` (18 checks; creates and deletes two throwaway auth users, impersonates user A as `authenticated` and also tests `anon`).
  4. First run surfaced a harness issue, not a migration bug: the un-migrated local image ships the legacy `auth.uid()` that reads only `request.jwt.claim.sub`. The script now sets both `request.jwt.claim.sub` and `request.jwt.claims` and asserts `auth.uid()` before testing.
  5. Ran a negative control in a rolled-back transaction: with the old `FOR ALL` policy and `GRANT ALL` restored, `update profiles set role = 'admin'` updated 1 row (vulnerable), confirming the checks detect the original hole.
  6. Updated `ROADMAP.md` Task 10.2 status to 🟢 Verified locally and the Phase 10 matrix row.
* **Key File Diffs**:
  - `scripts/sql/verify-user-db-rls.sql`: Created (local-only RLS and privilege verification; basis for Task 10.9).
  - `ROADMAP.md`: Task 10.2 status, verification results, remaining steps; Phase 10 matrix status.
* **Regression Analysis & Cross-System Impact**:
  - Confirmed app-facing operations still work under the new grants: own profile display-field update (as `updateUserProfile()` does), favorite/history/list-item upserts (`INSERT ... ON CONFLICT DO UPDATE`), list creation, and the signup trigger.
  - Local-only environment; no change was made to the remote User DB.
* **Verification**:
  - `scripts/sql/verify-user-db-rls.sql`: 18 / 18 PASS, final line `ALL TASK 10.2 CHECKS PASSED`.
  - Negative control: escalation reproduced with old policy (1 row), new policies restored after rollback.
  - Not yet done: `npm run db:user:push` to the User DB, in-app smoke test against it, and Security Advisor review.

---

## [2026-10-04] Task 10.2: Production Deployment & Smoke Test (User DB)
* **Milestone**: Phase 10 (Security Hardening) — Task 10.2 Deployment
* **Goal**: Apply the verified RLS and privilege hardening to the production User DB (`bpidsbcrvpkavvdvtpgh`) and confirm app flows and attack paths behave as tested locally.
* **Implementation Steps Taken**:
  1. Committed and pushed the migration, verification script, and docs (`c4e18f5`).
  2. `supabase migration list --workdir supabase/user`: remote had `20260930150000` and `20260930163000`; `20261004120000` pending.
  3. `supabase db push --dry-run`: would push only `20261004120000_harden_rls_and_grants.sql`.
  4. `supabase db push --workdir supabase/user --yes`: applied the migration (exit 0).
  5. Production smoke test (throwaway Node script, not committed): created two confirmed throwaway accounts with the service role, signed in as one through the public anon key exactly as the browser app does, ran app operations and attack attempts, then deleted both accounts.
  6. Updated `ROADMAP.md` Task 10.2 status to ✅ Completed and the Phase 10 matrix row.
* **Key File Diffs**:
  - Production User DB: migration `20261004120000_harden_rls_and_grants.sql` applied.
  - `ROADMAP.md`: Task 10.2 status, deployment and smoke-test results; Phase 10 matrix status.
* **Regression Analysis & Cross-System Impact**:
  - App flows verified against production: signup profile creation, own profile display edit, favorite upsert/delete, watch-progress upsert, list creation and item add.
  - Service-role paths (admin scripts, admin API routes) unaffected; the smoke test's service-role setup and cleanup worked.
  - Rollback, if ever needed: a new migration restoring the earlier policies and grants (definitions in `20260930150000_user_schema.sql` and `20260930163000_grant_permissions.sql`). Not expected.
* **Verification**:
  - Production smoke test: 24 / 24 PASS — `anon` denied (42501) on all five user tables; trigger-created profiles have `role = 'user'`; `update profiles set role = 'admin'` denied (42501) and role unchanged; own profile delete denied; cross-user favorite and list-item inserts denied (42501); reads return only own rows; both throwaway users deleted with no leftover profile rows.
  - Remaining: Supabase Security Advisor review in the dashboard (item 7).

---

## [2026-10-04] Task 10.3: Admin API Lockdown, Validation & Uniform Errors
* **Milestone**: Phase 10 (Security Hardening) — Task 10.3
* **Goal**: Finish locking down the admin Drama API: middleware-level JSON guard, no mock fallbacks, strict payload validation with a host allow-list shared with `next.config.mjs`, and one error envelope that never leaks database messages.
* **Implementation Steps Taken**:
  1. `lib/api/responses.ts`: `apiSuccess(data, status)` / `apiError(code, message, status, details?)` producing `{ success, data }` / `{ success: false, error: { code, message, details? } }`.
  2. `lib/auth/require-admin.ts`: switched to `apiError` (response shape unchanged).
  3. `lib/config/image-hosts.mjs`: single remote image host list; `next.config.mjs` now imports it for `images.remotePatterns`.
  4. `lib/validation/drama.ts`: `validateDramaPayload(body, "create" | "update")` (title 1–200, synopsis ≤ 5,000, genre ≤ 50, channel ≤ 100, status enum, `totalEpisodes` integer 1–500, ≤ 20 tags of ≤ 40 chars with case-insensitive dedupe, poster https URL on an allowed host ≤ 2,048 chars), plus `isAllowedImageUrl()`, `isUuid()`, `escapeLikePattern()`.
  5. `lib/admin/resolve-channel.ts`: shared channel lookup by name with escaped LIKE wildcards; `channel_code` / `channel_id` are no longer accepted from the client.
  6. `app/api/admin/dramas/route.ts` and `app/api/admin/dramas/[id]/route.ts` rewritten: validation, UUID check, `404` for unknown ids, `400` for empty `PATCH`, no mock data, generic `DATABASE_ERROR` messages with server-side logging, `POST` → `201`. Removed the exported `CreateDramaBody` / `DramaUpdateBody` interfaces (unused elsewhere).
  7. `middleware.ts`: added the `/api/admin/*` guard (401/403 JSON, never a redirect) and replaced two duplicated Supabase cookie blocks with `createMiddlewareSupabase()`.
  8. `lib/api/error-message.ts` + `lib/services/content.service.ts`: `updateDrama()` / `createDrama()` read errors via `getApiErrorMessage()` and parse bodies with `readJsonSafely()`.
  9. Tests: `__tests__/validation/drama.test.ts` (15) and `__tests__/api/responses.test.ts` (6).
* **Key File Diffs**:
  - Created: `lib/api/responses.ts`, `lib/api/error-message.ts`, `lib/config/image-hosts.mjs`, `lib/validation/drama.ts`, `lib/admin/resolve-channel.ts`, `__tests__/validation/drama.test.ts`, `__tests__/api/responses.test.ts`.
  - Modified: `app/api/admin/dramas/route.ts`, `app/api/admin/dramas/[id]/route.ts`, `middleware.ts`, `lib/auth/require-admin.ts`, `lib/services/content.service.ts`, `next.config.mjs`.
  - Docs: `ROADMAP.md` Task 10.3 (✅ with delivered capabilities and results), Task 10.1 integration note, Phase 10 matrix row.
* **Regression Analysis & Cross-System Impact**:
  - Bug fixed: since Task 10.1, a 401/403 from the admin API put an error object into React state in the admin create/edit forms (render crash). Messages are now plain strings and include field-level validation details.
  - Behavior changes for admin clients: invalid payloads that were previously coerced (e.g. `totalEpisodes: "abc"` → 1, any poster URL) now return `400`; posters must be on an allowed host; `POST` returns `201`; non-UUID ids return `400` instead of mock data.
  - Each `/api/admin/*` request now performs two `auth.getUser()` calls (middleware + handler), by design (defense in depth).
  - Unchanged: admin pages still list dramas through the public client (Task 12.2); `admin.*` subdomain rewriting of `/api/*` (Task 10.4).
* **Verification**:
  - `npm test`: 40 / 40 pass. `npx tsc --noEmit`: 0 errors. `next lint`: clean. `npm run build`: success.
  - End-to-end on `next start -p 3100` against the production databases (throwaway regular user with forged `user_metadata.role` and throwaway admin, both deleted afterwards; only reads and rejected writes): 21 / 21 PASS — 401 JSON without a session on all 5 routes; 403 for the regular user; admin list returned 35 real dramas across Published, Archived, Draft, Scheduled; `t-1` → 400; unknown UUID GET/PATCH → 404; invalid PATCH → 400 with `poster, status, title, totalEpisodes`; empty PATCH, malformed JSON, missing title → 400; the drama targeted by the rejected PATCH was unchanged.
  - Not exercised: a successful `POST` / `PATCH` write (avoided touching catalog data); the admin create/edit forms in a browser.

---

## [2026-10-04] Task 10.4: Middleware Rewrite — Admin Subdomain Guard, Session Refresh & Safe returnUrl
* **Milestone**: Phase 10 (Security Hardening) — Task 10.4
* **Goal**: Close the admin-subdomain bypass (rewrite returned before the guard ran), stop rewriting `/api/*` and `/auth/*` on the admin host, refresh sessions on every matched route, and validate the post-login `returnUrl`.
* **Implementation Steps Taken**:
  1. `lib/navigation/safe-redirect.ts`: `getSafeRedirect(value, fallback)` accepts only same-origin relative paths (rejects absolute and protocol-relative URLs, `/\` tricks, control characters, non-strings, > 2,048 chars); `getSafeAdminRedirect()` additionally requires `/admin` and rejects `/admin/login` (loop).
  2. `lib/middleware/route-decision.ts`: pure `resolveRoute()` / `decideRoute()`; admin-host paths map to `/admin/*` before any decision, with `/api`, `/auth`, `/_next` passing through; areas use segment matching (`/administrator` is public).
  3. `lib/supabase/middleware.ts`: `updateSession(request, { verify })` with `getUser()` for protected areas and cookie-gated `getSession()` refresh for public pages; `withSessionCookies()` replays refreshed cookies onto any response.
  4. `middleware.ts` rewritten around those modules; Task 10.3's `/api/admin/*` 401/403 JSON behavior preserved; admin `/admin` → `/admin/dashboard` added (Task 12.5 item 2).
  5. Tests: `__tests__/middleware/route-decision.test.ts` and `__tests__/navigation/safe-redirect.test.ts` (41 new).
  6. Docs: `ROADMAP.md` Task 10.4 ✅ (with the item 3 deviation), Task 10.5 🚧 partially delivered, Task 12.5 item 2 noted, Phase 10 matrix row.
* **Key File Diffs**:
  - Created: `lib/navigation/safe-redirect.ts`, `lib/middleware/route-decision.ts`, `lib/supabase/middleware.ts`, `__tests__/middleware/route-decision.test.ts`, `__tests__/navigation/safe-redirect.test.ts`.
  - Modified: `middleware.ts` (rewritten), `ROADMAP.md`, `CHANGELOG-DEV.md`.
* **Regression Analysis & Cross-System Impact**:
  - Main-host behavior for `/admin/*`, `/account/*`, and `/api/admin/*` is unchanged except: admin-login `returnUrl` is now validated; the login redirect keeps the query string; an admin at `/admin` is redirected server-side.
  - Admin host: `/api/*` and `/auth/*` now reach their real routes (previously 404); every console path requires login; public paths resolve under `/admin` (login, then 404) instead of an immediate 404 — documented deviation.
  - Public pages: guests incur no Supabase call; signed-in users get a token refresh only when it is expiring (no per-request Auth round trip). `getSession()` results are never used for authorization.
  - Refresh-token rotation is safe: refreshed cookies are forwarded to the request and set on the response, so Server Components, route handlers, and the browser share the new token.
* **Verification**:
  - `npm test`: 81 / 81 pass. `npx tsc --noEmit`: 0 errors. `next lint`: clean. `npm run build`: success.
  - End-to-end on `next start -p 3100` using `Host` headers (throwaway admin and regular user, deleted afterwards; read-only requests): 15 / 15 PASS — admin host `/dashboard` and `/` without login → login redirect; `/login` → 200; `/api/admin/dramas` → 401 JSON without login, 200 JSON as admin; regular user → `/admin/login?error=unauthorized`; admin `/` → `/admin/dashboard`; `returnUrl=//evil.example` → `/admin/dashboard`; `returnUrl=/admin/dramas` honored; main `/account` guest → `/login?returnUrl=%2Faccount`; guest `/home` → 200 with no `Set-Cookie`; `/home` with an expired session → 200 with a refreshed `sb-…-auth-token` cookie.
  - Not exercised: a real deployed `admin.` DNS host (tested via `Host` header only).

---

## [2026-10-04] Task 10.5: Safe Post-Login Redirects & Unified `returnUrl`
* **Milestone**: Phase 10 (Security Hardening) — Task 10.5
* **Goal**: Close the client-side open redirect on the login pages (`/login?redirect=https://evil.example` sent users off-site after a real login) and standardize on the `returnUrl` parameter.
* **Implementation Steps Taken**:
  1. `lib/navigation/safe-redirect.ts`: added `readReturnUrl(searchParams, fallback)` (reads `returnUrl`, then legacy `redirect`; validates via `getSafeRedirect`; rejects auth pages) and `returnUrlQuery(value)` (builds `?returnUrl=…` or `""`).
  2. `app/login/page.tsx`: password login and Google OAuth `next` use `readReturnUrl()`; signup link forwards the validated `returnUrl`.
  3. `app/signup/page.tsx`: Google OAuth `next` and the verify-email hand-off use `readReturnUrl()`; the hand-off parameter is now `returnUrl`; login link forwards the validated `returnUrl`.
  4. `app/verify-email/page.tsx`: post-verify destination uses `readReturnUrl()` (the page itself remains a stub until Task 11.1).
  5. `app/admin/login/page.tsx`: `returnUrl` validated with `getSafeAdminRedirect()` before `router.replace`.
  6. `components/header/HeaderActions.tsx`, `components/LoginRequiredModal.tsx`: links switched from `?redirect=` to `returnUrlQuery()`.
  7. `app/auth/callback/route.ts`: inline open-redirect check replaced by `getSafeRedirect()`.
  8. Tests: extended `__tests__/navigation/safe-redirect.test.ts` (5 new).
  9. Docs: `ROADMAP.md` Task 10.5 ✅ with delivered capabilities and results; Phase 10 matrix row.
* **Key File Diffs**:
  - Modified: `lib/navigation/safe-redirect.ts`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/verify-email/page.tsx`, `app/admin/login/page.tsx`, `components/header/HeaderActions.tsx`, `components/LoginRequiredModal.tsx`, `app/auth/callback/route.ts`, `__tests__/navigation/safe-redirect.test.ts`, `ROADMAP.md`, `CHANGELOG-DEV.md`.
* **Regression Analysis & Cross-System Impact**:
  - Existing links that use `?redirect=` keep working for one release through the fallback in `readReturnUrl()`.
  - Behavior change: auth pages are no longer valid post-login destinations (e.g. opening Login from the login page's own header now returns to `/home` instead of `/login`).
  - Fixed a lost-destination bug: a `returnUrl` set by middleware (e.g. after visiting `/account`) is now carried across the login ↔ signup links.
  - `auth/callback` behavior unchanged for valid paths; it was not exploitable before (origin-prefixed destination).
* **Verification**:
  - `npm test`: 86 / 86 pass. `npx tsc --noEmit`: 0 errors. `next lint`: clean. `npm run build`: success.
  - Real browser — headless Edge driven over the Chrome DevTools Protocol against `next start -p 3100`, throwaway user and admin deleted afterwards: 11 / 11 PASS. `?redirect=https://example.com/phish` → landed on `/home`; `?returnUrl=//example.com` → `/home`; `?returnUrl=/account/history` → honored; login → signup link `?returnUrl=%2Fdrama%2Fceo-secret-wife` kept and an unsafe `redirect` dropped; admin login `returnUrl=//example.com` → `/admin/dashboard`; `returnUrl=/admin/dramas` → honored.
  - Not exercised: Google OAuth round trip; verify-email redirect (stub page); a negative control against the pre-fix build.
---

## [2026-10-05] Task 10.6: Episode Media Access Control & Server Playback Endpoint
* **Milestone**: Phase 10 (Security Hardening) — Task 10.6
* **Goal**: Close episode media data leakage where `episodes.video_url` and draft/archived episode rows were readable by the public anon key (`USING (true)` policy), isolate streaming media assets into a privileged `episode_media` table, restrict public reads of `episodes` to published parent dramas, and route all stream requests through an authenticated server-gated playback endpoint (`GET /api/playback/[episodeId]`).
* **Implementation Steps Taken**:
  1. `supabase/content/supabase/migrations/20261005120000_episode_media_lockdown.sql`:
     - Replaced open `episodes` SELECT policy with `"Public read episodes of published titles"` checking `EXISTS (SELECT 1 FROM titles t WHERE t.id = episodes.title_id AND t.status = 'Published')`.
     - Created `episode_media` table with columns (`id`, `episode_id`, `provider`, `asset_ref`, `hls_url`, `mp4_url`, `duration_seconds`, `aspect_ratio`, `status`, `created_at`, `updated_at`).
     - Enabled RLS on `episode_media` with zero public policies (read/write restricted exclusively to `service_role` and `postgres`).
     - Hardened column grants: revoked full table SELECT on `episodes` from `anon` and `authenticated`; granted SELECT only on non-sensitive columns (`id, title_id, episode_number, title, thumbnail_url, duration_seconds, is_free, created_at`), denying public access to `video_url`.
     - Idempotent backfill from `episodes.video_url` into `episode_media`.
  2. `types/supabase-content.ts`: Added TypeScript definition for `episode_media` table and foreign key relationship to `episodes`.
  3. `lib/server/playback.ts`:
     - `canAccessEpisode(user, episode)`: Enforces that parent title must be `Published` unless the user possesses an administrative role (`admin` or `editor` via `getUserRole()`). Serves as the single gatekeeper hook for upcoming Phase 8 monetization rules.
     - `resolvePlaybackSession(info, expiresInSeconds)`: Selects primary stream URL (`hls_url` → `mp4_url` → fallback) and generates ISO future expiration timestamp (default 2 hours).
     - `getEpisodePlaybackInfo(episodeId)`: Fetches episode, parent drama status, and privileged media via `getContentAdminClient()`.
  4. `app/api/playback/[episodeId]/route.ts`:
     - Validates UUID format via `isUuid()` (returns `400 INVALID_ID`).
     - Resolves user session via `createUserServerClient()` without forcing guest login.
     - Validates episode existence and evaluates `canAccessEpisode()`. Returns `404 NOT_FOUND` for non-existent or unpublished titles to prevent title status enumeration.
     - Returns uniform JSON envelope `{ success: true, data: { url, expiresAt, provider, aspectRatio, durationSeconds } }`.
  5. `lib/api/responses.ts`: Added `"PAYMENT_REQUIRED"` and `"STREAM_UNAVAILABLE"` to `ApiErrorCode`.
  6. `lib/services/content.service.ts`:
     - Updated `getEpisodesByTitleId()` to query explicit public projection (`id, title_id, episode_number, title, thumbnail_url, duration_seconds, is_free, created_at`), omitting raw `video_url`.
     - Implemented `getEpisodePlayback(episodeId)` client-side service helper returning typed `PlaybackSource`.
  7. `app/watch/[slug]/page.tsx`:
     - Integrated `getEpisodePlayback(currentEpData.id)` effect hook on active episode changes.
     - Prioritizes server `playbackSource.url` over legacy fallbacks for `<VideoPlayer>`.
     - Added user-facing error notice banner if playback fails or is restricted.
  8. `scripts/sql/verify-content-db-rls.sql`:
     - Verification script asserting that `anon` cannot read `episode_media`, cannot select `video_url` from `episodes`, cannot view draft title episodes, and that `service_role` has full administrative access.
  9. Tests:
     - `__tests__/playback/playback.test.ts`: 12 unit tests verifying permission rules (guest, user, forged role, admin preview, editor preview, draft/archived denial) and stream URL resolution.
     - `__tests__/api/playback-route.test.ts`: 2 route handler tests verifying UUID validation and injection rejection.
  10. Docs: Updated `ROADMAP.md` matrix and Task 10.6 section.
* **Key File Diffs**:
  - Created: `supabase/content/supabase/migrations/20261005120000_episode_media_lockdown.sql`, `scripts/sql/verify-content-db-rls.sql`, `lib/server/playback.ts`, `app/api/playback/[episodeId]/route.ts`, `__tests__/playback/playback.test.ts`, `__tests__/api/playback-route.test.ts`.
  - Modified: `types/supabase-content.ts`, `lib/api/responses.ts`, `lib/services/content.service.ts`, `app/watch/[slug]/page.tsx`, `ROADMAP.md`, `CHANGELOG-DEV.md`.
* **Regression Analysis & Cross-System Impact**:
  - Catalog playback: Existing published dramas continue streaming smoothly because `canAccessEpisode()` permits all published episodes, and `resolvePlaybackSession()` falls back gracefully to `video_url` if an episode hasn't been backfilled yet.
  - Draft security: Episodes of unpublished/draft dramas cannot be enumerated or played by guests or regular users via API (returns 404). Staff with `admin` or `editor` in `app_metadata.role` can preview drafts.
  - Public database exposure: Direct PostgREST queries using the anon key now receive 0 rows for draft episodes and permission denied for `video_url` and `episode_media`.
  - Dual-database separation preserved: Content DB (`czkkzoiuyqybafacpgsp`) holds episode media assets; User DB (`bpidsbcrvpkavvdvtpgh`) holds auth and user sessions.
* **Verification**:
  - `npm test`: 100 / 100 pass across 19 test suites.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: production build passed with all 36 static pages and dynamic `ƒ /api/playback/[episodeId]`.
---

## [2026-10-05] Task 10.7: Admin Provisioning Script Hardening
* **Milestone**: Phase 10 (Security Hardening) — Task 10.7
* **Goal**: Harden `scripts/create-admin.ts` against dangerous default credentials (`admin@dramashort.com` / `Admin123456!`), unrequested credential resets on existing accounts, missing production safety gates, incomplete pagination in user discovery, and client-metadata contamination.
* **Implementation Steps Taken**:
  1. `scripts/create-admin.ts`:
     - Mandatory `--email` argument parsing with regex email validation and formatted CLI `--help` display.
     - Role support for `--role admin` and `--role editor` (default `"admin"`), plus `--revoke` flag to strip privileges and reset `profiles.role = 'user'`.
     - `generateSecurePassword(length = 20)` generating cryptographically high-entropy passwords with uppercase, lowercase, numbers, and symbols.
     - Credential safety: generated passwords for new accounts printed once with security instructions; user-supplied passwords via `--password` masked and never echoed to stdout.
     - Existing user credential preservation: existing account passwords untouched unless `--reset-password` is explicitly passed.
     - Privilege single source of truth: writes `app_metadata.role`, drops client-forged `user_metadata.role`, and synchronizes `profiles.role` via the service role client with typed `Database` schema bindings.
     - Paginated user discovery: `findUserByEmail()` loops through all pages of `listUsers({ page, perPage: 1000 })` guaranteeing accounts beyond page 1 are discovered.
     - Production refusal gate: `isProductionProject(url)` checks project ref `bpidsbcrvpkavvdvtpgh` and halts with exit code 1 unless `--confirm-production` is supplied.
  2. `__tests__/scripts/create-admin.test.ts`:
     - Created automated unit test suite with 16 tests covering email syntax validation, production project ref detection, password entropy, CLI argument parsing, enum validation, flags, and custom parameters.
  3. Documentation: Updated `ROADMAP.md` matrix and Task 10.7 section.
* **Key File Diffs**:
  - Created: `__tests__/scripts/create-admin.test.ts`.
  - Modified: `scripts/create-admin.ts`, `ROADMAP.md`, `CHANGELOG-DEV.md`.
* **Regression Analysis & Cross-System Impact**:
  - Production safety: accidental execution of `npm run admin:create` against production `.env.local` immediately halts with a clean safety message instead of overwriting production admin accounts.
  - Existing admin protection: running provisioning on an existing email to change roles or confirm status does not reset their password or lock them out.
  - Backward compatibility: positional email syntax remains supported for backward compatibility while honoring all safety gates.
* **Verification**:
  - `npm test`: 116 / 116 tests pass across 24 suites.
  - `npx tsx scripts/create-admin.ts --help`: verified structured CLI help guide.
  - `npx tsx scripts/create-admin.ts --email test@example.com`: verified production safety gate refusal against `.env.local` without `--confirm-production`.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
---

## [2026-10-05] Task 10.8: Supabase Auth Configuration & HTTP Security Headers
* **Milestone**: Phase 10 (Security Hardening) — Task 10.8
* **Goal**: Harden Supabase Auth policies against brute force, credential stuffing, and open redirects, configure Cloudflare Turnstile CAPTCHA bindings, enforce reauthentication on password changes, and apply enterprise-grade HTTP security headers with a comprehensive Content Security Policy (CSP).
* **Implementation Steps Taken**:
  1. `lib/config/security-headers.mjs`:
     - Built `buildContentSecurityPolicy()` configuring strict directives:
       - Default restrictiveness: `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
       - Scripts: `'self'`, `'unsafe-eval'`, `'unsafe-inline'`, `https://telegram.org` (Telegram Login Widget & WebApp SDK per `FUTURE_PLAN.md` §5.4), and `https://challenges.cloudflare.com` (Turnstile).
       - Media & Streaming: `blob:`, `data:`, `https://*.supabase.co`, `https://commondatastorage.googleapis.com`, and short drama streaming CDNs (`https://*.mux.com`, `https://*.cloudflarestream.com`, `https://*.b-cdn.net`).
       - Network connections: `https://*.supabase.co`, `wss://*.supabase.co` (Realtime), `https://api.telegram.org`, and `https://challenges.cloudflare.com`.
       - Framing: `frame-src 'self' https://oauth.telegram.org https://challenges.cloudflare.com`.
       - Anti-clickjacking & Telegram embedding: `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org`.
     - Created `getSecurityHeaders()` exporting standard OWASP headers:
       - `X-Content-Type-Options: nosniff`.
       - `Referrer-Policy: strict-origin-when-cross-origin`.
       - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`.
       - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
       - `X-DNS-Prefetch-Control: on`.
  2. `next.config.mjs`:
     - Wired `getSecurityHeaders()` into `async headers()` for all routes (`/:path*`).
  3. `supabase/user/supabase/config.toml`:
     - Hardened password requirements: `minimum_password_length = 8`, `password_requirements = "lower_upper_letters_digits"`.
     - Enabled secure password change with reauthentication nonce: `secure_password_change = true`.
     - Restricted `additional_redirect_urls` allowlist to trusted origins (`localhost:3000`, `127.0.0.1:3000`, `https://dramashort.com`, `https://admin.dramashort.com`, and `https://*.vercel.app`).
     - Bound Turnstile CAPTCHA provider under `[auth.captcha]`.
  4. `__tests__/config/security-headers.test.ts`:
     - Created automated unit test suite with 5 tests verifying baseline CSP directives, Supabase connections, Telegram origins, Turnstile CAPTCHA, and OWASP header mappings.
  5. Documentation: Updated `ROADMAP.md` matrix and Task 10.8 section.
* **Key File Diffs**:
  - Created: `lib/config/security-headers.mjs`, `__tests__/config/security-headers.test.ts`.
  - Modified: `next.config.mjs`, `supabase/user/supabase/config.toml`, `ROADMAP.md`, `CHANGELOG-DEV.md`.
* **Regression Analysis & Cross-System Impact**:
  - Media streaming: Verified that CSP allows all active and planned video hosts (Google demo bucket, Supabase storage, Mux, Cloudflare Stream, Bunny).
  - Next.js client hydration: Retains required `'unsafe-inline'` and `'unsafe-eval'` for React client scripts and HMR.
  - Telegram integration: Preserves compatibility with future Telegram Login Widget (`oauth.telegram.org`) and WebApp embedding (`web.telegram.org`).
* **Verification**:
  - `npm test`: 121 / 121 pass across 25 suites.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully compiled all 36 static pages and verified header configuration integration.
---

## [2026-10-05] Task 10.9: Security Regression Test Suite & CI Gate (Phase 10 Complete)
* **Milestone**: Phase 10 (Security Hardening) — Task 10.9 & Phase 10 Completion Gate
* **Goal**: Establish a regression test suite covering all security mechanisms delivered across Phase 10 (role escalation prevention, admin API route guards, open redirect defenses, subdomain isolation, playback access control, and database RLS policy contracts) and configure a GitHub Actions CI gate.
* **Implementation Steps Taken**:
  1. Automated Security Test Suites (`__tests__/security/`):
     - `require-admin.test.ts` (9 tests): Validates `requireAdmin()` with all privilege permutations: 401 on missing session or expired JWT, 500 on auth client throw, 403 on missing `app_metadata.role`, 403 on client-forged `user_metadata.role: "admin"` (self-elevation prevention), 403 on unexpected role strings, 403 on editor when admin required, 200 on authorized editor, and 200 on genuine admin. Confirms `auth.getUser()` is called server-side.
     - `admin-routes.test.ts` (11 tests): Integration tests of actual admin API routes (`GET /api/admin/dramas`, `POST /api/admin/dramas`, `GET /api/admin/dramas/[id]`, `PATCH /api/admin/dramas/[id]`). Verifies unauthenticated callers receive 401 UNAUTHORIZED, regular users and forged-role attackers receive 403 FORBIDDEN, invalid UUIDs receive 400 INVALID_ID, invalid payloads receive 400 VALIDATION_ERROR, and genuine admins succeed.
     - `open-redirect-matrix.test.ts` (33 tests): Exhaustive matrix tests covering OWASP open-redirect bypass vectors against `getSafeRedirect()`, `getSafeAdminRedirect()`, `readReturnUrl()`, and `returnUrlQuery()`. Blocks protocol tricks, protocol-relative `//evil.com`, backslash variations (`/\evil.com`, `\\evil.com`), encoded vectors (`%2F%2Fevil.com`), whitespace/control character injections, pseudo-protocols (`javascript:`), and auth-loop redirects.
     - `middleware-security-matrix.test.ts` (14 tests): Verifies host classification, case-insensitivity, subdomain isolation, prefix collisions, and the route decision matrix across host × path × session permutations.
     - `playback-access-control.test.ts` (11 tests): Verifies server-gated playback security. Confirms guests and regular users cannot access Draft, Scheduled, or Archived titles (403/UNPUBLISHED_TITLE); blocks users with forged `user_metadata.role`; permits admin/editor preview of drafts; verifies stream URL resolution, expiration, and UUID/injection validation on `GET /api/playback/[episodeId]`.
     - `rls-contract.test.ts` (10 tests): Validates database migration contracts. Asserts RLS is enabled on all sensitive user and content tables, `anon` has all default privileges revoked, `profiles` UPDATE grant strictly excludes `role`, `episode_media` revokes public access, and `episodes` SELECT policy restricts reading to Published titles only.
  2. Database pgTAP Test Suites (`supabase/*/supabase/tests/`):
     - `supabase/user/supabase/tests/user_rls.test.sql`: pgTAP tests verifying RLS on user tables, blocking anon reads, blocking role updates, and enforcing cross-user isolation.
     - `supabase/content/supabase/tests/content_rls.test.sql`: pgTAP tests verifying RLS on content tables, blocking anon/authenticated reads of `episode_media`, and blocking direct `video_url` column access.
  3. Continuous Integration Gate (`.github/workflows/ci.yml`):
     - Configured GitHub Actions CI workflow triggered on push and pull requests to `dramashort-app` and `main`.
     - Job 1 (`verify`): `npm ci` → `npx tsc --noEmit` → `npm run lint` → `npm test` → `npm run build`.
     - Job 2 (`supabase-rls-verification`): Sets up Supabase CLI and executes local RLS migration and policy verification tests.
  4. Testability Hooks (`lib/supabase/user-server.ts`, `lib/supabase/content.ts`, `lib/auth/require-admin.ts`, `lib/middleware/route-decision.ts`):
     - Added test client factory hooks allowing unit tests to inject mock clients cleanly without monkey-patching or leaking across tests.
     - Added default parameters to `decideRoute`.
  5. Roadmap & Milestone Gate: Marked Task 10.9 and the overarching Phase 10 milestone as ✅ Completed in `ROADMAP.md`.
* **Key File Diffs**:
  - Created:
    - `__tests__/security/require-admin.test.ts`
    - `__tests__/security/admin-routes.test.ts`
    - `__tests__/security/open-redirect-matrix.test.ts`
    - `__tests__/security/middleware-security-matrix.test.ts`
    - `__tests__/security/playback-access-control.test.ts`
    - `__tests__/security/rls-contract.test.ts`
    - `supabase/user/supabase/tests/user_rls.test.sql`
    - `supabase/content/supabase/tests/content_rls.test.sql`
    - `.github/workflows/ci.yml`
  - Modified:
    - `lib/supabase/user-server.ts`
    - `lib/supabase/content.ts`
    - `lib/auth/require-admin.ts`
    - `lib/middleware/route-decision.ts`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Test runner baseline expanded from 121 tests across 25 suites to 226 tests across 49 suites (+105 tests), catching all security invariants.
  - Zero disruption to production logic: test hooks are strictly opt-in and no-op by default.
  - Production build continues to compile cleanly with all 36 routes and static assets validated.
* **Verification**:
  - `npm test`: 226 / 226 tests pass across 49 suites (0 failures).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully compiled all 36 static pages, dynamic route handlers, and middleware bundle.
---

## [2026-10-05] Task 11.1: Real Email Verification on Signup & Confirmation Route
* **Milestone**: Phase 11 (Authentication & User Management Completeness) — Task 11.1
* **Goal**: Implement real email verification on signup, replacing mock code bypasses with genuine Supabase GoTrue OTP verification, branded responsive HTML email templates, server-side PKCE link confirmation route handler (`/auth/confirm`), and 60s cooldown resend functionality.
* **Implementation Steps Taken**:
  1. Branded Confirmation Template & Supabase GoTrue Configuration:
     - Authored responsive HTML email template at `supabase/user/supabase/templates/confirmation.html` featuring dark aesthetic branding (`#111827`, `#6366f1`), displaying both the 6-digit OTP verification code (`{{ .Token }}`) and one-click direct confirmation button (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`).
     - Configured `supabase/user/supabase/config.toml` under `[auth.email]` to enable `enable_confirmations = true` and bound `[auth.email.template.confirmation]` to the template.
  2. Server-Side Link Confirmation Route Handler (`app/auth/confirm/route.ts`):
     - Created PKCE/SSR email token confirmation route handler reading `token_hash`, `type` (`email` / `signup`), and destination redirect `next`.
     - Integrated `createUserServerClient` to call `verifyOtp({ token_hash, type })` and persist session cookies.
     - Hardened redirect handling with `getSafeRedirect(next, "/home")` to prevent open-redirect vulnerabilities and login-loop hazards.
  3. AuthContext Verification Services (`contexts/AuthContext.tsx`):
     - Updated `signUp()` to supply `emailRedirectTo: `${origin}/auth/confirm`` and return `{ error, needsEmailVerification, session }`.
     - Implemented `verifySignupOtp(email, token)`: verifies OTP code against Supabase auth using `type: 'signup'` (with fallback to `type: 'email'`), updates state, and invokes `syncGuestWatchHistory()`.
     - Implemented `resendSignupOtp(email)`: triggers `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`.
  4. User Interface Integration:
     - Updated `app/signup/page.tsx` to handle `needsEmailVerification`: skips `/verify-email` when session is created immediately (when confirmations are disabled in dev), and safely redirects to `/verify-email?email=...&returnUrl=...` when verification is required.
     - Hardened `app/verify-email/page.tsx`: replaced mock `login()` call with `verifySignupOtp()`, implemented `resendSignupOtp()` with 60s countdown timer, added inline error alert banner and loading states.
  5. Automated Verification Test Suite (`__tests__/auth/email-verification.test.ts`):
     - Added 9 unit and integration tests verifying token verification success, safe redirect sanitization, open-redirect blocking, missing parameter handling, GoTrue verification failure handling, and template placeholder validation.
  6. Roadmap Progress:
     - Marked Task 11.1 as ✅ Completed and updated Phase 11 milestone status in `ROADMAP.md`.
* **Key File Diffs**:
  - Created:
    - `app/auth/confirm/route.ts`
    - `supabase/user/supabase/templates/confirmation.html`
    - `__tests__/auth/email-verification.test.ts`
  - Modified:
    - `contexts/AuthContext.tsx`
    - `app/signup/page.tsx`
    - `app/verify-email/page.tsx`
    - `supabase/user/supabase/config.toml`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Test suite grew to 235 tests across 50 suites with 100% pass rate.
  - Full TypeScript type-checking and Next.js build compilation confirmed 37 routes with zero lint or build regressions.
  - Backward compatibility preserved for direct logins and guests.
* **Verification**:
  - `npm test`: 235 / 235 tests pass across 50 suites (0 failures).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 37 pages including dynamic route `ƒ /auth/confirm`.
---

## [2026-10-05] Task 11.2: Real Password Recovery & Reset Password Flow
* **Milestone**: Phase 11 (Authentication & User Management Completeness) — Task 11.2
* **Goal**: Replace non-functional mock password reset stubs with genuine end-to-end Supabase GoTrue password recovery, branded responsive HTML email templates, enumeration-safe request handling, 6-digit OTP verification, session establishment, and a dedicated reset password page (`/reset-password`) that invalidates all other active sessions via `signOut({ scope: "others" })`.
* **Implementation Steps Taken**:
  1. Branded Recovery Email Template & Supabase Configuration:
     - Authored responsive HTML template `supabase/user/supabase/templates/recovery.html` adhering to dark branding aesthetic (`#0f172a`, `#e11d48`), displaying 6-digit OTP code (`{{ .Token }}`) and direct one-click action button (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`).
     - Bound `[auth.email.template.recovery]` in `supabase/user/supabase/config.toml` to `./templates/recovery.html` with subject `"Reset your DramaShort password"`.
  2. AuthContext Recovery Services (`contexts/AuthContext.tsx`):
     - `resetPasswordForEmail(email)`: triggers GoTrue recovery email with `redirectTo` pointing to `/auth/confirm?type=recovery&next=/reset-password`. Suppresses account absence errors to prevent user enumeration attacks while relaying rate limits.
     - `verifyPasswordRecoveryOtp(email, token)`: verifies 6-digit OTP against Supabase GoTrue with `type: "recovery"`, hydrating active user and session state upon verification.
     - `updatePassword(newPassword)`: calls `supabase.auth.updateUser({ password: newPassword })` and terminates all other existing sessions via `supabase.auth.signOut({ scope: "others" })`.
  3. Interactive Recovery Interface (`app/forgot-password/page.tsx`):
     - Integrated real recovery request and OTP verification.
     - Implemented 60-second countdown cooldown preventing resend abuse, with inline status and error banners.
     - Automatically routes verified users to `/reset-password`.
  4. Reset Password Page (`app/reset-password/page.tsx`):
     - Created dedicated page validating active recovery session on mount (displaying friendly expiration alert if accessed without a valid session).
     - Form enforces minimum 8 characters and confirmation match with toggleable password visibility.
     - Calls `updatePassword()`, displays toast confirmation, and seamlessly routes user to `/home`.
  5. Security & Redirect Protection (`lib/navigation/safe-redirect.ts`):
     - Added `/reset-password` to `AUTH_PAGES` array in `lib/navigation/safe-redirect.ts` ensuring post-login returnUrls cannot produce redirect loops or open-redirect vulnerabilities.
  6. Automated Verification Test Suite (`__tests__/auth/password-recovery.test.ts`):
     - Authored 6 unit and regression tests covering recovery template placeholders, config bindings, open-redirect loop protection, account enumeration defense simulation, and password validation contracts.
     - Updated `__tests__/security/open-redirect-matrix.test.ts` to assert `/reset-password` loop defense.
* **Key File Diffs**:
  - Created:
    - `app/reset-password/page.tsx`
    - `supabase/user/supabase/templates/recovery.html`
    - `__tests__/auth/password-recovery.test.ts`
  - Modified:
    - `app/forgot-password/page.tsx`
    - `contexts/AuthContext.tsx`
    - `lib/navigation/safe-redirect.ts`
    - `supabase/user/supabase/config.toml`
    - `__tests__/security/open-redirect-matrix.test.ts`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - All 242 tests pass across 57 suites (+7 tests), including open-redirect and authentication matrices.
  - Zero disruption to existing login, signup, or guest user flows.
* **Verification**:
  - `npm test`: 242 / 242 tests pass across 57 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 38 pages including dynamic route `ƒ /reset-password`.
---

## [2026-10-05] Task 11.3: Real Account Deletion & GDPR Data Erasure
* **Milestone**: Phase 11 (Authentication & User Management Completeness) — Task 11.3
* **Goal**: Replace no-op account deletion modal with GDPR Article 17 compliant permanent account erasure, server-side route handler (`DELETE /api/account`), cascading deletion across all user databases, strict reauthentication requirements, and ADR-0001 documentation for financial records retention.
* **Implementation Steps Taken**:
  1. Service Role Client & Server Route Handler (`app/api/account/route.ts`, `lib/supabase/user-server.ts`):
     - Added `createUserServiceRoleClient()` with test injection hooks to `lib/supabase/user-server.ts`.
     - Built `DELETE /api/account` route handler verifying caller session via `auth.getUser()`, requiring typed confirmation (`confirmationText: "DELETE"`), and enforcing re-authentication checks (password verification or recent authentication within 5 minutes).
     - Calls privileged `auth.admin.deleteUser(user.id)` to permanently remove user and cascade foreign key deletions across user tables.
  2. Database Cascading Erasure Verification:
     - Confirmed `ON DELETE CASCADE` foreign key configuration on `profiles`, `favorites`, `watch_history`, `custom_lists`, and `custom_list_items` referencing `auth.users(id)`.
  3. Interactive Settings UX (`app/account/settings/page.tsx`):
     - Replaced stubbed modal with an accessible, GDPR-compliant permanent deletion modal.
     - Mandates typing `DELETE` into a mono-spaced confirmation input, accepts optional/required password verification, displays loading state during execution, and shows feedback toast before redirecting to `/login?deleted=true`.
  4. Client Cleanup in AuthContext (`contexts/AuthContext.tsx`):
     - Implemented `deleteAccount()` calling `DELETE /api/account`.
     - Purges local client storage (`localStorage` guest history and themes), terminates client auth state, and resets user profiles.
  5. Architecture Decision Record (`docs/adr/0001-account-deletion-and-data-retention.md`):
     - Authored ADR-0001 formally detailing GDPR Article 17 compliance, pre-deletion reauthentication requirements, and Phase 8 financial records retention rules (anonymizing transaction records while wiping personal data).
  6. Automated Verification Test Suite (`__tests__/account/account-deletion.test.ts`):
     - Added 10 automated unit and integration tests covering unauthenticated rejection (401), invalid confirmation keywords (400), stale session defense (403), password verification failure (400), successful recent deletion (200), successful password-verified deletion (200), service role gateway failure handling (500), foreign key cascade contracts, and ADR-0001 documentation.
  7. API Response Error Codes (`lib/api/responses.ts`):
     - Added `REAUTHENTICATION_REQUIRED`, `DELETION_FAILED`, `INVALID_CREDENTIALS`, and `INTERNAL_ERROR` to `ApiErrorCode`.
* **Key File Diffs**:
  - Created:
    - `app/api/account/route.ts`
    - `docs/adr/0001-account-deletion-and-data-retention.md`
    - `__tests__/account/account-deletion.test.ts`
  - Modified:
    - `app/account/settings/page.tsx`
    - `contexts/AuthContext.tsx`
    - `lib/supabase/user-server.ts`
    - `lib/api/responses.ts`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Expanded test runner to 252 tests across 58 test suites with 100% pass rate.
  - Zero disruption to non-deletion account settings or public flows.
* **Verification**:
  - `npm test`: 252 / 252 tests pass across 58 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 39 pages including dynamic route `ƒ /api/account`.
---

## [2026-10-05] Task 11.4: Support Contact & "Report Issue" Pipeline
* **Milestone**: Phase 11 (Authentication & User Management Completeness) — Task 11.4
* **Goal**: Replace mock `Math.random() > 0.15` contact submission with an authentic end-to-end support ticket pipeline, structured diagnostic context for video playback issue reporting, rate-limiting and anti-spam protection, dedicated User DB persistence (`public.support_tickets`), and Telegram ops bot notification readiness.
* **Implementation Steps Taken**:
  1. User Database Migration (`supabase/user/supabase/migrations/20261005160000_support_tickets.sql`):
     - Created `public.support_tickets` table:
       - Columns: `id UUID PRIMARY KEY`, `user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL`, `email TEXT NOT NULL`, `category TEXT NOT NULL CHECK (category IN ('general', 'playback', 'billing', 'content', 'account'))`, `subject TEXT NOT NULL`, `message TEXT NOT NULL`, `context JSONB NOT NULL DEFAULT '{}'::jsonb`, `status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved'))`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
       - Indexes: `idx_support_tickets_user_id`, `idx_support_tickets_status`, `idx_support_tickets_category`, `idx_support_tickets_created_at`.
       - Security & RLS: enabled RLS, revoked all privileges from `anon` and `authenticated` roles, granted exclusive access to `service_role`.
  2. Database Schema Types (`types/supabase-user.ts`):
     - Added `support_tickets` definition to `Database["public"]["Tables"]` enabling strict type checking on server writes.
  3. Shared Types & Rate Limiting (`lib/support/types.ts`, `lib/support/rate-limiter.ts`):
     - Created `lib/support/types.ts` defining `SUPPORT_CATEGORIES` and `SupportCategory` type, decoupled from server-only imports.
     - Created `lib/support/rate-limiter.ts` with sliding-window in-memory rate limiter enforcing maximum 5 submissions per hour per user/IP, with `Retry-After` calculation and test isolation hooks.
  4. Server Route Handler (`app/api/support/route.ts`):
     - Implemented `POST /api/support` handling ticket ingestion.
     - Anti-spam & Honeypot: rejects submissions containing filled bot honeypot fields (`hp`, `honeypot`, `website`) with `400 VALIDATION_ERROR`.
     - Validates payload: RFC-compliant email, category enum validation, subject length (3–200 chars), message length (10–4000 chars), context payload size cap (10KB).
     - Identifies optional user session: links `user_id` if authenticated; supports guest submissions with `user_id = null`.
     - Inserts record into `support_tickets` via privileged `createUserServiceRoleClient()`.
     - Ops Channel Notification: non-blocking Telegram notification dispatch when `TELEGRAM_BOT_TOKEN` and `TELEGRAM_OPS_CHAT_ID` are configured.
     - Returns uniform envelope `201 Created` with ticket reference ID.
  5. Interactive Contact & Support Page (`app/contact/page.tsx`):
     - Removed `Math.random() > 0.15` simulated outcome.
     - Parses URL search parameters for prefilled context (`category`, `title`, `titleName`, `ep`, `subject`, `message`).
     - Renders diagnostic banner when reporting playback issues from watch stage (`Reporting issue for: <Title> (Episode <n>)`).
     - Pre-fills email if user is authenticated via `useAuth()`.
     - Submits payload to `/api/support` with hidden honeypot field and loading spinner.
     - Displays feedback modal with real ticket reference ID (`#<ID>`) or specific server error messages.
  6. Structured Context in Watch Page (`app/watch/[slug]/page.tsx`):
     - Removed legacy `buildReportMessage` plaintext boilerplate generator.
     - Updated "Report Issue" action button to link to `/contact?category=playback&title=<slug>&ep=<n>&titleName=<title>`.
  7. API Response Error Codes (`lib/api/responses.ts`):
     - Added `TOO_MANY_REQUESTS` to `ApiErrorCode`.
  8. Automated Verification Test Suite (`__tests__/support/support-tickets.test.ts`):
     - Created 14 unit and integration tests covering SQL migration contracts, schema constraints, index definitions, service-role privileges, route handler JSON validation, honeypot rejection, field boundary checks, guest ticket creation, authenticated member ticket creation, database failure handling, rate limit enforcement (5/hr with `Retry-After`), and watch page structured link contracts.
* **Key File Diffs**:
  - Created:
    - `supabase/user/supabase/migrations/20261005160000_support_tickets.sql`
    - `lib/support/types.ts`
    - `lib/support/rate-limiter.ts`
    - `app/api/support/route.ts`
    - `__tests__/support/support-tickets.test.ts`
  - Modified:
    - `types/supabase-user.ts`
    - `lib/api/responses.ts`
    - `app/contact/page.tsx`
    - `app/watch/[slug]/page.tsx`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Test runner expanded to 266 tests across 67 test suites with 100% pass rate.
  - Zero disruption to existing playback, navigation, or catalog pages.
* **Verification**:
  - `npm test`: 266 / 266 tests pass across 67 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 40 pages including dynamic route `ƒ /api/support` and static page `○ /contact`.
---

## [2026-10-05] Task 11.5: Password Change Hardening
* **Milestone**: Phase 11 (Authentication & User Management Completeness) — Task 11.5
* **Goal**: Harden the user password change and setting workflows against session cloning and unverified changes, support Supabase GoTrue `secure_password_change` with `supabase.auth.reauthenticate()` email nonce collection (`OtpInput`), adapt UX dynamically for OAuth/third-party accounts lacking email/password credentials ("Set a password" vs. "Change Password"), and automatically invalidate all other active sessions via `supabase.auth.signOut({ scope: "others" })`.
* **Implementation Steps Taken**:
  1. AuthContext Service Hardening (`contexts/AuthContext.tsx`):
     - Enhanced `changePassword(newPassword, currentPassword, nonce)`:
       - Enforces minimum 8 character length requirement matching `supabase/user/supabase/config.toml`.
       - Passes `current_password` and optional security `nonce` directly to `supabase.auth.updateUser()`.
       - Detects reauthentication/nonce requirements (`status: 422/403`, `reauth`, `nonce`, `recent`) and returns `{ error, needsReauthentication: true }`.
       - Automatically revokes all other active sessions across browsers and devices on success via `supabase.auth.signOut({ scope: "others" })`.
     - Added `reauthenticate()` helper invoking `supabase.auth.reauthenticate()` to dispatch a 6-digit verification code to the user's registered email address.
     - Added `hasPasswordIdentity` boolean property derived from `user.identities` (`provider === "email"`) or `app_metadata.providers` to dynamically identify OAuth-only users.
  2. Account Management UI (`app/account/page.tsx`):
     - Dynamic button and modal title: displays "Set a password" for external OAuth accounts and "Change Password" for email/password accounts.
     - Form adapting: hides the "Current Password" field for OAuth users setting a password for the first time while displaying helpful guidance.
     - Multi-step security verification: when GoTrue requires reauthentication or a nonce, seamlessly switches the modal to an OTP verification step with `OtpInput` (6 digits), a 60-second cooldown timer for code resend via `reauthenticate()`, and a back navigation option.
     - Displays distinct success toast messages: `"Password created successfully"` vs. `"Password updated successfully"`.
  3. Automated Verification Test Suite (`__tests__/auth/password-change.test.ts`):
     - Authored 11 unit and integration tests covering password length enforcement, payload construction (`current_password` and `nonce`), reauthentication requirement detection, session revocation contracts (`signOut({ scope: "others" })`), dynamic button label evaluation, external provider assistance, and OtpInput integration.
* **Key File Diffs**:
  - Created:
    - `__tests__/auth/password-change.test.ts`
  - Modified:
    - `contexts/AuthContext.tsx`
    - `app/account/page.tsx`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Test runner expanded to 277 tests across 71 test suites with 100% pass rate.
  - Zero disruption to password reset, email change, profile edit, or deletion flows.
* **Verification**:
  - `npm test`: 277 / 277 tests pass across 71 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 40 pages.

---

## [2026-10-05] Task 11.6: Real 404s & Unavailable-Content States
* **Milestone**: Phase 11 (Authentication & User Management Completeness) — Task 11.6
* **Goal**: Eliminate fabricated mock fallbacks from runtime routes and components, enforce real 404s and search-engine de-indexing (`robots: { index: false, follow: false }`) for non-existent dramas and channels, establish canonical permanent redirects (`308`) for legacy slug formats, eradicate external sample video fallbacks (Big Buck Bunny), and present clear "Coming Soon" states for episodes awaiting media ingestion.
* **Implementation Steps Taken**:
  1. SEO & Crawl Protection (`app/drama/[slug]/layout.tsx`, `app/watch/[slug]/layout.tsx`):
     - Removed `getTitleBySlugOrFallback` imports in metadata generation.
     - When `getTitleBySlug(slug)` returns `null`, metadata emits `robots: { index: false, follow: false }` and `Drama Not Found — DramaShort` to prevent soft 404s and de-index invalid slugs.
  2. Drama Detail Page (`app/drama/[slug]/page.tsx`):
     - Replaced fallback title generation with `notFound()` when the drama does not exist in the database.
     - Implemented canonical redirect: if accessed via a legacy prefix slug, automatically invokes `permanentRedirect('/drama/${dbDrama.slug}')`.
  3. Video Watch Experience (`app/watch/[slug]/page.tsx`):
     - Removed all references to Google sample video storage bucket and Big Buck Bunny fallback URL.
     - Invokes `notFound()` if the title does not exist.
     - Implemented canonical redirect: if accessed via a legacy prefix slug, automatically invokes `permanentRedirect('/watch/${dbDrama.slug}')`.
     - When an episode lacks media URL, renders a clear unavailable video overlay with "Episode Unavailable — This episode does not have a video stream available yet" and a link back to drama details.
     - Episode sidebar header displays exact inventory counts: `{totalEps} episodes · {availableEpisodesCount} available`.
     - Episode grid renders non-clickable, styled "Coming soon" tiles for episodes without video media, preventing broken playback attempts.
     - Preserves React hook ordering rules (`useMemo` called unconditionally before loading skeleton return).
  4. Channel Directory (`app/channel/[slug]/page.tsx`):
     - Invokes `notFound()` when an invalid channel slug cannot be resolved.
  5. Personal Media Curation Cleanup (`components/ContinueWatching.tsx`, `app/account/favorite/page.tsx`, `app/account/history/page.tsx`):
     - Removed runtime imports and calls to `getTitleBySlugOrFallback`.
     - Continue watching gracefully filters out deleted or unknown dramas from the carousel.
     - Watch history gracefully skips titles that no longer exist in the catalog.
     - Favorites page hydrates exclusively from resolved database records.
  6. Content DB Test Client Mock (`lib/supabase/content.ts`):
     - Added `setTestContentClient()` and Proxy hook on `contentClient` to allow fast, deterministic in-memory queries in unit tests without network timeouts.
  7. Automated Verification Test Suite (`__tests__/routing/real-404-and-unavailable-states.test.ts`):
     - Created 8 comprehensive tests asserting:
       - `robots: { index: false, follow: false }` for non-existent titles on `/drama/[slug]` and `/watch/[slug]`.
       - Standard indexable metadata for existing dramas.
       - Zero runtime imports of `getTitleBySlugOrFallback` across `app/` and `components/`.
       - Zero references to Big Buck Bunny in watch player.
       - Defensive filtering in continue watching and history collections.
* **Key File Diffs**:
  - Created:
    - `__tests__/routing/real-404-and-unavailable-states.test.ts`
  - Modified:
    - `lib/supabase/content.ts`
    - `app/drama/[slug]/layout.tsx`
    - `app/drama/[slug]/page.tsx`
    - `app/watch/[slug]/layout.tsx`
    - `app/watch/[slug]/page.tsx`
    - `app/channel/[slug]/page.tsx`
    - `components/ContinueWatching.tsx`
    - `app/account/favorite/page.tsx`
    - `app/account/history/page.tsx`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Test runner expanded to 285 tests across 75 test suites with 100% pass rate.
  - Production build cleanly compiled all 40 static and dynamic routes.
* **Verification**:
  - `npm test`: 285 / 285 tests pass across 75 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 40 pages with 0 warnings.

---

## [2026-10-05] Task 11.7: Notifications — Hide Until Real
* **Milestone**: Phase 11 (Authentication & User Management Completeness) — Task 11.7
* **Goal**: Hide the mock notification bell behind the `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` feature flag (default: off) to avoid displaying ephemeral, hardcoded mock notifications to signed-in users, prevent shipping mock data in the main client bundle, and specify the future notifications database schema and Telegram delivery bridge in ADR-0002.
* **Implementation Steps Taken**:
  1. Architecture & Schema Specification (`docs/adr/0002-notifications-system-architecture.md`):
     - Published ADR-0002 specifying the target `public.notifications` table in User DB (`bpidsbcrvpkavvdvtpgh`):
       - Columns: `id UUID`, `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`, `type TEXT CHECK (type IN ('new_episode', 'system', 'reward', 'security'))`, `title TEXT`, `message TEXT`, `payload JSONB`, `read_at TIMESTAMPTZ`, `created_at TIMESTAMPTZ`.
       - RLS policies: authenticated users can SELECT and UPDATE (`read_at`) their own rows; INSERT and DELETE restricted exclusively to `service_role`.
       - Trigger hooks: episode release hook (Task 16.3) querying favorited subscribers, and Telegram Bot bridge (`FUTURE_PLAN.md` §5.4).
  2. Component Gating & Bundle Isolation (`components/NotificationBell.tsx`):
     - Created `isNotificationsFeatureEnabled()` reading `process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS === "true"` (default `false`).
     - Replaced static top-level import of `notificationItems` from `@/data/notifications.mock` with dynamic `import("@/data/notifications.mock")` triggered strictly when the flag is enabled.
     - Component renders `null` when the feature flag is disabled.
     - Preserves React Rules of Hooks with unconditional hook execution before early returns.
  3. Header Navigation Gating (`components/header/HeaderActions.tsx`):
     - Gated `NotificationBell` rendering behind `isNotificationsEnabled && isLoggedIn && <NotificationBell />`.
     - When the flag is disabled, no bell icon renders in the header navigation bar.
  4. Automated Verification Test Suite (`__tests__/components/notification-bell.test.ts`):
     - Authored 7 tests verifying:
       - Default disabled state when `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` is unset, `"false"`, `"0"`, or `"off"`.
       - Activation only when strictly `"true"`.
       - HeaderActions conditional rendering contract.
       - NotificationBell export and early return contracts.
       - Zero top-level static value imports of mock notifications data in NotificationBell.
       - ADR-0002 schema, notification types, and Telegram bridge documentation contracts.
* **Key File Diffs**:
  - Created:
    - `docs/adr/0002-notifications-system-architecture.md`
    - `__tests__/components/notification-bell.test.ts`
  - Modified:
    - `components/NotificationBell.tsx`
    - `components/header/HeaderActions.tsx`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Test runner expanded to 292 tests across 79 test suites with 100% pass rate.
  - Production build cleanly compiled all 40 routes.
* **Verification**:
  - `npm test`: 292 / 292 tests pass across 79 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 40 pages with 0 errors.

---

## [2026-10-06] Task 12.1: Server-Side Pagination for Discovery Pages
* **Milestone**: Phase 12 (Functional Bug Fixes & Data Integrity) — Task 12.1
* **Goal**: Replace client-side slicing and default 12-item pagination limits across discovery pages with robust server-side pagination, URL query synchronization, stable tie-breakers (`.order("id")`), and direct channel ID filtering.
* **Implementation Steps Taken**:
  1. Content Service Query Engine (`lib/services/content.service.ts`):
     - Added `channelId` to `TitleQueryOptions`.
     - Prioritized filtering by `channel_id` (foreign key UUID) over denormalized display name to avoid drift when channels are renamed. Also supported resolving by `channelSlug`.
     - Replaced implicit 12-item default with explicit 24-item default grid, enforcing a strict maximum ceiling of 60 items per request (`Math.min(60, Math.max(1, requestedSize))`).
     - Injected deterministic secondary tie-breaker `.order("id", { ascending: true })` on trending (`views_count`), newest (`created_at`), and rating sorts to prevent row skipping or duplication across page boundaries.
     - Updated in-memory fallback `filterMockTitles` to match identical filtering, sorting tie-breakers, and pagination semantics.
  2. Channel Entity Model (`data/channels.mock.ts`, `lib/services/content.service.ts`):
     - Added `id?: string` to `Channel` interface and updated `mapChannelRowToChannel` to pass `id: row.id`.
  3. Discovery Pages Server-Side Pagination & URL Sync:
     - `/genres` (`app/genres/page.tsx`):
       - Loaded distinct available genres across entire catalog via `getDistinctGenres()`.
       - Querying via `searchPublishedTitles({ genre, page, pageSize: 24, sort: "trending" })`.
       - Synchronized `?genre=` and `?page=` to URL using `window.history.replaceState`.
       - Wrapped in `<Suspense>` boundary.
     - `/trending` (`app/trending/page.tsx`):
       - Replaced client-side array slice with `searchPublishedTitles({ sort: "trending", page, pageSize: 24 })`.
       - Synchronized `?page=` in URL.
       - Accurately computes rank overlay: `(page - 1) * PAGE_SIZE + index + 1`.
       - Wrapped in `<Suspense>` boundary.
     - `/new-release` (`app/new-release/page.tsx`):
       - Replaced client-side array slice with `searchPublishedTitles({ sort: "newest", page, pageSize: 24 })`.
       - Synchronized `?page=` in URL.
       - Wrapped in `<Suspense>` boundary.
     - `/channel/[slug]` (`app/channel/[slug]/page.tsx`):
       - Filtered directly by `channelId: resolvedChannel.id` with fallback to `channelSlug`.
       - Synchronized `?page=` in URL.
       - Wrapped in `<Suspense>` boundary.
  4. Automated Verification Test Suite (`__tests__/services/server-side-pagination.test.ts`):
     - Created 8 tests covering:
       - Default page size 24 with range `[0, 23]`.
       - Page 2 range `[24, 47]`.
       - Maximum 60-item page size capping.
       - Stable ID tie-breaker application on trending and newest sorts.
       - Strict `channel_id` UUID filtering.
       - Genre filtering.
       - Component contracts ensuring all 4 discovery pages call `searchPublishedTitles` and wrap search params in `<Suspense>`.
* **Key File Diffs**:
  - Created:
    - `__tests__/services/server-side-pagination.test.ts`
  - Modified:
    - `data/channels.mock.ts`
    - `lib/services/content.service.ts`
    - `app/genres/page.tsx`
    - `app/trending/page.tsx`
    - `app/new-release/page.tsx`
    - `app/channel/[slug]/page.tsx`
    - `ROADMAP.md`
    - `CHANGELOG-DEV.md`
* **Regression Analysis & Cross-System Impact**:
  - Test runner expanded to 300 tests across 84 test suites with 100% pass rate.
  - Production build cleanly compiled all 40 static and dynamic routes.
* **Verification**:
  - `npm test`: 300 / 300 tests pass across 84 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 40 pages with 0 errors.
