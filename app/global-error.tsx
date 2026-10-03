"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalRootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Critical root error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0F0F12] text-[#F3F4F6] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-red-950/60 text-red-500 border border-red-800/40 flex items-center justify-center mb-6 shadow-lg">
          <AlertTriangle size={32} strokeWidth={2} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3 tracking-tight">
          Application Error
        </h1>
        <p className="text-sm text-gray-400 mb-8 max-w-md leading-relaxed">
          A critical system error occurred. We apologize for the inconvenience.
          Please try refreshing the page or restarting your session.
        </p>

        {error.digest && (
          <p className="text-xs font-mono text-gray-500 mb-6 bg-gray-900 px-3 py-1 rounded border border-gray-800">
            Error ID: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold text-sm px-6 py-2.5 shadow-md transition-colors cursor-pointer"
          >
            <RefreshCw size={15} strokeWidth={2.5} />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-gray-800 bg-gray-900 hover:bg-gray-800 text-gray-200 font-semibold text-sm px-5 py-2.5 transition-colors"
          >
            <Home size={15} strokeWidth={2} />
            Reload Home
          </Link>
        </div>
      </body>
    </html>
  );
}
