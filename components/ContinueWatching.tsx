"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Clock, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserWatchHistory,
  getGuestWatchHistory,
  type WatchHistoryRow,
} from "@/lib/services/user.service";
import { getTitlesBySlugs } from "@/lib/services/content.service";
import { getTitleBySlugOrFallback } from "@/data/titles.mock";

// The /home page surfaces up to the 8 most recent in-progress watches
const MAX_VISIBLE = 8;

export interface ContinueWatchingDramaItem {
  id: string;
  slug: string;
  title: string;
  poster: string;
  episodeNumber: number;
  totalEpisodes: number;
  episodeLabel: string;
  progress: number; // 0..1
  href: string;
  channel?: string;
}

export default function ContinueWatching() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [items, setItems] = useState<ContinueWatchingDramaItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      let historyRows: WatchHistoryRow[] = [];
      if (user) {
        historyRows = await getUserWatchHistory(user.id);
      } else {
        historyRows = getGuestWatchHistory();
      }

      if (!isMounted) return;

      if (!historyRows || historyRows.length === 0) {
        setItems([]);
        setHasLoaded(true);
        return;
      }

      // Extract unique slugs
      const slugs = Array.from(new Set(historyRows.map((r) => r.title_slug)));
      const dbTitles = await getTitlesBySlugs(slugs);

      if (!isMounted) return;

      const titleMap = new Map(dbTitles.map((t) => [t.slug, t]));
      const mappedItems: ContinueWatchingDramaItem[] = [];

      for (const row of historyRows) {
        const drama =
          titleMap.get(row.title_slug) || getTitleBySlugOrFallback(row.title_slug);
        const total = drama.totalEpisodes || 1;
        const rawProgress = row.progress || 0;
        const isCompletedSeries =
          row.episode_number >= total && rawProgress >= 0.95;

        // Omit finished dramas from Continue Watching
        if (isCompletedSeries) {
          continue;
        }

        let targetEp = row.episode_number;
        let displayProgress = rawProgress;
        let label = `EP ${targetEp} of ${total}`;

        // If the current episode is finished (>= 95%) and next episode exists:
        if (rawProgress >= 0.95 && targetEp < total) {
          targetEp = row.episode_number + 1;
          displayProgress = 0;
          label = `Up Next: EP ${targetEp} of ${total}`;
        }

        mappedItems.push({
          id: row.id || `cw-${row.title_slug}`,
          slug: row.title_slug,
          title: drama.title,
          poster: drama.poster,
          episodeNumber: targetEp,
          totalEpisodes: total,
          episodeLabel: label,
          progress: displayProgress,
          href: `/watch/${row.title_slug}?ep=${targetEp}`,
          channel: drama.channel,
        });

        if (mappedItems.length >= MAX_VISIBLE) {
          break;
        }
      }

      setItems(mappedItems);
      setHasLoaded(true);
    }

    if (!isAuthLoading) {
      loadHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [user, isAuthLoading]);

  const handleScroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 340;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-8 sm:py-10">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-text">
            Continue Watching
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Pick up right where you left off
          </p>
        </div>

        {/* Carousel controls on desktop when items exist */}
        {hasLoaded && items.length > 3 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleScroll("left")}
              aria-label="Scroll left"
              className="w-8 h-8 rounded-full border border-border bg-surface hover:bg-surface-elevated text-text-muted hover:text-text flex items-center justify-center transition-colors shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => handleScroll("right")}
              aria-label="Scroll right"
              className="w-8 h-8 rounded-full border border-border bg-surface hover:bg-surface-elevated text-text-muted hover:text-text flex items-center justify-center transition-colors shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {!hasLoaded ? (
        /* Loading Skeleton */
        <div className="flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="shrink-0 w-32 sm:w-36 md:w-40 animate-pulse space-y-2"
            >
              <div className="aspect-[2/3] rounded-md bg-surface border border-border/40" />
              <div className="h-3.5 bg-surface rounded w-3/4" />
              <div className="h-3 bg-surface/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface p-6 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clock size={20} strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text">
                Nothing in progress yet
              </p>
              <p className="text-xs text-text-muted max-w-sm">
                Watch an episode and your resume progress will automatically appear here.
              </p>
            </div>
          </div>
          <Link
            href="/trending"
            className="inline-flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-xs px-4 py-2 shadow-sm transition-colors shrink-0"
          >
            <Sparkles size={14} />
            <span>Discover Trending</span>
          </Link>
        </div>
      ) : (
        /* Dynamic In-Progress Carousel */
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group shrink-0 w-32 sm:w-36 md:w-40 snap-start flex flex-col"
            >
              <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm border border-border/30">
                <Image
                  src={item.poster}
                  alt={item.title}
                  fill
                  sizes="(min-width: 768px) 160px, (min-width: 640px) 144px, 128px"
                  className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
                />

                {/* Scrim gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                {/* Hover Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 backdrop-blur-[1px]">
                  <span className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-white shadow-lg group-hover:scale-110 transition-transform">
                    <Play size={16} fill="currentColor" className="translate-x-0.5" />
                  </span>
                </div>

                {/* Episode label badge */}
                <span className="absolute top-2 left-2 rounded-pill bg-black/65 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white">
                  {item.episodeLabel}
                </span>

                {/* Dynamic Progress Bar */}
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(0, item.progress * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Title & Progress % */}
              <div className="mt-2 space-y-0.5">
                <p className="text-xs sm:text-sm font-semibold text-text group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                  {item.title}
                </p>
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span className="truncate">{item.episodeLabel}</span>
                  {item.progress > 0 && (
                    <span className="shrink-0 ml-1 font-medium">
                      {Math.round(item.progress * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
