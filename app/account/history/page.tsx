"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Info,
  Clock,
  Trash2,
  Play,
  AlertCircle,
  Loader2,
  ChevronRight,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserWatchHistory,
  getGuestWatchHistory,
  deleteWatchHistoryItem,
  clearUserWatchHistory,
  deleteGuestWatchHistoryItem,
  clearGuestWatchHistory,
  type WatchHistoryRow,
} from "@/lib/services/user.service";
import { getTitlesBySlugs } from "@/lib/services/content.service";
import { useToast } from "@/hooks/useToast";

const HISTORY_WINDOW_DAYS = 60;

export interface DisplayHistoryItem {
  id: string;
  slug: string;
  title: string;
  poster: string;
  episodeNumber: number;
  totalEpisodes: number;
  episodeLabel: string;
  progress: number;
  watchedAt: string;
}

function dayLabel(isoDate: string) {
  const watched = new Date(isoDate);
  const today = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round(
    (startOfDay(today).getTime() - startOfDay(watched).getTime()) / 86400000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(watched);
}

export default function HistoryPage() {
  const { theme } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [items, setItems] = useState<DisplayHistoryItem[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const { message: toastMessage, show: showToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      let rows: WatchHistoryRow[] = [];
      if (user) {
        rows = await getUserWatchHistory(user.id);
      } else {
        rows = getGuestWatchHistory();
      }

      if (!isMounted) return;

      if (!rows || rows.length === 0) {
        setItems([]);
        setHasLoaded(true);
        return;
      }

      // Filter within the 60-day recent window
      const cutoff = Date.now() - HISTORY_WINDOW_DAYS * 86400000;
      const withinWindow = rows.filter((r) => {
        const time = new Date(r.updated_at || Date.now()).getTime();
        return time >= cutoff;
      });

      if (withinWindow.length === 0) {
        setItems([]);
        setHasLoaded(true);
        return;
      }

      const slugs = Array.from(new Set(withinWindow.map((r) => r.title_slug)));
      const dbTitles = await getTitlesBySlugs(slugs);

      if (!isMounted) return;

      const titleMap = new Map(dbTitles.map((t) => [t.slug, t]));
      const mapped: DisplayHistoryItem[] = [];

      for (const r of withinWindow) {
        const drama = titleMap.get(r.title_slug);
        if (!drama) {
          // Drama was deleted or no longer exists in database
          continue;
        }

        mapped.push({
          id: r.id || `history-${r.title_slug}`,
          slug: r.title_slug,
          title: drama.title,
          poster: drama.poster,
          episodeNumber: r.episode_number,
          totalEpisodes: drama.totalEpisodes,
          episodeLabel: `EP ${r.episode_number} of ${drama.totalEpisodes}`,
          progress: r.progress || 0,
          watchedAt: r.updated_at || new Date().toISOString(),
        });
      }

      setItems(mapped);
      setHasLoaded(true);
    }

    if (!isAuthLoading) {
      loadHistory();
    }

    return () => {
      isMounted = false;
    };
  }, [user, isAuthLoading]);

  // Group items by day label
  const groups = useMemo(() => {
    const map = new Map<string, DisplayHistoryItem[]>();
    for (const item of items) {
      const label = dayLabel(item.watchedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  const handleClearHistory = async () => {
    setIsClearing(true);
    let success = true;

    if (user) {
      success = await clearUserWatchHistory(user.id);
    } else {
      clearGuestWatchHistory();
    }

    if (success) {
      setItems([]);
      showToast("Watch history cleared successfully.");
      setShowClearModal(false);
    } else {
      showToast("Unable to clear watch history. Please try again.");
    }
    setIsClearing(false);
  };

  const handleDeleteItem = async (e: React.MouseEvent, item: DisplayHistoryItem) => {
    e.preventDefault();
    e.stopPropagation();

    setDeletingSlug(item.slug);
    let success = true;

    if (user) {
      success = await deleteWatchHistoryItem(user.id, item.slug);
    } else {
      deleteGuestWatchHistoryItem(item.slug);
    }

    if (success) {
      setItems((prev) => prev.filter((it) => it.slug !== item.slug));
      showToast(`Removed "${item.title}" from history.`);
    } else {
      showToast("Failed to remove item. Please try again.");
    }
    setDeletingSlug(null);
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <AccountSidebar />

          <main className="w-full flex-1 space-y-6">
            {/* Header with Title and Clear Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-border">
              <div>
                <h1 className="font-display font-bold text-xl sm:text-2xl">
                  Watch History
                </h1>
                <p className="text-xs text-text-muted mt-1">
                  {hasLoaded
                    ? items.length > 0
                      ? `${items.length} ${items.length === 1 ? "drama" : "dramas"} in your activity window`
                      : "No activity recorded"
                    : "Loading your watch history..."}
                </p>
              </div>

              {hasLoaded && items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/5 hover:bg-danger/15 text-danger text-xs font-semibold px-3.5 py-1.5 transition-colors"
                >
                  <Trash2 size={13} strokeWidth={2} />
                  <span>Clear History</span>
                </button>
              )}
            </div>

            {/* Info note about the 60-day window */}
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-4 text-xs sm:text-sm text-text-muted">
              <Info
                size={17}
                strokeWidth={2}
                className="shrink-0 mt-0.5 text-primary"
              />
              <p>
                Showing your watch history from today back to {HISTORY_WINDOW_DAYS} days ago. Your full history is safely stored in your account.
              </p>
            </div>

            {/* Loading Skeleton */}
            {!hasLoaded ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="animate-pulse space-y-2">
                    <div className="aspect-[2/3] rounded-md bg-surface border border-border/40" />
                    <div className="h-3.5 bg-surface rounded w-3/4" />
                    <div className="h-3 bg-surface/60 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : groups.length === 0 ? (
              /* Empty State */
              <div className="bg-surface border border-border rounded-xl p-10 sm:p-12 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                  <Clock size={28} strokeWidth={1.75} />
                </div>
                <h3 className="font-display font-bold text-lg text-text mb-1">
                  No watch history yet
                </h3>
                <p className="text-xs sm:text-sm text-text-muted max-w-sm mb-6 leading-relaxed">
                  Start watching vertical dramas and your playback progress will automatically show up here so you can pick up where you left off.
                </p>
                <Link
                  href="/home"
                  className="inline-flex items-center gap-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-xs sm:text-sm px-5 py-2.5 shadow-sm transition-colors"
                >
                  <span>Explore Dramas</span>
                  <ChevronRight size={15} />
                </Link>
              </div>
            ) : (
              /* Grouped Watch History List */
              groups.map(([label, groupItems]) => (
                <div key={label} className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    {label}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                    {groupItems.map((item) => (
                      <div
                        key={item.id}
                        className="group relative flex flex-col"
                      >
                        <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm border border-border/30">
                          <Image
                            src={item.poster}
                            alt={item.title}
                            fill
                            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 24vw, 45vw"
                            className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

                          {/* Episode badge */}
                          <span className="absolute top-2 left-2 rounded-pill bg-black/65 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-white">
                            {item.episodeLabel}
                          </span>

                          {/* Delete Item Button */}
                          <button
                            type="button"
                            onClick={(e) => handleDeleteItem(e, item)}
                            disabled={deletingSlug === item.slug}
                            aria-label={`Remove ${item.title} from history`}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/65 hover:bg-danger text-white/90 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 sm:focus:opacity-100 transition-all duration-200 z-10"
                            title="Remove from history"
                          >
                            {deletingSlug === item.slug ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <X size={13} strokeWidth={2.5} />
                            )}
                          </button>

                          {/* Hover Play/Resume Overlay */}
                          <Link
                            href={`/watch/${item.slug}?ep=${item.episodeNumber}`}
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[1px]"
                            aria-label={`Resume ${item.title} at ${item.episodeLabel}`}
                          >
                            <div className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-110">
                              <Play size={18} className="fill-current translate-x-0.5" />
                            </div>
                          </Link>

                          {/* Progress bar at bottom */}
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{
                                width: `${Math.min(100, Math.max(0, item.progress * 100))}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Title and details */}
                        <div className="mt-2 space-y-0.5">
                          <Link
                            href={`/drama/${item.slug}`}
                            className="text-xs sm:text-sm font-semibold text-text hover:text-primary transition-colors line-clamp-2 leading-snug"
                          >
                            {item.title}
                          </Link>
                          <div className="flex items-center justify-between text-[11px] text-text-muted">
                            <span>{item.episodeLabel}</span>
                            <span>{Math.round(item.progress * 100)}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </main>
        </div>
      </div>

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-history-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center">
              <AlertCircle size={22} strokeWidth={2} />
            </div>

            <div>
              <h3
                id="clear-history-title"
                className="font-display font-bold text-base text-text mb-1"
              >
                Clear Entire Watch History?
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                This will remove all {items.length} drama records from your watch history. You will lose your saved resume points for these titles.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="rounded-full border border-border bg-bg hover:bg-surface px-4 py-2 text-xs font-semibold text-text transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearHistory}
                disabled={isClearing}
                className="inline-flex items-center gap-2 rounded-full bg-danger hover:bg-danger/90 text-white px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isClearing && <Loader2 size={13} className="animate-spin" />}
                <span>{isClearing ? "Clearing..." : "Yes, Clear History"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-surface border border-border text-text px-4 py-2.5 text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
