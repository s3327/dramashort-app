"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, SlidersHorizontal, Film } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { DramaGridSkeleton } from "@/components/skeletons";
import { channels as initialChannels, type Channel } from "@/data/channels.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { useDebounce } from "@/hooks/useDebounce";
import {
  searchPublishedTitles,
  getChannels,
  getDistinctGenres,
  getPopularTags,
  type PaginatedTitlesResult,
} from "@/lib/services/content.service";

const PAGE_SIZE = 12;
const ALL_CHANNELS = "All Channels";
const ALL_GENRES = "All Genres";

function SearchContent() {
  const { theme } = useTheme();
  const searchParams = useSearchParams();

  // Search input state (debounced at 300ms)
  const initialQuery = searchParams.get("q") || "";
  const initialChannel = searchParams.get("channel") || ALL_CHANNELS;
  const initialGenre = searchParams.get("genre") || ALL_GENRES;
  const initialTags = searchParams.get("tags")
    ? searchParams.get("tags")!.split(",").filter(Boolean)
    : [];

  const [rawQuery, setRawQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(rawQuery, 300);

  const [channel, setChannel] = useState(initialChannel);
  const [genre, setGenre] = useState(initialGenre);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [page, setPage] = useState(1);

  // Available filter options loaded from DB catalog
  const [availableChannels, setAvailableChannels] = useState<Channel[]>(initialChannels);
  const [availableGenres, setAvailableGenres] = useState<string[]>([
    "Romance",
    "Marriage",
    "Revenge",
    "Fantasy",
    "Period",
    "Military",
    "Dark Romance",
    "Rivals",
    "Rebirth",
  ]);
  const [availableTags, setAvailableTags] = useState<string[]>([
    "CEO",
    "Revenge",
    "Marriage",
    "Second Chance",
    "Secret Identity",
    "Fake Marriage",
    "Romance",
    "Billionaire",
    "Villain",
    "Fantasy",
  ]);

  // Paginated search results state
  const [results, setResults] = useState<PaginatedTitlesResult>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  // 1. Load distinct filter options on mount
  useEffect(() => {
    let mounted = true;
    Promise.all([
      getChannels().catch(() => initialChannels),
      getDistinctGenres().catch(() => []),
      getPopularTags().catch(() => []),
    ]).then(([chans, gens, tgs]) => {
      if (!mounted) return;
      if (chans && chans.length > 0) setAvailableChannels(chans);
      if (gens && gens.length > 0) setAvailableGenres(gens);
      if (tgs && tgs.length > 0) setAvailableTags(tgs);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Trigger server-side query with debounced inputs and PostgREST pagination
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    searchPublishedTitles({
      query: debouncedQuery.trim() || undefined,
      channelName: channel !== ALL_CHANNELS ? channel : undefined,
      genre: genre !== ALL_GENRES ? genre : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (!mounted) return;
        setResults(res);
      })
      .catch((err) => {
        console.warn("Server search query failed:", err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [debouncedQuery, channel, genre, selectedTags, page]);

  // 3. Keep URL query parameters in sync for bookmarkable search URLs
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
    if (channel !== ALL_CHANNELS) params.set("channel", channel);
    if (genre !== ALL_GENRES) params.set("genre", genre);
    if (selectedTags.length > 0) params.set("tags", selectedTags.join(","));
    if (page > 1) params.set("page", String(page));

    const queryString = params.toString();
    const newUrl = queryString ? `/search?${queryString}` : "/search";
    window.history.replaceState(null, "", newUrl);
  }, [debouncedQuery, channel, genre, selectedTags, page]);

  const handleQueryChange = (val: string) => {
    setRawQuery(val);
    setPage(1);
  };

  const handleChannelChange = (val: string) => {
    setChannel(val);
    setPage(1);
  };

  const handleGenreChange = (val: string) => {
    setGenre(val);
    setPage(1);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setPage(1);
  };

  const clearAllFilters = () => {
    setRawQuery("");
    setChannel(ALL_CHANNELS);
    setGenre(ALL_GENRES);
    setSelectedTags([]);
    setPage(1);
  };

  const hasActiveFilters =
    rawQuery.trim() !== "" ||
    channel !== ALL_CHANNELS ||
    genre !== ALL_GENRES ||
    selectedTags.length > 0;

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 pt-8 pb-16">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl sm:text-3xl">Search Dramas</h1>
            <p className="text-sm text-text-muted mt-1">
              Find short dramas by title, synopsis, channel, genre, and tropes.
            </p>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors cursor-pointer px-3 py-1.5 rounded-full border border-border bg-surface hover:bg-surface-raised"
            >
              <X size={14} />
              Reset Filters
            </button>
          )}
        </div>

        {/* Search input with live debounced execution */}
        <div className="relative max-w-2xl mb-5">
          <Search
            size={18}
            strokeWidth={2}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search by drama title, keywords, or storyline..."
            className="w-full rounded-full border border-border bg-surface pl-11 pr-10 py-3 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors shadow-sm"
          />
          {rawQuery && (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              aria-label="Clear search input"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-1 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter controls row */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <SlidersHorizontal size={14} />
            Filters:
          </div>

          {/* Channel dropdown */}
          <select
            value={channel}
            onChange={(e) => handleChannelChange(e.target.value)}
            aria-label="Filter by channel"
            className="rounded-full border border-border bg-surface text-xs sm:text-sm text-text px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors cursor-pointer"
          >
            <option value={ALL_CHANNELS}>{ALL_CHANNELS}</option>
            {availableChannels.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Genre dropdown */}
          <select
            value={genre}
            onChange={(e) => handleGenreChange(e.target.value)}
            aria-label="Filter by genre"
            className="rounded-full border border-border bg-surface text-xs sm:text-sm text-text px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors cursor-pointer"
          >
            <option value={ALL_GENRES}>{ALL_GENRES}</option>
            {availableGenres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Taxonomy Tropes & Tags Chips */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-8">
          <span className="text-xs text-text-muted mr-1 font-medium">Tropes:</span>
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`rounded-pill text-xs font-medium px-3 py-1 border transition-all cursor-pointer ${
                  active
                    ? "bg-primary border-primary text-text-light shadow-sm"
                    : "bg-surface border-border text-text-muted hover:text-text hover:border-text-muted/40"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        {/* Results Count & Status Header */}
        <div className="flex items-center justify-between text-xs text-text-muted mb-4 border-b border-border/40 pb-2">
          <span>
            {isLoading
              ? "Searching catalog..."
              : results.total === 0
              ? "0 dramas found"
              : `Showing ${results.items.length} of ${results.total} drama${
                  results.total === 1 ? "" : "s"
                }`}
          </span>
          {results.total > 0 && !isLoading && (
            <span>
              Page {results.page} of {results.totalPages}
            </span>
          )}
        </div>

        {/* Results Grid / Shimmer Skeleton */}
        {isLoading ? (
          <DramaGridSkeleton count={PAGE_SIZE} hasSubtitle />
        ) : results.items.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-12 text-center my-6 max-w-lg mx-auto shadow-sm">
            <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mx-auto mb-4 text-text-muted">
              <Film size={24} />
            </div>
            <h2 className="font-display font-bold text-lg mb-2">No dramas found</h2>
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              We couldn’t find any dramas matching your search criteria. Try modifying your keywords,
              choosing a broader genre, or resetting your filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="inline-flex items-center gap-2 rounded-md bg-primary text-text-light px-4 py-2 text-sm font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {results.items.map((item) => (
                <TitleCard
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  poster={item.poster}
                  title={item.title}
                />
              ))}
            </div>

            {results.totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  page={results.page}
                  totalPages={results.totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
