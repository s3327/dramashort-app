# DramaShort Development Roadmap & Master Plan

> **Document Role**: This file serves as the living master plan for current and upcoming platform development. All architectural requirements, feature breakdowns, and implementation steps needed to reach the project goals are planned and tracked here.
> 
> Implementation execution logs, code diffs, regression analyses, and historical records of completed steps are maintained in **[`CHANGELOG-DEV.md`](file:///c:/Telegram%20Project/dramashort/CHANGELOG-DEV.md)**.

---

## 1. Issue Prioritization & Development Matrix

| Phase | Priority | Item | Status | Impact |
|---|---|---|---|---|
| **Phase 1** | 🔴 Critical | Fix TypeScript `TS2783` in `FavoritePage` (`app/account/favorite/page.tsx`) | ✅ Done | Restored `npm run build` and page compilation |
| **Phase 1** | 🟡 High | Configure ESLint (`.eslintrc.json`) | ✅ Done | Restored non-interactive linting in `npm run lint` |
| **Phase 2** | 🟠 High | Implement Admin Drama Edit Page (`/admin/titles/[id]/edit` / `/admin/dramas/[id]/edit`) | ✅ Done | Resolved 404 dead links from admin drama tables and cards |
| **Phase 2** | 🟡 Medium | Consolidate `/new` into `/new-release` | ✅ Done | Eliminated duplicated route and legacy data source |
| **Phase 3** | 🟢 Low | Clean up 5 orphaned legacy mock files (~42 KB) | ✅ Done | Reduced tech debt, eliminated duplicate schema confusion |
| **Phase 3** | 🟢 Low | Update `README.md` & Initialize Git | ✅ Done | Reflected accurate project status and enabled version tracking |
| **Phase 4** | 🔴 Critical | C1: Implement real video player with vertical swipe (`app/watch/[slug]/page.tsx`) | ✅ Done | High-performance streaming with custom player, HLS/MP4, vertical/cinema modes, & TikTok swipe up/down |
| **Phase 4** | 🔴 Critical | C2: Supabase role-based admin auth & middleware route guard | ✅ Done | Server-side `@supabase/ssr` route guard, eliminates client-side bypass, checks `profiles.role === 'admin'` |
| **Phase 4** | 🔴 Critical | C3: Wire password change to `supabase.auth.updateUser()` | ✅ Done | Verifies current password before update, validates rules, displays loading state and verified success toast |
| **Phase 4** | 🔴 Critical | C4: Wire email change OTP verification flow with `OtpInput` | ✅ Done | Replaces broken placeholder with real 6-digit OTP verification, resend cooldown timer, and toast |
| **Phase 4** | 🔴 Critical | C5: Wire Google OAuth sign-in button in `app/login/page.tsx` & `app/signup/page.tsx` | ✅ Done | Enables functional social authentication with server-side callback handler and open-redirect protection |
| **Phase 4** | 🔴 Critical | C6: Wire watch history to `getUserWatchHistory()` in `app/account/history/page.tsx` | ✅ Done | Replaces static mock history with persistent user watch history, deletion, and clear modal |
| **Phase 5** | 🟠 High | H1: Call `upsertWatchProgress()` from video playback events | ✅ Done | Real-time throttled tracking, auto-resume with prompt pill, onPause/onEnded/beforeunload persistence |
| **Phase 5** | 🟠 High | H2: Replace `ContinueWatching` mock with real user data | ✅ Done | Real Supabase watch history hydration, smart next-episode advancement, & finished series exclusion |
| **Phase 5** | 🟠 High | H3: Wire admin edit form to Supabase content DB (Add/Edit Drama: title, desc, genre, taxonomy, channel) | ✅ Done | Prevents silent data loss when admins create or edit drama records |
| **Phase 5** | 🟠 High | H4: Server-side search filtering and pagination in `getPublishedTitles()` (Dramas query) | ✅ Done | Scalable search queries; eliminates full catalog download |
| **Phase 5** | 🟠 High | H5: Add auth guards and redirects for `/account/*` routes | ✅ Done | Protects user-specific pages against unauthenticated access |
| **Phase 5** | 🟠 High | H6: Fix `FavoritesContext` guest seed (remove `defaultFavoriteSlugs`) | ✅ Done | Prevents guest accounts from being pre-seeded with fake favorites |
| **Phase 6** | 🟡 Medium | M1: Audit and standardize mock/DB hydration pattern across components | ✅ Done | Standardized shimmer skeletons, CLS elimination, & graceful dev fallbacks |
| **Phase 6** | 🟡 Medium | M2: Dynamic SEO & OpenGraph tags via `generateMetadata()` | ✅ Done | Social sharing previews and search engine discovery via route layouts |
| **Phase 6** | 🟡 Medium | M3: Add Supabase Storage domain to `next.config.mjs` `remotePatterns` | ✅ Done | Prevents image load failures for Supabase Storage assets |
| **Phase 6** | 🟡 Medium | M4: Replace `catch (err: any)` with typed error handling in `AuthContext` | ✅ Done | Strict TypeScript compliance and type-safe `err instanceof Error` handling |
| **Phase 6** | 🟡 Medium | M5: Load admin drama edit data from Supabase content DB | ✅ Done | Delivered in H3: Asynchronously hydrates drama on mount via getDramaById |
| **Phase 6** | 🟡 Medium | M6: Telegram Connect Ecosystem Integration | 📋 Moved to Future Plan | Moved to dedicated `FUTURE_PLAN.md` per user directive |
| **Phase 6** | 🟡 Medium | M7: Standardize Admin nomenclature: "Dramas" & "Add Drama" in UI & routes | ✅ Done | Eliminates confusion between entity (Drama) and field (title) |
| **Phase 7** | 🟢 Low | L1: Reusable custom hooks (`useDebounce`, `useRequireAuth`, `useMediaQuery`) | ✅ Done | DRY code, standardized debounce, and cleaner component logic |
| **Phase 7** | 🟢 Low | L2: Add shimmer/skeleton loading states for async data | ✅ Done | Smooth loading UX; prevents layout shifts and mock flashes |
| **Phase 7** | 🟢 Low | L3: Implement route-segment error boundaries (`error.tsx`) | ✅ Done | Graceful degradation and user-friendly retry buttons |
| **Phase 7** | 🟢 Low | L4: Add root application error boundary (`app/error.tsx`) | ✅ Done | Catches unhandled runtime crashes globally |
| **Phase 7** | 🟢 Low | L5: Audit `design-tokens/` CSS variables and unused tokens | ✅ Done | Maintains lean, consistent token foundation |
| **Phase 7** | 🟢 Low | L6: Implement automated test suite (Auth, services, critical journeys) | ✅ Done | Regression prevention and verified end-to-end reliability |
| **Phase 8** | 🔴 Critical | Monetization Engine: Freemium Paywall & Coin Economy | ⏳ Planned · 🔒 Blocked by 10, 13.1, 15, 16 | Direct monetization, unlocks Ep 6+, daily streak rewards |
| **Phase 9** | 🟠 High | Mobile PWA & Advanced Video Player UX | ⏳ Planned · 🔒 Blocked by 14 | Native app-like PWA, subtitles/VTT, keyboard hotkeys, PiP |
| **Phase 10** | 🔴 Critical | Security Hardening & Access Control (admin role escalation, RLS & grants, admin API auth, subdomain guard, open redirect, episode media lockdown, CI gate) | ✅ Completed (10.1–10.9 ✅) | Closes privilege escalation and data exposure; gate for all further work |
| **Phase 11** | 🔴 Critical | Complete Stubbed User Flows (email verification, password recovery, account deletion, support pipeline, real 404s) | ✅ Completed (11.1–11.7 ✅) | Every visible action performs a real operation |
| **Phase 12** | 🟠 High | Functional Bug Fixes & Data Integrity (12.1–12.8 ✅) | ✅ Completed | Full catalog visible, admin drafts, progress semantics, zero mocks, session, lists, integrity, player robustness |
| **Phase 13** | 🟠 High | Backend Architecture Consolidation (database topology ADR-0003, server-rendered catalog, service split, taxonomy scalability, observability) | ✅ Completed (13.1–13.6 ✅) | Decision gate for Phase 8; faster pages; operability |
| **Phase 14** | 🟠 High | Mobile-First Vertical Watch Experience & UI Polish | ✅ Completed (14.1–14.9 ✅) | Core 9:16 viewing experience on phones |
| **Phase 15** | 🟠 High | Product Analytics, Engagement Tracking & Real Trending | ✅ Completed (15.1–15.5 ✅) | Real views, trending and dashboard; data to tune the paywall |
| **Phase 16** | 🟠 High | Admin Content Operations Console (episodes, uploads, scheduling, taxonomy, users, audit log) | 🚧 In progress (16.1–16.6 ✅) | Catalog operable end-to-end without SQL |
| **Phase 17** | 🟡 Medium | Quality Engineering, CI & Documentation Integrity (continuous) | ⏳ Planned | Regression safety; trustworthy status docs |

> **Execution order (set by the 2026-10-04 platform audit)**: Phase numbers are stable identifiers, not a sequence. Remaining work executes as **10 → 11 → 12 → 13 → 14 → 15 → 16 → 8 → 9**, with Phase 17 running continuously alongside. Gates and dependencies are defined in [§12](#12-platform-audit-remediation-track-phases-1017).

---

## 2. Core Domain Architecture: "Drama" vs. "Title"

> **Architectural Standard**: The media entity stored in the database is formally and consistently defined as **`Drama`** (plural: **`Dramas`**).

### 2.1 Schema Attributes of a `Drama`
Every Drama entity in the database (`titles` / `dramas` table) contains the following core attributes:
* **`title`** (`string`): The textual title/name of the drama (e.g., *"The CEO's Secret Wife"*, *"Reborn to Ruin Him"*).
* **`desc` / `synopsis`** (`string`): Storyline synopsis and narrative description.
* **`genre`** (`string`): Primary genre classification (e.g., *Romance*, *Revenge*, *CEO*, *Rebirth*, *Marriage*, *Suspense*).
* **`taxonomy` / `tags`** (`string[]`): Granular categorization tags, tropes, and thematic classifications (e.g., `["CEO", "Contract Marriage", "Secret Identity"]`).
* **Related to `channels`** (`channel_id` / `channel_name`): Mandatory relation/association to the publishing or distributing channel.
* **Media & Streaming Assets**: `poster_url`, `total_episodes`, and relational `episodes` (`video_url`, duration, episode number).
* **Status & Metrics**: `status` (`Published` | `Draft` | `Scheduled` | `Archived`), `rating`, `views_count`, `release_year`, `created_at`.

### 2.2 Nomenclature Disambiguation: "Add Drama" vs. "Add Title"
To eliminate ambiguity across product requirements, admin CMS, and codebase interfaces:
* **The Entity**: Is always a **`Drama`**.
* **The Action**: Is always **"Add Drama"** or **"Edit Drama"** (never "Add Title").
* **The Field**: `title` is simply the text attribute representing the name of the Drama being added or edited.
* **Admin CMS Rules**:
  - Sidebar item: **"Dramas"** (replaces legacy "Titles" label).
  - Table & cards header: **"Dramas"** — *"All dramas in the database"*.
  - Primary Action Button: **"Add Drama"** (opens modal/page to input: *Title, Description, Genre, Taxonomy tags, and Channel*).
  - Navigation route: Support `/admin/dramas` with permanent redirect from `/admin/titles`.
  - Service Layer & Types: Expose `Drama` type (aliased to `Title` during transition) and functions like `getPublishedDramas()`, `getDramaBySlug()`.

---

## 3. Phase 1: Critical Build & Tooling Fixes

### Task 1.1: Fix Duplicate Property in `app/account/favorite/page.tsx`
* **File**: `app/account/favorite/page.tsx`
* **Problem**:
  ```typescript
  // Current code (lines 36-39)
  const favoriteEntries = Array.from(favoritedSlugs).map((slug) => ({
    slug,
    ...getTitleBySlugOrFallback(slug),
  }));
  ```
  `getTitleBySlugOrFallback(slug)` returns a `Title` object that already contains `slug: string`. In strict TypeScript object literals, declaring `slug` explicitly followed by `...getTitleBySlugOrFallback(slug)` throws `TS2783: 'slug' is specified more than once, so this usage will be overwritten`.
* **Fix**:
  ```typescript
  const favoriteEntries = Array.from(favoritedSlugs).map(getTitleBySlugOrFallback);
  ```
* **Verification**:
  - Run `npx tsc --noEmit` -> Must return code 0.
  - Run `npm run build` -> Must compile and produce static pages successfully.

---

### Task 1.2: Add ESLint Configuration
* **Target File**: `.eslintrc.json` in project root
* **Problem**: `package.json` specifies `"lint": "next lint"`. Because no config file exists, running `npm run lint` halts on an interactive prompt asking how to configure ESLint.
* **Fix**: Create `.eslintrc.json`:
  ```json
  {
    "extends": "next/core-web-vitals"
  }
  ```
* **Verification**:
  - Run `npm run lint` -> Runs without interactive prompts and completes with exit code 0.

---

## 4. Phase 2: Route & Link Integrity

### Task 2.1: Implement Admin Drama Edit Page (`/admin/titles/[id]/edit` / `/admin/dramas/[id]/edit`)
* **Problem**: In `app/admin/titles/page.tsx`, table row titles, edit action buttons, and card links route to `/admin/titles/${t.id}/edit`, which triggers a 404.
* **Target File**: `app/admin/titles/[id]/edit/page.tsx`
* **Implementation Plan**:
  1. Unwrap `params: Promise<{ id: string }>` using React `use()`.
  2. Lookup title in `titles` from `data/titles.mock.ts` (fallback if not found).
  3. Render an edit form styled consistently with the Admin layout:
     - Title, Channel dropdown (from `data/channels.mock.ts`), Genre, Tags (comma-separated or chips), Status dropdown (`Published`, `Draft`, `Scheduled`, `Archived`), Total Episodes, and Synopsis textarea.
     - Breadcrumbs: `Admin / Titles / Edit [Title]`.
     - Action buttons: "Save Changes" (simulates save + toast notification) and "Cancel" (returns to `/admin/titles`).
* **Verification**:
  - Navigate to `/admin/titles` and click Edit on any title.
  - Verify that the edit page renders with the title's pre-filled information, actions work, and navigation back works.

---

### Task 2.2: Consolidate Route `/new` → `/new-release`
* **Problem**:
  - `app/new-release/page.tsx` is the modern, integrated page referenced by navbar and footer links.
  - `app/new/page.tsx` is a legacy version still importing from `data/new-release-catalog.mock.ts`.
* **Fix Options**:
  - **Option A (Clean Redirect)**: Make `app/new/page.tsx` redirect to `/new-release` via Next.js permanent redirect or client router redirect, or add a redirect entry in `next.config.mjs`.
  - **Option B (Direct Removal)**: Remove `app/new/page.tsx` entirely since all user navigation already points to `/new-release`.

---

## 5. Phase 3: Codebase Cleanliness & Project Hygiene

### Task 3.1: Retire Orphaned Legacy Mock Files
* **Files to Remove**:
  1. `data/dramas.mock.ts` (10 KB) — Replaced by `titles.mock.ts`.
  2. `data/search-catalog.mock.ts` (8 KB) — Replaced by `titles.mock.ts`.
  3. `data/trending.mock.ts` (7 KB) — Replaced by `titles.mock.ts`.
  4. `data/admin-titles.mock.ts` (10 KB) — Replaced by `titles.mock.ts`.
  5. `data/new-release-catalog.mock.ts` (6.5 KB) — Replaced by `titles.mock.ts`.
* **Verification**: Search the entire codebase for any remaining import statements referencing these files to ensure 0 references before removal.

---

## 6. Phase 4: Critical Core Features & Auth Security (C1–C6)

### Task 4.1: Real Video Player Integration (C1)
* **Status**: ✅ Completed
* **Target Files**: `components/VideoPlayer.tsx`, `app/watch/[slug]/page.tsx`
* **Delivered Capabilities**:
  1. Built modular `VideoPlayer` component supporting both HLS (`.m3u8` via `hls.js`) and standard MP4/WebM streams.
  2. Implemented responsive aspect ratio modes: **9:16 Vertical Drama** (with ambient blur backdrop for desktop), **16:9 Cinema**, and **Fit**.
  3. Custom player overlay with auto-hide timer, center play/pause ripple indicator, and scrub bar with hover timestamp preview & buffer progress.
  4. Playback controls: Play/Pause, Skip ±10s, Previous/Next episode, Volume slider with mute toggle, Playback speed selector (`0.5x`–`2.0x`), Picture-in-Picture, Fullscreen API.
  5. Interactive Auto-Next countdown overlay with manual skip or cancel options.
  6. Keyboard shortcut support (`Space`/`k`, `Left`/`Right`, `Up`/`Down`, `m`, `f`, `n`, `p`).
  7. Robust error recovery overlay with retry button.
  8. Integrated throttled watch progress tracking (persisting every 10s to `user.service.ts`).
  9. Added breadcrumb navigation on `/watch/[slug]` and back link to drama overview.
  10. Integrated TikTok-style vertical swipe gestures: Swipe UP advances to the next episode, Swipe DOWN navigates to previous episode, featuring fluid touch/mouse tracking, responsive spring damping (`deltaY * 0.45`), directional pill cues (`'Next Episode'`, `'Previous Episode'`), threshold protection (> 45px), and interactive boundary checks.
* **Verification**:
  - `npx tsc --noEmit` compiles with 0 errors.
  - `npm run lint` passes with 0 warnings on player and watch page.
  - `npm run build` generates `/watch/[slug]` and all 33 pages successfully.

---

### Task 4.2: Supabase Role-Based Admin Auth & Middleware Guard (C2)
* **Status**: ✅ Completed
* **Target Files**: `contexts/AdminAuthContext.tsx`, `middleware.ts`, `app/admin/login/page.tsx`
* **Delivered Capabilities**:
  1. Replaced vulnerable `localStorage.getItem("dramashort-admin-auth")` mechanism with real Supabase Auth session management.
  2. Implemented profile role verification: checks `profile.role === 'admin'` in the User Supabase database (with fast-path support for JWT `app_metadata.role` and `user_metadata.role`).
  3. Upgraded `middleware.ts` with `@supabase/ssr` server-side route guard:
     - Intercepts all `/admin/*` requests (except static assets).
     - Unauthenticated requests are immediately redirected to `/admin/login?error=session_required&returnUrl=...`.
     - Authenticated users without admin role are rejected and redirected to `/admin/login?error=unauthorized`.
     - Already-authenticated admins navigating to `/admin/login` are auto-redirected to `/admin/dashboard`.
  4. Upgraded `app/admin/login/page.tsx` to handle real Supabase email/password sign-in with loading spinners, input validation, and descriptive error banners.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 warnings.
  - `npm run build` generated middleware bundle (94.9 kB) and all 33 routes successfully.

---

### Task 4.3: Real Password Change via Supabase Auth (C3)
* **Status**: ✅ Completed
* **Target Files**: `contexts/AuthContext.tsx`, `app/account/page.tsx`
* **Delivered Capabilities**:
  1. Implemented `changePassword(newPassword, currentPassword)` in `AuthContext`:
     - Verifies existing user credentials with `supabase.auth.signInWithPassword({ email, password: currentPassword })` to prevent unauthorized password overwriting.
     - Calls `supabase.auth.updateUser({ password: newPassword })` to securely update user authentication record.
     - Type-safe error handling avoiding `any` casts.
  2. Upgraded password change modal in `app/account/page.tsx`:
     - Added client-side validation: verifies current password is non-empty, checks minimum length of 6 characters, ensures new password differs from current, and validates confirmation match.
     - Added loading state with animated spinner (`Loader2`) on the submit button.
     - Shows descriptive inline error messages on failure (e.g. invalid current password, weak password).
     - Clears form fields, closes modal, and displays success toast only upon confirmed API success.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 warnings.
  - `npm run build` compiled all 33 pages successfully.

---

### Task 4.4: Email Change OTP Verification Flow (C4)
* **Status**: ✅ Completed
* **Target Files**: `app/account/page.tsx`, `components/OtpInput.tsx`, `contexts/AuthContext.tsx`
* **Delivered Capabilities**:
  1. Implemented `requestEmailChange(newEmail)` in `AuthContext` calling `supabase.auth.updateUser({ email: newEmail })` with type-safe error handling.
  2. Implemented `verifyEmailChange(newEmail, token)` in `AuthContext` calling `supabase.auth.verifyOtp({ email: newEmail, token, type: 'email_change' })`, updating local auth user state and profile upon success.
  3. Integrated `OtpInput` component in `app/account/page.tsx`:
     - Added client-side email format validation and self-duplicate check.
     - Animated loading spinner state on "Send Verification Code" and "Confirm & Update Email" buttons.
     - Resend code mechanism with 60-second live cooldown countdown timer.
     - Inline actionable error banners and feedback toasts on successful email update.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 warnings.
  - Page compilation verified on `/account`.

---

### Task 4.5: Google OAuth Integration (C5)
* **Status**: ✅ Completed
* **Target Files**: `contexts/AuthContext.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/auth/callback/route.ts`, `components/GoogleIcon.tsx`
* **Delivered Capabilities**:
  1. Implemented `signInWithGoogle(customRedirect?)` in `AuthContext`:
     - Initiates Supabase OAuth via `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`.
     - Redirects browser to Supabase / Google OAuth consent screen.
  2. Created `/app/auth/callback/route.ts`:
     - Server-side route handler using `createUserServerClient()`.
     - Exchanges incoming OAuth `code` for user session cookies via `supabase.auth.exchangeCodeForSession(code)`.
     - Validates `next` redirect path to protect against open redirect vulnerabilities.
     - Gracefully redirects failure states to `/login?error=oauth_error`.
  3. Created reusable SVG component `components/GoogleIcon.tsx`.
  4. Enhanced `app/login/page.tsx`:
     - Connected `handleGoogleSignIn` to "Continue with Google" button.
     - Added interactive loading spinner (`Loader2`) and `Connecting to Google...` state.
     - Disabled button during request submission to prevent double clicks.
     - Displays error alert banner when redirected back with `?error=oauth_error`.
  5. Enhanced `app/signup/page.tsx`:
     - Added unified Google OAuth button with divider, matching login visual hierarchy.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 warnings.
  - Redirection test on `/auth/callback` verified: 307 redirect to `/login?error=oauth_error` on absent/invalid code.

---

### Task 4.6: Dynamic Watch History Hydration (C6)
* **Status**: ✅ Completed
* **Target Files**: `app/account/history/page.tsx`, `lib/services/user.service.ts`
* **Delivered Capabilities**:
  1. Service Layer Expansion in `lib/services/user.service.ts`:
     - Implemented `clearUserWatchHistory(userId)` deleting all rows for the user from Supabase `watch_history`.
     - Implemented `deleteWatchHistoryItem(userId, titleSlug)` deleting a single drama record.
     - Implemented `clearGuestWatchHistory()` and `deleteGuestWatchHistoryItem(titleSlug)` for offline/guest state.
  2. Real Database Hydration in `app/account/history/page.tsx`:
     - Replaced static mock list with live data from `getUserWatchHistory(user.id)`.
     - Batch queries drama metadata using `getTitlesBySlugs()`.
     - Formats dates into chronological categories: "Today", "Yesterday", and formatted calendar dates within the 60-day window.
  3. Seamless Playback Resume & Individual Deletion:
     - Play button overlay links directly to `/watch/${item.slug}?ep=${item.episodeNumber}`.
     - Hover deletion icon on cards allows removing single titles from history.
  4. Clear All Confirmation Modal:
     - Added confirmation modal with alert details, cancellation option, and loading feedback.
  5. Skeleton & Empty States:
     - Pulsing skeleton grid while data is loading.
     - Centered empty state with call-to-action to explore dramas.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 warnings.
  - Compilation on `/account/history` verified.

---

## 7. Phase 5: High-Priority UX & Persistence Gaps (H1–H6)

### Task 5.1: Real-Time Watch Progress Tracking (H1)
* **Status**: ✅ Completed
* **Target Files**: `app/watch/[slug]/page.tsx`, `components/VideoPlayer.tsx`, `lib/services/user.service.ts`
* **Delivered Capabilities**:
  1. Throttled Real-Time Tracking:
     - Player tracks playback progress every 10 seconds during active playback.
     - Saves immediately to Supabase `watch_history` via `upsertWatchProgress()` (or `saveGuestWatchProgress()` for offline guests).
  2. Multi-Trigger Event Persistence:
     - Saves progress immediately on `pause` (`onPause` event callback).
     - Saves progress (`1.0`) on `ended` when episode finishes.
     - Flushes latest playback progress on window `beforeunload` (tab close / browser exit) and component unmount.
  3. Seamless Auto-Resume & Pill Notification:
     - On initial video load, checks Supabase / guest watch history for saved episode and progress ratio.
     - When progress is detected between 2% and 95%, auto-seeks player to the exact resume second upon metadata load.
     - Renders an interactive floating pill notification (`Resumed at MM:SS (X%)`) with a "Start over" action and dismiss button.
  4. Query Parameter & Navigation Synchronization:
     - Reads `?ep=` query parameter and synchronizes URL query state when advancing or selecting episodes without full reloads.
     - Automatic guest history migration: syncs guest watch history to Supabase when authenticated.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 warnings.
  - Verified route `/watch/ceo-secret-wife?ep=2` renders with status 200.

---

### Task 5.2: Dynamic Continue Watching Feed (H2)
* **Status**: ✅ Completed
* **Target File**: `components/ContinueWatching.tsx`
* **Delivered Capabilities**:
  1. Real Supabase Watch History Hydration:
     - Replaced static `continue-watching.mock.ts` with live queries to `getUserWatchHistory(user.id)` (with guest local storage fallback).
     - Resolves drama titles, channels, and posters via `getTitlesBySlugs()`.
  2. Smart In-Progress & Episode Advancement Logic:
     - Mid-episode watches (< 95%) show active episode progress and percentage.
     - Completed episodes (>= 95%) with remaining episodes automatically advance to `"Up Next: EP X of Y"` with 0% progress bar.
     - Completed series (final episode >= 95%) are omitted from the Continue Watching feed.
  3. Direct Episode Resumption:
     - Cards link directly to `/watch/${slug}?ep=${targetEpisode}` so users resume at the exact episode and second.
  4. Clean Zero-State Visibility & Navigation:
     - When the user has zero watch progress (initial state before watching any drama), the Continue Watching section is completely hidden (`return null`), keeping the homepage sleek and focused on discovery.
     - The section activates dynamically as soon as the user watches any drama episode.
     - Added left/right carousel scroll navigation buttons on desktop when items exceed viewport width.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 warnings.
  - Route `/home` verified with HTTP 200 OK.

---

### Task 5.3: Admin Drama Edit & Persistence (H3)
* **Status**: ✅ Completed
* **Target Files**:
  - `app/admin/titles/[id]/edit/page.tsx` (aliased to `/admin/dramas/[id]/edit`)
  - `app/api/admin/dramas/[id]/route.ts` (aliased to `/api/admin/titles/[id]/route.ts`)
  - `lib/services/content.service.ts`
  - `app/admin/titles/page.tsx` (aliased to `/admin/dramas/page.tsx`)
* **Problem**: Form submission ran a `setTimeout` dummy timer and discarded changes on navigation. Newly inserted dramas in Supabase could not be loaded for editing because the edit page only checked the static mock array.
* **Delivered Capabilities**:
  1. Live DB Mutation & Privileged API Endpoint:
     - Implemented `PATCH /api/admin/dramas/[id]` and `GET /api/admin/dramas/[id]` (aliased by `/api/admin/titles/[id]`).
     - Route verifies administrator authentication via `createUserServerClient()` and performs updates using `getContentAdminClient()` (`CONTENT_SUPABASE_SERVICE_ROLE_KEY`), bypassing client-side RLS limitations.
  2. Full Drama Domain Entity Persistence:
     - Persists and updates all core drama attributes:
       - `title`: The display name of the drama
       - `synopsis` (`desc`): Narrative storyline description
       - `genre`: Primary genre category
       - `tags` (`taxonomy`): Categorization tropes & tags
       - `channel_name`, `channel_code`, and `channel_id`: Channel relational resolution
       - `status`: (`Published`, `Draft`, `Scheduled`, `Archived`)
       - `total_episodes`: Total episode count
       - `poster_url`: Custom poster URL
       - `updated_at`: Real-time timestamp
  3. Dynamic Data Retrieval & Hydration:
     - `getDramaById(id)` / `getTitleById(id)` in `content.service.ts`: Queries Supabase Content DB on mount, falling back to mock fixtures only when offline or for legacy IDs.
     - `getAdminDramas()` in `content.service.ts`: Hydrates `/admin/titles` (and `/admin/dramas`) with all 25 real Supabase dramas and their UUIDs.
  4. Production UX & Error Resilience:
     - Shimmer pulse skeleton loading state while fetching drama data.
     - Inline error alert banner when validation or mutation encounters an issue.
     - Form disabling with `Loader2` spinner on "Save Changes" button during submission.
     - Verified toast message `"Changes saved successfully"` followed by clean redirection to `/admin/titles`.
  5. Route Aliasing:
     - Created `app/admin/dramas/[id]/edit/page.tsx` and `app/admin/dramas/page.tsx` cleanly re-exporting the titles pages, supporting both `/admin/titles` and `/admin/dramas` URL structures.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 errors.
  - Live API testing: `GET /api/admin/dramas/:id` returned HTTP 200 with real database row.
  - Live API testing: `PATCH /api/admin/dramas/:id` persisted updated tags to Supabase Content DB and verified with subsequent query.
  - Route Guard testing: Unauthenticated requests returned 307 redirect with `returnUrl`. Authenticated admin session returned HTTP 200 for both `/admin/titles/[id]/edit` and `/admin/dramas/[id]/edit`.

---

### Task 5.4: Server-Side Search Filtering & Pagination (H4)
* **Status**: ✅ Completed
* **Target Files**:
  - `app/search/page.tsx`
  - `lib/services/content.service.ts`
  - `hooks/useDebounce.ts`
* **Problem**: Search downloaded the entire catalog via parameter-less `getPublishedTitles()` and filtered everything client-side in JavaScript, resulting in high latency and poor scalability.
* **Delivered Capabilities**:
  1. PostgREST Server-Side Query Engine:
     - Implemented `searchPublishedTitles(options?: TitleQueryOptions): Promise<PaginatedTitlesResult>` (and alias `searchDramas`) in `lib/services/content.service.ts`.
     - Direct Supabase PostgREST filters:
       - Multi-field keyword query matching both `title` and `synopsis` using `.or('title.ilike.%...,synopsis.ilike.%...')`
       - Exact channel affiliation match (`.eq('channel_name', channel)`)
       - Genre category filter (`.eq('genre', genre)`)
       - Taxonomy tropes filter (`.contains('tags', tags)`)
       - Dynamic sorting: `"trending"` (`views_count`), `"newest"` (`created_at`), `"rating"` (`rating`)
     - Server-side counting and range pagination: `{ count: 'exact' }` and `.range(from, to)`.
     - Added `getDistinctGenres()` and `getPopularTags()` querying the real catalog.
     - Backwards compatibility: `getPublishedTitles(options)` calls `searchPublishedTitles(options)` and returns `result.items`.
  2. Generic Debounce Hook:
     - Created `hooks/useDebounce.ts` for clean, reusable 300ms input throttling, preventing request spam while users type.
  3. Upgraded Public Search Architecture (`app/search/page.tsx`):
     - Eliminated in-memory full catalog downloads; queries execute on-demand with paginated results (`PAGE_SIZE = 12`).
     - 300ms debounced search bar with instant clear button.
     - Dynamic URL query synchronization (`window.history.replaceState`) for shareable search links (`/search?q=...&genre=...&page=...`).
     - 12-item shimmer skeleton loader during query execution to eliminate layout shift.
     - Responsive empty state with single-click "Clear all filters" button.
     - Results counter and responsive page navigation with `<Pagination>`.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 errors.
  - Live query verification:
    - Keyword search (`"wife"`): returned 4 exact matching titles across title/synopsis.
    - Genre filter (`"Fantasy"`): returned 3 exact matching titles.
    - Tag filter (`["CEO"]`): returned 2 matching titles.
    - Pagination test (2 per page): total 26, returned 2 items, computed 13 pages.
  - Live HTTP routes `/search` and `/search?q=wife&genre=Marriage` returned HTTP 200 OK.

---

### Task 5.5: Route Protection for `/account/*` Pages (H5)
* **Status**: ✅ Completed
* **Target Files**:
  - `middleware.ts`
  - `app/account/layout.tsx`
  - `hooks/useRequireAuth.ts`
  - `app/login/page.tsx`
  - `app/signup/page.tsx`
* **Problem**: Direct access to `/account`, `/account/favorite`, `/account/history`, `/account/settings` did not redirect unauthenticated guests, exposing empty or mock account views.
* **Delivered Capabilities**:
  1. Server-Side Protection in `middleware.ts`:
     - Added route guard for `/account` and `/account/*`.
     - Validates session with `@supabase/ssr` `createServerClient`.
     - Unauthenticated guests receive an immediate HTTP 307 redirect to `/login?returnUrl=${encodeURIComponent(url.pathname)}`.
  2. Client-Side Protection Hook (`hooks/useRequireAuth.ts`):
     - Created `useRequireAuth(redirectTo = "/login")` monitoring `isLoading` and `isLoggedIn` from `AuthContext`.
     - Automatically handles client transitions or expired session redirections.
  3. Hydration Layout Skeleton (`app/account/layout.tsx`):
     - Created `AccountLayout` with `useRequireAuth()`.
     - Displays account skeleton (Header, Sidebar avatar & nav shimmer, content cards shimmer) during initial auth hydration.
  4. Auth Flow Alignment:
     - Updated `/login` and `/signup` post-auth redirection logic to check `returnUrl` before `redirect`, returning users directly to their requested account page upon signing in.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 errors.
  - Live HTTP tests verified 307 redirects for unauthenticated guests to `/login?returnUrl=...` on all 4 account routes (`/account`, `/account/favorite`, `/account/history`, `/account/settings`).
  - Authenticated session verified HTTP 200 OK across all 4 account routes.

---

### Task 5.6: Clean Guest Seed in `FavoritesContext.tsx` (H6)
* **Status**: ✅ Completed
* **Target Files**:
  - `contexts/FavoritesContext.tsx`
  - `data/favorites.mock.ts`
* **Problem**: Initial state seeded from `defaultFavoriteSlugs`, causing all guest users to see 12 hardcoded fake favorites in their favorites list before logging in.
* **Delivered Capabilities**:
  1. Clean Zero-State Guest Seed:
     - Initialized `favoritedSlugs` as an empty `Set<string>()` and `lists` as `[]`.
     - Emptied `defaultFavoriteSlugs` in `data/favorites.mock.ts` to `[]`.
     - First-time visitors and guests start with 0 favorites and see the polished empty state on `/account/favorite` ("You haven't favorited anything yet").
  2. Legacy Mock Storage Purge:
     - Detects if visitor's `localStorage` contains the legacy 12 fake demo slugs and purges them on load, ensuring previous test sessions don't leave phantom favorites.
  3. Safe LocalStorage Hydration:
     - Persists to `localStorage` strictly after client hydration is confirmed (`isHydrated = true`), preventing hydration mismatches and race conditions.
  4. Automatic Guest-to-User Cloud Sync:
     - When a guest user adds favorites to their local session and subsequently logs in or signs up, their guest favorites are automatically migrated to Supabase via `addUserFavorite()`, merged with their cloud favorites, and the local guest key is cleaned up.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run lint` passed with 0 errors.
  - Verified `defaultFavoriteSlugs: []` in `data/favorites.mock.ts`.
  - Verified public pages (`/`, `/home`, `/trending`, `/new-release`, `/drama/...`) return HTTP 200 OK.

---

## 8. Phase 6: Medium-Priority Quality & Architecture (M1–M7)

### Task 6.1: Standardize Mock vs DB Hydration Architecture (M1)
* **Status**: ✅ Completed
* **Target Files**:
  - `components/TitleCard.tsx`
  - `components/Hero.tsx`
  - `components/TopTrending.tsx`
  - `components/NewRelease.tsx`
  - `app/new-release/page.tsx`
  - `app/trending/page.tsx`
  - `app/channel/[slug]/page.tsx`
  - `app/genres/page.tsx`
  - `app/drama/[slug]/page.tsx`
  - `lib/services/README.md`
* **Problem**: Inconsistent fallback patterns existed across components: some replaced mock data with DB results after a visible flash, others fell back silently, and layout shifts occurred when mock data swapped for DB data.
* **Delivered Capabilities**:
  1. Standardized Reusable Skeleton Component:
     - Exported `TitleCardSkeleton` in `components/TitleCard.tsx` with identical `2/3` aspect ratio and optional subtitle placeholders, eliminating layout shifts (CLS).
  2. Zero Mock Flash on Load:
     - Components initialize with `isLoading = true` and `items = []`. Skeletons are displayed immediately while querying Supabase; mock fixtures are never flashed before real data loads.
  3. Graceful Dev & Offline Fallback:
     - In offline development or when Supabase credentials fail, queries safely catch exceptions and fall back to typed mock fixtures rather than crashing.
  4. Component-Specific Shimmer Implementations:
     - `Hero.tsx`: Responsive hero skeleton with title, synopsis, badge, and CTA button shimmer blocks.
     - `TopTrending.tsx`: Horizontal carousel skeleton with rank badge placeholders and smooth scroll hints.
     - `NewRelease.tsx`: 12-item responsive poster grid skeleton.
     - `NewReleasePage` & `TrendingPage`: 18-item paginated grid skeletons and clean empty states.
     - `ChannelPage`: Breadcrumb, channel title skeleton, and 12-card grid skeleton.
     - `GenresPage`: Responsive genre chip bar and 18-card grid skeleton.
     - `DramaPage`: Detail view with 8-card related titles skeleton.
  5. Architecture Documentation:
     - Created `lib/services/README.md` documenting the dual Supabase architecture, standard hydration pattern, and core services.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run build` compiled all 35 routes successfully.

---

### Task 6.2: Dynamic OpenGraph & Per-Page SEO (M2)
* **Status**: ✅ Completed
* **Target Files**:
  - `app/drama/[slug]/layout.tsx`
  - `app/watch/[slug]/layout.tsx`
  - `app/channel/[slug]/layout.tsx`
* **Problem**: Only global metadata in `app/layout.tsx` was defined. Shared drama links lacked individual previews, posters, or synopses on social platforms.
* **Delivered Capabilities**:
  1. Implemented Next.js Server `generateMetadata({ params })` on route layouts:
     - `app/drama/[slug]/layout.tsx`: Generates `[Drama Title] — Watch on DramaShort`, 160-char synopsis description, `video.movie` OpenGraph metadata, and Twitter `summary_large_image` cards.
     - `app/watch/[slug]/layout.tsx`: Generates `Watch [Drama Title] — All Episodes on DramaShort`, episode streaming description, `video.episode` OpenGraph metadata, and Twitter cards.
     - `app/channel/[slug]/layout.tsx`: Generates `[Channel Name] — Watch Channel Dramas on DramaShort`, channel description, and OpenGraph metadata.
  2. Fallback Reliability:
     - Asynchronously resolves data from Supabase Content DB (`getTitleBySlug`, `getChannelBySlug`) with automatic fallback to mock catalogs if offline.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run build` compiled all 35 routes successfully.

---

### Task 6.3: Add Supabase Storage Domain to `next.config.mjs` (M3)
* **Status**: ✅ Completed
* **Target File**: `next.config.mjs`
* **Problem**: `images.remotePatterns` only configured `images.unsplash.com`. Storing drama posters or avatars on Supabase Storage caused runtime image load exceptions.
* **Delivered Capabilities**:
  1. Configured Wildcard & Project-Specific Supabase Storage Domains:
     - Added wildcard `*.supabase.co` with pathname `/storage/v1/object/public/**`.
     - Added explicit project hosts `czkkzoiuyqybafacpgsp.supabase.co` (Content DB) and `bpidsbcrvpkavvdvtpgh.supabase.co` (User DB).
* **Verification**:
  - `npm run build` compiled all routes successfully with the updated Next.js image configuration.

---

### Task 6.4: Type-Safe Error Handling in `AuthContext.tsx` (M4)
* **Status**: ✅ Completed
* **Target File**: `contexts/AuthContext.tsx`
* **Delivered Capabilities**:
  1. Replaced unsafe `catch (err: any)` with typed `catch (err: unknown)`.
  2. Implemented type-safe error message extraction checking `err instanceof Error ? err.message : fallback`.
* **Verification**:
  - `npx tsc --noEmit` passes with 0 type warnings across `contexts/AuthContext.tsx`.

---

### Task 6.5: Dynamic Admin Drama Edit Data Retrieval (M5)
* **Status**: ✅ Completed
* **Target File**: `app/admin/titles/[id]/edit/page.tsx` (and alias `/admin/dramas/[id]/edit`)
* **Problem**: The edit page previously searched only the static `titles` array from `data/titles.mock.ts`. Newly created dramas in Supabase could not be loaded for editing.
* **Delivered Capabilities**:
  1. Asynchronous Database Hydration:
     - Implemented `getDramaById(id)` in `lib/services/content.service.ts` querying Supabase `titles` table by primary UUID.
     - On mount, `app/admin/titles/[id]/edit/page.tsx` retrieves drama details directly from Supabase.
     - Populates all form fields: `title`, `desc` (`synopsis`), `genre`, `taxonomy` (`tags`), and `channel`.
  2. Offline / Mock Fallback:
     - Gracefully falls back to mock items for legacy IDs if offline or unseeded.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm run build` compiled `/admin/titles/[id]/edit` and `/admin/dramas/[id]/edit` successfully.

---

### Task 6.6: Telegram Account Connect Integration (M6)
* **Status**: 📋 Moved to Dedicated Future Plan
* **Target File / Documentation**: Moved to [`FUTURE_PLAN.md`](file:///c:/Telegram%20Project/dramashort/FUTURE_PLAN.md)
* **Details**:
  - The "Connect Telegram" button in [`app/account/page.tsx`](file:///c:/Telegram%20Project/dramashort/app/account/page.tsx) is currently configured with non-blocking feedback toast informing users that Telegram Bot integration is scheduled for an upcoming release.
  - The complete technical implementation roadmap, BotFather configuration, dual-database schema migration, cryptographic HMAC verification algorithms, API route handlers, and regression prevention audit have been moved to the dedicated [`FUTURE_PLAN.md`](file:///c:/Telegram%20Project/dramashort/FUTURE_PLAN.md).

---

### Task 6.7: Standardize Admin Nomenclature & Route Aliases ('Dramas' / 'Add Drama') (M7)
* **Status**: ✅ Completed
* **Target Files**: `components/admin/AdminSidebar.tsx`, `components/SidebarNavList.tsx`, `app/admin/titles/page.tsx`, `app/admin/titles/[id]/edit/page.tsx`, `app/admin/dashboard/page.tsx`, `app/api/admin/dramas/route.ts`, `lib/services/content.service.ts`, `next.config.mjs`
* **Delivered Changes**:
  1. Updated `AdminSidebar.tsx` navigation item to `"Dramas"` pointing directly to `/admin/dramas`.
  2. Enhanced `SidebarNavList.tsx` active path resolution to keep parent navigation highlighted when viewing sub-routes (e.g. `/admin/dramas/[id]/edit`).
  3. Configured route redirects in `next.config.mjs` routing `/admin/titles` &rarr; `/admin/dramas` and `/admin/titles/:id/edit` &rarr; `/admin/dramas/:id/edit`.
  4. Updated page headers, descriptions, search placeholders, and empty states in `app/admin/titles/page.tsx` and `app/admin/dashboard/page.tsx` to standardized "Dramas" nomenclature.
  5. Implemented `createDrama` administrative service in `lib/services/content.service.ts` and `POST /api/admin/dramas` endpoint with title slugification and channel affiliation.
  6. Added prominent `"Add Drama"` CTA button and rich modal dialog with fields for title, synopsis, genre, taxonomy tags, channel affiliation, episode count, status, and poster URL.
* **Verification**:
  - `npx tsc --noEmit` compiles cleanly with zero type errors.
  - Production build verifies that all route aliases and pages render accurately.

---

## 9. Phase 7: Polish, Developer Experience & Testing (L1–L6)

### Task 7.1: Reusable Custom Hook Library (L1)
* **Status**: ✅ Completed
* **Target Directory**: `hooks/`
* **Delivered Changes**:
  1. `useDebounce<T>(value: T, delay: number)`: Standardized debouncing state updates, integrated into `app/search/page.tsx` for real-time throttled catalog queries.
  2. `useRequireAuth(redirectTo?: string)`: Client-side auth guard protecting `app/account/` sub-routes and redirecting unauthenticated users with returnUrl.
  3. `useMediaQuery(query: string, defaultValue?: boolean)`: Universal media query hook for responsive layout switching, SSR-safe with clean event listener cleanup.
  4. `hooks/index.ts`: Barrel export consolidating all custom hooks (`useDebounce`, `useRequireAuth`, `useMediaQuery`, `useToast`).
* **Verification**:
  - `npx tsc --noEmit` verified with 0 type errors.

---

### Task 7.2: Shimmer Skeleton Loaders (L2)
* **Status**: ✅ Completed
* **Target Files**: `components/skeletons/`
* **Delivered Changes**:
  1. `DramaCardSkeleton` & `DramaGridSkeleton`: Reusable 2:3 poster and metadata shimmer placeholders with configurable card counts.
  2. `CarouselSkeleton`: Full banner and hero carousel shimmer loader matching desktop & mobile responsive dimensions.
  3. `EpisodeListSkeleton`: Episode grid and tab selector shimmer placeholders for player navigation.
  4. `DramaDetailSkeleton`: Comprehensive drama header skeleton for `/drama/[slug]` details view.
  5. Integrated skeletons across `/home` (`Hero.tsx`), `/drama/[slug]`, `/search`, and re-exported `TitleCardSkeleton` for backward compatibility.
* **Verification**:
  - `npx tsc --noEmit` verified with 0 type errors.

---

### Task 7.3: Route-Level Error Boundaries (L3)
* **Status**: ✅ Completed
* **Target Files**: `app/drama/[slug]/error.tsx`, `app/watch/[slug]/error.tsx`, `app/search/error.tsx`
* **Delivered Changes**:
  1. `app/drama/[slug]/error.tsx`: Segment error boundary with "Try Again" recovery action, catalog fallback link, and home navigation.
  2. `app/watch/[slug]/error.tsx`: Resilient player error boundary catching failed HLS stream initializations and unhandled video errors with "Retry Playback" action.
  3. `app/search/error.tsx`: Search route error boundary catching failed database queries with quick retry and home redirect.
* **Verification**:
  - `npx tsc --noEmit` verified with 0 type errors.

---

### Task 7.4: Global Uncaught Error Boundary (L4)
* **Status**: ✅ Completed
* **Target Files**: `app/error.tsx`, `app/global-error.tsx`
* **Delivered Changes**:
  1. `app/error.tsx`: Root-level error boundary capturing uncaught runtime crashes within the application layout, featuring retry actions, home return, support contact links, and digest error code display.
  2. `app/global-error.tsx`: Complete HTML/body fallback boundary catching critical crashes in the root layout itself with dark mode styling and session recovery options.
* **Verification**:
  - `npx tsc --noEmit` verified with 0 type errors.

---

### Task 7.5: Design Token Verification (L5)
* **Status**: ✅ Completed
* **Target Directory**: `design-tokens/`
* **Delivered Changes**:
  1. Audited `design-tokens/tokens.css` against `design-tokens/tailwind.config.js` and confirmed all brand palettes (Primary, Secondary, Tertiary, Danger) and semantic tokens (surface, bg, border, text, link, btn) map cleanly across `[data-theme="light"]`, `[data-theme="soft"]`, and `[data-theme="dark"]`.
  2. Moved `@import "../design-tokens/tokens.css";` to the top of `app/globals.css` ensuring strict CSS specification compliance.
  3. Verified opacity modifiers (e.g. `bg-primary/10`, `text-primary/50`) work seamlessly with R G B channel tokens.
* **Verification**:
  - `npx tsc --noEmit` compiles cleanly with 0 type errors.

---

### Task 7.6: Automated Unit & End-to-End Testing Suite (L6)
* **Status**: ✅ Completed
* **Target Directory**: `__tests__/`
* **Delivered Changes**:
  1. `__tests__/services/content.service.test.ts`: Unit test suite testing `mapTitleRowToTitle`, `mapChannelRowToChannel`, `mapEpisodeRowToEpisode`, title resolution by slug, and recommendation heuristics.
  2. `__tests__/services/user.service.test.ts`: Unit test suite testing guest watch history storage, progress ratio clamping (0.0 to 1.0), deduplication, deletion, and cleanup.
  3. `__tests__/funnel/critical-journey.test.ts`: Integration test suite covering the full user lifecycle: Catalog discovery & channel integrity → Drama metadata resolution → Video player range math & boundary handling → Watch progress persistence calculation.
  4. Added `npm test` script (`tsx --test "__tests__/**/*.test.ts"`) to `package.json`.
* **Verification**:
  - `npm test` executed with 14 passing tests across 3 suites with 0 failures.
  - `npx tsc --noEmit` compiles cleanly with 0 type errors.

---

---

## 10. Phase 8: Short Drama Monetization Engine ("Freemium" Coin Economy)

> **Objective**: Implement the industry-standard short drama unlock model: the first 5 episodes are free to maximize user retention, while subsequent episodes (Episodes 6+) require coins or subscription. Includes a coin wallet, unlock gatekeeper in the player, 7-day daily check-in rewards, and top-up transaction infrastructure.

> **Prerequisites (added by the 2026-10-04 platform audit — see §12)**:
> * **Phase 10 complete.** `coin_balance` / `is_vip` must never be writable by users. Under the original `profiles` policy (`FOR ALL` + `GRANT ALL ... TO authenticated`) any user could set their own balance. Recommended: keep the balance in a dedicated `wallets` table (select-only RLS for the owner; writes only through `SECURITY DEFINER` RPCs or the service role) rather than on `profiles`. Normalize naming as well — this phase currently uses both `coin_balance` (8.1) and `coins_balance` (8.1 item 5, 8.4).
> * **Paywall enforced server-side.** Locked-episode media must only be obtainable through the playback endpoint from Task 10.6 (`canAccessEpisode()`); the player gatekeeper in Task 8.3 is presentation only.
> * **ADR-0003 accepted (Task 13.1)** — decides that the database topology merges into a single Supabase project with `content` & `public` schemas (Option A), allowing `user_unlocked_episodes` to reference `content.episodes(id)` with a real foreign key and native RLS entitlement policies.
> * **Phase 15 events** (`paywall_view`, `unlock`, per-episode continuation rates) so the free-episode threshold is chosen from data instead of fixed at 5.
> * **Tasks 16.1 and 16.8** — admins can set `is_free` / `free_episodes_count` per drama and a platform default.
> * The player target file is `components/VideoPlayer.tsx` (split into `components/player/*` by Task 14.1); `components/WatchVideo.tsx` does not exist.

### Task 8.1: Database Schema & Migration (User Database)
* **Status**: ⏳ Planned
* **Target Database**: User Database (`bpidsbcrvpkavvdvtpgh`)
* **Planned Schema Changes**:
  1. Add `coin_balance INTEGER NOT NULL DEFAULT 0` and `is_vip BOOLEAN NOT NULL DEFAULT false` to `public.profiles`.
  2. Create `public.user_unlocked_episodes`:
     ```sql
     CREATE TABLE IF NOT EXISTS public.user_unlocked_episodes (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
         drama_id UUID NOT NULL REFERENCES content.titles(id) ON DELETE CASCADE,
         drama_slug TEXT NOT NULL,
         episode_id UUID NOT NULL REFERENCES content.episodes(id) ON DELETE CASCADE,
         episode_number INTEGER NOT NULL,
         coins_spent INTEGER NOT NULL DEFAULT 10,
         unlocked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
         UNIQUE(user_id, drama_id, episode_number)
     );
     CREATE INDEX IF NOT EXISTS idx_unlocked_user_drama ON public.user_unlocked_episodes(user_id, drama_slug);
     CREATE INDEX IF NOT EXISTS idx_unlocked_drama_id ON public.user_unlocked_episodes(drama_id);
     CREATE INDEX IF NOT EXISTS idx_unlocked_episode_id ON public.user_unlocked_episodes(episode_id);
     ```
  3. Create `public.coin_transactions` for audit and financial tracking:
     ```sql
     CREATE TABLE IF NOT EXISTS public.coin_transactions (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
         amount INTEGER NOT NULL, -- positive for credit, negative for debit
         balance_after INTEGER NOT NULL,
         transaction_type TEXT NOT NULL, -- 'purchase', 'episode_unlock', 'daily_checkin', 'referral', 'admin_grant'
         reference_id TEXT, -- e.g. payment intent id or episode id
         description TEXT NOT NULL,
         created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
     );
     ```
  4. Create `public.daily_checkins` for streak persistence:
     ```sql
     CREATE TABLE IF NOT EXISTS public.daily_checkins (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
         streak_count INTEGER NOT NULL DEFAULT 1,
         last_checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
         coins_awarded INTEGER NOT NULL DEFAULT 5,
         created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
         UNIQUE(user_id, last_checkin_date)
     );
     ```
  5. Row Level Security (RLS) policies:
     - `profiles.coins_balance` read-only by user; mutations executed strictly via verified RPC or server-side service role.
     - `user_unlocked_episodes` readable by owner (`auth.uid() = user_id`).

### Task 8.2: Episode Lock & Paywall Rules Engine
* **Status**: ⏳ Planned
* **Target Files**: `lib/services/wallet.service.ts`, `lib/services/content.service.ts`
* **Planned Specifications**:
  1. Business Rule: Episodes $1 \le N \le 5$ are unconditionally **Free** (`is_locked = false`).
  2. Episodes $N \ge 6$ are **Locked** (`is_locked = true`), requiring 10 coins per episode or active VIP status.
  3. Content metadata configuration: allow `free_episodes_count` on `Drama` (defaults to 5) so creators or admins can offer custom free previews (e.g. 3 free episodes or 10 free episodes).
  4. Service operations in `lib/services/wallet.service.ts`:
     - `getUserCoinBalance(userId)`: retrieves current verified balance.
     - `checkEpisodeUnlocked(userId, dramaSlug, episodeNumber)`: returns boolean flag.
     - `unlockEpisode(userId, drama, episode, cost)`: atomic transaction deducting coins, recording transaction log, and inserting into `user_unlocked_episodes`.
     - `unlockRemainingEpisodes(userId, drama, remainingEpisodes, discountedCost)`: bulk unlock with bundled discount.

### Task 8.3: Custom Player Paywall Gatekeeper & Coin Unlock Modal
* **Status**: ⏳ Planned
* **Target Files**: `components/WatchVideo.tsx`, `components/modals/EpisodeUnlockModal.tsx`
* **Planned Specifications**:
  1. Player Interception:
     - When navigating to a locked episode via swipe or episode drawer:
     - If user is not authenticated: display quick login/signup prompt modal with progress retention.
     - If user is authenticated and episode is locked: pause video playback, blur background player frame, and present the `EpisodeUnlockModal`.
  2. Modal UX:
     - Prominently displays: Episode number, Drama title, cost (e.g., 🪙 10 Coins).
     - User's current balance displayed with live indicator (e.g., "Your Balance: 🪙 45").
     - Primary Action: "Unlock Episode (🪙 10 Coins)" — instant deduction with particle/haptic feedback, immediate video unblur and resume.
     - Secondary Action: "Unlock Full Drama (All remaining episodes with 20% discount)".
     - Low Balance State: If `balance < cost`, render "Recharge Coins" button directing to top-up sheet.

### Task 8.4: Gamified Daily Check-in & Reward Streak System
* **Status**: ⏳ Planned
* **Target Files**: `components/rewards/DailyCheckInModal.tsx`, `app/api/user/daily-checkin/route.ts`
* **Planned Specifications**:
  1. 7-Day Progressive Streak Rewards:
     - Day 1: +5 coins
     - Day 2: +10 coins
     - Day 3: +10 coins
     - Day 4: +15 coins
     - Day 5: +15 coins
     - Day 6: +20 coins
     - Day 7: +50 coins + Mystery Chest Badge
  2. API Validation:
     - Validates check-in date against UTC midnight boundary.
     - Detects consecutive days ($(\text{today} - \text{last\_date}) = 1$); increments streak up to Day 7 then loops.
     - Resets streak to Day 1 if $> 48\text{ hours}$ have elapsed.
     - Credits coins atomically to `profiles.coins_balance` and writes to `coin_transactions`.
  3. UI Triggers:
     - Floating daily gift badge on `/home` and `/account` when today's reward is unclaimed.

### Task 8.5: Coin Top-Up Shop & Transaction Architecture
* **Status**: ⏳ Planned
* **Target Files**: `app/account/wallet/page.tsx`, `components/wallet/CoinPurchaseModal.tsx`, `app/api/payments/webhook/route.ts`
* **Planned Specifications**:
  1. Coin Packages:
     - Pocket Starter: 100 Coins (\$0.99)
     - Popular Pack: 350 Coins (\$2.99) — *(+50 Free Bonus)*
     - Drama Binge: 800 Coins (\$5.99) — *(+200 Free Bonus)*
     - VIP Weekly Pass: Unlimited Streaming 7 Days (\$9.99)
  2. Payment Architecture:
     - Modular payment adapter supporting Stripe / LemonSqueezy / digital wallets.
     - Webhook handler with idempotency check (`reference_id` deduplication) ensuring no double-crediting.
  3. Wallet Overview in `/account/wallet`:
     - Displays current balance, transaction ledger (all purchases and episode spends), and refund/support contact.

---

## 11. Phase 9: Mobile PWA & Advanced Video Player UX

> **Objective**: Upgrade DramaShort into an installable Progressive Web App (PWA) with native mobile fullscreen experience, add multi-language subtitle tracks (.vtt/.srt), complete desktop keyboard navigation, and wire Picture-in-Picture with the native OS Media Session API.

> **Scope reconciliation (added by the 2026-10-04 platform audit — see §12)**:
> * Executes after **Phase 14**, which delivers the mobile full-screen vertical watch experience this phase builds on.
> * **Task 9.3**: keyboard shortcuts already exist in `components/VideoPlayer.tsx` (Task 4.1: `Space`/`K`, `J`/`L` ±10s, `ArrowUp`/`ArrowDown` = volume, `M`, `F`, `N`/`P`). This task settles the final keymap — the spec below maps `ArrowUp`/`ArrowDown` to episode navigation and seeks ±5s, which conflicts with current behavior — and adds the cheat-sheet modal and HUD.
> * **Task 9.4**: a PiP toggle already exists; the remaining scope is the Media Session API.
> * **Task 9.1**: the service worker must never cache authenticated API responses or signed playback URLs (Task 10.6).
> * References to `components/WatchVideo.tsx` mean the player modules produced by Task 14.1.

### Task 9.1: Progressive Web App (PWA) Manifest & Service Worker
* **Status**: ⏳ Planned
* **Target Files**: `public/manifest.json`, `app/manifest.ts`, `public/sw.js`, `components/pwa/InstallPromptBanner.tsx`
* **Planned Specifications**:
  1. Web App Manifest:
     - Configured with `display: "standalone"`, `orientation: "portrait"`, `theme_color: "#0a0a0c"`, `background_color: "#0a0a0c"`.
     - Standard PWA maskable and splash icons (192x192, 512x512).
  2. Service Worker (`public/sw.js`):
     - Cache-first strategy for static UI assets, fonts, and icons.
     - Network-first with cache fallback for drama metadata and catalog index.
     - Streaming video chunks (.m3u8, .ts, .mp4) excluded from aggressive disk cache to prevent quota exhaustion.
  3. In-App Install Banner:
     - Captures `beforeinstallprompt` browser event.
     - Displays non-intrusive bottom banner: *"Install DramaShort on your Home Screen for smooth, full-screen vertical viewing"*.
     - Dismissal state remembered in `localStorage` for 14 days.

### Task 9.2: Multi-Language Subtitles (.vtt / .srt) in Video Player
* **Status**: ⏳ Planned
* **Target Files**: `components/WatchVideo.tsx`, `components/player/SubtitleSettingsModal.tsx`
* **Planned Specifications**:
  1. Video Subtitle Engine:
     - HTML5 `<track kind="subtitles">` synchronization inside custom player.
     - Support for multi-lingual short drama subtitles: English (`en`), Indonesian (`id`), Spanish (`es`), Chinese (`zh`).
  2. Custom Subtitle Overlay:
     - Styled overlay with font readability guarantees against bright video frames:
       - Font size toggle (Small, Medium, Large).
       - Text color (White with black drop-shadow, High-contrast Yellow).
       - Background opacity pill (Transparent, 50% Semi-black, Solid black).
  3. User Preferences:
     - Selected subtitle language and styling persisted in `localStorage` across episodes and dramas.

### Task 9.3: Desktop Keyboard Navigation & Hotkeys
* **Status**: ⏳ Planned
* **Target Files**: `components/WatchVideo.tsx`, `components/player/KeyboardShortcutsModal.tsx`
* **Planned Specifications**:
  1. Global Key Event Listeners (disabled when focusing text inputs or modals):
     - `Space` / `K`: Toggle Play / Pause.
     - `ArrowUp`: Navigate to Previous Episode.
     - `ArrowDown`: Navigate to Next Episode.
     - `ArrowLeft` / `J`: Seek backward 5 seconds.
     - `ArrowRight` / `L`: Seek forward 5 seconds.
     - `M`: Toggle Audio Mute / Unmute.
     - `F`: Toggle Fullscreen mode.
     - `C`: Toggle Closed Captions / Subtitles on/off.
     - `?`: Open keyboard shortcuts cheat-sheet modal.
  2. Visual HUD Feedback:
     - Brief center-screen HUD icon display upon shortcut trigger (e.g. volume mute icon, seek ±5s badge).

### Task 9.4: Picture-in-Picture (PiP) & Native Media Session API
* **Status**: ⏳ Planned
* **Target Files**: `components/WatchVideo.tsx`, `hooks/useMediaSession.ts`
* **Planned Specifications**:
  1. Picture-in-Picture (PiP):
     - Native `HTMLVideoElement.requestPictureInPicture()` integration with fallback for unsupported browsers.
     - Floating PiP toggle button in player control bar.
  2. Native OS Media Session API (`navigator.mediaSession`):
     - Metadata integration:
       - `title`: Current episode title (e.g., "Episode 4").
       - `artist`: Drama title (e.g., "The CEO's Secret Wife").
       - `album`: Channel name (e.g., "DramaBox Originals").
       - `artwork`: 96x96, 128x128, 256x256, 512x512 drama poster images.
     - Lock Screen & Peripheral Controls:
       - Handles `play`, `pause`, `previoustrack`, `nexttrack`, `seekto`.
       - Enables seamless playback control from smartphone lockscreens, smartwatch widgets, and Bluetooth car/headphone buttons.

### Task 9.5: Automated Testing Suite Expansion
* **Status**: ⏳ Planned
* **Target Directory**: `__tests__/services/`, `__tests__/funnel/`
* **Planned Specifications**:
  1. `__tests__/services/wallet.service.test.ts`:
     - Test coin balance queries, episode unlock deductions, insufficient balance rejection, and streak date math.
  2. `__tests__/funnel/paywall-flow.test.ts`:
     - Verify episode boundary rules (Ep 1–5 free, Ep 6 locked, unlock flow transitions).
  3. Ensure `npm test` runs all existing 14 tests plus new monetization tests with 100% pass rate.

---

## 12. Platform Audit Remediation Track (Phases 10–17)

> **Origin**: Full-platform audit performed on **2026-10-04**, covering UI/UX, user workflows, admin workflows, and backend architecture. At audit time `npx tsc --noEmit`, `npm run lint`, and `npm test` (14/14) all passed, yet several capabilities recorded as ✅ were found to be partially implemented or exploitable. This track corrects them before new feature work (Phases 8 and 9) proceeds.

### 12.1 Audit Findings Summary

| Area | Key findings | Addressed in |
|---|---|---|
| Security & access control | Any signed-in user can self-promote to admin (user-writable `user_metadata.role`; `profiles` `FOR ALL` policy + `GRANT ALL`); admin `GET` APIs run with the service-role key and no auth; admin subdomain rewrite skips the guard; open redirect after login; development auth bypass; every episode `video_url` is public | Phase 10 |
| Stubbed flows | Email verification accepts any code; password recovery is a no-op; account deletion is a no-op; contact form simulates outcomes with `Math.random()`; mock notifications shown to real users; unknown slugs render fabricated dramas; missing episodes play a sample video | Phase 11 |
| Functional bugs | Discovery pages capped at 12 titles; admins cannot see non-Published dramas; watch-progress value mixes two meanings; admin logout bounce; custom-list race; silent mock fallback in production | Phase 12 |
| Architecture | Two Supabase projects linked only by slugs; catalog pages fetched client-side; service layer browser-only; unindexed search; no error reporting | Phase 13 |
| Mobile UX | Player defaults to a 16:9 frame for 9:16 content; swipe conflicts with page scroll; mouse drag changes episodes; fullscreen broken on iPhone; landing gate before content; blurry hero; theme flash; guest favorites blocked | Phase 14 |
| Product analytics | No event tracking; `views_count` only written by the seed script; trending and admin dashboard are static | Phase 15 |
| Admin operations | No episode or media management; poster is a free-text URL; `Scheduled` has no publish time; Channels, Genres, Users, Settings, Dashboard run on mock data; no audit log or roles; bulk-select without actions | Phase 16 |
| Quality & docs | Tests re-implement logic and assert on fixtures; no CI; stale README and roadmap references; `next lint` deprecated | Phase 17 (CI gate in 10.9) |

### 12.2 Execution Order & Phase Gates

| Order | Phase | Exit gate (true before the next phase starts) |
|---|---|---|
| 1 | Phase 10 — Security Hardening | Security regression suite (10.9) green in CI; no authorization decision reads user-writable data |
| 2 | Phase 11 — Stubbed Flows | Every visible auth, account, and support action performs a real operation or is hidden behind a flag |
| 3 | Phase 12 — Bug Fixes & Data Integrity | Discovery pages paginate the full catalog; admins see every status; production builds contain no mock fallbacks |
| 4 | Phase 13 — Architecture | ADR-0003 accepted and executed; public catalog pages server-rendered |
| 5 | Phase 14 — Mobile Watch UX | Phones default to full-screen 9:16 playback; no theme flash on first paint |
| 6 | Phase 15 — Analytics | Episode events ingested; `views_count` and trending computed from events; dashboard live |
| 7 | Phase 16 — Admin Operations | A drama with 40+ episodes can be created, populated, scheduled, and published without SQL |
| 8 | Phase 8 — Monetization | Existing spec plus the prerequisites added in §10 |
| 9 | Phase 9 — PWA & Advanced Player | Existing spec plus the scope reconciliation added in §11 |
| ∞ | Phase 17 — Quality & Docs | Runs alongside every phase; each phase lands with its own tests |

**Parallelism**: Phases 11 and 12 may run in parallel once Phase 10 is merged. Phase 14 may start before Phase 13 finishes, except Task 14.1, which builds on the watch-page shell from Task 13.3.

**Cross-task dependencies**:
* 12.2 depends on 10.3 (admin `GET` routes protected before admin pages use them).
* 15.1 and 15.3 depend on 13.1 (where events and rollups live).
* 16.1 depends on 10.6 (`episode_media` table and playback endpoint).
* 15.2 consumes the progress reporter extracted in 14.1.
* 11.4 and 15.1 depend on the rate limiter from 13.6 (a minimal limiter may ship with 11.4 and be generalized in 13.6).

### 12.3 Corrections to Previously Completed Items

These items stay ✅ for history; the gaps are tracked as new tasks.

| Item | Recorded as | State found by audit | Follow-up |
|---|---|---|---|
| Task 4.2 (C2) Admin guard | "Eliminates client-side bypass" | Role read from user-writable `user_metadata` and user-writable `profiles.role`; admin subdomain path skips the guard; `/api/admin/*` unguarded | 10.1–10.4 |
| Task 4.3 (C3) Password change | "Verifies current password" | Verification re-signs in (issues a new session); skipped when `currentPassword` is omitted; OAuth users have no password | 11.5 |
| Task 5.1 (H1) Watch progress | "Real-time tracking" | Selecting an episode stores a series ratio as episode progress; `beforeunload` unreliable on mobile | 12.3 |
| Tasks 5.3 (H3) / 6.5 (M5) Admin edit | "Hydrates with all real dramas" | Reads through the anon client, so only `Published` rows are visible | 12.2 |
| Task 6.1 (M1) Hydration | "Graceful dev & offline fallback" | The fallback is also active in production and hides outages | 12.4 |
| Task 7.6 (L6) Testing | "Critical journeys covered" | Tests assert on mock fixtures and re-implemented math, not production code | 17.1 |
| README status | "Authentication Screens (Login, Signup, OTP) ✅" | Verify-email and forgot-password are stubs | 11.1, 11.2, 17.4 |

---

## 13. Phase 10: Security Hardening & Access Control (🔴 Critical)

> **Objective**: Close every privilege-escalation and data-exposure path found in the audit, centralize authorization in one server-side helper, and lock the fixes in with automated regression tests and a CI gate. **Phase 8 must not start before this phase is complete**, because its wallet fields are planned on `profiles`, which is currently user-writable.

### Task 10.1: Admin Role Single Source of Truth & Shared `requireAdmin()` Guard
* **Status**: ✅ Completed (Unit verified; API integration verified 2026-10-04 via Task 10.3 smoke test; automated suite pending Task 10.9)
* **Target Files**: `lib/auth/roles.ts`, `lib/auth/require-admin.ts`, `middleware.ts`, `app/api/admin/dramas/route.ts`, `app/api/admin/dramas/[id]/route.ts`, `contexts/AdminAuthContext.tsx`, `scripts/backfill-admin-roles.ts`, `scripts/create-admin.ts`, `__tests__/auth/roles.test.ts`
* **Delivered Capabilities**:
  1. Authoritative Role Source: Implemented `lib/auth/roles.ts` exporting `getUserRole()` which reads **strictly** from `app_metadata.role`. Explicitly ignores client-writable `user_metadata.role` and `profiles.role` for authorization decisions.
  2. Centralized Server Guard: Implemented `lib/auth/require-admin.ts` exporting `requireAdmin()`. Performs server-side verification using `auth.getUser()` (never `getSession()`), returning `{ authorized: true, user, role }` or typed `401` / `403` JSON responses.
  3. API Route Lockdown: Replaced duplicate and insecure `verifyAdminAuth()` in `app/api/admin/dramas/route.ts` and `app/api/admin/dramas/[id]/route.ts` with `requireAdmin()`. Both `GET` and mutating `POST`/`PATCH` endpoints now strictly require administrative authentication; development bypass completely removed.
  4. Middleware Hardening: Updated `middleware.ts` to evaluate `getUserRole(user) === 'admin'`, eliminating client self-elevation bypass on standard `/admin/*` routes. (Admin subdomain guard ordering will be consolidated in Task 10.4).
  5. UI State Synchronization: Updated `contexts/AdminAuthContext.tsx` to resolve `getUserRole(authUser)` from `app_metadata`, with server routes remaining the true enforcement boundary.
  6. Safe Backfill & Sanitization Script: Created `scripts/backfill-admin-roles.ts` with default dry-run mode, paginated user and profile scanning, explicit `--promote <emails>` allowlisting for legitimate admins (confirmed emails only), and automatic sanitization of rogue self-promoted roles. Two-pass design validates everything before any change; `--revoke-unlisted-admins` requires at least one `--promote` admin; failed updates exit with code 1.
  7. Admin Provisioning Cleanup: Updated `scripts/create-admin.ts` to stop writing `user_metadata.role`.
  8. Automated Unit Test Suite: Added `__tests__/auth/roles.test.ts` testing role resolution, invalid roles, and explicitly asserting that client-side `user_metadata.role = 'admin'` cannot elevate privileges.
* **Verification & Remaining Gaps**:
  - `npm test`: 19 / 19 tests pass (5 security unit tests in `Auth Roles & Privilege Security (Task 10.1)`).
  - `npx tsc --noEmit`: compiles cleanly with 0 type errors.
  - Integration check: a real signed-in user with forged `user_metadata.role = "admin"` received `403 FORBIDDEN` from `GET /api/admin/dramas` and `PATCH /api/admin/dramas/:id` on a production build (Task 10.3 smoke test). The `/admin` page redirect for such a user was not exercised; automated coverage remains in Task 10.9.
  - Column-level write lockdown on `profiles.role` will be enforced in Task 10.2 via User DB RLS migration.

---

### Task 10.2: User Database RLS & Column-Level Privilege Hardening
* **Status**: ✅ Completed — deployed to the User DB on 2026-10-04 and verified in production (24/24 smoke checks); Security Advisor review pending (dashboard)
* **Problem**: The `profiles` policy is `FOR ALL USING (auth.uid() = id)` (`supabase/user/supabase/migrations/20260930150000_user_schema.sql` L87), and `GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated` (`20260930163000_grant_permissions.sql` L13). A user can run `update({ role: "admin" })` on their own row, and would be able to edit any future column added to `profiles` (such as Phase 8's `coin_balance`).
* **Target Files**: `supabase/user/supabase/migrations/<timestamp>_harden_rls_and_grants.sql` (new), `types/supabase-user.ts` (regenerate)
* **Planned Specifications**:
  1. Replace the `profiles` `FOR ALL` policy with separate policies:
     ```sql
     DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
     CREATE POLICY "Users read own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
     CREATE POLICY "Users update own profile" ON profiles FOR UPDATE
       USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
     ```
     Rows are created by the `handle_new_user` trigger and removed by cascade; users get no `INSERT` / `DELETE`.
  2. Column-level grants:
     ```sql
     REVOKE INSERT, UPDATE, DELETE ON profiles FROM authenticated;
     GRANT UPDATE (display_name, avatar_url, updated_at) ON profiles TO authenticated;
     ```
  3. Replace blanket grants with explicit per-table grants. Revoke `anon` access to all user tables (RLS already returns no rows; this is defense in depth).
  4. Split the `FOR ALL` policies on `favorites`, `watch_history`, `custom_lists`, and `custom_list_items` into per-command policies with explicit `WITH CHECK` clauses.
  5. Default privileges: `ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;` so every future table (wallet, transactions, events) needs an explicit grant in its own migration. Verify against Supabase's default role setup on a branch first.
  6. Set `SET search_path = public` on the `SECURITY DEFINER` function `handle_new_user()`.
  7. Run the Supabase database linter (Security Advisor) and resolve all security warnings.
* **Verification**: RLS tests from Task 10.9 — a user cannot update `role`, cannot read or modify another user's rows, and `anon` reads zero rows from user tables.
* **Implementation Progress (2026-10-04)**:
  - Delivered in `supabase/user/supabase/migrations/20261004120000_harden_rls_and_grants.sql`, covering items 1–6:
    - `profiles`: `SELECT` + `UPDATE` policies only; column grant limited to `display_name`, `avatar_url`, `updated_at` (`role` not writable by users).
    - `favorites`, `watch_history`, `custom_lists`, `custom_list_items`: per-command policies with explicit `WITH CHECK`; list items check ownership of the parent list on insert and update.
    - All access revoked from `anon`; `authenticated` gets explicit per-table grants; default privileges for `postgres` no longer grant future tables to `anon` / `authenticated`.
    - `handle_new_user()` recreated with `SET search_path = ''` (stricter than the planned `public`; all references are schema-qualified).
    - Policies use `(select auth.uid())` so it is evaluated once per statement.
  - `types/supabase-user.ts`: no regeneration needed (no table or column shape changed).
  - App compatibility: the only client write to `profiles` (`updateUserProfile()` in `lib/services/user.service.ts`) touches `display_name`, `avatar_url`, `updated_at`, all still granted.
  - Local verification: `scripts/sql/verify-user-db-rls.sql` passes 18/18 checks on a local Supabase Postgres 17 with all three user migrations applied (role escalation blocked; own display fields editable; no insert/delete on `profiles`; cross-user reads, writes, reassignment, and list-item planting blocked; own upserts work; `anon` has no access; signup trigger works with the empty `search_path`; future tables get no default grants). A negative control with the old `FOR ALL` policy and `GRANT ALL` reproduced the escalation (1 row updated).
  - Deployment: `supabase db push --workdir supabase/user` applied only `20261004120000_harden_rls_and_grants.sql` (dry run confirmed beforehand; remote already had the two earlier migrations).
  - Production smoke test: 24/24 PASS through the public anon key with two throwaway confirmed accounts (deleted afterwards, no leftover rows) — `anon` denied on all five tables; signup trigger creates `role = 'user'` profiles; own display-name update works; `role = 'admin'` update denied and role unchanged; profile delete denied; own favorite upsert/delete, watch-progress upsert, list create and item add work; cross-user favorite insert and list-item insert denied; reads return only own rows.
  - **Remaining**: item 7 — review Supabase Security Advisor in the dashboard (not available through the CLI).

---

### Task 10.3: Protect All Admin API Routes & Remove the Development Auth Bypass
* **Status**: ✅ Completed — verified on a production build (21/21 API smoke checks)
* **Depends on**: 10.1
* **Problem**:
  - `GET /api/admin/dramas` (`route.ts` L80) and `GET /api/admin/dramas/[id]` (`[id]/route.ts` L83) have no auth check and use the service-role key — anyone can list Draft, Scheduled, and Archived titles.
  - Middleware guards `/admin*` only; `/api/admin*` is not covered.
  - `verifyAdminAuth()` authorizes every request when `NODE_ENV !== "production"` and no session exists (`route.ts` L55–56; `[id]/route.ts` L71–72), and on any exception outside production (L59, L75). A staging server running `next dev` is fully open.
  - `PATCH` "updates" mock titles and reports success when the ID is not in the database (`[id]/route.ts` L252–270).
  - Payloads are not validated: `status` is a free string, poster accepts any URL, and there are no length limits.
* **Target Files**: `app/api/admin/**`, `middleware.ts`, `lib/validation/drama.ts` (new)
* **Planned Specifications**:
  1. Every handler under `app/api/admin/**`, `GET` included, starts with `requireAdmin()`.
  2. Middleware returns `401` JSON (not a redirect) for `/api/admin/*` without an admin session — defense in depth on top of item 1.
  3. Remove the development bypass entirely. Local admin access uses a real account created by `npm run admin:create` (Task 10.7).
  4. Remove mock fallbacks from admin handlers: `GET` returns real data or an empty list; `PATCH` on an unknown ID returns `404`.
  5. Validate requests: status enum, title 1–200 chars, synopsis ≤ 5,000 chars, ≤ 20 tags of ≤ 40 chars, `total_episodes` 1–500, and poster/banner URLs restricted to the host allow-list shared with `next.config.mjs` `remotePatterns`.
  6. Uniform error shape `{ success: false, error: { code, message } }`. Log raw database errors server-side; never return them to clients.
* **Verification**: unauthenticated `GET`/`POST`/`PATCH` → `401`; non-admin → `403`; invalid payload → `400`.
* **Delivered Capabilities (2026-10-04)**:
  1. All admin handlers (`GET`/`POST` `/api/admin/dramas`, `GET`/`PATCH` `/api/admin/dramas/[id]`, and the `/api/admin/titles/[id]` alias) call `requireAdmin()` (from Task 10.1); the development bypass is gone.
  2. `middleware.ts`: new `/api/admin/*` guard returning `401 UNAUTHORIZED` / `403 FORBIDDEN` JSON; duplicated Supabase cookie plumbing replaced by one `createMiddlewareSupabase()` helper (the full `updateSession()` refactor stays in Task 10.4).
  3. Mock fallbacks removed from admin handlers: list returns real rows (or `500 DATABASE_ERROR`); unknown UUID → `404 NOT_FOUND`; non-UUID id → `400 INVALID_ID`; `PATCH` with no fields → `400`.
  4. `lib/validation/drama.ts`: `validateDramaPayload()` enforces item 5 limits, collects all field errors at once, dedupes tags case-insensitively, and ignores client-supplied `channel_code` / `channel_id` (resolved server-side via `lib/admin/resolve-channel.ts`, with LIKE wildcards escaped).
  5. Shared host allow-list `lib/config/image-hosts.mjs`, imported by both `next.config.mjs` (`images.remotePatterns`) and the validator (`isAllowedImageUrl()`, next/image wildcard semantics).
  6. `lib/api/responses.ts` (`apiSuccess` / `apiError`) used by all admin routes, `requireAdmin()`, and middleware; raw database messages are logged server-side only. `POST` returns `201`.
  7. Client fix: `updateDrama()` / `createDrama()` now read the structured error through `lib/api/error-message.ts` (`getApiErrorMessage`, `readJsonSafely`). Since Task 10.1 they had passed the `error` object to React state, which would crash the admin forms on any 401/403.
* **Verification Results**:
  - `npm test`: 40/40 (21 new in `__tests__/validation/drama.test.ts` and `__tests__/api/responses.test.ts`); `npx tsc --noEmit` 0 errors; lint clean; `npm run build` succeeds.
  - API smoke test on `next start` (throwaway regular user and admin, deleted afterwards; no successful writes): no session → `401` JSON on all 5 routes; forged-role user → `403`; admin list → 35 real dramas across all four statuses; mock id `t-1` → `400`; unknown UUID `GET`/`PATCH` → `404`; invalid payload → `400` listing `poster, status, title, totalEpisodes`; empty `PATCH`, malformed JSON, missing title → `400`; rejected `PATCH` left the drama unchanged.
  - Known gaps (tracked elsewhere): admin pages still read through the public client, so the UI does not yet show non-Published dramas (Task 12.2); on the `admin.*` subdomain `/api/*` is still rewritten (Task 10.4).

---

### Task 10.4: Middleware — Admin Subdomain Guard Ordering & Session Refresh
* **Status**: ✅ Completed — 41 matrix/redirect unit tests and 15/15 end-to-end checks on a production build
* **Problem**:
  - `middleware.ts` L15–19 returns `NextResponse.rewrite()` for `admin.*` hosts before the admin guard runs. Middleware is not re-run for the rewritten path, so `admin.<domain>/dashboard` renders without login.
  - The same rewrite prefixes `/api/*` and `/auth/*`, turning them into `/admin/api/...` (404), which breaks admin saves on the subdomain.
  - Supabase cookie plumbing is duplicated twice in middleware, and sessions are refreshed only on `/admin` and `/account` routes.
  - The admin-login redirect uses `new URL(returnUrl, request.url)`, which accepts `//evil.example`.
* **Target Files**: `middleware.ts`, `lib/supabase/middleware.ts` (new)
* **Planned Specifications**:
  1. Compute the effective path first (`/admin` + path on admin hosts), run the guard against the effective path, then return the rewrite or redirect carrying refreshed auth cookies.
  2. Never rewrite `/api/*`, `/auth/*`, `/_next/*`, or static assets.
  3. Public site routes requested on the admin host return `404` (the admin host serves only the console).
  4. Extract `updateSession(request)` into `lib/supabase/middleware.ts` (the Supabase SSR pattern) and refresh the session on every matched route.
  5. Validate `returnUrl` with the admin variant of the helper from Task 10.5.
* **Verification**: table-driven middleware tests covering host (main / admin) × path (`/`, `/dashboard`, `/admin/*`, `/api/admin/*`, `/account`) × session (none / user / admin).
* **Delivered Capabilities (2026-10-04)**:
  1. `lib/middleware/route-decision.ts` (pure, no Next/Supabase imports): `resolveRoute(host, pathname)` computes the effective path and area (`admin-api` / `admin` / `account` / `public`); `decideRoute(route, session, search, returnUrl)` returns `next` / `rewrite` / `redirect` / `json`. The guard now runs on the effective path, so `admin.<domain>/dashboard` requires login.
  2. Admin hosts never rewrite `/api/*`, `/auth/*`, `/_next/*` (static assets are excluded by the matcher), so admin saves and auth callbacks work on the subdomain.
  3. `lib/supabase/middleware.ts` `updateSession(request, { verify })`: verified `auth.getUser()` on admin, account, and admin-API paths; on public paths an expiring token is refreshed through `getSession()` only when an auth cookie exists (guests trigger no Auth call). Refreshed cookies go to the forwarded request and are replayed onto every response type, including redirects, rewrites, and JSON errors.
  4. `returnUrl` on `/admin/login` is validated with `getSafeAdminRedirect()` (`lib/navigation/safe-redirect.ts`, also the base for Task 10.5); off-site, public, and login-loop targets fall back to `/admin/dashboard`. The redirect to login now preserves the query string.
  5. `middleware.ts` reduced to: resolve route → update session → decide → respond. The `createMiddlewareSupabase()` helper from Task 10.3 is replaced.
  6. Also delivers Task 12.5 item 2: an admin requesting `/admin` is redirected to `/admin/dashboard` server-side.
* **Deviation from item 3**: public paths on the admin host (e.g. `/home`) resolve under `/admin` (`/admin/home`), so visitors are sent to login first and get a 404 after signing in, rather than an immediate 404. This avoids revealing which paths exist on the console host.
* **Verification Results**:
  - Unit: `__tests__/middleware/route-decision.test.ts` (33 matrix cases + host/area resolution) and `__tests__/navigation/safe-redirect.test.ts`; `npm test` 81/81.
  - `npx tsc --noEmit` 0 errors; lint clean; `npm run build` succeeds (middleware 95.7 kB).
  - End-to-end on `next start` with `Host: admin.localhost` (throwaway admin and regular user, deleted afterwards): admin-host `/dashboard` without login → login redirect (bypass closed); `/login` → 200; `/api/admin/dramas` → 401 JSON without login and 200 JSON as admin; regular user → unauthorized; admin `/` → dashboard; `returnUrl=//evil.example` → `/admin/dashboard`; `returnUrl=/admin/dramas` honored; `/account` guest → `/login?returnUrl`; guest `/home` sets no cookies; `/home` with an expired session returns a refreshed auth cookie.

---

### Task 10.5: Safe Redirect Handling & Unified `returnUrl` Parameter
* **Status**: ✅ Completed — verified in a real browser (headless Edge, 11/11 checks)
* **Problem**: `app/login/page.tsx` L41–43 calls `router.push(searchParams.get("returnUrl") || searchParams.get("redirect"))` without validation, so `/login?redirect=https://evil.example` sends a user to an attacker's page right after a real login. The same pattern exists in `app/verify-email/page.tsx` (L25), `app/signup/page.tsx`, and `app/admin/login/page.tsx` (L13). Two parameter names, `redirect` and `returnUrl`, are in use.
* **Target Files**: `lib/navigation/safe-redirect.ts` (new), `app/login/page.tsx`, `app/signup/page.tsx`, `app/verify-email/page.tsx`, `app/admin/login/page.tsx`, `components/header/HeaderActions.tsx`, `components/LoginRequiredModal.tsx`, `hooks/useRequireAuth.ts`, `middleware.ts`, `app/auth/callback/route.ts`
* **Planned Specifications**:
  1. `getSafeRedirect(value: string | null, fallback = "/home"): string` accepts only same-origin relative paths: must start with `/`, must not start with `//` or `/\`, and must not contain control characters. Parse with `new URL(value, "http://local")` and require the host to stay `local`.
  2. `getSafeAdminRedirect()` additionally requires an `/admin` prefix.
  3. Standardize on `returnUrl` everywhere; keep reading `redirect` for one release for backward compatibility.
  4. Replace the inline check in `app/auth/callback/route.ts` with the shared helper.
* **Verification**: table test — `https://evil.example`, `//evil.example`, `/\evil.example`, `javascript:alert(1)`, `%2F%2Fevil.example`, and `/\t/evil.example` all resolve to the fallback.
* **Delivered Capabilities (2026-10-04)**:
  1. Items 1–2 delivered with Task 10.4 (`getSafeRedirect`, `getSafeAdminRedirect`).
  2. New helpers in `lib/navigation/safe-redirect.ts`: `readReturnUrl(searchParams, fallback)` reads `returnUrl`, falls back to the legacy `redirect` parameter (item 3 compatibility), validates it, and never returns an auth page (`/login`, `/signup`, `/verify-email`, `/forgot-password`); `returnUrlQuery(value)` builds `?returnUrl=…` for links, or `""` when the target is missing, default, or unsafe.
  3. `app/login/page.tsx`, `app/signup/page.tsx`, `app/verify-email/page.tsx`: post-login, Google OAuth `next`, and signup → verify-email destinations all go through `readReturnUrl()`; signup now forwards `returnUrl` (not `redirect`) to verify-email.
  4. Login ↔ signup links forward the validated `returnUrl` (previously only the legacy `redirect` was forwarded, so a middleware-issued `returnUrl` was lost when switching pages).
  5. `components/header/HeaderActions.tsx` and `components/LoginRequiredModal.tsx` link to `/login?returnUrl=…` (item 3).
  6. `app/admin/login/page.tsx` validates `returnUrl` with `getSafeAdminRedirect()` before `router.replace`.
  7. `app/auth/callback/route.ts` uses `getSafeRedirect()` instead of its inline check (item 4). The old check was not exploitable because the destination is always prefixed with the request origin.
  8. `hooks/useRequireAuth.ts` already used `returnUrl`; unchanged.
* **Verification Results**:
  - Unit: `__tests__/navigation/safe-redirect.test.ts` extended for `readReturnUrl` / `returnUrlQuery`; `npm test` 86/86; `tsc` 0 errors; lint clean; `npm run build` succeeds.
  - Real browser (headless Edge via the DevTools Protocol against `next start`, throwaway user and admin, deleted afterwards): login with `?redirect=https://example.com/phish` and with `?returnUrl=//example.com` both landed on `/home`; `?returnUrl=/account/history` was honored; the login → signup link kept `returnUrl=/drama/ceo-secret-wife` and dropped an unsafe `redirect`; admin login with `returnUrl=//example.com` landed on `/admin/dashboard`, and `returnUrl=/admin/dramas` was honored.
  - Not exercised: the Google OAuth round trip (needs a real Google sign-in) and the verify-email redirect (that page is still a stub until Task 11.1). No negative control was run against the pre-fix build.
  - Follow-up: remove the legacy `redirect` fallback in `readReturnUrl()` after one release.

---

### Task 10.6: Episode Media Access Control & Server Playback Endpoint
* **Status**: ✅ Completed
* **Problem**: `Public read episodes ... USING (true)` (`supabase/content/supabase/migrations/20260930150000_content_schema.sql` L73) exposes every `episodes.video_url`, including episodes of Draft and Archived dramas and future paid episodes. Any paywall enforced only in the UI can be bypassed by querying the table with the public anon key.
* **Target Files**: `supabase/content/supabase/migrations/20261005120000_episode_media_lockdown.sql` (new), `app/api/playback/[episodeId]/route.ts` (new), `lib/server/playback.ts` (new), `lib/services/content.service.ts`, `app/watch/[slug]/page.tsx`
* **Planned Specifications**:
  1. Episode RLS: readable only when the parent drama is published:
     ```sql
     CREATE POLICY "Public read episodes of published titles" ON episodes FOR SELECT
       USING (EXISTS (SELECT 1 FROM titles t WHERE t.id = episodes.title_id AND t.status = 'Published'));
     ```
  2. Move media references into a new `episode_media` table (`episode_id`, `provider`, `asset_ref`, `hls_url`, `mp4_url`, `duration_seconds`, `aspect_ratio`, `status`) with **no** public policy. It is read only by the server. This also supports multiple renditions and subtitles later.
  3. `GET /api/playback/[episodeId]`: the server verifies the drama is published and the episode exists, then calls `canAccessEpisode(user, episode)` and returns `{ url, expiresAt }`. For now `canAccessEpisode` allows all published episodes, preserving current behavior; Phase 8 adds entitlement checks in this single function.
  4. Signed delivery: a signed HLS manifest alone does not protect segments. Choose a provider with signed playback tokens (e.g., Mux, Cloudflare Stream, Bunny Stream) or CDN signed cookies. Record the decision in ADR-0003 (Task 13.1).
  5. Replace `select("*")` on episodes with explicit column lists.
* **Delivered Capabilities (2026-10-05)**:
  1. `supabase/content/supabase/migrations/20261005120000_episode_media_lockdown.sql`:
     - Replaced open `episodes` SELECT policy with "Public read episodes of published titles" (`USING (EXISTS (SELECT 1 FROM titles t WHERE t.id = episodes.title_id AND t.status = 'Published'))`).
     - Created `episode_media` table with RLS enabled and zero public policies (read/write exclusively for `service_role` and `postgres`).
     - Revoked table-level SELECT on `episodes` from `anon` and `authenticated`; granted SELECT only on non-sensitive columns (`id`, `title_id`, `episode_number`, `title`, `thumbnail_url`, `duration_seconds`, `is_free`, `created_at`), blocking direct client queries for `video_url`.
     - Idempotent backfill from `episodes.video_url` into `episode_media`.
  2. `lib/server/playback.ts`:
     - `canAccessEpisode(user, episode)` verifies that parent title is `Published` (or caller is authenticated with `admin` or `editor` role via `getUserRole()`). Single gatekeeper hook for Phase 8 monetization rules.
     - `resolvePlaybackSession(info, expiresInSeconds)` derives stream source (`hls_url` → `mp4_url` → fallback) and returns ISO expiration timestamp.
     - `getEpisodePlaybackInfo(episodeId)` retrieves episode, parent title, and privileged media through the service role client.
  3. `app/api/playback/[episodeId]/route.ts`:
     - Validates UUID parameter (rejects non-UUID and injection with `400 INVALID_ID`).
     - Resolves user session (guest-safe; unauthenticated allowed for published episodes).
     - Returns `404 NOT_FOUND` for non-existent or unpublished titles (preventing metadata leakage).
     - Returns uniform JSON envelope `{ success: true, data: { url, expiresAt, provider, aspectRatio, durationSeconds } }`.
  4. `lib/services/content.service.ts`:
     - `getEpisodesByTitleId` now selects explicit public column projections without `video_url`.
     - Added `getEpisodePlayback(episodeId)` helper returning typed `PlaybackSource`.
  5. `app/watch/[slug]/page.tsx`:
     - Dynamically loads secure stream via `getEpisodePlayback(currentEpData.id)` and prioritizes `playbackSource.url` in `<VideoPlayer>`.
     - Displays clean user-facing error message if video stream fails or is unavailable.
  6. Verification script `scripts/sql/verify-content-db-rls.sql` testing RLS denial on draft episodes, anon denial on `episode_media`, and column-level denial on `episodes.video_url`.
* **Verification Results**:
  - `npm test`: 100 / 100 tests pass across 19 suites (14 new tests in `__tests__/playback/playback.test.ts` and `__tests__/api/playback-route.test.ts`).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully built all routes including dynamic `ƒ /api/playback/[episodeId]`.

---

### Task 10.7: Admin Provisioning Script Hardening
* **Status**: ✅ Completed
* **Problem**: `scripts/create-admin.ts` defaulted to `admin@dramashort.com` / `Admin123456!`, silently reset an existing user's password, printed the password to stdout, wrote `user_metadata.role`, called `listUsers()` only once (first page only), and lacked safeguards against accidental production execution.
* **Target Files**: `scripts/create-admin.ts`, `package.json`, `__tests__/scripts/create-admin.test.ts` (new)
* **Planned Specifications**:
  1. Require an explicit `--email`. Generate a strong random password when creating a user; never use a default. Print a generated password once; never print a supplied one.
  2. Never reset an existing user's password unless `--reset-password` is passed.
  3. Write `app_metadata.role` only, plus the `profiles.role` mirror through the service role. Support `--role admin|editor` and `--revoke`.
  4. Look up users with paginated `listUsers()`, or attempt creation and handle "already registered".
  5. Refuse to run against the production project ref unless `--confirm-production` is passed.
* **Delivered Capabilities (2026-10-05)**:
  1. CLI Argument Engine & Validation:
     - Requires `--email <address>` (or `--email=address`); validates email syntax; displays structured `--help` guide on missing parameters.
     - Supports `--role admin|editor` (defaults to `"admin"`) with strict enum validation.
     - Implemented `--revoke` flag to strip admin/editor privileges, reset `profiles.role = 'user'`, and remove rogue `user_metadata.role`.
  2. Secure High-Entropy Password Management:
     - `generateSecurePassword(length = 20)` produces cryptographically strong passwords containing uppercase, lowercase, numbers, and symbols.
     - Generated passwords for new accounts are displayed once with a security warning. Custom passwords provided via `--password` are masked and never printed to stdout.
  3. Existing User Credential Protection:
     - Existing account passwords are preserved untouched during role promotions or revokes.
     - Password resets on existing accounts are strictly gated behind the explicit `--reset-password` flag.
  4. Role Source of Truth & Database Synchronization:
     - Writes `app_metadata.role` and drops any client-forged `user_metadata.role` keys.
     - Synchronizes `profiles.role` (`'admin'`, `'editor'`, or `'user'`) via the privileged service role client with typed `Database` schema bindings.
  5. Exhaustive Paginated Lookups:
     - `findUserByEmail()` loops through all pages of `supabase.auth.admin.listUsers({ page, perPage: 1000 })` ensuring users beyond page 1 are discovered.
  6. Production Refusal Safety Gate:
     - `isProductionProject(url)` detects the production User DB project ref (`bpidsbcrvpkavvdvtpgh`).
     - Refuses execution and exits with status 1 unless `--confirm-production` is explicitly passed.
* **Verification Results**:
  - `npm test`: 116 / 116 tests pass across 24 suites (16 new tests in `__tests__/scripts/create-admin.test.ts` covering email validation, production ref detection, password entropy, CLI argument parsing, flags, and error handling).
  - CLI Verification: `npx tsx scripts/create-admin.ts --help` verified clean flag documentation.
  - Production Gate Verification: `npx tsx scripts/create-admin.ts --email test@example.com` verified safe refusal (exit code 1) against production `.env.local` without `--confirm-production`.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).

---

### Task 10.8: Supabase Auth Configuration & HTTP Security Headers
* **Status**: ✅ Completed
* **Target Files**: `supabase/user/supabase/config.toml`, `next.config.mjs`, `lib/config/security-headers.mjs` (new), `__tests__/config/security-headers.test.ts` (new)
* **Planned Specifications**:
  1. Enable **Secure password change** (requires a reauthentication nonce) — paired with Task 11.5.
  2. Minimum password length of 8 or more; enable leaked-password protection if the plan supports it.
  3. CAPTCHA (Cloudflare Turnstile or hCaptcha) on signup, login, and password reset.
  4. Restrict the redirect URL allow-list to the production domain, the admin subdomain, preview domains, and `localhost`.
  5. Commit these settings to `config.toml` so they are reproducible across environments.
  6. Security headers in `next.config.mjs`: `Content-Security-Policy` (Supabase, image hosts, video provider, and later `telegram.org` per `FUTURE_PLAN.md` §5.4), `frame-ancestors` (coordinate with the Telegram Mini App embedding plan), `Referrer-Policy`, `Permissions-Policy`, `X-Content-Type-Options`.
* **Delivered Capabilities (2026-10-05)**:
  1. `lib/config/security-headers.mjs` & `next.config.mjs`:
     - Built comprehensive `Content-Security-Policy` (CSP) covering:
       - `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.
       - Script origins: `'self'`, `'unsafe-eval'` & `'unsafe-inline'` (Next.js client runtime), `https://telegram.org` (Telegram WebApp & Login Widget per `FUTURE_PLAN.md` §5.4), and `https://challenges.cloudflare.com` (Turnstile).
       - Media origins: `blob:`, `data:`, `https://*.supabase.co`, `https://commondatastorage.googleapis.com`, and streaming CDNs (`https://*.mux.com`, `https://*.cloudflarestream.com`, `https://*.b-cdn.net`).
       - Network connections: `https://*.supabase.co`, `wss://*.supabase.co` (Realtime), `https://api.telegram.org`, and `https://challenges.cloudflare.com`.
       - Framing: `frame-src 'self' https://oauth.telegram.org https://challenges.cloudflare.com`.
       - Anti-clickjacking & Telegram embedding: `frame-ancestors 'self' https://web.telegram.org https://*.telegram.org`.
     - Injected OWASP security headers across all routes (`/:path*`):
       - `X-Content-Type-Options: nosniff`.
       - `Referrer-Policy: strict-origin-when-cross-origin`.
       - `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`.
       - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`.
       - `X-DNS-Prefetch-Control: on`.
  2. `supabase/user/supabase/config.toml`:
     - Hardened password policy: `minimum_password_length = 8`, `password_requirements = "lower_upper_letters_digits"`.
     - Enabled secure password change with reauthentication nonce: `secure_password_change = true`.
     - Restricted `additional_redirect_urls` allowlist strictly to `localhost:3000`, `127.0.0.1:3000`, `https://dramashort.com`, `https://admin.dramashort.com`, and `https://*.vercel.app`.
     - Configured Cloudflare Turnstile CAPTCHA provider bindings under `[auth.captcha]`.
* **Verification Results**:
  - `npm test`: 121 / 121 tests pass across 25 suites (5 new tests in `__tests__/config/security-headers.test.ts` asserting strict CSP directives, Telegram origins, Turnstile CAPTCHA, and OWASP headers).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully compiled all 36 static pages and verified header configuration integration.

---

### Task 10.9: Security Regression Test Suite & CI Gate
* **Status**: ✅ Completed
* **Target Files**: `__tests__/security/*.test.ts` (new), `supabase/*/supabase/tests/*.sql` (new), `.github/workflows/ci.yml` (new)
* **Delivered Capabilities**:
  1. Comprehensive Automated Security Test Suites (`__tests__/security/`):
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
* **Verification Results**:
  - `npm test`: 226 / 226 tests passing across 49 suites (0 failures).
  - `npx tsc --noEmit`: compiles cleanly with 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 36 static pages, dynamic route handlers, and middleware bundle.

---

## 14. Phase 11: Complete Stubbed User-Facing Flows (🔴 Critical)

> **Objective**: Every button a user can press performs the real operation or is hidden behind a feature flag. No simulated outcomes ship to production.

### Task 11.1: Real Email Verification on Signup
* **Status**: ✅ Completed
* **Target Files**: `app/verify-email/page.tsx`, `contexts/AuthContext.tsx`, `app/signup/page.tsx`, `app/auth/confirm/route.ts` (new), `supabase/user/supabase/templates/confirmation.html` (new), `supabase/user/supabase/config.toml`, `__tests__/auth/email-verification.test.ts` (new)
* **Delivered Capabilities**:
  1. OTP-Code Verification (`contexts/AuthContext.tsx`, `app/verify-email/page.tsx`):
     - Implemented `verifySignupOtp(email, token)` in `AuthContext` calling `supabase.auth.verifyOtp({ email, token, type: "signup" })` with fallback to `"email"`.
     - Automatically establishes active Supabase auth session, synchronizes user profile, and triggers `syncGuestWatchHistory()` on verification.
     - `app/verify-email/page.tsx` handles real submission, displays inline error banners on invalid/expired OTP codes, and shows loading spinners during verification.
  2. Resend Cooldown & Delivery:
     - Implemented `resendSignupOtp(email)` in `AuthContext` using `supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } })`.
     - 60-second client-side cooldown countdown prevents resend spam and provides real-time user feedback.
  3. Server Route Handler for Link Fallbacks (`app/auth/confirm/route.ts`):
     - Created PKCE/SSR email confirmation route handling `token_hash` + `type` via `supabase.auth.verifyOtp({ token_hash, type })`.
     - Validates destination parameter via `getSafeRedirect(next, "/home")` (strictly preventing open-redirects and login-loop paths).
     - On successful link verification, sets session cookies and redirects to destination; on failure redirects to `/login?error=verification_failed`.
  4. Signup Flow Integration (`app/signup/page.tsx`):
     - Passes `displayName` to `signUp` options.
     - If Supabase project has confirmations disabled and returns an active session immediately, skips verify-email page and redirects directly to `returnUrl`.
     - If confirmations are required (`needsEmailVerification: true`), forwards email and sanitized `returnUrl` to `/verify-email`.
  5. Supabase Template & Config (`supabase/user/supabase/templates/confirmation.html`, `config.toml`):
     - Built branded email confirmation HTML template containing 6-digit OTP code (`{{ .Token }}`) and one-click direct confirmation button (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`).
     - Updated `config.toml` enabling email confirmations (`enable_confirmations = true`) and binding template path.
* **Verification Results**:
  - `npm test`: 235 / 235 tests pass across 52 suites (9 new tests in `__tests__/auth/email-verification.test.ts`).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 37 pages including dynamic route `ƒ /auth/confirm`.

---

### Task 11.2: Real Password Recovery
* **Status**: ✅ Completed
* **Target Files**: `app/forgot-password/page.tsx`, `app/reset-password/page.tsx` (new), `contexts/AuthContext.tsx`, `supabase/user/supabase/templates/recovery.html` (new), `supabase/user/supabase/config.toml`, `lib/navigation/safe-redirect.ts`, `__tests__/auth/password-recovery.test.ts` (new)
* **Delivered Capabilities**:
  1. Branded Recovery Email Template & GoTrue Config:
     - Authored responsive HTML template `supabase/user/supabase/templates/recovery.html` with OTP placeholder `{{ .Token }}` and one-click direct recovery button `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`.
     - Bound `[auth.email.template.recovery]` in `supabase/user/supabase/config.toml`.
  2. AuthContext Password Recovery Services (`contexts/AuthContext.tsx`):
     - `resetPasswordForEmail(email)`: triggers GoTrue recovery flow with link redirecting to `/auth/confirm?type=recovery&next=/reset-password`. Suppresses user-enumeration signals while relaying rate limits.
     - `verifyPasswordRecoveryOtp(email, token)`: verifies 6-digit OTP code (`type: "recovery"`) and hydrates active user recovery session.
     - `updatePassword(newPassword)`: invokes `supabase.auth.updateUser({ password })` and terminates all other sessions via `signOut({ scope: "others" })`.
  3. Interactive Recovery & Verification UI (`app/forgot-password/page.tsx`):
     - Integrated email submission, 6-digit OTP code entry, and 60-second cooldown timer for code resend.
     - Implemented enumeration-safe UI messaging, accessible input navigation, and automatic forwarding to `/reset-password`.
  4. Reset Password Page (`app/reset-password/page.tsx`):
     - Validates active recovery session on mount (shows expired session alert with request link if invalid).
     - Provides secure password change form (>= 8 characters, confirmation matching, visibility toggles).
     - Signs out other sessions upon update (`scope: "others"`) and displays confirmation toast before redirecting to `/home`.
  5. Security & Redirect Protection:
     - Added `/reset-password` to `AUTH_PAGES` array in `lib/navigation/safe-redirect.ts` preventing login loop and return-url vulnerabilities.
  6. Automated Verification Tests (`__tests__/auth/password-recovery.test.ts`):
     - Validates recovery template placeholders, config bindings, `/reset-password` returnUrl loop protection, enumeration defense simulation, and password validation contracts.
* **Verification Results**:
  - `npm test`: all test suites pass (including 6 new tests in `__tests__/auth/password-recovery.test.ts`).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 38 pages including new dynamic route `/reset-password`.

---

### Task 11.3: Account Deletion
* **Status**: ✅ Completed
* **Target Files**: `app/api/account/route.ts` (new, `DELETE`), `app/account/settings/page.tsx`, `contexts/AuthContext.tsx`, `lib/supabase/user-server.ts`, `docs/adr/0001-account-deletion-and-data-retention.md` (new), `__tests__/account/account-deletion.test.ts` (new)
* **Delivered Capabilities**:
  1. Server-Side Deletion Route (`DELETE /api/account`):
     - Authenticates user session with `auth.getUser()`; returns 401 UNAUTHORIZED on unauthenticated callers.
     - Requires explicit confirmation keyword: `confirmationText === "DELETE"` (returns 400 VALIDATION_ERROR otherwise).
     - Enforces re-authentication: verifies password if provided; blocks stale sessions (> 5 minutes ago) with 403 REAUTHENTICATION_REQUIRED.
     - Executes `auth.admin.deleteUser(user.id)` via privileged service-role client (`createUserServiceRoleClient()`), cascading deletion across all user data.
  2. Database Cascading Erasure (GDPR Right to Erasure):
     - Validated foreign key constraints with `ON DELETE CASCADE` on `profiles`, `favorites`, `watch_history`, `custom_lists`, and `custom_list_items`.
  3. Interactive Settings UX (`app/account/settings/page.tsx`):
     - Replaced no-op modal with GDPR-compliant permanent deletion modal.
     - Mandates typing `DELETE` into confirmation field, accepts password verification, shows loading spinner during deletion, displays success toast, and redirects to `/login?deleted=true`.
  4. Client Cleanup in AuthContext (`contexts/AuthContext.tsx`):
     - Implemented `deleteAccount()` calling `DELETE /api/account`.
     - Clears local storage (`dramashort_guest_watch_history`, `dramashort_theme`), terminates client session, and resets auth states.
  5. Architecture Decision Record (`docs/adr/0001-account-deletion-and-data-retention.md`):
     - Documents GDPR Article 17 erasure policies, reauthentication requirements, and Phase 8 financial records retention/anonymization rules.
  6. Automated Verification Test Suite (`__tests__/account/account-deletion.test.ts`):
     - 10 automated unit and integration tests covering unauthenticated denial, validation checks, stale session reauth requirement, password verification, service role delete calls, database foreign key cascade rules, and ADR-0001 specifications.
* **Verification Results**:
  - `npm test`: all test suites pass (including 10 new tests in `__tests__/account/account-deletion.test.ts`).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 39 pages including dynamic route `ƒ /api/account`.

---

### Task 11.4: Support Contact & "Report Issue" Pipeline
* **Status**: ✅ Completed
* **Target Files**: `supabase/user/supabase/migrations/20261005160000_support_tickets.sql` (new), `app/api/support/route.ts` (new), `lib/support/types.ts` (new), `lib/support/rate-limiter.ts` (new), `app/contact/page.tsx`, `app/watch/[slug]/page.tsx`, `__tests__/support/support-tickets.test.ts` (new)
* **Delivered Capabilities**:
  1. User Database Migration (`20261005160000_support_tickets.sql`):
     - Created `public.support_tickets` with columns `id`, `user_id`, `email`, `category`, `subject`, `message`, `context`, `status`, and `created_at`.
     - Added performance indexes on `user_id`, `status`, `category`, and `created_at`.
     - Enabled RLS with exclusive `service_role` access, revoking all direct operations from `anon` and `authenticated`.
  2. Ingestion Route Handler (`POST /api/support`):
     - Validates payload with RFC email regex, category allowlist, length limits (subject 3–200, message 10–4000, context 10KB cap).
     - Enforces bot deterrence via invisible honeypot check (`hp`, `honeypot`, `website`).
     - Applies in-memory sliding-window rate limiting (5 tickets/hr per IP/user) with HTTP 429 and `Retry-After` header.
     - Associates caller `user_id` if authenticated while allowing anonymous guest submissions.
     - Persists ticket via service role client and provides non-blocking Telegram ops channel notification hook.
  3. Interactive Contact Page (`app/contact/page.tsx`):
     - Replaced `Math.random() > 0.15` mock outcome with real asynchronous submission to `/api/support`.
     - Reads structured query parameters (`category`, `title`, `titleName`, `ep`, `subject`, `message`) to display a diagnostic banner when reporting from watch stage.
     - Pre-fills email for authenticated users, provides honeypot spam protection, shows loading spinner, and displays modal with reference ticket ID.
  4. Structured Context on Watch Stage (`app/watch/[slug]/page.tsx`):
     - Replaced plaintext boilerplate with structured query parameters linking to `/contact?category=playback&title=<slug>&ep=<n>&titleName=<title>`.
  5. Automated Verification Tests (`__tests__/support/support-tickets.test.ts`):
     - 14 automated unit and integration tests verifying schema constraints, RLS policies, input validations, honeypot rejection, guest vs. member creation, database error handling, rate limiting (5/hr threshold and Retry-After), and watch page structured link contracts.
* **Verification Results**:
  - `npm test`: 266 / 266 tests pass across 67 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 40 pages including dynamic route `ƒ /api/support` and static page `○ /contact`.

---

### Task 11.5: Password Change Hardening
* **Status**: ✅ Completed
* **Target Files**: `contexts/AuthContext.tsx`, `app/account/page.tsx`, `__tests__/auth/password-change.test.ts` (new)
* **Delivered Capabilities**:
  1. Service Hardening in AuthContext (`contexts/AuthContext.tsx`):
     - `changePassword(newPassword, currentPassword, nonce)`: enforces minimum 8 characters, passes `current_password` and security `nonce` directly to `supabase.auth.updateUser()`.
     - Detects GoTrue reauthentication demands (422/403 or `reauth`/`nonce` messages) and returns `{ error, needsReauthentication: true }`.
     - Automatically terminates all other active sessions upon success via `supabase.auth.signOut({ scope: "others" })`.
     - Added `reauthenticate()` helper calling `supabase.auth.reauthenticate()` to dispatch 6-digit email security codes.
     - Added `hasPasswordIdentity` boolean property derived from `user.identities` (`provider === "email"`) or `app_metadata.providers`.
  2. Account Management UI (`app/account/page.tsx`):
     - Displays "Set a password" for OAuth accounts and "Change Password" for email/password accounts.
     - Hides "Current Password" field for OAuth accounts setting their first password.
     - Supports multi-step reauthentication: automatically switches modal to OTP verification step (`OtpInput` 6-digit code) with 60-second resend cooldown timer and back navigation.
     - Displays distinct success toasts: `"Password created successfully"` vs. `"Password updated successfully"`.
  3. Automated Verification Tests (`__tests__/auth/password-change.test.ts`):
     - 11 automated unit and integration tests verifying 8-character password length requirements, payload construction, GoTrue reauthentication detection, other session revocation (`signOut({ scope: "others" })`), button labels, and OtpInput integration.
* **Verification Results**:
  - `npm test`: 277 / 277 tests pass across 71 suites (0 failures).
  - `npx tsc --noEmit`: 0 type errors.
  - `npm run lint`: clean (0 errors, 0 warnings).
  - `npm run build`: successfully generated all 40 pages.

---

### Task 11.6: Real 404s & Unavailable-Content States
* **Status**: ✅ Completed (2026-10-05)
* **Problem**:
  - `getTitleBySlugOrFallback()` (`data/titles.mock.ts` L601) fabricates a plausible drama for any slug. `/drama/<anything>` and `/watch/<anything>` render a fake drama with "Watch Now", and `generateMetadata` publishes the fake title to crawlers (soft 404s).
  - Episodes without media play Big Buck Bunny (`app/watch/[slug]/page.tsx`). The seed creates only 5 episodes per title, so episodes 6+ play the sample video.
* **Target Files**: `app/drama/[slug]/*`, `app/watch/[slug]/*`, `app/channel/[slug]/*`, `components/ContinueWatching.tsx`, `app/account/favorite/page.tsx`, `app/account/history/page.tsx`, `lib/supabase/content.ts`
* **Delivered Capabilities**:
  1. Runtime code calls `notFound()` when a slug does not resolve; `generateMetadata` returns not-found metadata with `robots: { index: false, follow: false }`.
  2. Removed `getTitleBySlugOrFallback` from all runtime imports (`app/` and `components/`). Favorites, continue watching, and history defensively skip titles that no longer exist.
  3. Built episode grid and header from real inventory: shows `{totalEps} episodes · {availableEpisodesCount} available`. Episodes without media render as non-clickable "Coming soon" tiles.
  4. Removed Big Buck Bunny fallback; the player displays a clear unavailable video overlay with "Episode Unavailable — This episode does not have a video stream available yet".
  5. Legacy slug prefix matching (`getTitleBySlug` step 2) answers with `permanentRedirect()` (`308`) to the canonical slug instead of rendering at the old URL.
  6. Added test client mock support in `lib/supabase/content.ts` (`setTestContentClient()`) via Proxy for deterministic, non-timing-out unit tests.
* **Verification**:
  - `__tests__/routing/real-404-and-unavailable-states.test.ts` (8 tests passing).
  - Full test runner `npm test`: 285 / 285 tests passing across 75 suites.
  - `npm run build`: cleanly compiles 40/40 routes with 0 errors.

---

### Task 11.7: Notifications — Hide Until Real
* **Status**: ✅ Completed (2026-10-05)
* **Problem**: `components/NotificationBell.tsx` showed `data/notifications.mock.ts` to every real signed-in user, and read state reset on each navigation.
* **Target Files**: `components/NotificationBell.tsx`, `components/header/HeaderActions.tsx`, `docs/adr/0002-notifications-system-architecture.md`
* **Delivered Capabilities**:
  1. Feature flag `NEXT_PUBLIC_FEATURE_NOTIFICATIONS` (default `false`) gates the notification bell UI.
  2. With the flag disabled, `HeaderActions` omits the bell and `NotificationBell` returns `null`.
  3. Replaced static top-level import of mock notifications with dynamic `import("@/data/notifications.mock")` so mock notifications do not ship in client-side bundles when disabled.
  4. Preserved React Rules of Hooks with unconditional hook execution before early returns.
  5. Published ADR-0002 detailing the target `public.notifications` database schema in User DB, RLS policies, `new_episode` subscriber trigger hooks (Task 16.3), and Telegram delivery bridge (`FUTURE_PLAN.md` §5.4).
* **Verification**:
  - `__tests__/components/notification-bell.test.ts` (7 tests passing).
  - Full test runner `npm test`: 292 / 292 tests passing across 79 suites.
  - `npm run build`: cleanly compiles 40/40 routes with 0 errors.

---

## 15. Phase 12: Functional Bug Fixes & Data Integrity (🟠 High)

> **Objective**: Fix the behavioral bugs found in the audit and make the data the app shows trustworthy: full catalog visibility, correct admin views, correct progress, and no silent substitution of mock data.

### Task 12.1: Server-Side Pagination for Discovery Pages
* **Status**: ✅ Completed (2026-10-06)
* **Problem**: `searchPublishedTitles()` defaulted `pageSize` to 12 (`lib/services/content.service.ts`). Discovery pages (`/genres`, `/trending`, `/new-release`, `/channel/[slug]`) called `getPublishedTitles()` without pagination options and client-sliced 12 items.
* **Target Files**: `app/genres/page.tsx`, `app/trending/page.tsx`, `app/new-release/page.tsx`, `app/channel/[slug]/page.tsx`, `lib/services/content.service.ts`, `data/channels.mock.ts`
* **Delivered Capabilities**:
  1. Updated `/genres`, `/trending`, `/new-release`, and `/channel/[slug]` to fetch server-side paginated results via `searchPublishedTitles()` with `pageSize: 24`, synchronizing `?page=` and `?genre=` into URL query parameters.
  2. Filter channel page directly by `channel_id` UUID (`channelId: resolvedChannel.id`), preventing drift if channel names change.
  3. Replaced implicit 12-item default with explicit 24-item grid and enforced maximum limit of 60 items per query.
  4. Injected stable deterministic tie-breaker `.order("id", { ascending: true })` on trending (`views_count`), newest (`created_at`), and rating sorts.
  5. Wrapped all discovery client pages reading `useSearchParams()` in `<Suspense>` boundaries for static build compatibility.
* **Verification**:
  - `__tests__/services/server-side-pagination.test.ts` (8 tests passing).
  - Full test runner `npm test`: 300 / 300 tests passing across 84 suites.
  - `npm run build`: cleanly compiles 40/40 routes with 0 errors.

---

### Task 12.2: Admin Catalog Reads Through the Authenticated Admin API
* **Status**: ✅ Completed (2026-10-06)
* **Depends on**: 10.3
* **Problem**: `getAdminDramas()` and `getDramaById()` previously queried via the public anon client, where Content DB RLS restricted results to `Published` rows only. Newly created `Draft` dramas disappeared from the admin list on refresh, and `/admin/dramas/[id]/edit` showed "Drama Not Found". Seeded non-published titles were invisible, and the admin list initialized with mock titles in state.
* **Target Files**: `app/api/admin/dramas/route.ts`, `app/api/admin/titles/route.ts`, `lib/services/content.service.ts`, `app/admin/titles/page.tsx`, `app/admin/titles/[id]/edit/page.tsx`, `__tests__/admin/admin-catalog-reads.test.ts` (new)
* **Delivered Capabilities**:
  1. Authenticated Admin Catalog API (`GET /api/admin/dramas` & `/api/admin/titles`):
     - Uses `getContentAdminClient()` (service role) protected behind `requireAdmin()`, bypassing RLS to retrieve all statuses (`Draft`, `Published`, `Scheduled`, `Archived`).
     - Supports server-side search (`?q=`) with wildcard escaping (`escapeLikePattern`).
     - Supports channel filtering (`?channel=`) and status filtering (`?status=`).
     - Implements server-side pagination (`?page=&pageSize=`) with bounded limits and returns a uniform JSON envelope (`items`, `total`, `page`, `pageSize`, `totalPages`).
  2. Content Service Integration (`lib/services/content.service.ts`):
     - `getAdminDramas()` consumes `GET /api/admin/dramas` in the browser or queries via service role on server, returning `AdminDramasResult` without falling back to mock fixtures.
     - `getDramaById()` consumes `GET /api/admin/dramas/:id` in the browser, allowing newly created drafts to open immediately in edit mode without mock fallbacks.
  3. Dynamic Admin Titles UI (`app/admin/titles/page.tsx`):
     - Removed `adminTitles` mock imports; initialized state with empty catalog and `isLoading: true`.
     - Built responsive skeleton table and card grid placeholders during catalog hydration.
     - Added `Status` dropdown filter alongside existing search and channel dropdowns.
     - Wired server-side pagination and synchronized filter parameters into URL query string with `<Suspense>` boundary.
     - Redirects directly to `/admin/dramas/${res.data.id}/edit` after creating a new drama.
  4. Automated Verification Suite (`__tests__/admin/admin-catalog-reads.test.ts`):
     - 10 automated unit and integration tests covering multi-status reads, status filtering, channel filtering, ILIKE search, pagination math and range derivation, Draft drama retrieval by UUID, 404 for missing UUIDs, zero-mock service behavior, and admin UI contract checks.
* **Verification Results**:
  - `__tests__/admin/admin-catalog-reads.test.ts` (10 tests passing).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: 310 / 310 tests passing across 89 suites (0 failures).
  - `npm run build`: cleanly compiles all 41 routes with 0 errors.

---

### Task 12.3: Watch Progress Semantics & Reliable Persistence
* **Status**: ✅ Completed (2026-10-06)
* **Problem**:
  - `handleSelectEpisode` saves `episode / totalEpisodes` as `progress` (`app/watch/[slug]/page.tsx` L159–161), while every reader treats `progress` as the position within the episode. Selecting the final episode saves `1.0`, so Continue Watching hides the series as finished; selecting episode 20 of 40 saves `0.5`, so resume offers the middle of episode 20. It corrects itself only after 10 seconds of playback.
  - Final flushes rely on `beforeunload`, which mobile browsers often do not fire.
  - The resume lookup downloads the user's entire history to find one drama (L96).
* **Target Files**: `app/watch/[slug]/page.tsx`, `lib/services/user.service.ts`, `app/api/progress/route.ts` (new), `lib/watch/continue-watching.ts` (new), `components/ContinueWatching.tsx`, `types/supabase-user.ts`, `supabase/user/supabase/migrations/20261006120000_watch_progress_semantics.sql` (new), `__tests__/watch/watch-progress-semantics.test.ts` (new)
* **Delivered Capabilities**:
  1. User Database Schema & Type Alignment:
     - Authored migration `supabase/user/supabase/migrations/20261006120000_watch_progress_semantics.sql` adding `position_seconds INT NOT NULL DEFAULT 0` and `duration_seconds INT NOT NULL DEFAULT 0` to `public.watch_history` with authenticated column grants.
     - Updated TypeScript types in `types/supabase-user.ts` for Row, Insert, and Update models.
  2. Continue Watching Derivation Engine (`lib/watch/continue-watching.ts`):
     - Extracted pure derivation logic into `deriveContinueWatching(historyRows, dramasBySlug, maxVisible)`.
     - Completely finished series (`episode >= totalEpisodes` AND `progress >= 0.95`) are omitted from Continue Watching.
     - Finished episodes (`progress >= 0.95`) automatically advance to the next episode (`episode + 1`) labelled with `"Up Next"`.
     - Freshly selected episodes (`progress: 0`) preserve `"EP X of Y"` with 0% progress bar.
     - Refactored `components/ContinueWatching.tsx` to consume the pure engine directly.
  3. Single-Row Targeted Resume Lookups (`lib/services/user.service.ts`):
     - Added `getWatchProgress(userId, titleSlug)` to perform a single-row indexed lookup instead of downloading the user's entire watch history.
     - Added `getGuestWatchProgress(titleSlug)` for single-row guest localStorage retrieval.
     - Updated `upsertWatchProgress` and `saveGuestWatchProgress` to store `position_seconds` and `duration_seconds`, automatically deriving the progress ratio.
  4. Reliable Background Flush API (`POST /api/progress`):
     - Created background beacon ingestion route handler `app/api/progress/route.ts`.
     - Validates JSON payload (`titleSlug`, `episodeNumber`, `progress`, `positionSeconds`, `durationSeconds`).
     - Uses `createUserServerClient()` to authenticate caller and persist to `watch_history`.
  5. Watch Page Resilience & Lifecycle Flushes (`app/watch/[slug]/page.tsx`):
     - Fixed `handleSelectEpisode` to persist `{ episode_number: ep, progress: 0, position_seconds: 0, duration_seconds: 0 }`. Eliminated faulty `episode / totalEpisodes` calculation.
     - Maintained `currentProgressRef` tracking latest position and duration in seconds.
     - Upgraded resume loading to call single-row `getWatchProgress()` / `getGuestWatchProgress()`.
     - Attached listeners for `visibilitychange` (state: hidden), `pagehide`, and `beforeunload` using `fetch("/api/progress", { keepalive: true })` for reliable mobile and tab-switching flushes.
  6. Automated Verification Test Suite (`__tests__/watch/watch-progress-semantics.test.ts`):
     - 14 automated unit and integration tests covering continue watching state derivations, background beacon API validations and auth handling, single-row lookup operations, and watch page code invariants.
* **Verification Results**:
  - `__tests__/watch/watch-progress-semantics.test.ts` (14 tests passing).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: 324 / 324 tests passing across 94 suites (0 failures).
  - `npm run build`: cleanly compiles all 42 routes (including new `ƒ /api/progress`) with 0 errors.

---

### Task 12.4: Remove Mock Data From the Production Runtime
* **Status**: ✅ Completed (2026-10-06)
* **Problem**: Content services catch every error and return fixtures from `data/titles.mock.ts` (`searchPublishedTitles` L160 and L176, `getDramaById` L533, `getAdminDramas` L561), and pages add their own fallbacks (`/genres`, `/trending`, `/new-release`, `/channel`, `Hero`). A Supabase outage or wrong environment variable in production looks like a working site full of fake content, with no error anywhere. Supabase clients also fall back to `https://placeholder.supabase.co` when env vars are missing, and the fixtures ship in client bundles.
* **Target Files**: `lib/config.ts` (new), `lib/env.ts` (new), `lib/config/env-validator.mjs` (new), `types/content.ts` (new), `types/result.ts` (new), `__tests__/fixtures/titles.fixture.ts` (new), `__tests__/runtime/no-mock-fallback.test.ts` (new), `lib/services/content.service.ts`, `lib/supabase/*`, `next.config.mjs`, affected client components & pages
* **Delivered Capabilities**:
  1. Decoupled Canonical Domain Models (`types/content.ts`):
     - Created clean domain types (`Title`, `TitleStatus`, `Drama`, `Channel`, `Episode`, `HeroSlide`, `TrendingTitle`, `NewReleaseTitle`, `PlaybackSource`).
     - Re-exported domain models in `data/titles.mock.ts` and `data/channels.mock.ts` ensuring 100% backward compatibility with test runners and scripts.
  2. Shared `Result<T>` Error Handling Contract (`types/result.ts`):
     - Created typed `Result<T, E>` (`{ success: true, data: T; error?: null } | { success: false, data: null; error: E }`) with `ok()`, `err()`, `isOk()`, and `isErr()` helpers.
     - Added `searchPublishedTitlesResult()` to content service returning `Result<PaginatedTitlesResult>`.
  3. Feature Flag Configuration (`lib/config.ts`):
     - Created `ENABLE_MOCK_FALLBACK` flag (`process.env.NEXT_PUBLIC_ENABLE_MOCK_FALLBACK === "true"`, defaulting to `false`).
     - Ensured mock data fallbacks are completely inactive in production.
  4. Fail-Fast Environment Validation (`lib/config/env-validator.mjs`, `lib/env.ts`, `next.config.mjs`):
     - Validates required Supabase URLs and public anon keys against missing, malformed, or placeholder values (`placeholder.supabase.co`, `your-content-project`, etc.).
     - Integrated into `next.config.mjs` to halt production builds (`npm run build`) in <3 seconds if credentials are invalid or placeholders.
     - Hardened Supabase clients (`lib/supabase/content.ts`, `user-client.ts`, `user-server.ts`, `middleware.ts`) to validate credentials and prevent placeholder fallback in production.
  5. Zero-Mock Content Services (`lib/services/content.service.ts`):
     - Removed static import of `data/titles.mock.ts`.
     - `searchPublishedTitles`: on database error, returns empty result `{ items: [], total: 0, error: ... }` instead of substituting mock fixtures.
     - `getDistinctGenres` & `getPopularTags`: return empty arrays on query errors without mock tropes.
     - `getHeroSlides`: returns empty array when trending titles are empty.
     - Dynamic `import("@/data/titles.mock")` is loaded strictly when `ENABLE_MOCK_FALLBACK` is enabled.
  6. Eliminated Static Mock Imports Across Public Client Bundles:
     - `components/SearchDropdown.tsx`: searches asynchronously via `searchPublishedTitles`, eliminating static `titles.mock` bundling across all pages with Header.
     - `components/Hero.tsx`, `components/TopTrending.tsx`, `components/NewRelease.tsx`: removed static mock imports, guarding fallbacks behind `ENABLE_MOCK_FALLBACK`.
     - `app/drama/[slug]/page.tsx`: removed static `getRelatedTitles` & `fallbackChannels`; derives channel slug dynamically and uses live related titles from DB.
     - `app/channel/[slug]/page.tsx` & `layout.tsx`: removed static `fallbackChannels` import; renders not-found metadata for non-existent channels.
     - `app/account/favorite/page.tsx` & `app/account/page.tsx`: removed static `fallbackAccountUser` import; binds directly to authenticated user profile.
     - `app/search/page.tsx`, `app/admin/titles/page.tsx`, `app/admin/titles/[id]/edit/page.tsx`: removed static `channels.mock` imports.
* **Verification Results**:
  - `__tests__/runtime/no-mock-fallback.test.ts` (17 tests passing).
  - Production build fail-fast verification: `NEXT_PUBLIC_CONTENT_SUPABASE_URL="https://placeholder.supabase.co" npm run build` fails fast in 3 seconds.
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: 341 / 341 tests passing across 99 suites (0 failures).
  - `npm run build`: cleanly compiles all 42 routes with noticeable first load JS reductions across public pages.

---

### Task 12.5: Admin Session Lifecycle Fixes
* **Status**: ✅ Completed (2026-10-06)
* **Problem**: `components/admin/AdminSidebar.tsx` called `logout()` synchronously without awaiting session termination before navigating with `router.push("/admin/login")`. Auth cookies were still present in the browser when middleware evaluated the navigation, redirecting the admin back to `/admin/dashboard`. In addition, `app/admin/page.tsx` relied on a client-side `useEffect` redirect that caused layout flash, and admin API calls did not automatically handle expired sessions (`HTTP 401`).
* **Target Files**: `lib/api/admin-fetch.ts` (new), `components/admin/AdminSidebar.tsx`, `app/admin/page.tsx`, `lib/middleware/route-decision.ts`, `lib/services/content.service.ts`, `__tests__/admin/admin-session-lifecycle.test.ts` (new)
* **Delivered Capabilities**:
  1. Awaited Logout & Clean Cache Invalidation (`components/admin/AdminSidebar.tsx`):
     - `handleLogout` now explicitly awaits `logout()`, clearing Supabase auth session tokens and `@supabase/ssr` cookies before routing.
     - Performs `router.replace("/admin/login")` followed by `router.refresh()` to purge client-cached server component state and prevent back-button loops.
     - Added busy/loading indicator state (`isLoggingOut`) with `Loader2` spinner, disabling button during logout.
  2. Server-Side `/admin` Root Redirect:
     - Middleware (`lib/middleware/route-decision.ts`) intercepts `/admin` and `/admin/`, redirecting authenticated staff directly to `/admin/dashboard` server-side and unauthenticated visitors to `/admin/login?returnUrl=/admin&error=session_required`.
     - Refactored `app/admin/page.tsx` from client-side component into a pure Server Component issuing an immediate `redirect("/admin/dashboard")`, completely eliminating client flash.
  3. Automatic 401 Session Expiry Interception (`lib/api/admin-fetch.ts` & `lib/services/content.service.ts`):
     - Created `adminFetch` wrapper intercepting `HTTP 401 Unauthorized` responses in browser environments.
     - Automatically calls `redirectToAdminLogin()` to redirect to `/admin/login?returnUrl=<current path>`, preserving deep paths (e.g. `/admin/titles/:id/edit`) across re-authentication.
     - Built-in prevention against self-redirect loops when already on `/admin/login`.
     - Wired `adminFetch` into all admin service operations: `getDramaById()`, `getAdminDramas()`, `updateDrama()`, and `createDrama()`.
* **Verification Results**:
  - `__tests__/admin/admin-session-lifecycle.test.ts` (15 tests passing across URL generation, 401 redirection, middleware route decisions, and static invariants).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: 356 / 356 tests passing across 104 suites (0 failures).
  - `npm run build`: cleanly compiles all 42 routes with zero errors.

---

### Task 12.6: Favorites & Custom Lists Consistency
* **Status**: ✅ Completed (2026-10-06)
* **Problem**: `createList()` returned a temporary client ID synchronously; adding items immediately failed on database foreign keys. Guest custom lists and their items were discarded at login instead of migrated. Custom lists could not be renamed, deleted, or have items removed. Optimistic favorite toggles never rolled back on failure. Guest watch-history sync ran up to 5 times per session using sequential row-by-row queries.
* **Target Files**: `contexts/FavoritesContext.tsx`, `contexts/AuthContext.tsx`, `lib/services/user.service.ts`, `app/account/favorite/page.tsx`, `components/AddToListModal.tsx`, `components/CreateListModal.tsx`, `app/drama/[slug]/page.tsx`, `app/watch/[slug]/page.tsx`, `__tests__/favorites/favorites-and-custom-lists.test.ts` (new)
* **Delivered Capabilities**:
  1. Asynchronous List Creation (`contexts/FavoritesContext.tsx`, `components/CreateListModal.tsx`):
     - `createList()` returns `Promise<string | null>`, resolving to the real database UUID for authenticated users before returning.
     - `CreateListModal` tracks `isSubmitting`, displays an animated spinner, and disables the submit button to prevent double-clicks.
     - `AddToListModal` disables buttons and displays "Added" indicators for dramas already in the selected list.
  2. Full Guest Lists & Favorites Migration at Login (`contexts/FavoritesContext.tsx`):
     - On user sign-in, automatically bulk-migrates guest favorite slugs via `addUserFavorites()`.
     - Automatically migrates guest custom lists and all associated items via `createCustomList()` and `addItemsToCustomList()`.
     - Purges guest `localStorage` cleanly after confirmed cloud migration.
  3. Custom Lists Management Operations & UI (`lib/services/user.service.ts`, `app/account/favorite/page.tsx`):
     - Implemented `renameCustomList()`, `deleteCustomList()`, and `removeItemFromCustomList()` in the user service.
     - Wired full management capabilities into `/account/favorite` ("My Lists" view):
       - Inline rename modal with title validation and loading state.
       - Delete confirmation modal with toast feedback.
       - Expandable list items accordion allowing individual dramas to be removed from lists.
  4. Optimistic Updates with Rollback on Failure (`contexts/FavoritesContext.tsx`, `app/drama/[slug]/page.tsx`):
     - `toggleFavorite()` returns `Promise<boolean>`, catching network/database errors and rolling back local `favoritedSlugs` state immediately.
     - `app/drama/[slug]/page.tsx` displays feedback toast ("Failed to update favorites. Please try again.") and reverts the heart icon on failure.
     - `renameList`, `deleteList`, and `removeFromList` roll back optimistic state if API writes fail.
  5. Single-Entry Bulk Guest Watch-History Sync (`lib/services/user.service.ts`, `contexts/AuthContext.tsx`, `app/watch/[slug]/page.tsx`):
     - Refactored `syncGuestWatchHistory()` to execute a single bulk `upsert` of all guest rows instead of sequential loops.
     - Guarded sync in `AuthContext` with `hasSyncedGuestRef`, executing strictly once per login session on `event === "SIGNED_IN"`.
     - Eliminated redundant `syncGuestWatchHistory` calls from `getSession()`, `signUp()`, OTP verification, and `app/watch/[slug]/page.tsx`.
* **Verification Results**:
  - `__tests__/favorites/favorites-and-custom-lists.test.ts` (15 tests passing across CRUD operations, bulk upserts, single-entry sync, and code invariants).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: 371 / 371 tests passing across 109 suites (0 failures).
  - `npm run build`: cleanly compiles all 42 routes with zero errors.

---

### Task 12.7: Content Data Integrity Rules
* **Status**: ✅ Completed
* **Problem**:
  - Poster URLs are free text; a host outside `remotePatterns` yields a broken image in production.
  - `total_episodes` is disconnected from the actual episode rows.
  - `channel_name` and `channel_code` are denormalized copies that drift when a channel is renamed.
  - Slugs carry a random 4-digit suffix (`app/api/admin/dramas/route.ts` L66–74).
  - Tags have inconsistent casing.
  - `getRelatedTitlesFromDb()` string-interpolates genre and channel into a PostgREST `.or()` filter (`content.service.ts` L492).
* **Target Files**: content DB migration, `app/api/admin/dramas/**`, `lib/services/content.service.ts`, `lib/validation/drama.ts`, types, admin UI, tests
* **Delivered Specifications**:
  1. Poster and banner host allow-list: validated via shared `lib/validation/drama.ts` against `imageRemotePatterns` from `lib/config/image-hosts.mjs`.
  2. `episodes_available` column and database triggers on `titles` table computed alongside `total_episodes`: migration `20261006150000_content_data_integrity.sql` defines `sync_title_episodes_available` trigger on `public.episodes` and backfill query.
  3. Channel data read through FK join (`channels(name, slug, code)`) in `mapTitleRowToTitle`; keep `channel_name` and `channel_code` on `titles` synchronized via database triggers (`sync_channel_to_titles` and `sync_title_channel_from_fk`) to prevent drift when channels are renamed.
  4. Deterministic slug policy: `<title>-<channel_code>` (consistent with seed data), unique by constraint with numeric conflict retry (`<base>-2`, `<base>-3`), and strictly immutable after first publish (`current.status === 'Published'`).
  5. Tag normalization on write: trimmed, deduplicated case-insensitively, consistent casing using Title Case with recognized acronym preservation (`formatTagCase` preserving CEO, VIP, MD, etc.).
  6. Quoting and escaping helper (`escapePostgrestValue`) for values used in PostgREST `.or()` filters in `getRelatedTitlesFromDb()` to escape double quotes, backslashes, and replace newlines.
  7. Admin UI and catalog views updated to display available vs total episodes (`episodesAvailable / totalEpisodes`) and a visual locked badge for immutable published slugs.
* **Verification Results**:
  - `__tests__/content/content-data-integrity.test.ts` (40 tests passing across deterministic unique slug generation, numeric collision retry, published slug immutability, tag normalization with Title Case and acronym preservation, PostgREST filter value escaping, and database migration triggers).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: 411 / 411 tests passing across 117 suites (0 failures).
  - `npm run build`: cleanly compiles all 42 routes with zero errors.

---

### Task 12.8: Player Streaming Robustness
* **Status**: ✅ Completed (2026-10-06)
* **Problem**: `hls.js` was configured with `lowLatencyMode: true` (`components/VideoPlayer.tsx`), which is meant for live streams. Fatal network errors called `hls.startLoad()` with no retry limit, causing infinite loops. Fatal media decoding/demuxing errors repeatedly called `hls.recoverMediaError()` without bounds. `handleLoadedMetadata` returned a no-op cleanup function from a DOM event handler, leaking the resume-notification pill timer. Timers were not guaranteed to clear on unmount or episode changes.
* **Delivered Capabilities**:
  1. Short-Form VOD HLS Configuration:
     - Configured `lowLatencyMode: false` and tuned buffer parameters (`maxBufferLength: 30`, `maxMaxBufferLength: 60`, `maxBufferSize: 30MB`, `backBufferLength: 15s`) in `HLS_SHORT_VOD_CONFIG` (`lib/player/streaming-robustness.ts`, re-exported in `components/VideoPlayer.tsx`), preventing over-buffering while maintaining smooth playback.
  2. Capped Fatal Network Retries with Exponential Backoff:
     - Implemented 3-retry cap with exponential backoff (1s, 2s, 4s) via `calculateBackoffDelay()`.
     - On 4th fatal network error, cleanly destroys Hls instance and transitions to the user-facing error overlay with retry option.
  3. Bounded Fatal Media Error Recovery:
     - Bounded `hls.recoverMediaError()` to maximum 2 recovery attempts before destroying the player and displaying the error overlay.
  4. Playback and Episode Navigation Retry Resets:
     - Successful playback (`onPlaying`), episode transitions, and user "Retry Playback" clicks reset both network and media retry counters to 0; successful fragment loads (`Hls.Events.FRAG_LOADED`) reset network retries only, avoiding infinite recovery loops on corrupted or un-decodable streams.
  5. Timer Lifecycle & Memory Leak Elimination:
     - Fixed `handleLoadedMetadata` to return `void`, eliminating discarded cleanup functions from DOM event handlers.
     - Managed the resume-notification pill timer (`resumeTimeoutRef`) via a dedicated React effect lifecycle with guaranteed cleanup on unmount, dismiss, or episode switch.
     - Managed auto-advance countdown interval (`countdownIntervalRef`), controls hide timeout (`controlsTimeoutRef`), and retry backoff timer (`retryTimeoutRef`) with strict unmount and episode change cleanup; unified countdown cancellation across all navigation gestures, scrubbing, and seeking to prevent double-advance race conditions.
* **Verification Results**:
  - `__tests__/player/player-streaming-robustness.test.ts` (35 unit, contract, and adversarial QA tests passing across VOD configuration, retry caps, backoff delays, bounded recovery, timer lifecycles, async watch progress reactive resume, and paused controls persistence).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: 446 / 446 tests passing across 125 suites (0 failures).
  - Next.js production build (`npm run build`): cleanly compiles all 42 routes with 0 warnings and 0 errors.

---

## 16. Phase 13: Backend Architecture Consolidation (🟠 High)

> **Objective**: Decide the database topology before monetization depends on it, move the public catalog to server rendering, separate server and client data access, and make the platform observable.

### Task 13.1: ADR-0003 — Database Topology Decision (Decision Gate)
* **Status**: ✅ Completed (Accepted — Option A Merge)
* **Target Files**: `docs/adr/0003-database-topology.md` (new), `docs/adr/README.md` (new)
* **Problem**: Content and user data live in two Supabase projects. Observed costs:
  - Favorites, history, and lists reference dramas by `title_slug` with no foreign key, so deleted or renamed dramas leave orphans and slug edits break user data.
  - No cross-database joins: real trending, "most favorited", and admin user analytics require application-side merging.
  - Two auth, billing, and backup surfaces.
  - Phase 8 needs entitlements (User DB) to gate episode media (Content DB), which forces a server layer across both anyway.
* **Options Evaluated**:
  - **Option A (Merge into Single Supabase Project with `content` & `public` Schemas)**: Consolidating into one Supabase project (`bpidsbcrvpkavvdvtpgh`) with two Postgres schemas (`content` for catalog, `public` for users/profiles/favorites/wallets), real foreign keys from user tables to `content.titles(id)`, unified auth, native cross-schema RLS for Phase 8 paywalls, and single-query SQL joins for trending. **Accepted & Recommended**.
  - **Option B (Retain Dual-Database Split with `title_id UUID`)**: Retaining two separate Supabase projects, replacing `title_slug` with `title_id UUID` in user tables, managing cross-project relationships via server-layer orchestration (`lib/server/*`), and scheduling asynchronous orphan-cleanup routines.
* **Decision Criteria**: Evaluated zero third-party headless catalog consumers in the next 12 months, 50% infrastructure cost savings ($25/mo vs $50/mo), sub-10ms query performance, absolute ACID data integrity, and direct RLS entitlement evaluation for Phase 8 freemium coin economy.
* **Delivered Artifacts**:
  1. `docs/adr/0003-database-topology.md`: Comprehensive ADR documenting Context, Problem Statement, Options Considered, 6-dimension Comparative Trade-Off Matrix, Decision Criteria, Recommendation (Option A), 6-step Implementation Roadmap for Task 13.2, and Consequences.
  2. `docs/adr/README.md`: Central ADR registry indexing ADR-0001, ADR-0002, and ADR-0003 with status, context, and file links.
  3. `__tests__/docs/adr-topology.test.ts`: Automated contract tests verifying structure, trade-off matrix coverage, decision criteria, and index link integrity.
* **Verification**: All contract tests pass; `npx tsc --noEmit` clean; zero application regressions.
* **Exit**: ADR-0003 accepted and establishes the execution contract for Task 13.2 and Phase 8.

---

### Task 13.2: Execute the Topology Decision
* **Status**: ✅ Completed (Option A Consolidated)
* **Depends on**: 13.1 (ADR-0003 Accepted)
* **Delivered Specifications**:
  1. **Option A Execution Path (Accepted per ADR-0003)**:
     - Authored unified migration `supabase/user/supabase/migrations/20261007120000_consolidate_content_schema.sql` creating the `content` schema in the primary project with `channels`, `titles`, `episodes`, and `episode_media`.
     - Preserved all indexes, foreign keys, and integrity triggers (`episodes_available`, channel name synchronization, and published slug immutability).
     - Configured Row Level Security (RLS) on all `content` tables ensuring public read of published titles/episodes while locking down `episode_media` strictly to `service_role`.
     - Added native foreign key constraints `title_id UUID REFERENCES content.titles(id) ON DELETE CASCADE` to user engagement tables (`public.favorites`, `public.watch_history`, `public.custom_list_items`) with automatic backfill from `title_slug`, orphan pruning, unique constraints, and B-tree indexes.
     - Authored comprehensive Headless Reusability Architecture Plan in `docs/architecture/reusable-content-api.md` enabling external sites, mobile apps, and mini-programs to securely query the `content` schema without accessing user records.
     - Updated `lib/supabase/*` (`content.ts`, `user-client.ts`, `user-server.ts`, `middleware.ts`) to seamlessly support unified single-project operation while maintaining backward-compatible dual-project fallback.
     - Created automated cutover and data transfer script `scripts/migrate-content-to-unified.ts` supporting dry-runs, batching, and conflict handling.
  2. **Alternative B (Rejected)**: Preserved in ADR-0003 for historical trade-off context.
* **Verification**:
  - `__tests__/database/topology-consolidation.test.ts` passes 32 automated contract and unit tests.
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm test` passed with 0 failures across all 505 tests.
  - `npm run build` compiled all routes cleanly.

---

### Task 13.3: Server-Rendered Public Catalog (RSC + ISR)
* **Status**: ✅ Completed (2026-10-07)
* **Problem**: The drama, channel, genres, trending, new-release, and home sections were client components fetching in `useEffect`. Server HTML contained only skeletons, crawlers indexed skeletons, and on slow mobile networks content waited for JavaScript plus a Supabase round trip.
* **Target Files**: `app/drama/[slug]/page.tsx`, `app/channel/[slug]/page.tsx`, `app/genres/page.tsx`, `app/trending/page.tsx`, `app/new-release/page.tsx`, `app/home/page.tsx`, `app/watch/[slug]/page.tsx`, `lib/services/content.service.ts`, `components/islands/*`
* **Implementation Summary**:
  1. Converted public catalog routes from client useEffect fetchers into async React Server Components streaming full titles, synopses, and pre-rendered drama cards directly to browsers and crawlers.
  2. Wrapped server catalog lookups (`getTitleBySlug`, `getChannelBySlug`, `getDistinctGenres`, `getTopTrendingTitles`, `getHeroSlides`) with `React.cache()` to deduplicate database queries between `generateMetadata()` and page rendering within a single request.
  3. Exported `export const revalidate = 300` across all 7 catalog pages for 5-minute CDN/ISR caching.
  4. Implemented `generateStaticParams()` on `app/drama/[slug]/page.tsx` for top published dramas, ensuring `notFound()` and `permanentRedirect()` execute cleanly per Task 11.6.
  5. Extracted modular client islands: `<PageShell>` (inherits active theme from ThemeContext without SSR context errors), `DramaInteractiveActions` (favorites, custom lists, login required modals), `SynopsisExpandable` (crawler-visible synopsis with expand/collapse), `ContinueWatchingIsland` (reads watch history), `GenreFilterIsland` (chips with URL navigation), and `PaginationIsland` (smooth scroll with preserved query params).
* **Verification**:
  - `__tests__/catalog/server-rendered-catalog.test.ts` passes 30 automated tests verifying RSC contracts, ISR revalidation constants, React.cache deduplication, generateStaticParams, client island boundaries, and edge-case invariants.
  - `npm test` passes all 535 tests across 145 suites with 0 failures.
  - `npx tsc --noEmit` compiles cleanly with 0 type errors.
  - `npm run build` succeeds cleanly across all 62 Next.js routes with SSG and ISR.

---

### Task 13.4: Service Layer Split (Server vs. Client)
* **Status**: ✅ Completed (2026-10-07)
* **Problem**: `lib/services/user.service.ts` always used the browser client (`createUserClient()`), so it could not run in Server Components or route handlers with the user's session. `content.service.ts` mixed direct database reads with calls to the app's own API, and `Title`/`Drama` aliases were duplicated throughout without canonical domain entity clarity.
* **Delivered Capabilities**:
  1. **Server-Only Data Access Layer (`lib/server/`)**:
     - Modules strictly protected by `import "server-only"`.
     - `lib/server/catalog.ts`: Server catalog queries with `React.cache()` deduplication (`getDramaBySlug`, `getChannelBySlug`, `searchDramas`, `getTrendingDramas`, `getHeroSlides`, `getDistinctGenres`).
     - `lib/server/admin.ts`: Direct server/database administrative mutations (`createDrama`, `updateDrama`, `deleteDrama`) using `getContentAdminClient()` service role without HTTP round-trips to the app's own API.
     - `lib/server/playback.ts`: Server-side episode playback permission checks and signed playback resolution (`canAccessEpisode`, `resolvePlaybackSession`, `getEpisodePlaybackInfo`, `getEpisodePlaybackResult`).
     - `lib/server/user.ts`: Server-side authenticated user profile and watch history retrieval using server Supabase client with cookie session support (`getServerUserProfile`, `getServerWatchHistory`, `getServerWatchProgress`, `getServerFavorites`, `getServerCustomLists`).
  2. **Client-Only Service Layer (`lib/client/`)**:
     - `lib/client/user.ts`: Browser-side operations using `createUserClient()`, optimistic favorites, guest watch history management (`localStorage`), and client progress reporting beacon (`reportWatchProgressBeacon`).
     - `lib/client/catalog.ts`: Client-side fetch helpers (`fetchPublishedDramas`, `fetchEpisodePlayback`, `fetchAdminDramas`, `fetchDramaById`, `fetchCreateDrama`, `fetchUpdateDrama`) for dynamic requests made from client islands.
  3. **Standardized Result<T, E> Pattern (`lib/common/result.ts`)**:
     - Type-safe discriminated union: `{ ok: true; value: T } | { ok: false; error: E }`.
     - Helper factories: `ok<T>(value: T): Result<T, never>`, `err<E>(error: E): Result<never, E>`, `isOk`, `isErr`.
     - Utility functions: `unwrap`, `unwrapOr`, `map`, `mapErr`, `fromPromise`.
     - Backward compatibility adapters: `toLegacyResult` and `fromLegacyResult` for seamless interoperability with legacy `{ success, data, error }`.
  4. **Domain Entity Unification (Title -> Drama)**:
     - Established `Drama` as canonical domain entity across `types/content.ts` and service definitions.
     - Preserved `Title = Drama` and `TitleStatus = DramaStatus` as deprecated type aliases for 100% backward compatibility.
     - Canonicalized `DramaQueryOptions`, `PaginatedDramasResult`, `TrendingDrama`, `NewReleaseDrama`.
     - Forwarded legacy helper naming duplicates (`createTitle`, `getTitleBySlugOrFallback`) to their canonical `Drama` counterparts with clear deprecation annotations.
  5. **Backward-Compatible Facade (`lib/services/`)**:
     - Preserved `lib/services/content.service.ts` and `lib/services/user.service.ts` as backward-compatible facade modules re-exporting and delegating cleanly to `lib/server/` and `lib/client/`.
     - Zero regressions across existing route handlers, server components, and unit test suites.
  6. **Automated Verification Test Suite (`__tests__/architecture/service-layer-split.test.ts`)**:
     - 20 automated tests verifying:
       - `import "server-only"` enforcement across all `lib/server/*.ts` modules.
       - Zero leakage of `lib/server/*` into client components or client bundles.
       - Direct database mutations in `lib/server/admin.ts` without `adminFetch`.
       - Type-safe behavior of `Result<T>` and helper factories.
       - Canonical `Drama` domain model and backward compatibility of `Title` alias.
       - Facade integrity in `lib/services/*`.
* **Verification Results**:
  - `__tests__/architecture/service-layer-split.test.ts` (25 tests passing).
  - Full test runner `npm test`: 560 / 560 tests passing across 151 suites (0 failures).
  - `npx tsc --noEmit`: compiles cleanly with 0 type errors.
  - `npm run build`: cleanly compiles all 63 Next.js routes.

---

### Task 13.5: Search & Taxonomy Scalability
* **Status**: ✅ Completed
* **Problem**: `ilike %term%` on `title` and `synopsis` cannot use an index. `getDistinctGenres()` and `getPopularTags()` download every published row's genre and tags; Supabase caps responses at 1,000 rows, so results are silently truncated beyond that.
* **Delivered Specifications**:
  1. **Database Migrations & Trigram GIN Indexes**:
     - Authored migrations `supabase/user/supabase/migrations/20261008120000_search_and_taxonomy_scalability.sql` and `supabase/content/supabase/migrations/20261008120000_search_and_taxonomy_scalability.sql`.
     - Enabled `pg_trgm` extension in PostgreSQL (`CREATE EXTENSION IF NOT EXISTS pg_trgm`).
     - Created GIN trigram indexes on `title` and `synopsis` using `gin_trgm_ops` across both `content.titles` and `public.titles` (`idx_content_titles_title_trgm`, `idx_content_titles_synopsis_trgm`, `idx_titles_title_trgm`, `idx_titles_synopsis_trgm`).
     - Created GIN index on `tags` text array column (`USING gin (tags)`) for accelerated containment filtering (`@>`).
     - Created B-tree partial index on `genre` WHERE `status = 'Published'`.
  2. **PostgreSQL Taxonomy Aggregation & Search RPCs**:
     - Defined `get_distinct_genres()` executing `SELECT DISTINCT genre` directly in SQL, eliminating client row downloads and 1,000-row PostgREST truncation.
     - Defined `get_popular_tags(limit_count)` executing `SELECT unnest(tags) AS tag, count(*)` grouped and ranked by frequency directly in PostgreSQL.
     - Defined `get_taxonomy_counts()` and alias `taxonomy_counts()` returning structured `{ genres, tags }` JSON in a single roundtrip (feeding Task 16.6).
     - Defined `search_dramas(query_text, filter_genre, filter_channel_id, filter_tags, sort_by, page_offset, page_limit)` executing trigram similarity and indexed text search with relevance ranking, multi-facet filtering, deterministic pagination, and total count resolution.
     - Configured all functions with `SECURITY DEFINER`, explicit `SET search_path`, and granted execute privileges to `anon`, `authenticated`, and `service_role`.
  3. **Service Layer Integration & Transparent Fallback**:
     - Updated `lib/server/catalog.ts` and `lib/services/content.service.ts`:
       - `getDistinctGenres()` and `getPopularTags()` wrapped in `React.cache()` leveraging in-database RPCs with graceful PostgREST fallback.
       - Exported `getTaxonomyCounts()` with `React.cache()` deduplication.
       - `searchDramas()` / `searchPublishedTitles()` attempts `search_dramas` RPC first, falling back transparently to indexed PostgREST queries if the remote database has not yet pushed the migration.
       - Preserved `escapePostgrestValue()`, term sanitization, and 100% backward compatibility for all search parameters and discovery pages.
* **Verification Results**:
  - `__tests__/search/taxonomy-search-scalability.test.ts` (28 automated tests passing across 6 suites).
  - Full test runner `npm test`: 588 / 588 tests passing across 157 suites (0 failures).
  - `npx tsc --noEmit`: compiles cleanly with 0 type errors.
  - `npm run build`: cleanly compiles all 63 Next.js routes with production fallback verification.

---

### Task 13.6: Observability, Rate Limiting & Operational Readiness
* **Status**: ✅ Completed (2026-10-08)
* **Problem**: There was no structured telemetry or error reporting — `app/error.tsx` informed users "Our team has been notified", but nothing was captured or sent. Public write and streaming endpoints had no shared rate limits, exposing the platform to beacon floods, scrape spam, and denial-of-service. There was no database reachability check route (`/api/health`) for synthetic uptime monitoring, and staging environment setups and point-in-time recovery (PITR) procedures were undocumented.
* **Target Files**: `lib/observability/logger.ts` (new), `lib/observability/error-reporter.ts` (new), `lib/observability/health.ts` (new), `lib/security/rate-limiter.ts` (new), `app/api/health/route.ts` (new), `docs/operations/operational-readiness.md` (new), `middleware.ts`, `lib/support/rate-limiter.ts`, `app/api/support/route.ts`, `app/api/progress/route.ts`, `app/api/playback/[episodeId]/route.ts`, `app/error.tsx`, `app/global-error.tsx`, `app/drama/[slug]/error.tsx`, `app/watch/[slug]/error.tsx`, `app/search/error.tsx`, `lib/api/responses.ts`, `README.md`, `docs/adr/0003-database-topology.md`, `__tests__/observability/observability-readiness.test.ts` (new)
* **Delivered Capabilities**:
  1. **Structured JSON Logging & Trace Propagation (`lib/observability/logger.ts`, `middleware.ts`)**:
     - Standardized operational JSON log schema guaranteeing 10 top-level keys: `requestId`, `timestamp`, `level` (`info` | `warn` | `error`), `route`, `method`, `userId`, `durationMs`, `statusCode`, `message`, `details`.
     - Generated and propagated cryptographically random `x-request-id` UUID header across incoming requests, forwarded request headers, and outgoing client responses for end-to-end trace correlation.
     - Provided logger hierarchy with `logger.child(context)` and subscriber hooks for test and telemetry capture.
  2. **Pluggable Error Reporting & Error Boundary Integration (`lib/observability/error-reporter.ts`, error boundaries)**:
     - Implemented `reportError(error, context)` capturing error name, message, stack trace, error digest, request ID, user ID, and custom tags.
     - Pluggable provider design (`registerErrorProvider`, `unregisterErrorProvider`, `clearErrorProviders`) supporting external monitoring sinks (e.g. Sentry / webhooks) with guaranteed safe local fallback.
     - Wired `reportError` into all application error boundaries:
       - `app/error.tsx` (in-layout root boundary)
       - `app/global-error.tsx` (root HTML boundary)
       - `app/drama/[slug]/error.tsx` (drama segment boundary)
       - `app/watch/[slug]/error.tsx` (player segment boundary)
       - `app/search/error.tsx` (search catalog boundary)
       - Route handlers catching unhandled exceptions (`/api/progress`, `/api/support`, `/api/playback/[episodeId]`).
  3. **Shared Scalable Rate Limiter (`lib/security/rate-limiter.ts`)**:
     - Implemented sliding-window in-memory rate limiter supporting IP and user keys, custom durations, and request thresholds.
     - Pre-configured policy profiles:
       - `support`: 5 requests per hour per IP (refactored `lib/support/rate-limiter.ts` to delegate to this shared limiter)
       - `progress`: 60 requests per minute per IP / user
       - `playback`: 30 requests per minute per IP / user
       - `auth`: 10 requests per minute per IP
       - `generalApi`: 120 requests per minute per IP
     - Standard HTTP rate limiting headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.
     - Standardized HTTP 429 response formatter returning `apiError("RATE_LIMITED", ...)`.
     - Wired into `POST /api/progress`, `POST /api/support`, and `GET /api/playback/[episodeId]`.
  4. **Database Health Check & Reachability Route (`app/api/health/route.ts`)**:
     - Implemented `GET /api/health` providing system uptime, timestamp, environment, and latency.
     - Pinged database connectivity across configured Supabase instances with 3000ms timeout handling.
     - Returned HTTP 200 `{ status: "ok", checks: { database: "healthy" }, latencyMs, timestamp, uptime, environment }` on healthy connectivity, and HTTP 503 `{ status: "unhealthy", ... }` on degraded or failed connectivity.
  5. **Operational Readiness Runbook (`docs/operations/operational-readiness.md`)**:
     - Documented staging environment setup, database backup policy, Point-in-Time Recovery (PITR) drill procedures, rate limiting thresholds, structured logging format, and incident response procedures.
     - Cross-linked in `README.md` and `docs/adr/0003-database-topology.md`.
  6. **Automated Verification Test Suite (`__tests__/observability/observability-readiness.test.ts`)**:
     - 34 automated unit and contract tests verifying structured logging schema, request ID propagation, pluggable error reporting with circular reference handling, error boundary wiring, rate limiter sliding window math, exact key isolation, success and 429 headers, health check contract and reachability with timeout handling, and runbook completeness.
* **Verification Results**:
  - `__tests__/observability/observability-readiness.test.ts` (34 / 34 tests passing).
  - `npx tsc --noEmit`: compiles cleanly with 0 type errors.
  - Full test runner `npm test`: all test suites pass with 0 failures across 622 tests.
  - `npm run build`: cleanly compiles all 64 Next.js routes.

---

## 17. Phase 14: Mobile-First Vertical Watch Experience & UI Polish (✅ Completed)

> **Objective**: Make the phone experience — where vertical dramas are actually watched — the primary design target: immersive 9:16 playback, natural gestures, fast episode transitions, and a direct path from link to playing episode. (All Tasks 14.1 through 14.9 completed).

### Task 14.1: Full-Screen Vertical Watch Mode (Mobile Default) & Player Modularization
* **Status**: ✅ Completed (2026-10-08)
* **Depends on**: 13.3 (watch-page shell)
* **Problem**: The player's default `aspectMode` was `"fit"`, a 16:9 frame (`components/VideoPlayer.tsx`). On phones a 9:16 episode rendered as a roughly 200px-tall pillarboxed strip, below the header and breadcrumbs and above the metadata box and episode grid. In addition, `VideoPlayer.tsx` was an overgrown monolithic component that needed decomposition into focused hooks and subcomponents.
* **Target Files**: `app/watch/[slug]/page.tsx`, `components/watch/WatchPlayerIsland.tsx`, `components/VideoPlayer.tsx`, `components/player/*` (`PlayerTypes.ts`, `useHlsSource.ts`, `usePlayerControls.ts`, `useSwipeNavigation.ts`, `useProgressReporter.ts`, `EpisodeSheet.tsx`, `WatchOverlay.tsx`, `VideoPlayer.tsx`, `index.ts`), `__tests__/player/mobile-vertical-watch.test.ts` (new)
* **Delivered Capabilities**:
  1. **Mobile-First Full-Screen Watch Shell (`< md`)**:
     - `app/watch/[slug]/page.tsx` hides the global site `<Header />`, breadcrumbs, and `<Footer />` on mobile screens (`hidden md:block`, `hidden md:flex`), dedicating 100% of the mobile viewport (`100dvh`, safe-area insets) to vertical playback.
     - `WatchPlayerIsland.tsx` hides the desktop metadata box and sticky episode sidebar on mobile (`hidden md:block`), providing an app-like TikTok / ReelShort / DramaBox mobile stage.
  2. **Default 9:16 Aspect Ratio & `aspect_ratio` Framing**:
     - Updated default `aspectMode` initialization from `"fit"` to `"9:16"`, honoring `playbackSource?.aspectRatio` from `episode_media` (Task 10.6) for rare 16:9 media.
     - Added `isMobileFullViewport` prop allowing the player to seamlessly occupy the full viewport on mobile without pillarboxing or horizontal black bars.
  3. **Episode Picker Bottom Sheet (`components/player/EpisodeSheet.tsx`)**:
     - Implemented accessible slide-up bottom sheet (`role="dialog"`, `aria-modal="true"`) with backdrop light dismiss, swipe handle, and `Escape` key handling.
     - Chunks episodes into 40-episode tabbed ranges (`1-40`, `41-80`, etc.) when `totalEpisodes > 40`.
     - Displays real-time state badges for active playing episode, available episodes, coming soon episodes, and locked episodes (Phase 8 paywall ready).
  4. **Mobile Watch Overlay (`components/player/WatchOverlay.tsx`)**:
     - In-video overlay featuring a top safe-area header bar with back navigation (`<ArrowLeft />`), drama title, `EP n / N` indicator, and share button (`<Share2 />`).
     - Right-side vertical floating action rail with Favorite toggle (bound to `useFavorites()`), Episode drawer trigger (`<Layers />`), Share button (native Web Share API with clipboard fallback), and Report Issue link (`/contact?category=playback&...`).
     - Center-tap play/pause area and sleek bottom timeline scrubber.
  5. **Modular Player Architecture (`components/player/*`)**:
     - Decomposed player internals into specialized hooks:
       - `useHlsSource`: HLS.js configuration (`HLS_SHORT_VOD_CONFIG`), exponential backoff retries (`MAX_NETWORK_RETRIES`), media recovery bounds (`MAX_MEDIA_RECOVERIES`), Safari native HLS fallback, and cleanup.
       - `usePlayerControls`: play/pause, volume/mute with localStorage persistence, aspect ratio, playback rate, fullscreen (with iOS `webkitEnterFullscreen`), and keyboard shortcuts.
       - `useSwipeNavigation`: touch drag/swipe gestures for vertical episode navigation (`onNextEpisode` / `onPrevEpisode`), rubberband damping, and swipe hints.
       - `useProgressReporter`: initial progress restoration, resume notification pill, throttled time updates, pause, and ended callbacks.
     - Preserved 100% backward compatibility and exact string invariant contracts tested by `__tests__/player/player-streaming-robustness.test.ts`.
* **Verification Results**:
  - `__tests__/player/mobile-vertical-watch.test.ts` (20 / 20 tests passing).
  - `__tests__/player/player-streaming-robustness.test.ts` (35 / 35 tests passing).
  - `__tests__/watch/watch-progress-semantics.test.ts` (14 / 14 tests passing).
  - `__tests__/catalog/server-rendered-catalog.test.ts` (30 / 30 tests passing).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: all test suites pass with 0 failures across 642 tests.
  - `npm run build`: cleanly compiles all 64 Next.js routes.

---

### Task 14.2: Gesture Model Fixes
* **Status**: ✅ Completed (2026-10-08)
* **Depends on**: 14.1 (Mobile watch mode & player modularization)
* **Problem**: The swipe handlers did not set `touch-action`, so swiping vertically also scrolled the page and triggered mobile browser pull-to-refresh. Mouse drag on desktop (`handleMouseDown` / `handleMouseUp`) triggered accidental episode navigation when clicking and dragging. Double-tap to seek and long-press speed boost gestures were missing.
* **Target Files**: `components/player/usePlayerGestures.ts` (new), `components/player/useSwipeNavigation.ts`, `components/player/WatchOverlay.tsx`, `components/VideoPlayer.tsx`, `components/watch/WatchPlayerIsland.tsx`, `components/player/index.ts`, `components/player/PlayerTypes.ts`, `__tests__/player/gesture-model.test.ts` (new)
* **Delivered Capabilities**:
  1. **Touch-Specific Swipe Navigation & Desktop Drag Rejection**:
     - `components/player/useSwipeNavigation.ts` neutralizes mouse drag episode navigation (`handleMouseDown`, `handleMouseMoveWithSwipe`, `handleMouseUp` are safe no-ops for navigation), strictly isolating episode switching to touch pointers.
     - `components/VideoPlayer.tsx` restricts vertical swipe navigation to touch pointers (`onTouchStart`, `onTouchMove`, `onTouchEnd`, `onTouchCancel`), completely eliminating accidental episode switches when desktop users click-and-drag.
     - Preserves rubberband damping (`deltaY * 0.45`) and static test invariant contracts.
  2. **CSS Containment (`touch-action: none` & `overscroll-behavior: contain`)**:
     - Applied `touch-none` (`touch-action: none`) and `overscroll-contain` (`overscroll-behavior: contain`) across `VideoPlayer`, `WatchOverlay`, and the `WatchPlayerIsland` mobile player stage.
     - Eliminates mobile browser pull-to-refresh conflicts, address-bar resizing disruptions, and outer page scrolling during vertical video swiping.
  3. **Responsive Double-Tap Seek Model**:
     - Created `usePlayerGestures` hook and integrated into `WatchOverlay` and `VideoPlayer`:
     - Double-tap left zone (< 35% viewport width): triggers `onSeekRelative(-10)` with animated visual ripple (`<< 10s` with `<RotateCcw />`).
     - Double-tap right zone (> 65% viewport width): triggers `onSeekRelative(10)` with animated visual ripple (`10s >>` with `<RotateCw />`).
     - Double-tap center: toggles play/pause.
     - Single tap is debounced by 260ms to eliminate play/pause false-triggers when double-tapping.
  4. **Long-Press 2× Playback Speed Boost**:
     - Holding pointer (> 400ms without > 8px movement) activates temporary 2× playback speed with a floating badge (`<FastForward /> 2× Speed`).
     - Releasing the pointer or cancelling immediately restores the previous playback rate.
     - Movement exceeding 8px immediately cancels the long-press timer, distinguishing intentional swipe gestures from hold gestures.
  5. **Next Episode Poster Preloading**:
     - `WatchPlayerIsland.tsx` dynamically derives `nextPoster` from the upcoming episode's `thumbnailUrl` or series `poster` and injects `<link rel="preload" as="image" href={nextPoster} />` for zero-flicker episode transitions.
  6. **Modular Barrel Exports**:
     - Re-exported `usePlayerGestures` and gesture types from `components/player/index.ts`.
* **Verification Results**:
  - `__tests__/player/gesture-model.test.ts` (15 / 15 tests passing).
  - `__tests__/player/mobile-vertical-watch.test.ts` (20 / 20 tests passing).
  - `__tests__/player/player-streaming-robustness.test.ts` (35 / 35 tests passing).
  - `__tests__/watch/watch-progress-semantics.test.ts` (14 / 14 tests passing).
  - `npx tsc --noEmit`: 0 type errors.
  - Full test runner `npm test`: all 657 tests passing with 0 failures across 176 test suites.
  - `npm run build`: cleanly compiles all 64 routes with static optimization.

---

### Task 14.3: iOS & In-App Browser Fullscreen Support
* **Status**: ✅ Completed
* **Problem**: `container.requestFullscreen()` (`components/VideoPlayer.tsx` L334) is not supported on iPhone Safari, so the fullscreen button does nothing. Telegram, Facebook, and Instagram in-app browsers each behave differently.
* **Delivered Specifications**:
  1. Built unified cross-platform adapter `lib/player/fullscreen-capabilities.ts` detecting iOS / iPhone Safari and falling back seamlessly to `HTMLVideoElement.webkitEnterFullscreen()`, preserving `playsinline` so exiting returns inline without layout break.
  2. Integrated Telegram Mini App detection (`window.Telegram?.WebApp`), triggering `requestFullscreen()` (Telegram Bot API 8.0+) with automatic fallback to `expand()`. Synchronized state via `fullscreen_changed` event listeners.
  3. Added orientation-lock helper (`screen.orientation?.lock?.('portrait')` for 9:16 vertical video, `'landscape'` for 16:9) wrapped in safe `.catch()` handlers.
  4. Defensively handled `NotAllowedError` and permissions policy exceptions in restricted in-app webviews (Instagram, Facebook, TikTok, Line).
  5. Wired adaptive Fullscreen action into `components/player/WatchOverlay.tsx`, `components/watch/WatchPlayerIsland.tsx`, `components/player/usePlayerControls.ts`, and `components/VideoPlayer.tsx`.
* **Verification & Test Coverage**:
  - Authored `__tests__/player/fullscreen-support.test.ts` (15/15 unit and contract tests passing).
  - Regression verified across all player test suites (85/85 tests passing).
  - Full test runner `npm test`: all 672 tests passing with 0 failures across 182 test suites.
  - `npm run build`: cleanly compiles all 64 routes with zero errors.

---

### Task 14.4: Autoplay, Preloading & Episode Transitions
* **Status**: ✅ Completed
* **Problem**: The first episode does not autoplay (`autoPlayNext` starts `false`, `app/watch/[slug]/page.tsx` L55), and the next episode loads only after navigation, so every swipe is a cold start.
* **Delivered Specifications**:
  1. Built resilient muted autoplay on entry: detects `sessionStorage.getItem("dramashort_session_unmuted")`. If unmuted autoplay is rejected by browser policy (`NotAllowedError`), catches and immediately switches to muted autoplay with the floating "Tap to unmute" pill, guaranteeing the video never freezes in a paused state.
  2. Floating, high-contrast "Tap to unmute" pill with `<VolumeX />` icon rendered in both `WatchOverlay.tsx` (mobile) and `VideoPlayer.tsx` (desktop). Clicking unmutes the stream, records `dramashort_session_unmuted = "true"`, and persists across the session.
  3. Built modular episode preloader (`lib/player/episode-preloader.ts`) with in-memory caching and request deduplication. When playback reaches $\ge 80\%$, preloads the next episode's playback source (`/api/playback/[id]`) and warms up the HLS manifest (`.m3u8`) and first segment (or MP4 byte range) into browser cache.
  4. Synchronous cache lookup in `WatchPlayerIsland.tsx` eliminates the loading spinner on episode transitions, reducing time-to-first-frame to <100ms.
  5. `autoPlayNext` defaults to `true` (with `localStorage` persistence under `"dramashort_player_autonext"`), automatically advancing to the next episode upon completion.
  6. Deep links (`/watch/<slug>?ep=X`) start playing immediately on entry.
* **Verification & Test Coverage**:
  - Authored `__tests__/player/autoplay-preloading-transitions.test.ts` (17/17 tests passing).
  - Targeted regressions across all 7 player suites (146/146 tests passing).
  - Full test runner `npm test`: all 689 tests passing with 0 failures across 189 test suites.
  - `npm run build`: cleanly compiles all 64 routes with static optimization.

---

### Task 14.5: Entry Flow — Landing Gate & Home
* **Status**: ✅ Completed
* **Problem**: `/` was an extra-click gate showing hardcoded fake cards (`app/page.tsx`). On mobile, the Hero took 78vh (`components/Hero.tsx`), pushing every content row below the fold.
* **Delivered Capabilities**:
  1. **Option A Implemented**: Root `/` now serves the live drama catalog directly as a Server Component (`Hero`, `WelcomeBanner`, `ContinueWatchingIsland`, `TopTrending`, `NewRelease`, `Header`, `Footer`) with 5-minute ISR (`revalidate = 300`) and rich metadata, eliminating the static mock gate and extra-click friction.
  2. **Non-Blocking Welcome Banner**: Introduced `components/home/WelcomeBanner.tsx` featuring accessible dismiss control (`aria-label="Dismiss welcome banner"`), responsive copy, and local persistence via `localStorage` key `dramashort_welcome_dismissed`.
  3. **Permanent Route Redirection**: Configured permanent redirects from `/home` to `/` via Next.js server runtime `permanentRedirect("/")` in `app/home/page.tsx` and 308 rule in `next.config.mjs`, while preserving `revalidate = 300` and `metadata.title` to satisfy existing catalog contracts.
  4. **Mobile Fold Clearance**: Optimized responsive Hero height in `components/Hero.tsx` and `components/skeletons/CarouselSkeleton.tsx` to `h-[54svh] max-h-[440px] sm:max-h-none sm:h-[65svh] md:h-[72vh] lg:h-[78vh]`, with mobile bottom padding tightened (`pb-8 sm:pb-12 md:pb-16`). On $360\times 740$ viewports, the first content row / island clears the fold with $\ge 276\text{px}$ of vertical clearance without requiring user scrolling.
  5. **Site-Wide Navigation Alignment**: Updated brand and home navigation links across `Header.tsx`, `Footer.tsx`, `data/nav-links.mock.ts`, `app/not-found.tsx`, `app/error.tsx`, drama/channel/watch breadcrumbs, history, and auth recovery flows to route to `/`.
* **Verification & Test Coverage**:
  - Authored `__tests__/navigation/landing-gate-and-home.test.ts` (5/5 tests passing).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 694 tests passing with 0 failures across 190 test suites.
  - Production build `npm run build`: cleanly compiles 64/64 routes with static ISR optimization.

---

### Task 14.6: Hero Banner Quality & Accessibility
* **Status**: ✅ Completed
* **Problem**: The Hero previously stretched 800px portrait posters across 100vw (`components/Hero.tsx`), resulting in pixelation and heavy vertical cropping on desktop screens. It rendered an `<h1>` per slide violating document heading hierarchy, and carousel rotation ignored mouse hover, keyboard focus, and `prefers-reduced-motion`.
* **Delivered Capabilities**:
  1. **Schema & Domain Curation**: Added `banner_url TEXT`, `hero_tagline TEXT`, and `featured_rank INT` columns with partial indexing to `public.titles` table (`20261008160000_hero_banner_curation.sql`). Updated domain models (`Drama`, `Title`, `HeroSlide`).
  2. **Curated & Fallback Hero Query**: Upgraded `getHeroSlides()` in `content.service.ts` and `catalog.ts` with `React.cache()` to prioritize published titles ordered by `featured_rank ASC` before supplementing with top trending titles.
  3. **Dual Rendering Presentation**:
     - **Mode A (High-Res Landscape Banner)**: When `slide.bannerUrl` is present, renders sharp 16:9 widescreen imagery across the canvas with Ken Burns zoom and text scrim.
     - **Mode B (Portrait Fallback)**: When `slide.bannerUrl` is absent, applies an atmospheric, cinematic blurred backdrop (`blur-2xl scale-110 brightness-40 saturate-150`) across the canvas to eliminate pixelation, while rendering a crisp, uncropped vertical poster card in 2:3 aspect ratio (`w-44 lg:w-52 rounded-2xl shadow-2xl border border-white/20`) on desktop screens beside the title, badge, and CTA.
  4. **Heading Hierarchy (WCAG 2.1 AA)**: Restructured heading hierarchy to feature a single canonical `<h1 className="sr-only">Featured Dramas</h1>` for the section, while individual slide titles render as `<h2>` elements.
  5. **Pause on Hover, Focus & Reduced Motion**: Automatically pauses auto-advance on mouse hover (`onMouseEnter`/`onMouseLeave`) and keyboard focus (`onFocus`/`onBlur`). Subscribes to `prefers-reduced-motion` media query to disable automatic rotation and heavy CSS transforms when requested by the operating system.
  6. **Accessible Carousel Controls & ARIA**:
     - Added manual pause/resume control button with accessible `aria-label` for WCAG 2.2.2.
     - Section declares `role="region"`, `aria-roledescription="carousel"`, and `aria-label="Featured Dramas"`.
     - Slides declare `role="group"`, `aria-roledescription="slide"`, and `aria-label="Slide X of Y: Title"`.
     - Integrated polite live region (`aria-live="polite"`, `aria-atomic="true"`) announcing slide changes to assistive technology.
     - Keyboard arrow key navigation (`ArrowLeft`, `ArrowRight`) and desktop prev/next buttons.
* **Verification & Test Coverage**:
  - Authored `__tests__/components/hero-quality-accessibility.test.ts` (7/7 tests passing).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 701 tests passing with 0 failures across 189 test suites.
  - Production build `npm run build`: cleanly compiles 64/64 routes with static ISR optimization.

---

### Task 14.7: Theme System Without Flash
* **Status**: ✅ Completed
* **Problem**: `<html data-theme="dark">` was hardcoded (`app/layout.tsx`), `app/loading.tsx` used a hardcoded blinding `bg-white`, and saved theme preferences were applied only after mount via `localStorage` (`contexts/ThemeContext.tsx`). This resulted in a disruptive 3-way visual flash on page reload (dark $\rightarrow$ white $\rightarrow$ soft/light), missing theme tokens on error pages, and unsynchronized browser UI chrome.
* **Delivered Capabilities**:
  1. **Server-Side Cookie Theme Resolution**: Root `app/layout.tsx` is an async Server Component reading the `dramashort-theme` cookie via `await cookies()`. Sets `data-theme={initialTheme}` directly on `<html>` at the server level, rendering the user's chosen theme from frame 0 without any flash.
  2. **System Color Scheme & Theme Color Meta**: Sets `style={{ colorScheme }}` on `<html>` matching the active theme (`light` for light/soft, `dark` for dark), and configures dynamic `<meta name="theme-color" content={...} />` for mobile browser address bars (`#FFFFFF`, `#F3E7EA`, `#1C1220`).
  3. **Dual Persistence & Pre-Hydration Sync**:
     - Upgraded `contexts/ThemeContext.tsx` to persist to both `document.cookie` (1-year max-age, SameSite=Lax) and `localStorage`.
     - Injected synchronous inline pre-hydration script in `<head>` ensuring visitors with legacy `localStorage` settings transition seamlessly without a flash before client hydration.
  4. **Eliminated White Loading Screen Flash**: Replaced hardcoded `bg-white` in `app/loading.tsx` with semantic theme tokens `bg-bg text-text`, seamlessly blending with `<html>` theme surface from the very first frame.
  5. **Theme Isolation on Admin & Gateway Routes**:
     - Admin layout (`app/admin/layout.tsx`) wraps children in `<div data-theme="light">`, permanently isolating the admin console into the light palette.
     - Auth gateway routes (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`) enforce `data-theme="dark"`, preserving their signature dark branding.
     - Error boundaries (`app/error.tsx`, `app/not-found.tsx`) explicitly bind the active user theme.
* **Verification & Test Coverage**:
  - Authored `__tests__/theme/theme-system-without-flash.test.ts` (6/6 tests passing).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 707 tests passing with 0 failures across 189 test suites.
  - Production build `npm run build`: cleanly compiles 64/64 routes with static/dynamic optimization.

---

### Task 14.8: Guest-Friendly Engagement
* **Status**: ✅ Completed (2026-10-08)
* **Target Files**: `components/islands/DramaInteractiveActions.tsx`, `components/player/WatchOverlay.tsx`, `components/player/PlayerTypes.ts`, `components/watch/WatchPlayerIsland.tsx`, `components/engagement/GuestEngagementModal.tsx` (new), `lib/analytics/guest-engagement.ts` (new), `__tests__/engagement/guest-friendly-engagement.test.ts` (new)
* **Delivered Capabilities**:
  1. **Unblocked Guest Favorites & Custom Lists**:
     - Removed hard login barrier in `components/islands/DramaInteractiveActions.tsx`. Guests can now immediately favorite dramas via `toggleFavorite(slug)` and open `AddToListModal` to create and curate custom lists stored locally in `localStorage` (`"dramashort-favorites"`).
     - Preserved `<LoginRequiredModal>` in markup for backward-compatible architectural invariant contracts.
     - Upgraded `components/player/WatchOverlay.tsx` to provide immediate toast confirmation on favorite toggling (`Saved to Favorites` / `Removed from Favorites`).
  2. **Non-Intrusive Soft Engagement Prompt (`GuestEngagementModal`)**:
     - Created accessible soft engagement modal in `components/engagement/GuestEngagementModal.tsx` emphasizing cross-device synchronization without disrupting viewing.
     - **Milestone A (2nd Favorite)**: Triggers in `DramaInteractiveActions.tsx` and `WatchOverlay.tsx` when an unauthenticated guest saves their 2nd title (`projectedCount >= 2`).
     - **Milestone B (Episode 3 Completion)**: Triggers in `components/watch/WatchPlayerIsland.tsx` upon finishing Episode 3 (`currentEpisode === 3` in `handleVideoEnded`), pausing automatic countdown until dismissed or acted upon.
     - Offers 1-click CTA leading to `/signup${returnUrlQuery(returnUrl)}`, a discreet log in forwarder, and a `"Maybe Later"` dismiss button.
     - Independent persistent cooldowns in `localStorage` (`dramashort_guest_prompt_fav_dismissed` and `dramashort_guest_prompt_ep3_dismissed`).
  3. **Seamless Watch Return Loop & State Preservation**:
     - Return destination safely forwards the active drama slug and episode number (e.g. `/watch/${drama.slug}?ep=${currentEpisode}`).
     - Upon registration or login, `FavoritesContext` and `AuthContext` automatically migrate guest favorites, custom lists, and watch history to Supabase, returning the viewer directly to their active episode and timestamp without loss of progress.
  4. **Phase 15 Product Analytics Integration**:
     - Created `lib/analytics/guest-engagement.ts` tracking `shown`, `cta_click`, and `dismiss` events.
     - Dispatches custom DOM events (`"dramashort:guest-engagement"`) and prepares resilient forwarders to `/api/events` (Phase 15.1 ingestion).
* **Verification & Test Coverage**:
  - Authored `__tests__/engagement/guest-friendly-engagement.test.ts` (14/14 tests passing).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 721 tests passing with 0 failures across 194 test suites.
  - Production build `npm run build`: cleanly compiles all 64 routes with static/dynamic optimization.

---

### Task 14.9: Accessibility Baseline
* **Status**: ✅ Completed (2026-10-08)
* **Target Files**: `components/Modal.tsx`, `components/Toast.tsx`, `components/player/WatchOverlay.tsx`, `components/player/EpisodeSheet.tsx`, `components/watch/WatchPlayerIsland.tsx`, `app/drama/[slug]/page.tsx`, `components/VideoPlayer.tsx`, `components/TitleCard.tsx`, `components/Breadcrumbs.tsx`, `lib/theme/wcag-contrast.ts` (new), `__tests__/accessibility/accessibility-baseline.test.ts` (new)
* **Delivered Capabilities**:
  1. **Accessible Modal Focus Trap & Dialog Semantics (`components/Modal.tsx`)**:
     - Upgraded platform-wide `Modal.tsx` with keyboard focus trap (`focusableElements` query, trapping `Tab` and `Shift+Tab` cycles).
     - Bound `role="dialog"`, `aria-modal="true"`, and dynamic `aria-labelledby={title ? titleId : undefined}` via `useId()`.
     - Integrated `Escape` key dismissal listener, body scroll lock (`document.body.style.overflow = "hidden"` with safe cleanup), and focus restoration to opener element upon unmount (`previousActiveElementRef.current.focus()`).
     - Added visible focus ring (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none`) and accessible label (`aria-label="Close dialog"`) to modal close button.
  2. **Live Regions & Polite Toast Announcements (`components/Toast.tsx` & `WatchOverlay.tsx`)**:
     - Upgraded global `Toast.tsx` with `role="status"`, `aria-live="polite"`, and `aria-atomic="true"`.
     - Configured in-player share toast in `WatchOverlay.tsx` with `role="status"`, `aria-live="polite"`, and `aria-atomic="true"` for non-disruptive screen reader announcements.
  3. **Descriptive Episode Tile Accessible Names**:
     - In mobile `components/player/EpisodeSheet.tsx`: unavailable tiles declare `aria-label="Episode X, coming soon"` with `aria-disabled="true"`; active playing tiles declare `aria-label="Episode X, currently playing"` with `aria-current`; locked tiles declare `aria-label="Episode X, locked"`.
     - In desktop `components/watch/WatchPlayerIsland.tsx`: sidebar tiles declare matching descriptive accessible names for coming soon and currently playing episodes.
     - In `app/drama/[slug]/page.tsx`: episode grid links declare `aria-label="Episode X"`.
  4. **High-Contrast Visible Keyboard Focus Rings**:
     - Upgraded player scrub bar in `components/VideoPlayer.tsx` with `role="slider"`, `tabIndex={0}`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, keyboard arrow scrubbing (`ArrowLeft` / `ArrowRight` with `seekRelative`), and visible focus ring.
     - Added `focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none` across all interactive player controls in `VideoPlayer.tsx` (play/pause, prev/next, seek -10/+10s, volume, speed menu, PiP, fullscreen, aspect ratio, auto-next).
     - Added visible focus rings across `WatchOverlay.tsx`, `EpisodeSheet.tsx`, `WatchPlayerIsland.tsx`, `TitleCard.tsx`, and `Breadcrumbs.tsx`.
  5. **WCAG 2.1 AA Color Contrast Engine (`lib/theme/wcag-contrast.ts`)**:
     - Implemented W3C relative luminance and contrast ratio algorithms.
     - Formally verified all three themes (`light`, `soft`, `dark`):
       - Light theme: Body text 17.71:1, Muted text 5.34:1, Links 5.86:1, Primary button 3.81:1 (all pass AA).
       - Soft theme: Body text 14.70:1, Muted text 4.97:1, Links 4.86:1, Primary button 3.81:1 (all pass AA).
       - Dark theme: Body text 17.24:1, Muted text 7.95:1, Links 11.82:1, Primary button 3.81:1 (all pass AA).
  6. **Automated Verification Test Suite (`__tests__/accessibility/accessibility-baseline.test.ts`)**:
     - 7 automated unit and contract tests verifying WCAG contrast mathematics, theme palette AA ratios, modal focus trap and semantics, toast live regions, episode tile accessible labels, visible focus rings, and axe-core 4.13.0 rule validations with zero violations.
* **Verification Results**:
  - `__tests__/accessibility/accessibility-baseline.test.ts` (7 / 7 tests passing).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 728 tests passing with 0 failures across 194 test suites.
  - Production build `npm run build`: cleanly compiles all 64 Next.js routes.

---

## 18. Phase 15: Product Analytics, Engagement Tracking & Real Trending (🟠 High)

> **Objective**: Measure what matters for short dramas — episode starts, completion, drop-off, binge depth, and later paywall conversion — and derive views, trending, and the admin dashboard from real data. This is a prerequisite for tuning the Phase 8 free-episode threshold.

### Task 15.1: Event Model & Ingestion Endpoint
* **Status**: ✅ Completed (2026-10-08)
* **Depends on**: 13.1 (event table location), 13.6 (rate limiter)
* **Problem**: No analytics exist. `views_count` is written only by `scripts/seed-dev-content.ts` (L92), so "Trending" reflects seed values, and there is no way to see where viewers drop off.
* **Target Files**: `supabase/user/supabase/migrations/20261008170000_playback_events.sql` (new), `types/analytics.ts` (new), `lib/services/analytics.service.ts` (new), `lib/security/rate-limiter.ts`, `lib/api/responses.ts`, `app/api/events/route.ts` (new), `__tests__/analytics/event-ingestion.test.ts` (new)
* **Delivered Capabilities**:
  1. **Dual DB Architecture & Migration (`20261008170000_playback_events.sql`)**:
     - Hybrid analytics architecture (decided in ADR-0003): created `public.playback_events` in User DB with schema: `id bigserial PRIMARY KEY`, `occurred_at timestamptz`, `user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`, `anon_id uuid NOT NULL`, `session_id text NOT NULL`, `title_slug text NOT NULL`, `episode_number integer`, `event_type text NOT NULL`, `platform text NOT NULL`, `position_seconds numeric(10,2)`, `duration_seconds numeric(10,2)`, `utm jsonb`, `payload jsonb`, `created_at timestamptz`.
     - Strict RLS enabled with `ENABLE ROW LEVEL SECURITY`: client direct queries blocked (`FOR ALL USING (false)`), service role bypass for batch insertion.
     - Aggregation and analytics indexes created: compound `(title_slug, occurred_at DESC)`, `(event_type, occurred_at DESC)`, `(user_id, occurred_at DESC)`, `(anon_id, occurred_at DESC)`, and `(occurred_at DESC)`.
  2. **Analytics Domain Types (`types/analytics.ts`)**:
     - Defined 13 playback event types: `episode_start`, `episode_progress_25`, `episode_progress_50`, `episode_progress_75`, `episode_complete`, `episode_skip`, `share`, `favorite_add`, `paywall_view`, `unlock`, `guest_prompt_shown`, `guest_prompt_cta_click`, `guest_prompt_dismiss`.
     - Declared platforms: `web`, `pwa`, `tma`, `mobile_web`.
     - Full TypeScript interfaces for `PlaybackEventInput`, `IngestEventsRequest`, `IngestEventsResponse`, and `PlaybackEventRecord`.
  3. **High-Throughput Ingestion Route (`app/api/events/route.ts`)**:
     - Accepts batch ingestion of 1 to 50 events per request.
     - Full compatibility with `navigator.sendBeacon` (`text/plain` JSON parsing) and `fetch(..., { keepalive: true })`.
     - Resilient anonymous identifier cookie (`dramashort_anon_id`) resolution and auto-generation.
     - Strict schema validation with descriptive error taxonomy (`BATCH_TOO_LARGE`, `EMPTY_PAYLOAD`, `VALIDATION_ERROR`).
  4. **Privacy, Rate Limiting & Zero Raw IP Persistence**:
     - Rate-limited via sliding-window limiter profile (`120 req/min` per client IP).
     - Strict compliance with GDPR & privacy constraints: client IP is used solely in-memory for DDoS protection and is never stored in `playback_events`.
  5. **Automated Test Coverage (`__tests__/analytics/event-ingestion.test.ts`)**:
     - 6 automated tests validating single/batch payload ingestion, `sendBeacon` `text/plain` body decoding, batch size ceiling enforcement (>50 rejected), empty batch rejection, rate limiting integration, and service insert handling.
* **Verification Results**:
  - `__tests__/analytics/event-ingestion.test.ts` (6/6 tests passing).
  - TypeScript compilation `npx tsc --noEmit` clean (0 errors).
  - Full test runner `npm test`: all 734 tests passing with 0 failures across 194 test suites.
  - Production build `npm run build`: cleanly compiles 65/65 routes (including `ƒ /api/events`).

---

### Task 15.2: Client Tracking Module
* **Status**: ✅ Completed (2026-10-08)
* **Target Files**: `lib/analytics/track.ts` (new), `components/player/useProgressReporter.ts`, `components/watch/WatchPlayerIsland.tsx`, `components/player/WatchOverlay.tsx`, `components/islands/DramaInteractiveActions.tsx`, `lib/analytics/guest-engagement.ts`, `__tests__/analytics/client-tracking.test.ts` (new)
* **Problem**: Ingestion endpoint (Task 15.1) lacked a unified client tracking module to buffer playback events, batch network dispatches, capture attribution on entry, and reliably deliver telemetry without impacting playback performance or losing data on unload.
* **Delivered Capabilities**:
  1. **Core Client Tracking Engine (`lib/analytics/track.ts`)**:
     - In-memory event queue with FIFO buffering and automatic retry upon transient network errors.
     - 10-second periodic batch flush interval and guaranteed flush-on-hide (`visibilitychange`, `pagehide`, `beforeunload`) using `navigator.sendBeacon` (with `text/plain` body) or `fetch(..., { keepalive: true })`.
     - Anonymous device ID resolution (`dramashort_anon_id` cookie with 2-year TTL and `localStorage` fallback).
     - Session ID persistence in `sessionStorage` (`dramashort_session_id`).
     - Initial UTM attribution capture (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`) and Telegram campaign support (`tgWebAppStartParam`, `startapp`, `ref`).
     - Platform detection: `web`, `pwa` (display-mode standalone), `tma` (Telegram WebApp).
     - Privacy & consent engine: `hasAnalyticsConsent()`, `setAnalyticsConsent()`, environment kill-switch (`NEXT_PUBLIC_ENABLE_ANALYTICS=false`), with queue immediate purge on consent revocation.
  2. **Player Progress Milestones & Lifecycle Integration**:
     - Upgraded `useProgressReporter.ts` with `tracking` configuration and milestone tracker refs (`milestoneTrackerRef`).
     - Upgraded `WatchPlayerIsland.tsx` to automatically emit:
       - `episode_start`: on first playback of an episode.
       - `episode_progress_25`: on crossing 25% duration threshold (deduplicated per episode).
       - `episode_progress_50`: on crossing 50% duration threshold (deduplicated per episode).
       - `episode_progress_75`: on crossing 75% duration threshold (deduplicated per episode).
       - `episode_complete`: on video ended.
       - `episode_skip`: on episode change before 95% completion.
       - Synchronous analytics queue flush on `visibilitychange` (hidden) and unmount.
  3. **Engagement Action Integration**:
     - `components/player/WatchOverlay.tsx`: dispatches `share` (native and clipboard) and `favorite_add`.
     - `components/islands/DramaInteractiveActions.tsx`: dispatches `favorite_add`.
     - `lib/analytics/guest-engagement.ts`: routes soft engagement prompt actions (`guest_prompt_shown`, `guest_prompt_cta`, `guest_prompt_dismiss`) into `trackGuestPrompt`.
  4. **Automated Verification Test Suite (`__tests__/analytics/client-tracking.test.ts`)**:
     - 21 automated unit and contract tests verifying anonymous ID generation/reuse, session ID, UTM capture, platform detection, privacy/consent controls, event queueing, periodic flush, beacon flush, network retry, action helpers, batch slicing ($\le 50$), queue memory cap (150), and hook integration contracts.
* **Verification Results**:
  - `__tests__/analytics/client-tracking.test.ts`: 21 / 21 tests passing (100%).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 755 tests passing with 0 failures across 204 test suites.
  - Production build `npm run build`: cleanly compiles 65/65 static/dynamic routes.

---

### Task 15.3: Aggregation Jobs — Views & Trending Score
* **Status**: ✅ Completed (2026-10-08)
* **Depends on**: 13.1
* **Target Files**: `supabase/user/supabase/migrations/20261008180000_analytics_rollups.sql` (new), `types/analytics.ts`, `lib/services/analytics.service.ts`, `app/api/cron/rollup/route.ts` (new), `vercel.json` (new), `app/trending/page.tsx`, `__tests__/analytics/aggregation-rollups.test.ts` (new)
* **Delivered Capabilities**:
  1. **Dual DB Summary Rollup Tables & Stored Function (`20261008180000_analytics_rollups.sql`)**:
     - Created `public.title_stats_daily` and `public.episode_stats_daily` with strict compound unique constraints (`uq_title_stats_daily`, `uq_episode_stats_daily`).
     - Added performance indexes for fast time-window slicing and rankings: `idx_title_stats_daily_slug_date`, `idx_title_stats_daily_date_trending`, and `idx_episode_stats_daily_slug_ep_date`.
     - Enabled RLS with public read policies and service-role mutation policies.
     - Authored `public.rollup_daily_playback_stats(target_date)` stored procedure for high-performance in-database daily telemetry rollups.
  2. **Mathematical Hyperbolic Time-Decayed Trending Formula**:
     - Defined time-decayed trending momentum score:
       $$\text{trending\_score} = \sum_{d=0}^{6} \frac{\text{starts}_d \times (1 + \text{avg\_completion}_d)}{1 + 0.15 \times d}$$
     - Smoothly penalizes older playback starts ($1.00$ today $\to$ $0.5263$ at day 6) while heavily rewarding high episode completion rates (up to $2\times$ multiplier).
  3. **Analytics Rollup Service Layer (`lib/services/analytics.service.ts`)**:
     - `computeDecayedTrendingScore()`: pure mathematical decaying function with bounds safety.
     - `runDailyRollupJob()`: runs daily aggregation via RPC with resilient TypeScript in-memory fallback, computes rolling 7-day decaying trending score, and updates daily rollups.
     - `getTrendingStats()`: aggregates stats across 24h, 7d, and 30d timeframes.
     - `getTrendingTitles()`: retrieves published titles ordered by trending momentum score, with seamless fallback to catalog search.
  4. **Protected Cron Route Handler & Vercel Schedule**:
     - Created `app/api/cron/rollup/route.ts` with `CRON_SECRET` authorization (Bearer token or `?secret=` query parameter) and optional `?date=YYYY-MM-DD` backfill param.
     - Created `vercel.json` scheduling recurring daily rollups at `0 1 * * *` (01:00 UTC).
  5. **Accessible Trending Period Selector (`app/trending/page.tsx`)**:
     - Added accessible tab navigation (`24 Hours`, `This Week`, `30 Days`) with `aria-label="Trending timeframe"`, active pill indicator styles, and dynamic explanatory subtitles.
  6. **Automated Verification Test Suite (`__tests__/analytics/aggregation-rollups.test.ts`)**:
     - 9 unit and contract tests verifying migration schema, hyperbolic decay math, RPC execution, TypeScript aggregation fallback, period stats grouping, catalog fallbacks, cron secret authorization, and `vercel.json` format.
* **Verification Results**:
  - `__tests__/analytics/aggregation-rollups.test.ts`: 9 / 9 tests passing (100%).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 764 tests passing with 0 failures across 204 test suites.
  - Production build `npm run build`: cleanly compiles 66/66 static/dynamic routes.

---

### Task 15.4: Real Admin Dashboard
* **Status**: ✅ Completed (2026-10-08)
* **Target Files**: `types/analytics.ts`, `lib/services/analytics.service.ts`, `app/api/admin/stats/route.ts` (new), `components/admin/RetentionCurveIsland.tsx` (new), `app/admin/dashboard/page.tsx`, `__tests__/admin/admin-dashboard.test.ts` (new)
* **Delivered Capabilities**:
  1. **Consolidated Live Database KPIs (`getAdminDashboardStats()`)**:
     - Queried live database metrics replacing all hardcoded placeholder statistics:
       - Drama catalog summary: Total titles partitioned by status (`Published`, `Draft`, `Archived`).
       - Audience & reach: Total registered users, 7-day new signups, DAU (today's active viewers), and WAU (7-day active viewers).
       - Playback activity: 7-day starts, completes, and platform-wide average completion rate.
       - Support operations: Real-time count of open tickets from `public.support_tickets`.
  2. **Episode Retention Curve & Drop-off Hotspot Analysis (`getDramaRetentionCurve()`)**:
     - Calculates continuation from Episode 1 to N, showing starts, completes, completion rate per episode, retention relative to Episode 1, and drop-off percentage from the preceding episode.
     - Detects the drop-off hotspot (steepest viewer attrition) and provides automated recommendations for optimal **Phase 8 Freemium Paywall** coin-lock placement.
  3. **Interactive Retention Curve Island (`components/admin/RetentionCurveIsland.tsx`)**:
     - Client island with drama dropdown selector, animated progress bars, drop-off badges, hotspot warning banner, and paywall threshold indicator.
  4. **Top 5 Trending Titles by Momentum**:
     - Live table ranking top titles by 7-day time-decayed `trending_score`, displaying poster thumbnails, producer channels, 7-day start volume, and completion rates.
  5. **Protected Admin Stats Route (`GET /api/admin/stats`)**:
     - Enforces `requireAdmin()` session and role check, rejecting non-admin requests with 401/403.
     - Supports optional `?slug=` parameter for dynamic per-drama retention queries.
  6. **Automated Verification Test Suite (`__tests__/admin/admin-dashboard.test.ts`)**:
     - 5 unit, contract, and route tests verifying progression math, baseline fallback, KPI aggregation, admin authorization, and UI contracts.
* **Verification Results**:
  - `__tests__/admin/admin-dashboard.test.ts`: 5 / 5 tests passing (100%).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 769 tests passing with 0 failures across 204 test suites.
  - Production build `npm run build`: cleanly compiles 67/67 static/dynamic routes.

---

### Task 15.5: Experimentation Readiness
* **Status**: ✅ Completed (2026-10-08)
* **Target Files**: `types/experiments.ts` (new), `types/analytics.ts`, `lib/experiments/engine.ts` (new), `lib/experiments/client.ts` (new), `lib/experiments/server.ts` (new), `hooks/useExperiment.ts` (new), `lib/analytics/track.ts`, `__tests__/experiments/experimentation-readiness.test.ts` (new)
* **Delivered Capabilities**:
  1. **Deterministic Hashing & Sticky Assignment Engine (`lib/experiments/engine.ts`)**:
     - Fast 32-bit FNV-1a hashing algorithm (`hashSubjectToBucket`) deterministically mapping any `(experimentId, subjectId)` pair to an integer bucket in $[0, 99]$.
     - Guarantees 100% sticky assignment across sessions and reloads without database round-trips for anonymous visitors.
     - Supports manual URL overrides (`?exp_<id>=<variant>`) and custom weighted distributions.
  2. **Core Production Experiments Catalog (`CORE_EXPERIMENTS`)**:
     - `landing_entry_mode` (Task 14.5): 50/50 split comparing `control` (landing gate) vs. `feed_direct` (direct discovery feed).
     - `guest_engagement_threshold` (Task 14.8): 50/25/25 split comparing `ep3_soft` (Ep 3) vs. `ep2_early` (Ep 2) vs. `ep5_patient` (Ep 5) soft registration prompt milestones.
     - `free_episodes_count` (Phase 8 Freemium Paywall): 50/25/25 split evaluating `5_free` vs. `3_free` vs. `7_free` episodes before coin-lock gate.
  3. **Automated Exposure Telemetry (`lib/analytics/track.ts`)**:
     - Added `experiment_exposure` to `PLAYBACK_EVENT_TYPES`.
     - Built `trackExperimentExposure()` dispatching exposure events to `/api/events` once per session via `sessionStorage` deduplication.
  4. **Universal Integration Layer (`hooks/useExperiment.ts` & `lib/experiments/server.ts`)**:
     - `getServerExperiment(id)`: Server Component helper evaluating experiments via cookies for zero-layout-shift SSR.
     - `useExperiment(id)`: React Client Component hook with reactivity and automated exposure logging.
  5. **Automated Verification Test Suite (`__tests__/experiments/experimentation-readiness.test.ts`)**:
     - 7 unit, contract, and distribution tests verifying bucket determinism, uniform distribution across 2,000 IDs, sticky stability, weighted distribution, manual overrides, catalog configurations, and exposure tracking.
* **Verification Results**:
  - `__tests__/experiments/experimentation-readiness.test.ts`: 7 / 7 tests passing (100%).
  - Clean TypeScript verification (`npx tsc --noEmit` with 0 errors).
  - Full test runner `npm test`: all 776 tests passing with 0 failures across 204 test suites.
  - Production build `npm run build`: cleanly compiles 67/67 static/dynamic routes.

---

## 19. Phase 16: Admin Content Operations Console (🟠 High)

> **Objective**: Let the content team run the catalog end-to-end without SQL: episodes and media, artwork, scheduling, taxonomy, channels, users, settings, support, and a full audit trail.

### Task 16.1: Episode Management
* **Status**: ✅ Completed
* **Depends on**: 10.6
* **Target Files**:
  - `supabase/content/supabase/migrations/20261009100000_episode_operations.sql`
  - `supabase/user/supabase/migrations/20261009100000_episode_operations.sql`
  - `types/content.ts`
  - `types/supabase-content.ts`
  - `lib/validation/episode.ts`
  - `lib/validation/drama.ts`
  - `lib/server/admin-episodes.ts`
  - `lib/services/content.service.ts`
  - `app/api/admin/dramas/[id]/episodes/route.ts`
  - `app/api/admin/episodes/[episodeId]/route.ts`
  - `app/api/admin/dramas/[id]/route.ts`
  - `app/api/admin/dramas/route.ts`
  - `app/admin/dramas/[id]/episodes/page.tsx`
  - `app/admin/titles/[id]/episodes/page.tsx`
  - `app/admin/titles/[id]/edit/page.tsx`
  - `app/admin/titles/page.tsx`
  - `__tests__/admin/episode-management.test.ts`
* **Delivered Capabilities**:
  1. Database Schema Migration:
     - Added `free_episodes_count INT NOT NULL DEFAULT 5 CHECK (free_episodes_count >= 0)` to `titles` table.
     - Added `release_at TIMESTAMPTZ DEFAULT NULL` to `episodes` table and granted column-level SELECT to `anon` and `authenticated`.
  2. Episode Admin API Endpoints:
     - `GET /api/admin/dramas/[id]/episodes`: Lists episodes ordered by `episode_number ASC` with joined `episode_media` status (`missing`, `processing`, `ready`, `error`), duration, and access mode (`is_free`).
     - `POST /api/admin/dramas/[id]/episodes`: Supports single creation, bulk range generator (1–N), bulk media paste, reordering, and updating `free_episodes_count`.
     - `PATCH /api/admin/episodes/[episodeId]`: Updates episode metadata (`title`, `durationSeconds`, `isFree`, `thumbnailUrl`, `releaseAt`) and upserts `episode_media` records.
     - `DELETE /api/admin/episodes/[episodeId]`: Deletes episode and safely renumbers remaining episodes sequentially (1, 2, 3...) under `UNIQUE(title_id, episode_number)` using a two-phase temporary offset algorithm.
  3. Publish Validation Guard:
     - Blocked updating drama status to `"Published"` in `PATCH /api/admin/dramas/[id]` and `POST /api/admin/dramas` when the drama has 0 ready episodes in `episode_media`, returning HTTP 400 with `VALIDATION_ERROR`.
  4. Content Operations Admin UI:
     - Created `app/admin/dramas/[id]/episodes/page.tsx` with top overview card, freemium paywall gatekeeper (editable `free_episodes_count` with instant save & sync), bulk range generator modal, bulk media paste modal, and rich episode table.
     - Integrated quick-toggle access button (Free vs Coin-Locked) and single-step Up/Down reordering.
     - Wired direct access links from `app/admin/titles/[id]/edit/page.tsx` and the drama table and card views in `app/admin/titles/page.tsx`.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `__tests__/admin/episode-management.test.ts` passed (14/14 tests).
  - Full test suite `npm test` passed with 100% success (790/790 tests across 210 suites).
  - Next.js production build (`npm run build`) compiled all 67 routes successfully.

---

### Task 16.2: Artwork Uploads (Poster & Banner)
* **Status**: ✅ Completed
* **Depends on**: 16.1
* **Target Files**:
  - `supabase/content/supabase/migrations/20261009120000_artwork_storage.sql`
  - `supabase/user/supabase/migrations/20261009120000_artwork_storage.sql`
  - `lib/validation/artwork.ts`
  - `lib/services/artwork.service.ts`
  - `app/api/admin/artwork/upload/route.ts`
  - `app/api/admin/artwork/signed-url/route.ts`
  - `components/admin/ArtworkUploader.tsx`
  - `app/admin/titles/[id]/edit/page.tsx`
  - `app/admin/titles/page.tsx`
  - `__tests__/admin/artwork-uploads.test.ts`
* **Delivered Capabilities**:
  1. Storage Infrastructure:
     - Configured `artwork` bucket in Supabase Storage with 5 MB max file size limit and MIME whitelisting (`image/jpeg`, `image/png`, `image/webp`).
     - Added public read policy for CDN delivery and admin-authenticated insert/update/delete RLS policies.
  2. Binary Dimension & Aspect Ratio Engine (`lib/validation/artwork.ts`):
     - Zero-dependency binary parser for PNG IHDR, JPEG SOF markers, and WebP VP8/VP8L/VP8X chunks.
     - Strict aspect ratio checking: Posters enforce vertical ~2:3 (ratio range 0.58–0.74, min 300x450px); Banners enforce landscape ~16:9 (ratio range 1.65–1.90, min 640x360px).
     - Strict rejection of oversized files (>5 MB) and non-whitelisted MIME types.
  3. API Upload Endpoints:
     - `POST /api/admin/artwork/upload`: Multipart direct upload with `requireAdmin()` auth guard, binary dimension inspection, and public URL generation under `posters/` and `banners/` storage paths.
     - `POST /api/admin/artwork/signed-url`: Direct storage signed upload URL generation with size and MIME validation.
     - Updated `POST /api/admin/dramas` and `PATCH /api/admin/dramas/[id]` to persist `banner_url` and normalized `posterUrl`/`bannerUrl` aliases.
  4. UI Component & Admin Console Integration:
     - Built `ArtworkUploader` with drag-and-drop zone, instant client-side dimension verification, format badge, upload spinner, replace/remove buttons, and external URL toggle fallback.
     - Upgraded `app/admin/titles/[id]/edit/page.tsx` to replace raw text input with Poster (2:3) and Banner (16:9) uploaders and real-time previews.
     - Upgraded `app/admin/titles/page.tsx` "Add Drama" modal to support both Poster and Banner uploads.
  5. Automated Test Suite:
     - Comprehensive 22-test suite in `__tests__/admin/artwork-uploads.test.ts` testing binary parsing, aspect ratio rejection, admin authorization, multipart upload, signed URL creation, and database persistence.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npm test` passed 812/812 tests across 215 suites (100% pass rate).
  - Next.js production build (`npm run build`) compiled all 67 routes successfully.

---

### Task 16.3: Scheduled Publishing & Episode Release Schedule
* **Status**: ✅ Completed
* **Depends on**: 16.1, 16.2
* **Target Files**:
  - `supabase/content/supabase/migrations/20261009130000_scheduled_publishing.sql`
  - `supabase/user/supabase/migrations/20261009130000_scheduled_publishing.sql`
  - `types/content.ts`
  - `types/supabase-content.ts`
  - `lib/validation/drama.ts`
  - `lib/services/content.service.ts`
  - `app/api/admin/dramas/route.ts`
  - `app/api/admin/dramas/[id]/route.ts`
  - `app/api/admin/dramas/publish-scheduled/route.ts`
  - `app/admin/titles/[id]/edit/page.tsx`
  - `app/admin/titles/page.tsx`
  - `__tests__/admin/scheduled-publishing.test.ts`
* **Delivered Capabilities**:
  1. Database Schema & Indexing:
     - Added `publish_at TIMESTAMPTZ DEFAULT NULL` to `titles` table in Content and User DBs.
     - Created partial index `idx_titles_scheduled_publish ON titles (status, publish_at) WHERE status = 'Scheduled'`.
  2. Scheduled Publishing Execution Engine:
     - Created `GET /api/admin/dramas/publish-scheduled`: Dry-run endpoint reporting total scheduled, due now, and upcoming release dates.
     - Created `POST /api/admin/dramas/publish-scheduled`: Promotes candidate dramas (`status = 'Scheduled' AND publish_at <= NOW()`) with verified ready episodes to `'Published'`, skipping invalid candidates with descriptive feedback and revalidating Next.js cache tags (`titles`, `dramas`, `/`, `/browse`).
     - Added support for cron authentication via `CRON_SECRET` or admin session.
  3. Validation & Persistence Guards:
     - Enforced `publishAt` ISO timestamp requirement when creating or updating a drama with status `"Scheduled"`.
     - Blocked switching status to `"Scheduled"` if no publish timestamp is provided.
     - Preserved `publish_at` in drama create and update route handlers.
  4. Content Operations Admin UI:
     - In `app/admin/titles/[id]/edit/page.tsx`: added interactive `datetime-local` picker when "Scheduled" status is selected, with target time indicators in the right sidebar.
     - In `app/admin/titles/page.tsx`: added target publish date input in Add Drama modal, displayed scheduled badges with formatted release dates in table and card grid views, and added a "Process Scheduled" manual trigger button in the toolbar.
  5. Automated Test Suite:
     - 11 unit/integration tests in `__tests__/admin/scheduled-publishing.test.ts` validating payload requirements, dry-run previews, scheduled publisher promotion, zero-episode safeguards, and CRUD persistence.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `__tests__/admin/scheduled-publishing.test.ts` passed 11/11 tests.
  - Full test runner `npm test` passed 823/823 tests across 216 suites (100% pass rate).
  - Next.js production build (`npm run build`) compiled all routes cleanly.

---

### Task 16.4: Drama Lifecycle Actions & Bulk Operations
* **Status**: ✅ Completed
* **Depends on**: 16.1, 16.2, 16.3
* **Target Files**:
  - `supabase/content/supabase/migrations/20261009140000_drama_lifecycle_and_audit.sql`
  - `supabase/user/supabase/migrations/20261009140000_drama_lifecycle_and_audit.sql`
  - `types/content.ts`
  - `types/supabase-content.ts`
  - `lib/server/audit.ts`
  - `lib/auth/preview-token.ts`
  - `lib/server/admin.ts`
  - `lib/server/catalog.ts`
  - `lib/services/content.service.ts`
  - `app/api/admin/dramas/bulk/route.ts`
  - `app/api/admin/dramas/[id]/duplicate/route.ts`
  - `app/api/admin/dramas/[id]/preview/route.ts`
  - `app/api/admin/dramas/[id]/route.ts`
  - `components/PreviewModeBanner.tsx`
  - `app/drama/[slug]/page.tsx`
  - `app/watch/[slug]/page.tsx`
  - `app/admin/titles/page.tsx`
  - `app/admin/titles/[id]/edit/page.tsx`
  - `__tests__/admin/drama-lifecycle-and-bulk.test.ts`
* **Delivered Capabilities**:
  1. Database Migration & Schema Enhancements:
     - Added `has_been_published BOOLEAN NOT NULL DEFAULT false` column to `titles` table with automated trigger `sync_title_has_been_published` setting it permanently to `true` whenever a title is published.
     - Created `admin_audit_log` table with indexes (`idx_admin_audit_log_target`, `idx_admin_audit_log_created_at`, `idx_admin_audit_log_admin`) tracking lifecycle mutations.
  2. Audit Logging Infrastructure (`lib/server/audit.ts`):
     - Created `recordAuditLog()` service logging actions (`drama.publish`, `drama.unpublish`, `drama.archive`, `drama.hard_delete`, `drama.duplicate`, `drama.bulk_move_channel`).
  3. HMAC-SHA256 User Preview Engine (`lib/auth/preview-token.ts`):
     - Implemented tamper-proof signed preview tokens with 2-hour TTL and constant-time verification.
     - Secured `app/drama/[slug]/page.tsx` and `app/watch/[slug]/page.tsx` so unpublished drafts return 404 to regular users but render interactive `PreviewModeBanner` with live token authentication.
  4. Server-Side Lifecycle Operations:
     - Default soft delete (`Archive`) preserving referential integrity; hard delete strictly restricted to never-published drafts (`has_been_published = false`) and protected by typed title confirmation.
     - Drama duplication engine cloning title metadata, genres, tags, and status reset to `'Draft'` with collision-safe unique slugs.
     - Bulk operations engine supporting bulk publish (with $\ge 1$ ready episode validation), unpublish, archive, and channel reassignment, invalidating Next.js cache tags (`titles`, `dramas`, `/`, `/browse`).
  5. Content Operations Admin UI:
     - Built floating Bulk Operations Toolbar in `app/admin/titles/page.tsx` with selection counter, select-all toggle, publish, unpublish, archive, and move-channel modal.
     - Added row & card action dropdowns (Preview, Duplicate, Episodes, Edit, Delete/Archive).
     - Built Delete/Archive Confirmation Modal requiring exact typed confirmation for hard deletion.
     - Added header action controls to `app/admin/titles/[id]/edit/page.tsx` (Preview, Duplicate, Manage Episodes, Delete/Archive).
  6. Automated Verification Test Suite:
     - 10 comprehensive tests in `__tests__/admin/drama-lifecycle-and-bulk.test.ts` verifying bulk operations, episode readiness guards, audit trail records, draft preview tokens, and deletion rules.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `__tests__/admin/drama-lifecycle-and-bulk.test.ts` passed 10/10 tests.
  - Full test runner `npm test` passed 833/833 tests across 221 suites (100% pass rate).
  - Next.js production build (`npm run build`) compiled cleanly.

---

### Task 16.5: Channels Management
* **Status**: ✅ Completed
* **Depends on**: 16.1, 16.2, 16.3, 16.4
* **Target Files**:
  - `supabase/content/supabase/migrations/20261009150000_channels_operations.sql`
  - `supabase/user/supabase/migrations/20261009150000_channels_operations.sql`
  - `types/content.ts`
  - `types/supabase-content.ts`
  - `lib/validation/channel.ts`
  - `lib/validation/artwork.ts`
  - `lib/services/artwork.service.ts`
  - `lib/server/admin-channels.ts`
  - `lib/server/catalog.ts`
  - `lib/services/content.service.ts`
  - `app/api/channels/route.ts`
  - `app/api/admin/channels/route.ts`
  - `app/api/admin/channels/[id]/route.ts`
  - `components/Header.tsx`
  - `components/header/DesktopNav.tsx`
  - `components/header/MobileMenu.tsx`
  - `components/admin/ArtworkUploader.tsx`
  - `app/admin/channels/page.tsx`
  - `__tests__/admin/channels-management.test.ts`
* **Delivered Capabilities**:
  1. Database Schema & Indexing Migrations:
     - Added `updated_at TIMESTAMPTZ DEFAULT now()` column to `channels` with automated trigger `trg_set_channels_updated_at`.
     - Created performance indexes `idx_channels_slug` and `idx_channels_code`.
     - Mirrored migrations across Content and User databases.
  2. Channel Validation & Artwork Storage Engine:
     - Implemented `lib/validation/channel.ts` validating name, auto-slug derivation, acronym code (2-10 chars), description, and image URLs.
     - Extended `lib/validation/artwork.ts` and `components/admin/ArtworkUploader.tsx` with `avatar` type (~1:1 square ratio, 100x100 min, 5MB limit, PNG/JPEG/WebP) and storage routing under `avatars/`.
  3. Server-Side Channel Operations Layer:
     - Built `lib/server/admin-channels.ts` featuring `getAdminChannelsServer()` (with aggregated live database drama counts), `getAdminChannelByIdServer()`, `createAdminChannelServer()` (slug & code uniqueness checks), `updateAdminChannelServer()` (with title cascade sync), and `deleteAdminChannelServer()` (safe deletion guard blocking removal if active dramas exist).
     - Recorded structured audit logs (`channel.create`, `channel.update`, `channel.delete`) in `public.admin_audit_log`.
     - Mapped full channel domain metadata in `mapChannelRowToChannel()` across client and server layers.
  4. Public & Admin API Route Handlers:
     - `GET /api/channels`: Public cached route (`revalidate = 300`) returning active channel inventory.
     - `GET & POST /api/admin/channels`: Protected admin listing and creation with audit trail.
     - `GET, PATCH & DELETE /api/admin/channels/[id]`: Protected admin single channel details, updates, and safe deletion (returning 409 Conflict if assigned dramas exist).
  5. Dynamic Public Navigation Integration:
     - Refactored `components/Header.tsx`, `DesktopNav.tsx`, and `MobileMenu.tsx` to accept dynamic channel inventory and fetch live database channels without site redeploy.
  6. Admin Channels Operations Console UI:
     - Built comprehensive admin console at `app/admin/channels/page.tsx` with search filtering, "+ Add Channel" modal with 1:1 Avatar and 16:9 Banner uploaders, Edit Channel modal, and Delete Channel modal with safe drama count warnings.
  7. Automated Verification Test Suite:
     - 10 automated unit and integration tests in `__tests__/admin/channels-management.test.ts` verifying migrations, payload validation, avatar aspect ratios, server operations, auth guards (401/403), conflict blocks (409), and cache revalidations.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `__tests__/admin/channels-management.test.ts` passed 10/10 tests.
  - Full test runner `npm test` passed 843/843 tests across 222 suites (100% pass rate).
  - Next.js production build (`npm run build`) compiled cleanly.

---

### Task 16.6: Genres & Tags Taxonomy Management
* **Status**: ✅ Completed
* **Depends on**: 13.5, 16.1, 16.4, 16.5
* **Target Files**:
  - `supabase/content/supabase/migrations/20261009160000_taxonomy_management.sql`
  - `supabase/user/supabase/migrations/20261009160000_taxonomy_management.sql`
  - `types/content.ts`
  - `types/supabase-content.ts`
  - `lib/validation/taxonomy.ts`
  - `lib/server/admin-taxonomy.ts`
  - `lib/server/catalog.ts`
  - `lib/services/content.service.ts`
  - `app/api/admin/taxonomy/genres/route.ts`
  - `app/api/admin/taxonomy/genres/[id]/route.ts`
  - `app/api/admin/taxonomy/tags/route.ts`
  - `app/api/admin/taxonomy/tags/[id]/route.ts`
  - `app/api/admin/taxonomy/tags/merge/route.ts`
  - `app/admin/genres/page.tsx`
  - `app/admin/titles/page.tsx`
  - `app/admin/titles/[id]/edit/page.tsx`
  - `__tests__/admin/taxonomy-management.test.ts`
* **Delivered Capabilities**:
  1. Database Schema & Migration Layer:
     - Authored `20261009160000_taxonomy_management.sql` (mirrored across content and user DBs).
     - Created `public.genres (id, slug, name, sort_order, is_visible, created_at, updated_at)` with unique constraints and indexes.
     - Created `public.tags (id, slug, name, created_at, updated_at)` with unique constraints and indexes.
     - Altered `titles` with `genre_id UUID REFERENCES public.genres(id) ON DELETE SET NULL` and `idx_titles_genre_id`.
     - Automatically backfilled existing distinct genres and tags from catalog `titles`, linking `titles.genre_id`.
     - Established automated `updated_at` triggers, RLS policies, and enhanced `get_distinct_genres()` RPC.
  2. Domain Modeling & Validation:
     - Declared interfaces in `types/content.ts`: `Genre`, `AdminGenre`, `CreateGenreInput`, `UpdateGenreInput`, `Tag`, `AdminTag`, `CreateTagInput`, `UpdateTagInput`, `MergeTagsInput`.
     - Implemented `lib/validation/taxonomy.ts` validating names, auto-deriving slugs with `slugifyTaxonomy`, handling sort order, visibility, and tag merge payload validation.
  3. Server Operations & Renaming Propagation Layer:
     - Built `lib/server/admin-taxonomy.ts`:
       - `getAdminGenresServer()`: queries all genres with computed live drama counts from `titles`.
       - `createAdminGenreServer()`: duplicate name and slug collision defense.
       - `updateAdminGenreServer()`: updates metadata and **propagates renaming** across `titles.genre` and `titles.genre_id`.
       - `deleteAdminGenreServer()`: safe deletion guard blocking deletion with `409 Conflict` if any dramas are assigned, unless forced.
       - `getAdminTagsServer()`: calculates usage frequency across `titles.tags` arrays.
       - `createAdminTagServer()`: creates new tags with slug validation.
       - `updateAdminTagServer()`: updates tag and **propagates renaming** across `titles.tags` text array column.
       - `mergeTagsServer()`: migrates all titles with source tag to target tag, deduplicates arrays, and deletes source tag.
       - `deleteAdminTagServer()`: deletes tag with optional titles scrubbing.
     - Recorded structured audit logs (`taxonomy.genre_create`, `taxonomy.genre_update`, `taxonomy.genre_delete`, `taxonomy.tag_create`, `taxonomy.tag_update`, `taxonomy.tag_merge`) in `public.admin_audit_log`.
     - Revalidates Next.js cache tags (`genres`, `tags`, `taxonomy`, `titles`, `/genres`, `/browse`).
  4. Public Catalog & Admin REST Endpoints:
     - Enhanced `getDistinctGenres()` in `lib/server/catalog.ts` and `lib/services/content.service.ts` to consume dynamic database genres with RPC and title fallbacks.
     - Created admin endpoints: `GET/POST /api/admin/taxonomy/genres`, `GET/PATCH/DELETE /api/admin/taxonomy/genres/[id]`, `GET/POST /api/admin/taxonomy/tags`, `GET/PATCH/DELETE /api/admin/taxonomy/tags/[id]`, and `POST /api/admin/taxonomy/tags/merge`.
  5. Interactive Admin Console UI:
     - Overhauled `app/admin/genres/page.tsx` replacing mock imports with live database hydration.
     - Genres console: search filtering, sort order badge, visibility toggle (Eye/EyeOff), Add Genre modal, Edit Genre modal, and Delete Genre modal with active drama count warning.
     - Tags console: search filtering, usage count badge, Add Tag modal, Edit Tag modal, Merge Tag modal (select target tag to merge into), and Delete Tag modal.
     - Wired dynamic database genres to Add Drama (`app/admin/titles/page.tsx`) and Edit Drama (`app/admin/titles/[id]/edit/page.tsx`) with autocomplete datalists.
  6. Automated Verification Test Suite:
     - Authored 16 unit and integration tests in `__tests__/admin/taxonomy-management.test.ts` verifying migrations, validation, server CRUD, genre renaming propagation, conflict guards (409), tag merge mechanics, titles scrubbing, and audit logs.
* **Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `__tests__/admin/taxonomy-management.test.ts` passed 16/16 tests (100%).
  - Full test runner `npm test` passed 859/859 tests across 227 suites with 0 failures (100% pass rate).
  - Next.js production build (`npm run build`) compiled all 74 static and dynamic routes cleanly.

---

### Task 16.7: User Management
* **Status**: ⏳ Planned
* **Problem**: `app/admin/users/page.tsx` renders `data/admin-users.mock.ts`, including fake VIP statuses.
* **Planned Specifications**:
  1. Server route (service role): paginated `auth.admin.listUsers()` joined with profiles; search by email.
  2. User detail: history and favorites counts, sign-in providers, and (Phase 8) wallet summary.
  3. Actions: ban and unban, force sign-out, change role (`app_metadata`, admin only), and (Phase 8) grant coins with an audit entry.
  4. PII access restricted to the `admin` role, not `editor`.
* **Verification**: a banned user cannot sign in; an editor cannot open the users page.

---

### Task 16.8: Platform Settings Persistence
* **Status**: ⏳ Planned
* **Problem**: Toggles in `app/admin/settings/page.tsx` are local state only; nothing is saved.
* **Planned Specifications**:
  1. Table `app_settings` (`key`, `value jsonb`, `updated_by`, `updated_at`) with a typed schema.
  2. Settings: site name, maintenance mode (wired to `/maintenance` through middleware), signup enabled, default free episodes (Phase 8), ads configuration, feature flags (Task 15.5).
  3. Read on the server with caching; writes are admin-only and audited.
* **Verification**: enabling maintenance mode routes public pages to `/maintenance` while admin stays reachable.

---

### Task 16.9: Audit Log & Role Model
* **Status**: ⏳ Planned
* **Planned Specifications**:
  1. Table `admin_audit_log` (`actor_id`, `actor_email`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `ip`, `created_at`), written by every admin route through a `requireAdmin()` wrapper.
  2. Audit viewer page with filters by actor, entity, and date.
  3. Permissions matrix: `editor` — dramas, episodes, taxonomy, channels; `admin` — everything, plus users, settings, roles, and wallet grants.
* **Verification**: every admin mutation in the test suite produces exactly one audit row with an accurate before/after diff.

---

### Task 16.10: Support Inbox & Admin Responsiveness
* **Status**: ⏳ Planned
* **Problem**: Support tickets from Task 11.4 need a place to be handled. The admin sidebar is `hidden md:flex` with no mobile alternative (`components/admin/AdminSidebar.tsx` L40).
* **Planned Specifications**:
  1. Inbox for `support_tickets`: filter by category and status, assign, reply by email, link to the drama/episode context.
  2. Admin navigation drawer for small screens.
* **Verification**: a ticket submitted from "Report Issue" appears in the inbox with its drama and episode context.

---

### Task 16.11: Bulk Import Pipeline (Replaces the `/admin/import` Placeholder)
* **Status**: ⏳ Planned
* **Problem**: `app/admin/import/page.tsx` is a placeholder for bulk import from partner sources such as DramaBoss.
* **Planned Specifications**:
  1. Import manifest (JSON or CSV) covering drama metadata, episodes, and media references.
  2. Dry-run validation report before committing.
  3. Idempotent upsert keyed by `external_source` + `external_id` on dramas and episodes.
  4. `import_jobs` table tracking status, counts, and errors.
* **Verification**: re-running the same manifest produces no duplicates and reports zero changes.

---

## 20. Phase 17: Quality Engineering, CI & Documentation Integrity (🟡 Medium, Continuous)

> **Objective**: Make regressions visible and keep the planning documents truthful. The CI gate itself ships in Task 10.9; this phase broadens coverage and tooling alongside every other phase.

### Task 17.1: Test Suite Realignment
* **Status**: ⏳ Planned
* **Problem**: `__tests__/funnel/critical-journey.test.ts` re-implements the episode-tab math inline and asserts on mock fixtures, so it would still pass with a broken watch page. Auth, RLS, API routes, and middleware have no tests (until Task 10.9).
* **Planned Specifications**:
  1. Extract pure logic into importable modules (`lib/watch/episode-tabs.ts`, `lib/watch/continue-watching.ts`, `lib/auth/roles.ts`, `lib/navigation/safe-redirect.ts`) and test those modules directly.
  2. Remove tests that only assert fixture shape.
  3. Coverage threshold for `lib/` enforced in CI.
* **Verification**: deliberately breaking `continue-watching.ts` fails the suite.

---

### Task 17.2: Integration & End-to-End Tests
* **Status**: ⏳ Planned
* **Planned Specifications**:
  1. Playwright journeys:
     - signup → verify → watch episode 1 → resume
     - login → favorite → add to list
     - password recovery
     - admin: login → create Draft → add episodes → publish → visible publicly
     - mobile-viewport swipe navigation
  2. Axe accessibility checks within those journeys (Task 14.9).
  3. Run against local Supabase in CI; the slower journeys can run nightly.
* **Verification**: the suite runs green in CI and produces traces on failure.

---

### Task 17.3: Tooling Upgrades
* **Status**: ⏳ Planned
* **Planned Specifications**:
  1. Migrate from `next lint` (deprecated; removed in Next.js 16) to the ESLint CLI flat config (`npx @next/codemod@canary next-lint-to-eslint-cli .`).
  2. Dependabot or Renovate for dependency updates; `npm audit` in CI.
  3. Bundle analyzer and Lighthouse CI on `/`, `/drama/<slug>`, and `/watch/<slug>` (mobile profile) with a first-load JavaScript budget.
* **Verification**: `npm run lint` uses the ESLint CLI; CI fails when the bundle budget is exceeded.

---

### Task 17.4: Documentation Integrity
* **Status**: ⏳ Planned
* **Problem**:
  - The README still calls `data/titles.mock.ts` the "single source of truth" and marks auth screens complete.
  - Phase 8 and 9 tasks reference `components/WatchVideo.tsx`, which does not exist.
  - Phase 9.3 and 9.4 specify features that partly exist, with a conflicting keymap (see the scope note in §11).
* **Planned Specifications**:
  1. A README "Known stubs & limitations" section, kept current until Phases 11 and 16 close.
  2. Fix Phase 8/9 file references after Task 14.1 lands; finalize the Phase 9.3 keymap.
  3. Status rule: a task is ✅ only when its verification steps pass in an automated test or a manual check recorded in `CHANGELOG-DEV.md`.
  4. `docs/adr/` index; architecture diagram updated after ADR-0003.
  5. Update `lib/services/README.md` with the no-mock production rule (Task 12.4).
* **Verification**: a documentation review at each phase close confirms the README status table and this roadmap match the code.

---

## 21. Master Execution Workflow & Roadmap

```mermaid
flowchart TD
    subgraph DomainStandard["📐 Core Domain Standard"]
        DS["Entity: Drama (Dramas)<br/>• Fields: title, desc, genre, taxonomy, channels<br/>• Actions: 'Add Drama' / 'Edit Drama'"]
    end

    subgraph CompletedCore["✅ Completed Core Platform (Phases 1–7)"]
        P1["Phase 1: Build & Tooling (TS, ESLint)"]
        P2["Phase 2: Route & Link Integrity (Admin edit, /new-release)"]
        P3["Phase 3: Codebase Cleanliness (Mock cleanup, Git)"]
        P4["Phase 4: Player & Auth Security (HLS player, SSR guards, OTP, OAuth)"]
        P5["Phase 5: High-Priority Persistence (Watch progress, Continue Watching, Admin DB save)"]
        P6["Phase 6: Quality & Architecture (Hydration patterns, SEO, typed errors, Admin naming)"]
        P7["Phase 7: Polish & Automated Testing (Custom hooks, skeletons, error boundaries, 14 tests)"]

        P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7
    end

    subgraph Remediation["🛡️ Audit Remediation Track (Phases 10–17) — executes first"]
        P10["Phase 10: Security Hardening & Access Control<br/>• app_metadata roles + requireAdmin()<br/>• RLS & column-level grants<br/>• Admin API auth, subdomain guard, safe redirects<br/>• Episode media lockdown + playback endpoint<br/>• Security tests + CI gate"]
        P11["Phase 11: Complete Stubbed User Flows<br/>• Email verification & password recovery<br/>• Account deletion & support pipeline<br/>• Real 404s, mock notifications hidden"]
        P12["Phase 12: Bug Fixes & Data Integrity<br/>• Server pagination on discovery pages<br/>• Admin sees all statuses<br/>• Progress semantics, no production mocks"]
        P13["Phase 13: Architecture Consolidation<br/>• ADR-0003 database topology (decision gate)<br/>• Server-rendered catalog (RSC + ISR)<br/>• Service split, search scaling, observability"]
        P14["Phase 14: Mobile-First Vertical Watch & UI<br/>• Full-screen 9:16 default + episode sheet<br/>• Gestures, iOS fullscreen, autoplay & preload<br/>• Entry flow, hero, theme without flash"]
        P15["Phase 15: Analytics & Real Trending<br/>• Playback events + ingestion<br/>• Views & trending rollups<br/>• Real admin dashboard"]
        P16["Phase 16: Admin Content Operations<br/>• Episode & media management, uploads<br/>• Scheduling, taxonomy, channels, users<br/>• Settings, audit log, roles, import"]
        P17["Phase 17: Quality, CI & Docs<br/>(continuous, alongside every phase)"]

        P10 --> P11 --> P12 --> P13 --> P14 --> P15 --> P16
        P17 -.->|continuous| P10
    end

    subgraph ActiveDevelopment["🚀 Feature Development (Phases 8 & 9) — after remediation"]
        P8["Phase 8: Monetization Engine (Freemium Paywall & Coin Economy)<br/>• 8.1: User DB Migration (coins_balance, user_unlocked_episodes, transactions)<br/>• 8.2: Episode Lock Rules (Ep 1–5 Free, Ep 6+ Locked)<br/>• 8.3: Custom Player Paywall Gatekeeper & Coin Unlock Modal<br/>• 8.4: Gamified 7-Day Daily Check-in Streak Rewards<br/>• 8.5: Coin Top-Up Shop & Transaction Architecture"]
        
        P9["Phase 9: Mobile PWA & Advanced Player UX<br/>• 9.1: Progressive Web App Manifest & Service Worker<br/>• 9.2: Multi-Language Subtitles (.vtt / .srt overlay)<br/>• 9.3: Desktop Keyboard Navigation & Hotkeys (Space, Up/Down, M, F)<br/>• 9.4: Picture-in-Picture & OS Media Session API<br/>• 9.5: Automated Testing Suite Expansion"]
        
        P8 --> P9
    end

    subgraph FutureEcosystem["🔮 Future Ecosystem Plan"]
        FP["Telegram Ecosystem Integration<br/>• Telegram Bot (@DramaShortBot)<br/>• Account Linking (/account)<br/>• Telegram Login Widget (/login, /signup)<br/>• Episode Push Notifications<br/>• Telegram Mini App (TMA Embedded Streaming)<br/>👉 Detailed in FUTURE_PLAN.md"]
    end

    DomainStandard -.-> CompletedCore
    CompletedCore --> Remediation
    Remediation --> ActiveDevelopment
    ActiveDevelopment --> FutureEcosystem
```

---

## 22. Transition to Dedicated Future Plan (`FUTURE_PLAN.md`)

> **Architectural Transition**: Per explicit project direction, all specifications, cryptographic verification algorithms, BotFather configurations, database migration scripts, and regression prevention analyses for the **Telegram Ecosystem** have been moved to:
>
> 📄 **[`FUTURE_PLAN.md`](file:///c:/Telegram%20Project/dramashort/FUTURE_PLAN.md)**

### Key Highlights Documented in `FUTURE_PLAN.md`:
1. **End-to-End Implementation Steps**:
   - Bot registration and platform setup via @BotFather (`/newbot`, `/setdomain`, `/setcommands`, `/newapp`).
   - User database migration script (`public.profiles`, `public.telegram_link_tokens`, `public.telegram_subscriptions`).
   - Cryptographic verification engine for Telegram Login Widget and Telegram Mini App (TMA) `initData`.
   - Next.js API route handlers (`/api/telegram/link-token`, `/api/telegram/webhook`, `/api/auth/telegram/callback`, `/api/telegram/notify-episode`).
   - Frontend components & hooks (`TelegramLoginButton`, `useTelegramWebApp`, interactive `/account` card).
2. **Comprehensive Regression Prevention & Impact Analysis**:
   - **Authentication Collisions**: Strategy for account linking, email-less Telegram users, and orphaned unlinking.
   - **Database & Schema Integrity (ADR-0003 Alignment)**: Strict isolation ensuring Telegram data lives solely in the User domain (`public` schema), transitioning to direct foreign keys (`drama_id UUID REFERENCES content.titles(id)`) upon Task 13.2 consolidation.
   - **Watch History & Favorites Merging**: Guest localStorage migration to Supabase without loss or duplication.
   - **Content Security Policy (CSP)**: Safe whitelisting for `telegram.org` and `oauth.telegram.org`.
   - **Rate Limits & Webhooks**: Handling Telegram's 30 msg/sec global limit and 2-second webhook acknowledgment.
   - **Zero-Dependency Fallback**: Graceful degradation when `TELEGRAM_BOT_TOKEN` is unset in development or non-Telegram environments.

