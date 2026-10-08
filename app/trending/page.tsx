import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Flame } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import PageShell from "@/components/PageShell";
import PaginationIsland from "@/components/islands/PaginationIsland";
import { formatCompactNumber } from "@/lib/format";
import { getTrendingTitles } from "@/lib/services/analytics.service";
import { searchPublishedTitles } from "@/lib/services/content.service";
import type { TrendingPeriod } from "@/types/analytics";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Trending Dramas — DramaShort",
  description:
    "Browse the most popular and watched vertical drama series this week on DramaShort.",
};

const PAGE_SIZE = 24;

const PERIOD_DESCRIPTIONS: Record<TrendingPeriod, string> = {
  "24h": "Ranked by real-time viewer momentum in the past 24 hours.",
  "7d": "Ranked by 7-day completion-weighted momentum and viewer retention.",
  "30d": "Ranked by sustained viewer engagement and watch volume over the past month.",
};

/**
 * Server Component pre-rendering ranked trending titles with server-side pagination and period filtering.
 */
export default async function TrendingPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const rawPage = typeof sp?.page === "string" ? sp.page : Array.isArray(sp?.page) ? sp.page[0] : undefined;
  const page = Math.max(1, parseInt(rawPage || "1", 10) || 1);

  const rawPeriod = typeof sp?.period === "string" ? sp.period : Array.isArray(sp?.period) ? sp.period[0] : undefined;
  const period: TrendingPeriod = rawPeriod === "24h" || rawPeriod === "30d" ? rawPeriod : "7d";

  // Real analytics trending rankings with seamless fallback to catalog searchPublishedTitles
  const results =
    (await getTrendingTitles({
      period,
      page,
      pageSize: PAGE_SIZE,
    })) ||
    (await searchPublishedTitles({
      sort: "trending",
      page,
      pageSize: PAGE_SIZE,
    }));


  return (
    <PageShell className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <h1 className="flex items-center gap-2 font-display font-bold text-2xl">
            <Flame size={24} strokeWidth={2.5} className="text-primary fill-primary/20" />
            Trending
          </h1>

          {/* Accessible Period Selector Tabs */}
          <nav aria-label="Trending timeframe" className="flex items-center gap-1 p-1 bg-surface border border-border rounded-full text-xs font-semibold">
            <Link
              href="/trending?period=24h"
              className={`px-3 py-1 rounded-full transition-colors ${
                period === "24h"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-elevated"
              }`}
              aria-current={period === "24h" ? "page" : undefined}
            >
              24 Hours
            </Link>
            <Link
              href="/trending?period=7d"
              className={`px-3 py-1 rounded-full transition-colors ${
                period === "7d"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-elevated"
              }`}
              aria-current={period === "7d" ? "page" : undefined}
            >
              This Week
            </Link>
            <Link
              href="/trending?period=30d"
              className={`px-3 py-1 rounded-full transition-colors ${
                period === "30d"
                  ? "bg-primary text-white shadow-sm"
                  : "text-text-muted hover:text-text hover:bg-surface-elevated"
              }`}
              aria-current={period === "30d" ? "page" : undefined}
            >
              30 Days
            </Link>
          </nav>
        </div>

        <p className="text-sm text-text-muted mb-8">
          {PERIOD_DESCRIPTIONS[period]}
        </p>

        {results.items.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-12 text-center my-6 max-w-lg mx-auto shadow-sm">
            <h2 className="font-display font-bold text-lg mb-2">No trending dramas yet</h2>
            <p className="text-sm text-text-muted">
              Start watching drama series to see trending rankings populate here.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {results.items.map((item, index) => {
                const rank = (results.page - 1) * PAGE_SIZE + index + 1;
                return (
                  <TitleCard
                    key={item.id}
                    href={`/drama/${item.slug}`}
                    poster={item.poster}
                    title={item.title}
                    overlay={
                      <span className="absolute top-2 left-2 rounded-md bg-black/70 backdrop-blur-sm px-1.5 py-0.5 text-xs font-extrabold text-text-light">
                        {rank}
                      </span>
                    }
                    subtitle={
                      <p className="text-xs text-text-muted mt-0.5">
                        {formatCompactNumber(item.views)} views
                      </p>
                    }
                  />
                );
              })}
            </div>

            <Suspense fallback={null}>
              <PaginationIsland
                page={results.page}
                totalPages={results.totalPages}
                basePath="/trending"
              />
            </Suspense>
          </>
        )}
      </main>

      <Footer />
    </PageShell>
  );
}

