# DramaShort Service & Hydration Architecture

This directory contains the central data access layers and service facades for the DramaShort application, interfacing with the Supabase PostgreSQL database architecture, Next.js server components, and local guest persistence.

---

## 1. Dual Supabase Architecture

> [!NOTE] **Topology Decision Update (ADR-0003)**
> Per **ADR-0003: Database Topology Decision** ([`docs/adr/0003-database-topology.md`](../../docs/adr/0003-database-topology.md)), DramaShort will consolidate Content and User data into a single Supabase project partitioned into `content` and `public` schemas (Task 13.2). Dual clients in `lib/supabase/*` will be consolidated into unified singletons.

The project currently coordinates two decoupled Supabase projects:

| Project | Supabase Ref | Primary Scope | Client Access |
|---|---|---|---|
| **Content DB** | `czkkzoiuyqybafacpgsp` | Reusable Headless CMS for channels, dramas (`titles` table), and episodes | Read-only for public clients (`NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY`); write-enabled for privileged server routes (`CONTENT_SUPABASE_SERVICE_ROLE_KEY`) |
| **User DB** | `bpidsbcrvpkavvdvtpgh` | App-specific user database: Supabase Auth, profiles, wallets, transactions, favorites, custom lists, watch history | Authenticated access with strict Row-Level Security (RLS) policies per `auth.uid()` |

---

## 2. Service Layer Split Architecture (Task 13.4)

To prevent security vulnerabilities, credential leaks, and bloated client bundles, the service architecture enforces strict layer separation:

```
lib/
├── server/               # 🔒 Server-Only Operations
│   ├── admin.ts          # Direct DB mutations & admin operations
│   ├── catalog.ts        # Server-rendered catalog & ISR data fetches
│   ├── user.ts           # Server-side user profiles & session resolvers
│   ├── wallet.ts         # Atomic coin ledger & entitlement checks
│   └── playback.ts       # Secured video streaming URL signer & token issuer
│
├── client/               # 🌐 Client-Side Safe Operations
│   ├── catalog.ts        # Client fetch helpers calling /api/dramas
│   └── user.ts           # Client operations calling /api/user/* & localStorage
│
└── services/             # 🔄 Standardized Facade Layer (Result<T> Pattern)
    ├── content.service.ts# Re-exports unified drama & channel methods
    ├── user.service.ts   # Re-exports user profile, history, & favorite methods
    └── wallet.service.ts # Re-exports wallet, paywall, & coin unlock methods
```

### Architectural Guardrails:
1. **Server-Only Enforcement**: Every module in `lib/server/*` begins with `import 'server-only'`. Any accidental import by a Client Component (`'use client'`) fails at compile time.
2. **Zero Client Leakage**: Client modules (`lib/client/*`) never import from `lib/server/*` or invoke `supabaseServiceRoleClient`.
3. **Standardized `Result<T>` Pattern**: Service methods return a discriminated union `Result<T, E>` (`{ ok: true, value: T }` or `{ ok: false, error: E }`) via `lib/utils/result.ts`, eliminating unhandled promise rejections and enforcing explicit error handling.

---

## 3. Strict No-Mock Production Rule (Task 12.4)

> [!IMPORTANT] **No Mock Data in Production**
> In production environments (`process.env.NODE_ENV === "production"`), the application **MUST NEVER** serve mock data from `data/*.mock.ts` when a database query or network request fails.

### Policy Rules:
1. **Production Failure Handling**: When Supabase is unreachable or encounters a query error in production, services return a typed `err(...)` Result or throw a structured error that renders Next.js Error Boundaries (`error.tsx`) or explicit empty states.
2. **Scope of Mock Fixtures**: Mock datasets in `data/titles.mock.ts` and `data/channels.mock.ts` are strictly restricted to:
   - Automated unit tests (`node:test`).
   - Development mode (`NODE_ENV === "development"`) when Supabase credentials are unset.
   - Database seed scripts.
3. **No Silent Data Masking**: Production errors must be visible to observability telemetry and error boundaries, rather than silently masked by fallback fixtures.

---

## 4. Standardized Hydration Pattern

Client-side catalog components adhere to the following hydration pattern:

```tsx
"use client";

import { useEffect, useState } from "react";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import { getPublishedTitles } from "@/lib/services/content.service";
import type { Drama } from "@/types/drama";

export default function MyCatalogSection() {
  const [items, setItems] = useState<Drama[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getPublishedTitles({ sort: "newest", limit: 12 })
      .then((data) => {
        if (!isMounted) return;
        setItems(data || []);
      })
      .catch((err) => {
        console.error("Failed to query catalog:", err);
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <TitleCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (hasError || items.length === 0) {
    return <EmptyStateMessage />;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <TitleCard key={item.id} href={`/drama/${item.slug}`} poster={item.poster} title={item.title} />
      ))}
    </div>
  );
}
```

### Key Principles:
1. **Zero Layout Shift (CLS)**: Skeletons (`TitleCardSkeleton`, Hero skeleton) match the exact card aspect ratios (`2/3`), spacing (`gap-4`), and grid layouts.
2. **No Mock Flashes**: Components initialize with `isLoading = true` and `items = []`. Mock fixtures are never rendered prior to data resolution.
3. **Clean Empty & Error States**: Real empty states or retry actions are rendered when queries return zero results or fail.

---

## 5. Core Services Reference

### `content.service.ts`
- **`searchPublishedTitles(options)`**: Server-side filtering, keyword matching (multi-field `title` + `synopsis`), channel/genre/tag filters, and PostgREST pagination.
- **`getPublishedTitles(options)`**: Wrapper returning published drama lists.
- **`getTopTrendingTitles(limit)`**: Top dramas sorted by view count.
- **`getNewReleaseTitles(limit)`**: Latest published dramas sorted by publication date.
- **`getHeroSlides()`**: Dynamic slides derived from top trending dramas.
- **`getDramaBySlug(slug)`**: Lookup drama by slug with channel hydration.
- **`getEpisodesByDramaId(dramaId)`**: Ordered episode lists for video playback.
- **`getChannelBySlug(slug)`** & **`getChannels()`**: Publishing channels.

### `user.service.ts`
- **Profiles**: `getUserProfile()`, `updateUserProfile()`.
- **Favorites & Lists**: `getUserFavorites()`, `addUserFavorite()`, `removeUserFavorite()`, `getUserCustomLists()`, `createCustomList()`, `addItemToCustomList()`.
- **Watch History & Progress**: `getUserWatchHistory()`, `getWatchProgress()`, `upsertWatchProgress()`, `deleteWatchHistoryItem()`, `clearUserWatchHistory()`.
- **Guest Storage & Sync**: `getGuestWatchHistory()`, `saveGuestWatchProgress()`, `syncGuestWatchHistory()`.

### `wallet.service.ts`
- **Wallet & Balance**: `getUserWallet()`, `getCoinTransactions()`.
- **Entitlements & Unlocks**: `unlockEpisodeWithCoins()`, `isEpisodeUnlocked()`.
- **Daily Rewards**: `getDailyCheckInStatus()`, `claimDailyReward()`.
