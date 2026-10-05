"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { useTheme } from "@/contexts/ThemeContext";
import {
  searchPublishedTitles,
  type PaginatedTitlesResult,
} from "@/lib/services/content.service";

const PAGE_SIZE = 24;

function NewReleaseContent() {
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

  // Fetch server-side paginated new releases
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    searchPublishedTitles({
      sort: "newest",
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (!isMounted) return;
        setResults(res);
      })
      .catch((err) => {
        console.warn("Failed to load new releases from DB:", err);
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
    const newUrl = queryString ? `/new-release?${queryString}` : "/new-release";
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
        <h1 className="font-display font-bold text-2xl mb-8">New Release</h1>

        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <TitleCardSkeleton key={i} />
            ))}
          </div>
        ) : results.items.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-12 text-center my-6 max-w-lg mx-auto shadow-sm">
            <h2 className="font-display font-bold text-lg mb-2">No new releases yet</h2>
            <p className="text-sm text-text-muted">
              Check back soon for new drama series releases.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {results.items.map((item) => (
                <TitleCard
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  poster={item.poster}
                  title={item.title}
                />
              ))}
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

export default function NewReleasePage() {
  return (
    <Suspense fallback={null}>
      <NewReleaseContent />
    </Suspense>
  );
}
