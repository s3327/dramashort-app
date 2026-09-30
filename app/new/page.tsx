"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { newReleaseCatalog } from "@/data/new-release-catalog.mock";
import { useTheme } from "@/contexts/ThemeContext";

const PAGE_SIZE = 24;

export default function NewReleasePage() {
  const { theme } = useTheme();
  const [page, setPage] = useState(1);

  // Always sorted newest first — not trusting the mock array's own order.
  const sorted = useMemo(
    () =>
      [...newReleaseCatalog].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
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
            <Link key={item.id} href={`/drama/${item.slug}`} className="group">
              <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm">
                <Image
                  src={item.poster}
                  alt={item.title}
                  fill
                  sizes="(min-width: 1024px) 16vw, (min-width: 640px) 24vw, 32vw"
                  className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
                />
              </div>
              <p className="mt-2 text-xs sm:text-sm font-semibold text-text line-clamp-2 leading-snug">
                {item.title}
              </p>
            </Link>
          ))}
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-center gap-1.5 mt-10">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-full border border-border text-sm font-semibold text-text hover:bg-surface disabled:opacity-30 disabled:pointer-events-none transition-colors px-4 py-2 mr-2"
          >
            Previous
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-current={p === page}
              className={`h-8 w-8 rounded-full text-sm font-semibold transition-colors ${
                p === page
                  ? "bg-btn-primary text-btn-primary-text"
                  : "text-text-muted hover:text-text hover:bg-surface"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-full border border-border text-sm font-semibold text-text hover:bg-surface disabled:opacity-30 disabled:pointer-events-none transition-colors px-4 py-2 ml-2"
          >
            Next
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
}
