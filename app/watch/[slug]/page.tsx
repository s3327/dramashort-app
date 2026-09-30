"use client";

import { use, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Flag } from "lucide-react";
import Header from "@/components/Header";
import { getTitleBySlugOrFallback } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";

const EPISODES_PER_TAB = 40;

function buildReportMessage(title: string) {
  const date = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  return `[reporting from "${title}" at "${date}"]\n\nPlease elaborate on the error you're experiencing below this line.\n=================\n`;
}

export default function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { theme } = useTheme();
  const { slug } = use(params);
  const drama = getTitleBySlugOrFallback(slug);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const episodes = Array.from({ length: drama.totalEpisodes }, (_, i) => i + 1);

  const episodeTabs = useMemo(
    () =>
      Array.from({ length: Math.ceil(drama.totalEpisodes / EPISODES_PER_TAB) }, (_, i) => {
        const start = i * EPISODES_PER_TAB + 1;
        const end = Math.min((i + 1) * EPISODES_PER_TAB, drama.totalEpisodes);
        return { start, end };
      }),
    [drama.totalEpisodes]
  );
  const visibleEpisodes = episodes.slice(
    activeTab * EPISODES_PER_TAB,
    activeTab * EPISODES_PER_TAB + EPISODES_PER_TAB
  );

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Player */}
          <div className="flex-1 min-w-0">
            <div className="relative aspect-video rounded-lg overflow-hidden bg-black shadow-md">
              <Image
                src={drama.poster}
                alt={drama.title}
                fill
                sizes="(min-width: 1024px) 70vw, 100vw"
                className="object-cover opacity-40"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Decorative only — no real playback wired up yet */}
                <button
                  type="button"
                  aria-label="Play"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 hover:bg-white transition-colors shadow-lg"
                >
                  <Play size={26} strokeWidth={2.5} fill="currentColor" className="text-primary-dark ml-1" />
                </button>
              </div>
              <span className="absolute bottom-3 left-3 rounded-pill bg-black/60 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-text-light">
                Episode {currentEpisode}
              </span>
            </div>

            <h1 className="mt-4 font-display font-bold text-xl sm:text-2xl">
              {drama.title}
            </h1>
            <p className="text-sm text-text-muted">
              Episode {currentEpisode} of {drama.totalEpisodes}
            </p>
          </div>

          {/* Episodes */}
          <aside className="w-full lg:w-72 shrink-0">
            <div className="bg-surface border border-border rounded-lg shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <Link
                  href={`/contact?subject=Report&message=${encodeURIComponent(
                    buildReportMessage(drama.title)
                  )}`}
                  className="order-2 flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-danger transition-colors"
                >
                  <Flag size={13} strokeWidth={2} />
                  Report
                </Link>
                <h2 className="order-1 mt-1.5 font-display font-bold text-sm">Episodes</h2>
              </div>

              {/* Episode range tabs — only needed past 40 episodes, all
                  same width regardless of how many tabs there are. */}
              {episodeTabs.length > 1 && (
                <div className="flex gap-1.5 mb-3">
                  {episodeTabs.map((tab, index) => {
                    const active = index === activeTab;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActiveTab(index)}
                        aria-current={active}
                        className={`flex-1 basis-0 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "bg-primary text-text-light"
                            : "bg-bg border border-border text-text-muted hover:text-text hover:border-primary/50"
                        }`}
                      >
                        {tab.start}-{tab.end}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-2 max-h-[440px] overflow-y-auto pr-1">
                {visibleEpisodes.map((ep) => {
                  const active = ep === currentEpisode;
                  return (
                    <button
                      key={ep}
                      type="button"
                      onClick={() => setCurrentEpisode(ep)}
                      aria-current={active}
                      className={`aspect-square rounded-md text-xs font-semibold transition-colors ${
                        active
                          ? "bg-btn-primary text-btn-primary-text"
                          : "bg-bg border border-border text-text-muted hover:text-text hover:border-primary/50"
                      }`}
                    >
                      {ep}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
