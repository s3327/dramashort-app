"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import type { Title } from "@/types/content";
import { searchPublishedTitles } from "@/lib/services/content.service";

const MAX_SUGGESTIONS = 6;

export default function SearchDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Title[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!trimmedQuery) {
      setMatches([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(() => {
      searchPublishedTitles({ query: trimmedQuery, pageSize: MAX_SUGGESTIONS })
        .then((res) => {
          if (isMounted) {
            setMatches(res.items || []);
          }
        })
        .catch(() => {
          if (isMounted) {
            setMatches([]);
          }
        });
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [trimmedQuery]);

  const openDropdown = () => {
    setIsOpen(true);
    // Wait for the panel to render before focusing.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setQuery("");
  };

  const goToFullResults = () => {
    if (trimmedQuery === "") return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    closeDropdown();
  };

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        aria-label="Search"
        aria-expanded={isOpen}
        className="p-2 rounded-full text-text/80 hover:text-primary hover:bg-surface transition-colors"
      >
        <Search size={20} strokeWidth={2} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-md border border-border bg-surface shadow-md overflow-hidden z-30">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goToFullResults();
            }}
            className="p-3 border-b border-border"
          >
            <div className="relative">
              <Search
                size={15}
                strokeWidth={2}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeDropdown();
                }}
                placeholder="Search by title..."
                className="w-full rounded-full border border-border bg-bg pl-8 pr-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
          </form>

          {trimmedQuery !== "" && (
            <div>
              {matches.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-text-muted">
                  No titles found for &ldquo;{query.trim()}&rdquo;.
                </p>
              ) : (
                <>
                  <div className="max-h-72 overflow-y-auto divide-y divide-border">
                    {matches.map((item) => (
                      <Link
                        key={item.id}
                        href={`/drama/${item.slug}`}
                        onClick={closeDropdown}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-primary/5 transition-colors"
                      >
                        <div className="relative h-12 w-9 shrink-0 rounded overflow-hidden bg-bg">
                          <Image
                            src={item.poster}
                            alt={item.title}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        </div>
                        <p className="text-sm font-semibold text-text line-clamp-2 leading-snug">
                          {item.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={goToFullResults}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/5 border-t border-border transition-colors"
                  >
                    See all results for &ldquo;{query.trim()}&rdquo;
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
