"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { reportError } from "@/lib/observability/error-reporter";

export default function DramaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, {
      digest: error.digest,
      route: "/drama/[slug]",
      tags: { boundary: "app/drama/[slug]/error" },
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <Header />
      <main className="flex-1 max-w-[800px] w-full mx-auto px-6 py-20 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-6">
          <AlertCircle size={32} strokeWidth={2} />
        </div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl mb-3">
          Unable to Load Drama
        </h1>
        <p className="text-sm text-text-muted mb-8 max-w-md leading-relaxed">
          We encountered an unexpected error while retrieving this drama&apos;s details.
          Please try refreshing, or explore other titles in our catalog.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm px-6 py-2.5 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw size={15} strokeWidth={2.5} />
            Try Again
          </button>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-surface-raised font-semibold text-sm px-5 py-2.5 transition-colors"
          >
            <Search size={15} strokeWidth={2} />
            Browse Catalog
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface hover:bg-surface-raised font-semibold text-sm px-5 py-2.5 transition-colors"
          >
            <Home size={15} strokeWidth={2} />
            Home
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
