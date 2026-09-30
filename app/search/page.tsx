"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { titles as allTitles } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";

const PAGE_SIZE = 12;
const ALL_CHANNELS = "All Channels";
const ALL_GENRES = "All Genres";

function SearchContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [channel, setChannel] = useState(ALL_CHANNELS);
  const [genre, setGenre] = useState(ALL_GENRES);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  // Filter option lists are derived from the mock catalog — new channels,
  // genres, or tags added to the data automatically show up here.
  const channels = useMemo(
    () => [ALL_CHANNELS, ...Array.from(new Set(allTitles.map((i) => i.channel))).sort()],
    []
  );
  const genres = useMemo(
    () => [ALL_GENRES, ...Array.from(new Set(allTitles.map((i) => i.genre))).sort()],
    []
  );
  const allTags = useMemo(
    () => Array.from(new Set(allTitles.flatMap((i) => i.tags))).sort(),
    []
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTitles.filter((item) => {
      const isPublished = item.status === "Published";
      const matchesQuery = q === "" || item.title.toLowerCase().includes(q);
      const matchesChannel = channel === ALL_CHANNELS || item.channel === channel;
      const matchesGenre = genre === ALL_GENRES || item.genre === genre;
      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((t) => item.tags.includes(t));
      return isPublished && matchesQuery && matchesChannel && matchesGenre && matchesTags;
    });
  }, [query, channel, genre, selectedTags]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Keep the current page valid whenever filters change the result count.
  useEffect(() => {
    setPage(1);
  }, [query, channel, genre, selectedTags]);

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl mb-6">Search</h1>

        {/* Search box */}
        <div className="relative max-w-xl mb-4">
          <Search
            size={18}
            strokeWidth={2}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title..."
            className="w-full rounded-full border border-border bg-surface pl-10 pr-4 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>

        {/* Filters — more filter types can be added to this row later */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="rounded-full border border-border bg-surface text-sm text-text px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="rounded-full border border-border bg-surface text-sm text-text px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Tags — multi-select chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {allTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`rounded-pill text-xs font-semibold px-3 py-1.5 border transition-colors ${
                  active
                    ? "bg-primary border-primary text-text-light"
                    : "bg-surface border-border text-text-muted hover:text-text"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <p className="text-sm text-text-muted py-12 text-center">
            No titles match your search or filters.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {pageItems.map((item) => (
                <TitleCard
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  poster={item.poster}
                  title={item.title}
                />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
