"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { titles as fallbackTitles, type Title } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { getPublishedTitles } from "@/lib/services/content.service";

const PAGE_SIZE = 24;
const ALL_GENRE = "All";
// Roughly two chip rows' worth of height (chip height + gap) — used to
// detect whether the genre list actually needs an expand/collapse toggle.
const CHIP_ROW_COLLAPSED_HEIGHT = 76;

function GenresContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const [titles, setTitles] = useState<Title[]>(fallbackTitles);

  useEffect(() => {
    getPublishedTitles().then((dbTitles) => {
      if (dbTitles && dbTitles.length > 0) {
        setTitles(dbTitles);
      }
    });
  }, []);

  const genres = useMemo(
    () => [ALL_GENRE, ...Array.from(new Set(titles.map((i) => i.genre))).sort()],
    [titles]
  );

  const genreFromUrl = searchParams.get("genre");
  const [selectedGenre, setSelectedGenre] = useState(
    genreFromUrl && titles.some((i) => i.genre === genreFromUrl) ? genreFromUrl : ALL_GENRE
  );
  const [page, setPage] = useState(1);

  const chipRowRef = useRef<HTMLDivElement>(null);
  const [isChipRowExpanded, setIsChipRowExpanded] = useState(false);
  const [chipRowHasOverflow, setChipRowHasOverflow] = useState(false);

  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    setChipRowHasOverflow(el.scrollHeight > CHIP_ROW_COLLAPSED_HEIGHT + 4);
  }, [genres]);

  useEffect(() => {
    setPage(1);
  }, [selectedGenre]);

  const filtered = useMemo(
    () =>
      titles.filter(
        (item) =>
          item.status === "Published" &&
          (selectedGenre === ALL_GENRE || item.genre === selectedGenre)
      ),
    [titles, selectedGenre]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
                onClick={() => setSelectedGenre(g)}
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
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6 mt-8">
          {pageItems.map((item) => (
            <TitleCard
              key={item.id}
              href={`/drama/${item.slug}`}
              poster={item.poster}
              title={item.title}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-sm text-text-muted py-12 text-center">
            No titles found in this genre yet.
          </p>
        )}

        {filtered.length > 0 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
