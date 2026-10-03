# DramaShort Service & Hydration Architecture

This directory contains the central data access layers for the DramaShort application, interfacing with the dual Supabase PostgreSQL database architecture and local guest persistence.

---

## 1. Dual Supabase Architecture

The project maintains two decoupled Supabase projects:

| Project | Supabase Ref | Primary Scope | Client Access |
|---|---|---|---|
| **Content DB** | `czkkzoiuyqybafacpgsp` | Reusable Headless CMS for channels, dramas (`titles` table), and episodes | Read-only for public clients (`NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY`); write-enabled for privileged server routes (`CONTENT_SUPABASE_SERVICE_ROLE_KEY`) |
| **User DB** | `bpidsbcrvpkavvdvtpgh` | App-specific user database: Supabase Auth, profiles, favorites, custom lists, watch history | Authenticated access with strict Row-Level Security (RLS) policies per `auth.uid()` |

---

## 2. Standardized Hydration & Loading Pattern (Phase 6 M1)

All UI components and pages consuming dynamic content must adhere to the **Standardized Hydration Pattern**:

```tsx
"use client";

import { useEffect, useState } from "react";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import { getPublishedTitles } from "@/lib/services/content.service";
import { titles as fallbackTitles, type Title } from "@/data/titles.mock";

export default function MyCatalogSection() {
  const [items, setItems] = useState<Title[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getPublishedTitles({ sort: "newest", limit: 12 })
      .then((data) => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          setItems(data);
        } else {
          // Graceful fallback if database returns empty in development
          setItems(fallbackTitles.slice(0, 12));
        }
      })
      .catch((err) => {
        console.warn("Failed to query Content DB, falling back to mock fixtures:", err);
        if (isMounted) setItems(fallbackTitles.slice(0, 12));
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

  if (items.length === 0) {
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
1. **Zero Layout Shift (CLS)**: Skeletons (`TitleCardSkeleton`, Hero skeleton, Trending carousel skeleton) match the exact card aspect ratios (`2/3`), spacing (`gap-4`), and grid layouts.
2. **No Mock Flashes**: Components initialize with `isLoading = true` and `items = []`. Mock fixtures are never rendered prior to data resolution, preventing visual flicker.
3. **Graceful Offline / Dev Fallbacks**: If Supabase connection fails or environment variables are unavailable during builds or offline development, components fall back to typed mock fixtures rather than throwing runtime errors or rendering blank pages.
4. **Clean Empty States**: Once loaded, if the database returns 0 records for a legitimate query (e.g. filtered search or empty channel), a dedicated empty state is presented.

---

## 3. Core Services

### `content.service.ts`
- **`searchPublishedTitles(options)`**: Server-side filtering, keyword matching (multi-field `title` + `synopsis`), channel/genre/tag filters, and PostgREST pagination.
- **`getPublishedTitles(options)`**: Simple wrapper around search returning item lists.
- **`getTopTrendingTitles(limit)`**: Top dramas sorted by view count.
- **`getNewReleaseTitles(limit)`**: Latest published dramas sorted by creation date.
- **`getHeroSlides()`**: Dynamic slides derived from top trending dramas.
- **`getTitleBySlug(slug)`**: Lookup by slug (with legacy prefix support).
- **`getTitlesBySlugs(slugs)`**: Batch lookups for favorites and watch history hydration.
- **`getEpisodesByTitleId(titleId)`**: Ordered episode lists for video playback.
- **`getChannelBySlug(slug)`** & **`getChannels()`**: Publishing channels.

### `user.service.ts`
- **Profiles**: `getUserProfile()`, `updateUserProfile()`.
- **Favorites & Lists**: `getUserFavorites()`, `addUserFavorite()`, `removeUserFavorite()`, `getUserCustomLists()`, `createCustomList()`, `addItemToCustomList()`.
- **Watch History**: `getUserWatchHistory()`, `upsertWatchProgress()`, `deleteWatchHistoryItem()`, `clearUserWatchHistory()`.
- **Guest Storage & Sync**: `getGuestWatchHistory()`, `saveGuestWatchProgress()`, `syncGuestWatchHistory()`, `deleteGuestWatchHistoryItem()`, `clearGuestWatchHistory()`.
