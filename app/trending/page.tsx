"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { titles as fallbackTitles, type Title } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { formatCompactNumber } from "@/lib/format";
import { getPublishedTitles } from "@/lib/services/content.service";

const PAGE_SIZE = 24;

export default function TrendingPage() {
  const { theme } = useTheme();
  const [page, setPage] = useState(1);
  const [allRanked, setAllRanked] = useState<Title[]>(() =>
    fallbackTitles
      .filter((t) => t.status === "Published")
      .sort((a, b) => b.views - a.views)
  );

  useEffect(() => {
    getPublishedTitles({ sort: "trending" }).then((dbTitles) => {
      if (dbTitles && dbTitles.length > 0) {
        setAllRanked(dbTitles);
      }
    });
  }, []);

  const totalPages = Math.max(1, Math.ceil(allRanked.length / PAGE_SIZE));
  const pageItems = allRanked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
          {pageItems.map((item, index) => {
            const rank = (page - 1) * PAGE_SIZE + index + 1;
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

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </main>

      <Footer />
    </div>
  );
}
