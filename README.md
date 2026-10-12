# DramaShort — Web & Admin Platform

DramaShort is a vertical drama streaming web platform engineered for high-retention short-form episodic entertainment, paired with an integrated backoffice administrative console.

---

## Architecture & Features

* **Framework & Core**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide icons.
* **Database & Source of Truth**: Primary production data source is Supabase PostgreSQL (one project, every table in the `public` schema, per [ADR-0005](docs/adr/0005-single-supabase-project.md)), accessed via Server Components (RSC), Incremental Static Regeneration (ISR), and secured PostgREST API routes. Mock fixtures in [`data/titles.mock.ts`](data/titles.mock.ts) are strictly reserved for unit testing, database seeding, and offline development environments.
* **Strict No-Mock Production Standard**: In production environments (`NODE_ENV === "production"`), the application strictly enforces the no-mock rule (Task 12.4). Live database or network failures never silently fall back to mock data, preventing data contamination and surfacing real error boundaries.
* **Multi-Theme Engine**: Custom design tokens with 3 runtime surfaces (`light`, `soft` [default], `dark`) managed via `ThemeProvider` and CSS variables, eliminating theme flash during page loads.
* **Freemium Monetization Engine**:
  - Virtual coin economy with atomic PostgreSQL transactions and ledger (`public.coin_transactions`).
  - Episode lock engine (Episodes 1–5 Free, Episode 6+ Locked, configurable per drama).
  - In-player paywall gatekeeper (`EpisodeUnlockModal`) with single-episode and discounted full-series bundle unlocks.
  - Gamified 7-day daily check-in streak rewards with UTC midnight boundaries and mystery chest bonuses.
  - Coin top-up shop (`/account/wallet`) and VIP pass subscription packages.
* **Advanced Video Streaming UX**:
  - Vertical 9:16 mobile-first short-drama player with adaptive HLS.js streaming and automatic fallback.
  - Multi-language subtitle overlay (`.vtt` / `.srt`) with customizable typography, colors, and background opacity.
  - Desktop keyboard shortcuts with visual frosted-glass HUD badge and accessible cheat-sheet modal (`?`).
  - Picture-in-Picture (PiP) and native OS Media Session API integration.
  - High-precision resume tracking and "Continue Watching" derivation.
* **Progressive Web App (PWA)**:
  - Installable PWA manifest with standalone portrait display mode.
  - Cache-first service worker for static assets with strict exclusions for streaming video and authenticated APIs.
  - Floating in-app install prompt banner with 14-day dismissal window.
* **Backoffice Admin Console**:
  - Subdomain routing (`admin.*`) and secure role-based access control (`admin`, `editor`).
  - Real-time KPI dashboard (titles, users, views, revenue).
  - Drama directory (`/admin/dramas`), metadata editor, and episode manager with video upload.
  - Channel and taxonomy management (genres & tags).
  - User moderation console (role assignment, account ban/unban, session revocation).
  - Customer Support Inbox (`/admin/support`) with linked drama/episode context and resolution workflows.
  - Platform audit log (`/admin/audit`), platform configuration settings (`/admin/settings`), and bulk CSV import pipeline (`/admin/import`).
* **Tooling, Quality & CI**:
  - Modern ESLint 9 Flat Config (`eslint.config.mjs`) replacing deprecated `next lint`.
  - Automated dependency management via Dependabot (`.github/dependabot.yml`) and `npm audit` CI security gate.
  - First-Load JavaScript bundle budget validator (`scripts/check-bundle-budget.mjs`) enforcing gzip transfer limits.
  - Lighthouse CI mobile configuration (`.lighthouserc.json`) targeting discovery, detail, and streaming routes.
  - Multi-device Playwright E2E suite and 1,151+ automated tests in `npm test` with 100% pass rate.
* **Architecture Decision Records**: Formal architectural choices and decision gates are cataloged in [`docs/adr/README.md`](docs/adr/README.md).
* **Headless Reusability Architecture**: Multi-schema catalog access and PostgreSQL role grants for external apps are documented in [`docs/architecture/reusable-content-api.md`](docs/architecture/reusable-content-api.md).
* **Operational Readiness & Telemetry**: Staging setup, database backup policy, PITR, rate limiting, and incident runbooks are documented in [`docs/operations/operational-readiness.md`](docs/operations/operational-readiness.md).

---

## Route Overview

