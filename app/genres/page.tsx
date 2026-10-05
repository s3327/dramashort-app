"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { useTheme } from "@/contexts/ThemeContext";
import {
  searchPublishedTitles,
  getDistinctGenres,
  type PaginatedTitlesResult,
} from "@/lib/services/content.service";

const PAGE_SIZE = 24;
const ALL_GENRE = "All";
// Roughly two chip rows' worth of height (chip height + gap) — used to
// detect whether the genre list actually needs an expand/collapse toggle.
const CHIP_ROW_COLLAPSED_HEIGHT = 76;

function GenresContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();

  const initialGenre = searchParams.get("genre") || ALL_GENRE;
  const initialPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);

  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [page, setPage] = useState(initialPage);
  const [genres, setGenres] = useState<string[]>([ALL_GENRE]);

  const [results, setResults] = useState<PaginatedTitlesResult>({
    items: [],
    total: 0,
    page: initialPage,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  // 1. Load distinct genres list from Content DB
  useEffect(() => {
    let isMounted = true;
    getDistinctGenres()
      .then((dbGenres) => {
        if (!isMounted) return;
        if (dbGenres && dbGenres.length > 0) {
          setGenres([ALL_GENRE, ...dbGenres]);
        }
      })
      .catch((err) => {
        console.warn("Failed to load distinct genres:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch server-side paginated titles for active genre & page
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    searchPublishedTitles({
      genre: selectedGenre !== ALL_GENRE ? selectedGenre : undefined,
      page,
      pageSize: PAGE_SIZE,
      sort: "trending",
    })
      .then((res) => {
        if (!isMounted) return;
        setResults(res);
      })
      .catch((err) => {
        console.warn("Failed to load genres titles from DB:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedGenre, page]);

  // 3. Keep URL query parameters in sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedGenre !== ALL_GENRE) params.set("genre", selectedGenre);
    if (page > 1) params.set("page", String(page));

    const queryString = params.toString();
    const newUrl = queryString ? `/genres?${queryString}` : "/genres";
    window.history.replaceState(null, "", newUrl);
  }, [selectedGenre, page]);

  const chipRowRef = useRef<HTMLDivElement>(null);
  const [isChipRowExpanded, setIsChipRowExpanded] = useState(false);
  const [chipRowHasOverflow, setChipRowHasOverflow] = useState(false);

  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    setChipRowHasOverflow(el.scrollHeight > CHIP_ROW_COLLAPSED_HEIGHT + 4);
  }, [genres]);

  const handleSelectGenre = (genre: string) => {
    setSelectedGenre(genre);
    setPage(1);
  };

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
        <h1 className="font-display font-bold text-2xl mb-5">Genres</h1>

        {/* Genre chips — capped to ~2 lines, expandable if there are more */}
        <div
          ref={chipRowRef}
          className={`flex flex-wrap gap-2 ${!isChipRowExpanded ? "overflow-hidden" : ""}`}
          style={{
            maxHeight: isChipRowExpanded ? undefined : CHIP_ROW_COLLAPSED_HEIGHT,
          }}
        >
          {genres.map((g) => {
            const active = g === selectedGenre;
            return (
              <button
                key={g}
                type="button"
                onClick={() => handleSelectGenre(g)}
                aria-pressed={active}
                className={`rounded-pill text-sm font-semibold px-4 py-1.5 border transition-colors whitespace-nowrap ${
                  active
                    ? "bg-primary border-primary text-text-light"
                    : "bg-surface border-border text-text-muted hover:text-text"
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>

        {chipRowHasOverflow && (
          <button
            type="button"
            onClick={() => setIsChipRowExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-link hover:text-link-hover transition-colors"
          >
            {isChipRowExpanded ? "Show less" : "Show all genres"}
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              className={`transition-transform ${isChipRowExpanded ? "rotate-180" : ""}`}
            />
          </button>
        )}

        {/* Results */}
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6 mt-8">
            {Array.from({ length: 18 }).map((_, i) => (
              <TitleCardSkeleton key={i} />
            ))}
          </div>
        ) : results.items.length === 0 ? (
          <p className="text-sm text-text-muted py-12 text-center">
            No titles found in this genre yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6 mt-8">
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

export default function GenresPage() {
  return (
    <Suspense fallback={null}>
      <GenresContent />
    </Suspense>
  );
}
