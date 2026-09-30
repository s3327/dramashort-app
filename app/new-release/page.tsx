"use client";

import { useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TitleCard from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { titles } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";

const PAGE_SIZE = 24;

export default function NewReleasePage() {
  const { theme } = useTheme();
  const [page, setPage] = useState(1);

  // Always sorted newest first — not trusting the array's own order.
  // Only Published titles are eligible for the public site.
  const sorted = useMemo(
    () =>
      titles
        .filter((t) => t.status === "Published")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    []
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