### 🎬 Public Consumer Web App
| Route | Description |
|---|---|
| `/` | Landing gateway hero with brand ambient glow and enter CTA |
| `/home` | Main feed with Hero carousel, Continue Watching, Top Trending, and New Releases |
| `/trending` | View-ranked catalog with time-period pill selector |
| `/genres` | Filterable drama library with responsive category chips and pagination |
| `/new-release` | Newest releases sorted chronologically by publication date |
| `/channel/[slug]` | Channel/studio showcase with breadcrumb hierarchy and catalog |
| `/drama/[slug]` | Drama details, synopsis, channel link, favorite toggle, list modal, related recommendations |
| `/watch/[slug]` | Video player interface with 40-episode tabbed navigation, paywall, subtitles, and report modal |
| `/search` | Deep search with query, channel, genre, and multi-tag filtering |
| `/contact`, `/faq`, `/terms`, `/privacy-policy`, `/content-guidelines`, `/maintenance` | Informational and legal layout pages |

### 👤 User Account & Auth
| Route | Description |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` | Authentication flow with OTP input, password recovery, and safe return redirects |
| `/account` | User profile overview, display name edit, email verification change step, password change modal |
| `/account/wallet` | Virtual coin balance, VIP pass status, top-up packages modal, and transaction ledger |
| `/account/favorite` | User favorites catalog and custom watchlists |
| `/account/history` | Chronological watch history with relative timestamps |
| `/account/settings` | Account configuration and language preferences |

### 🛠️ Backoffice Admin Console
| Route | Description |
|---|---|
| `/admin` | Smart gateway routing to dashboard or login based on session |
| `/admin/login` | Admin authentication portal |
| `/admin/dashboard` | KPI analytics (total dramas, users, views, active channels, revenue) |
| `/admin/dramas` | Drama directory with table & card views, channel filters, search, bulk select, and pagination |
| `/admin/dramas/[id]/edit` | Complete drama editing form (metadata, status, episodes, tags, synopsis, poster preview) |
| `/admin/dramas/[id]/episodes` | Episode management, media upload, video stream URL configuration, and lock pricing |
| `/admin/channels` | Channel management grid with sync status, drama counts, and metadata |
| `/admin/genres` | Genre and tag directory with usage counters and creation modal |
| `/admin/users` | User moderation directory with status filtering, role assignment, and ban/unban controls |
| `/admin/support` | Customer support inbox with ticket assignment, priority controls, and linked drama context |
| `/admin/audit` | Administrative audit trail capturing user, action, target entity, and timestamp |
| `/admin/settings` | Platform configurations (General, Site, Users, Monetization) |
| `/admin/import` | CSV and bulk metadata import pipeline with schema validation |

---

## Known Stubs & Future Roadmap

To ensure transparent documentation integrity across all development milestones:

1. **Telegram Ecosystem Integration**:
   - The "Connect Telegram" button in `/account` provides an informational notification.
   - The complete technical implementation roadmap for BotFather setup, HMAC verification algorithms, database migration scripts, Next.js webhook handlers, and Telegram Mini App (TMA) streaming is documented in [`FUTURE_PLAN.md`](FUTURE_PLAN.md).
2. **Production Database & No-Mock Policy**:
   - In development environments lacking Supabase credentials, the application gracefully reads from mock datasets in `data/*.mock.ts`.
   - In production builds (`NODE_ENV === "production"`), the application strictly enforces the no-mock rule: queries either succeed against Supabase or return structured errors to prevent stale mock data leakage.

---

## Project Structure

```
dramashort/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # login, signup, forgot-password, reset-password, verify-email
│   ├── account/                  # account, wallet, favorite, history, settings
│   ├── admin/                    # admin console (dramas, episodes, support, audit, import, settings)
│   ├── channel/[slug]/           # channel profile pages
│   ├── drama/[slug]/             # drama detail pages
│   ├── watch/[slug]/             # video player & episode picker
│   ├── home/                     # homepage feed
│   ├── genres/                   # genre filter directory
│   ├── new-release/              # new releases directory
│   ├── search/                   # multi-attribute search
│   ├── layout.tsx                # font providers & theme wrapper
│   └── globals.css               # tailwind directives & design tokens
│
├── components/                   # modular UI components
│   ├── admin/                    # admin sidebar & console widgets
│   ├── account/                  # account navigation sidebar & modals
│   ├── header/                   # desktop nav, mobile sheet, action bar
│   ├── player/                   # subtitle overlay, HUD, episode sheet, shortcuts modal
│   ├── rewards/                  # daily check-in streak modal & trigger badge
│   ├── wallet/                   # coin purchase modal & package cards
│   ├── Header.tsx                # main sticky navigation bar
│   ├── Footer.tsx                # footer with dynamic browse & legal links
│   ├── Hero.tsx                  # featured carousel
│   ├── TitleCard.tsx             # reusable responsive drama card
│   ├── VideoPlayer.tsx           # core video streaming player
│   └── Toast.tsx                 # animated toast notification
│
├── contexts/                     # AuthContext, AdminAuthContext, FavoritesContext, ThemeContext, DailyRewardContext
├── data/                         # offline catalog mocks & fallback fixtures (titles.mock.ts)
├── design-tokens/                # tokens.css (color scales, theme tokens) and tailwind config
├── docs/                         # Architecture Decision Records (ADR) & technical specifications
├── e2e/                          # Playwright end-to-end journey tests & fixtures
├── hooks/                        # useToast, useMediaQuery, useSwipeNavigation, custom utility hooks
├── lib/                          # server-only operations (lib/server/), client fetchers (lib/client/), facades (lib/services/)
├── middleware.ts                 # admin subdomain URL rewrite rules & session guard
├── public/                       # logos, icons, subtitles, service worker (sw.js)
├── scripts/                      # bundle budget checker (check-bundle-budget.mjs)
└── supabase/                     # Supabase CLI workdir: one migration chain, config.toml, email templates
```

---

## Status

| Subsystem | Status |
|---|---|
| Design Tokens (Colors, Themes, Typography) | ✅ Complete |
| Landing Page (`/`) & Homepage Feed (`/home`) | ✅ Complete |
| Vertical Drama Player & Streaming UX (HLS, PiP, Subtitles, Keymap) | ✅ Complete |
| User Account, Favorites & Watch History | ✅ Complete |
| Authentication System (Login, Signup, OTP, Reset Password) | ✅ Complete |
| Freemium Monetization Engine (Coins, Locks, Check-in Streak, Shop) | ✅ Complete |
| Progressive Web App (PWA Manifest, Service Worker, Install Prompt) | ✅ Complete |
| Backoffice Admin Portal (Dramas, Episodes, Taxonomy, Users, Settings) | ✅ Complete |
| Admin Support Inbox, Audit Trail & Bulk Import Pipeline | ✅ Complete |
| Backend Architecture & Service Layer Split (`lib/server/` vs `lib/client/`) | ✅ Complete |
| Automated Tooling & Quality (ESLint Flat Config, Bundle Budgets, CI) | ✅ Complete |
| Automated Test Suite (1,151+ tests across 341 suites, 100% pass rate) | ✅ Complete |
| Multi-Device Playwright E2E Suite & WCAG 2.1 AA Axe Auditing | ✅ Complete |
| Telegram Mini App & Bot Ecosystem | 🔮 Future Plan (See [`FUTURE_PLAN.md`](FUTURE_PLAN.md)) |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (see "Database (Supabase)" below)
cp .env.example .env.local

# 3. Run local development server
npm run dev

# 4. Check types & linting
npx tsc --noEmit
npm run lint

# 5. Check First-Load JavaScript bundle budgets
npm run check:budget

# 6. Run automated test suite
npm test

# 7. Run Playwright E2E tests
npm run test:e2e

# 8. Build for production
npm run build
```

Open `http://localhost:3000` to view the public site, or `http://localhost:3000/admin` for the admin portal.

### Database (Supabase)

The app uses one Supabase project with every table in the `public` schema ([ADR-0005](docs/adr/0005-single-supabase-project.md)). It needs three variables in `.env.local`:

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser and server |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (admin writes, seed and admin scripts); never expose it to the browser |

`NEXT_PUBLIC_*` values are built into the browser code, so rebuild after changing them. `npm run build` and `npm run start` also need `PAYMENT_WEBHOOK_SECRET` and `CRON_SECRET`; for local builds put them in `.env.production.local` (see `.env.example`).

The schema is one migration chain in `supabase/migrations/`; `supabase/config.toml` holds the auth settings and `supabase/templates/` the email templates.

```bash
# Local stack in Docker (needs Docker Desktop); applies every migration
npm run db:start
#   If the analytics or Studio containers fail their health checks (seen on Windows):
#   npx supabase start -x studio,logflare,vector
npx supabase status -o env       # API_URL, ANON_KEY, SERVICE_ROLE_KEY for the three variables
npm run db:seed:dev              # sample catalog: 35 titles, 175 episodes
npm run admin:create -- --email you@example.com   # admin account; prints a generated password once
npm run db:stop                  # stop the local stack and delete its data

# Linked project (after `npx supabase link --project-ref <ref>`)
npm run db:push                  # apply new migrations
npm run types                    # regenerate types/supabase.ts
```

`db:seed:dev`, `db:clean:dev` and `admin:create` change the project in `.env.local` (shell variables take precedence). They refuse any hosted project unless `--confirm-production` is passed, so against a hosted project run, for example, `npm run admin:create -- --email you@example.com --confirm-production`.
