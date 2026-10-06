# DramaShort — Web & Admin Platform

DramaShort is a vertical drama streaming web platform built for high-retention short-form episodic entertainment, paired with an integrated backoffice admin portal.

---

## Architecture & Features

* **Framework**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide icons.
* **Multi-Theme Engine**: Custom design tokens with 3 runtime surfaces (`light`, `soft` [default], `dark`) managed via `ThemeProvider` and CSS variables.
* **Unified Drama Catalog**: Single source of truth in [`data/titles.mock.ts`](data/titles.mock.ts) powering public feeds, detail views, and backoffice management.
* **Subdomain Admin Routing**: Next.js middleware automatically detects `admin.*` hostnames and internally rewrites requests to `/admin`.
* **Client State & Persistence**: `AuthContext` (mock session) and `FavoritesContext` with `localStorage` synchronization.
* **Architecture Decision Records**: Formal platform architectural choices and decision gates are maintained in [`docs/adr/README.md`](docs/adr/README.md).
* **Headless Reusability Architecture**: Multi-schema catalog access and PostgreSQL role grants for external apps are documented in [`docs/architecture/reusable-content-api.md`](docs/architecture/reusable-content-api.md).

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
| `/watch/[slug]` | Video player interface with 40-episode tabbed navigation and issue reporting modal |
| `/search` | Deep search with query, channel, genre, and multi-tag filtering |
| `/contact`, `/faq`, `/terms`, `/privacy-policy`, `/content-guidelines`, `/maintenance` | Informational and legal layout pages |

### 👤 User Account & Auth
| Route | Description |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/verify-email` | Authentication flow with OTP input and redirect preservation |
| `/account` | User profile overview, display name edit, email verification change step, password change modal |
| `/account/favorite` | User favorites catalog and custom watchlists |
| `/account/history` | Chronological watch history with relative timestamps |
| `/account/settings` | Account configuration and language preferences |

### 🛠️ Backoffice Admin Console
| Route | Description |
|---|---|
| `/admin` | Smart gateway routing to dashboard or login based on session |
| `/admin/login` | Admin authentication portal |
| `/admin/dashboard` | KPI analytics (total titles, users, views, active channels) |
| `/admin/titles` | Title directory with table & card views, channel filters, search, bulk select, and pagination |
| `/admin/titles/[id]/edit` | Complete title editing form (metadata, status, episodes, tags, synopsis, poster preview) |
| `/admin/channels` | Channel management grid with sync status, title counts, and metadata |
| `/admin/genres` | Genre and tag directory with usage counters and creation modal |
| `/admin/users` | User management directory with status filtering and sorting |
| `/admin/settings` | Tabbed configurations (General, Site, Users, Ads) |
| `/admin/import` | Drama scraping and bulk ingest placeholder |

---

## Project Structure

```
dramashort/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # login, signup, forgot-password, verify-email
│   ├── account/                  # account, favorite, history, settings
│   ├── admin/                    # admin console & titles/[id]/edit
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
│   ├── admin/                    # admin sidebar & placeholders
│   ├── account/                  # account navigation sidebar
│   ├── header/                   # desktop nav, mobile sheet, action bar
│   ├── Header.tsx                # main sticky navigation bar
│   ├── Footer.tsx                # footer with dynamic browse & legal links
│   ├── Hero.tsx                  # featured carousel
│   ├── TitleCard.tsx             # reusable responsive drama card
│   └── Toast.tsx                 # animated toast notification
│
├── contexts/                     # AuthContext, AdminAuthContext, FavoritesContext, ThemeContext
├── data/                         # unified catalog (titles.mock.ts) and static data mocks
├── design-tokens/                # tokens.css (color scales, theme tokens) and tailwind config
├── docs/                         # Architecture Decision Records (ADR) registry
├── hooks/                        # useToast and custom utility hooks
├── lib/                          # formatting utilities and recommendation algorithms
├── middleware.ts                 # admin subdomain URL rewrite rules
├── preview/                      # standalone static HTML preview mockups
└── public/                       # logos, wordmarks, circular icons
```

---

## Status

| Piece | Status |
|---|---|
| Design Tokens (Colors, Themes, Typography) | ✅ Complete |
| Landing Page (`/`) | ✅ Complete |
| Homepage Feed (`/home`) | ✅ Complete |
| Drama Detail & Watch Experience | ✅ Complete |
| User Account & Favorites Management | ✅ Complete |
| Authentication Screens (Login, Signup, OTP) | ✅ Complete |
| Admin Console & Title Management | ✅ Complete |
| Unified Catalog (`titles.mock.ts` + Supabase Content DB) | ✅ Complete |
| Backend & Dual-Database Integration (Supabase SSR & Service Role) | ✅ Complete |
| Automated Testing Suite (14 unit & journey tests) | ✅ Complete |
| Telegram Mini App & Bot Ecosystem | 🔮 Future Plan (See [`FUTURE_PLAN.md`](FUTURE_PLAN.md)) |

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Check types & linting
npx tsc --noEmit
npm run lint

# 4. Build for production
npm run build
```

Open `http://localhost:3000` to view the public site, or `http://localhost:3000/admin` for the admin portal.
