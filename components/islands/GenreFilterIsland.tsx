"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

export interface GenreFilterIslandProps {
  genres: string[];
  activeGenre: string;
}

const ALL_GENRE = "All";
const CHIP_ROW_COLLAPSED_HEIGHT = 76;

/**
 * Client island rendering interactive genre chip buttons with URL navigation
 * and expandable multi-row overflow toggles.
 */
export default function GenreFilterIsland({
  genres,
  activeGenre,
}: GenreFilterIslandProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const chipRowRef = useRef<HTMLDivElement>(null);
  const [isChipRowExpanded, setIsChipRowExpanded] = useState(false);
  const [chipRowHasOverflow, setChipRowHasOverflow] = useState(false);

  useEffect(() => {
    const el = chipRowRef.current;
    if (!el) return;
    setChipRowHasOverflow(el.scrollHeight > CHIP_ROW_COLLAPSED_HEIGHT + 4);
  }, [genres]);

  const handleSelectGenre = (genre: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (genre.toLowerCase() === ALL_GENRE.toLowerCase()) {
      params.delete("genre");
    } else {
      params.set("genre", genre);
    }
    params.delete("page"); // Reset pagination upon changing filter

    const queryString = params.toString();
    const newUrl = queryString ? `/genres?${queryString}` : "/genres";
    router.push(newUrl);
  };

  return (
    <>
      <div
        ref={chipRowRef}
        className={`flex flex-wrap gap-2 ${!isChipRowExpanded ? "overflow-hidden" : ""}`}
        style={{
          maxHeight: isChipRowExpanded ? undefined : CHIP_ROW_COLLAPSED_HEIGHT,
        }}
      >
        {genres.map((g) => {
          const active = g.toLowerCase() === activeGenre.toLowerCase();
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
    </>
  );
}

export { GenreFilterIsland };
