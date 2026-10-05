"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Flame } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCompactNumber } from "@/lib/format";
import {
  searchPublishedTitles,
  type PaginatedTitlesResult,
} from "@/lib/services/content.service";

const PAGE_SIZE = 24;

function TrendingContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();

  const initialPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const [page, setPage] = useState(initialPage);

  const [results, setResults] = useState<PaginatedTitlesResult>({
    items: [],
    total: 0,
    page: initialPage,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch server-side ranked trending titles
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    searchPublishedTitles({
      sort: "trending",
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (!isMounted) return;
        setResults(res);
      })
      .catch((err) => {
        console.warn("Failed to load trending titles from DB:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [page]);

  // Keep URL ?page= parameter in sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));

    const queryString = params.toString();
    const newUrl = queryString ? `/trending?${queryString}` : "/trending";
    window.history.replaceState(null, "", newUrl);
  }, [page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1.5">
          <h1 className="flex items-center gap-2 font-display font-bold text-2xl">
            <Flame size={24} strokeWidth={2.5} className="text-primary fill-primary/20" />
            Trending
          </h1>
          {/* Static for now — the active period is set from admin settings later */}
          <span className="rounded-pill bg-surface border border-border text-xs font-semibold text-text-muted px-3 py-1.5">
            This Week
          </span>
        </div>
        <p className="text-sm text-text-muted mb-8">
          Ranked by how many users pressed play, most viewed first.
        </p>

        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <TitleCardSkeleton key={i} hasSubtitle />
            ))}
          </div>
        ) : results.items.length === 0 ? (
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

            <Pagination
              page={results.page}
              totalPages={results.totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function TrendingPage() {
  return (
    <Suspense fallback={null}>
      <TrendingContent />
    </Suspense>
  );
}
