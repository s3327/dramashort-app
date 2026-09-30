"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { Info } from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import { historyItems } from "@/data/history.mock";
import { useTheme } from "@/contexts/ThemeContext";

const HISTORY_WINDOW_DAYS = 60;

function dayLabel(isoDate: string) {
  const watched = new Date(isoDate);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
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
  // Only the last HISTORY_WINDOW_DAYS is shown here — everything is still
  // kept in the real database from account creation onward; this page is
  // just a recent-activity window, not the full retention policy.
  const groups = useMemo(() => {
    const cutoff = Date.now() - HISTORY_WINDOW_DAYS * 86400000;
    const withinWindow = historyItems
      .filter((item) => new Date(item.watchedAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime());

    const map = new Map<string, typeof historyItems>();
    for (const item of withinWindow) {
      const label = dayLabel(item.watchedAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <AccountSidebar />

          <main className="w-full flex-1 space-y-6">
            <h1 className="font-display font-bold text-xl sm:text-2xl">History</h1>

            {/* Info note about the 60-day window */}
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">
              <Info size={17} strokeWidth={2} className="shrink-0 mt-0.5 text-primary" />
              <p>
                Showing your watch history from today back to {HISTORY_WINDOW_DAYS} days ago.
              </p>
            </div>

            {groups.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg shadow-sm p-8 text-center">
                <p className="text-sm text-text-muted">
                  No watch history in the last {HISTORY_WINDOW_DAYS} days yet.
                </p>
              </div>
            ) : (
              groups.map(([label, items]) => (
                <div key={label}>
                  <h2 className="text-sm font-semibold text-text-muted mb-3">{label}</h2>
                  <div className="grid grid-cols-4 gap-3 sm:gap-4">
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        href={`/drama/${item.slug}`}
                        className="group"
                      >
                        <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm">
                          <Image
                            src={item.poster}
                            alt={item.title}
                            fill
                            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 24vw, 45vw"
                            className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                          <span className="absolute top-2 left-2 rounded-pill bg-black/55 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-text-light">
                            {item.episodeLabel}
                          </span>
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, item.progress * 100))}%` }}
                            />
                          </div>
                        </div>
                        <p className="mt-2 text-xs sm:text-sm font-semibold text-text line-clamp-2 leading-snug">
                          {item.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
