"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useTheme } from "@/contexts/ThemeContext";

export default function LegalLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[760px] mx-auto px-6 pt-10 pb-16">
        <h1 className="font-display font-bold text-2xl sm:text-3xl mb-2">{title}</h1>
        <p className="text-xs text-text-muted mb-6">Last updated: {lastUpdated}</p>

        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-4 text-sm text-text-muted mb-8">
          <Info size={17} strokeWidth={2} className="shrink-0 mt-0.5 text-primary" />
          <p>
            This is placeholder content for development purposes and hasn&apos;t been
            reviewed by legal counsel. Replace with the real policy before launch.
          </p>
        </div>

        <div className="space-y-7 text-sm leading-relaxed text-text-muted [&_h2]:font-display [&_h2]:font-bold [&_h2]:text-lg [&_h2]:text-text [&_h2]:mb-2">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
