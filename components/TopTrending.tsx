"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { trendingTitles as fallbackTrendingTitles, type TrendingTitle } from "@/data/top-trending.mock";
import { getTopTrendingTitles } from "@/lib/services/content.service";

const GAP_PX = 16; // matches gap-4

// Solid strip accents, cycling per rank — a small curated palette (rather
// than just primary/secondary/tertiary) to echo the color variety in the
// reference row.
const RANK_ACCENTS = [
  { bg: "bg-[#D9A536]", text: "text-text-dark" }, // gold
  { bg: "bg-[#3E63A6]", text: "text-text-light" }, // blue
  { bg: "bg-[#7B4FB8]", text: "text-text-light" }, // purple
  { bg: "bg-[#D8477F]", text: "text-text-light" }, // pink
];

export default function TopTrending() {
  const [items, setItems] = useState<TrendingTitle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    getTopTrendingTitles(10)
      .then((titles) => {
        if (!isMounted) return;
        if (titles && titles.length > 0) {
          setItems(
            titles.map((t, idx) => ({
              id: t.id,
              rank: idx + 1,
              title: t.title,
              poster: t.poster,
              href: `/drama/${t.slug}`,
            }))
          );
        } else {
          setItems(fallbackTrendingTitles);
        }
      })
      .catch((err) => {
        console.warn("Failed to load trending titles from DB, using fallback:", err);
        if (isMounted) setItems(fallbackTrendingTitles);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const scrollByCards = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-card]");
    const step = card ? card.getBoundingClientRect().width + GAP_PX : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-8 sm:py-10">
      <h2 className="flex items-center gap-2 font-display font-bold text-xl sm:text-2xl text-text mb-4">
        <Flame size={22} strokeWidth={2.5} className="text-primary fill-primary/20 shrink-0" />
        Top Trending
      </h2>

      {isLoading ? (
        <div className="flex gap-4 overflow-hidden pb-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="shrink-0 w-32 sm:w-36 md:w-40 space-y-2">
              <div className="aspect-[2/3] w-full rounded-md bg-surface border border-border/40 animate-pulse relative">
                <div className="absolute top-2 left-2 w-7 h-7 rounded-sm bg-border/50 animate-pulse" />
              </div>
              <div className="h-4 w-3/4 rounded bg-surface border border-border/30 animate-pulse" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? null : (
        <div className="relative">
          {/* Arrow hints — clickable, and the row itself accepts native swipe/drag */}
          <button
            type="button"
          aria-label="Scroll left"
          onClick={() => scrollByCards(-1)}
          className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-black/45 text-text-light backdrop-blur-sm hover:bg-black/65 transition-colors"
        >
          <ChevronLeft size={20} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollByCards(1)}
          className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 h-10 w-10 items-center justify-center rounded-full bg-black/45 text-text-light backdrop-blur-sm hover:bg-black/65 transition-colors"
        >
          <ChevronRight size={20} strokeWidth={2.5} />
        </button>

        <div
          ref={scrollerRef}
          className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, index) => {
            const accent = RANK_ACCENTS[index % RANK_ACCENTS.length];
            return (
              <Link
                key={item.id}
                href={item.href}
                data-card
                className="group flex shrink-0 snap-start rounded-md overflow-hidden shadow-sm aspect-[3/4]
                  w-[calc((100%-2rem)/2.5)]
                  sm:w-[calc((100%-3rem)/3.5)]
                  lg:w-[calc((100%-4rem)/4.5)]"
              >
                {/* Rank strip — solid box attached to the poster, not overlaid on it */}
                <div className={`flex flex-col shrink-0 w-9 sm:w-10 md:w-11 ${accent.bg} ${accent.text}`}>
                  <span className="pt-2.5 pb-1 text-center text-xl sm:text-2xl font-extrabold leading-none">
                    {item.rank}
                  </span>
                  <div className="flex-1 min-h-0 flex justify-center overflow-hidden px-1 pb-2.5">
                    <span
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      className="block h-full text-[11px] sm:text-xs font-semibold leading-tight"
                    >
                      {item.title}
                    </span>
                  </div>
                </div>

                {/* Poster */}
                <div className="relative flex-1 min-w-0">
                  <Image
                    src={item.poster}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 28vw, 40vw"
                    className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      )}
    </section>
  );
}
