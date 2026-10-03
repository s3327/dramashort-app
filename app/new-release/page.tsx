"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { titles as fallbackTitles, type Title } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { getPublishedTitles } from "@/lib/services/content.service";

const PAGE_SIZE = 24;

export default function NewReleasePage() {
  const { theme } = useTheme();
  const [page, setPage] = useState(1);
  const [allSorted, setAllSorted] = useState<Title[]>(() =>
    fallbackTitles
      .filter((t) => t.status === "Published")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  useEffect(() => {
    getPublishedTitles({ sort: "newest" }).then((dbTitles) => {
      if (dbTitles && dbTitles.length > 0) {
        setAllSorted(dbTitles);
      }
    });
  }, []);

  const totalPages = Math.max(1, Math.ceil(allSorted.length / PAGE_SIZE));
  const pageItems = allSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl mb-8">New Release</h1>

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
      </main>

      <Footer />
    </div>
  );
}
