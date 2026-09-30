"use client";

import { use, useEffect, useMemo, useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Flag, ArrowLeft, Tv, Star, Eye } from "lucide-react";
import Header from "@/components/Header";
import Breadcrumbs from "@/components/Breadcrumbs";
import VideoPlayer from "@/components/VideoPlayer";
import { getTitleBySlugOrFallback, type Title } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { getTitleBySlug, getEpisodesByTitleId, type Episode } from "@/lib/services/content.service";
import { useAuth } from "@/contexts/AuthContext";
import {
  getUserWatchHistory,
  getGuestWatchHistory,
  upsertWatchProgress,
  saveGuestWatchProgress,
} from "@/lib/services/user.service";

const EPISODES_PER_TAB = 40;

function buildReportMessage(title: string, episode: number) {
  const date = new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  return `[reporting from "${title}" - Episode ${episode} at "${date}"]\n\nPlease elaborate on the error you're experiencing below this line.\n=================\n`;
}

export default function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { slug } = use(params);

  const [drama, setDrama] = useState<Title>(() => getTitleBySlugOrFallback(slug));
  const [dbEpisodes, setDbEpisodes] = useState<Episode[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(1);
  const [activeTab, setActiveTab] = useState(0);
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const lastRecordedSecondRef = useRef<number>(-1);

  // Fetch drama and real episode data from database
  useEffect(() => {
    getTitleBySlug(slug).then((dbDrama) => {
      if (dbDrama) {
        setDrama(dbDrama);
        getEpisodesByTitleId(dbDrama.id).then((eps) => {
          if (eps && eps.length > 0) {
            setDbEpisodes(eps);
          }
        });
      }
    });
  }, [slug]);

  // Load saved watch position for this drama
  useEffect(() => {
    async function loadResumePoint() {
      let historyRows = [];
      if (user) {
        historyRows = await getUserWatchHistory(user.id);
      } else {
        historyRows = getGuestWatchHistory();
      }
      const match = historyRows.find(
        (r) => r.title_slug === slug || r.title_slug === drama.slug
      );
      if (match && match.episode_number > 0) {
        setCurrentEpisode(match.episode_number);
        setActiveTab(Math.floor((match.episode_number - 1) / EPISODES_PER_TAB));
      }
    }
    loadResumePoint();
  }, [user, slug, drama.slug]);

  const recordProgress = useCallback(
    (epNum: number, progressRatio: number) => {
      if (user) {
        upsertWatchProgress(user.id, drama.slug, epNum, progressRatio);
      } else {
        saveGuestWatchProgress(drama.slug, epNum, progressRatio);
      }
    },
    [user, drama.slug]
  );

  const handleSelectEpisode = useCallback(
    (ep: number) => {
      setCurrentEpisode(ep);
      setAutoPlayNext(true);
      const progress = Math.min(1.0, ep / (drama.totalEpisodes || 1));
      recordProgress(ep, progress);
    },
    [drama.totalEpisodes, recordProgress]
  );

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number, progressRatio: number) => {
      const currentSec = Math.floor(currentTime);
      // Record progress every 10 seconds
      if (currentSec % 10 === 0 && currentSec !== lastRecordedSecondRef.current && duration > 0) {
        lastRecordedSecondRef.current = currentSec;
        recordProgress(currentEpisode, progressRatio);
      }
    },
    [currentEpisode, recordProgress]
  );

  const handleVideoEnded = useCallback(() => {
    recordProgress(currentEpisode, 1.0);
  }, [currentEpisode, recordProgress]);

  const currentEpData = dbEpisodes.find((e) => e.episodeNumber === currentEpisode);
  const videoSrc =
    currentEpData?.videoUrl && currentEpData.videoUrl.trim() !== ""
      ? currentEpData.videoUrl
      : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

  const totalEps = drama.totalEpisodes || 1;
  const episodes = useMemo(
    () => Array.from({ length: totalEps }, (_, i) => i + 1),
    [totalEps]
  );

  const episodeTabs = useMemo(
    () =>
      Array.from({ length: Math.ceil(totalEps / EPISODES_PER_TAB) }, (_, i) => {
        const start = i * EPISODES_PER_TAB + 1;
        const end = Math.min((i + 1) * EPISODES_PER_TAB, totalEps);
        return { start, end };
      }),
    [totalEps]
  );

  const visibleEpisodes = episodes.slice(
    activeTab * EPISODES_PER_TAB,
    activeTab * EPISODES_PER_TAB + EPISODES_PER_TAB
  );

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text transition-colors">
      <Header />

      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/home" },
              { label: drama.title, href: `/drama/${drama.slug}` },
              { label: `Episode ${currentEpisode}` },
            ]}
          />

          <Link
            href={`/drama/${drama.slug}`}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Details
          </Link>
        </div>

        {/* Watch Stage Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Main Video Streaming Player */}
          <div className="flex-1 w-full min-w-0">
            <VideoPlayer
              key={`${drama.slug}-${currentEpisode}`}
              src={videoSrc}
              poster={drama.poster}
              title={currentEpData?.title || `Episode ${currentEpisode}`}
              dramaTitle={drama.title}
              currentEpisode={currentEpisode}
              totalEpisodes={totalEps}
              autoPlay={autoPlayNext}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleVideoEnded}
              onNextEpisode={() => {
                if (currentEpisode < totalEps) {
                  handleSelectEpisode(currentEpisode + 1);
                }
              }}
              onPrevEpisode={() => {
                if (currentEpisode > 1) {
                  handleSelectEpisode(currentEpisode - 1);
                }
              }}
            />

            {/* Video Meta Info */}
            <div className="mt-4 p-4 rounded-xl bg-surface border border-border shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="font-display font-bold text-xl sm:text-2xl text-text">
                    {drama.title}
                  </h1>
                  <p className="text-sm font-medium text-primary mt-0.5">
                    Episode {currentEpisode} of {totalEps}
                    {currentEpData?.title && currentEpData.title !== `Episode ${currentEpisode}` && (
                      <span className="text-text-muted ml-2 font-normal">
                        — {currentEpData.title}
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/contact?subject=Report&message=${encodeURIComponent(
                      buildReportMessage(drama.title, currentEpisode)
                    )}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-danger px-3 py-1.5 rounded-md border border-border bg-bg hover:border-danger/30 transition-colors"
                  >
                    <Flag size={13} strokeWidth={2} />
                    Report Issue
                  </Link>
                </div>
              </div>

              {/* Drama Tags & Channel Info */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3 pt-3 border-t border-border text-xs text-text-muted">
                {drama.channel && (
                  <span className="inline-flex items-center gap-1 font-semibold text-text">
                    <Tv size={13} className="text-primary" />
                    {drama.channel}
                  </span>
                )}
                {drama.genre && (
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {drama.genre}
                  </span>
                )}
                {drama.rating && (
                  <span className="inline-flex items-center gap-1">
                    <Star size={12} className="text-amber-400 fill-amber-400" />
                    {drama.rating.toFixed(1)}
                  </span>
                )}
                {drama.views > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Eye size={12} />
                    {drama.views.toLocaleString()} views
                  </span>
                )}
              </div>

              {drama.synopsis && (
                <p className="mt-3 text-xs sm:text-sm text-text-muted leading-relaxed line-clamp-3">
                  {drama.synopsis}
                </p>
              )}
            </div>
          </div>

          {/* Episode Selection Sidebar */}
          <aside className="w-full lg:w-80 shrink-0">
            <div className="bg-surface border border-border rounded-xl shadow-sm p-4 sticky top-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-display font-bold text-base text-text">Episodes</h2>
                <span className="text-xs font-medium text-text-muted">
                  Total: {totalEps}
                </span>
              </div>

              {/* Range tabs if > 40 episodes */}
              {episodeTabs.length > 1 && (
                <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
                  {episodeTabs.map((tab, index) => {
                    const active = index === activeTab;
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setActiveTab(index)}
                        aria-current={active}
                        className={`flex-1 min-w-[54px] rounded-md py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? "bg-primary text-text-light shadow-sm"
                            : "bg-bg border border-border text-text-muted hover:text-text hover:border-primary/50"
                        }`}
                      >
                        {tab.start}-{tab.end}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Episode Grid */}
              <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2 max-h-[500px] overflow-y-auto pr-1">
                {visibleEpisodes.map((ep) => {
                  const active = ep === currentEpisode;
                  return (
                    <button
                      key={ep}
                      type="button"
                      onClick={() => handleSelectEpisode(ep)}
                      aria-current={active}
                      className={`aspect-square rounded-lg text-xs font-bold transition-all duration-150 ${
                        active
                          ? "bg-btn-primary text-btn-primary-text ring-2 ring-primary ring-offset-2 ring-offset-bg shadow-md scale-105"
                          : "bg-bg border border-border text-text-muted hover:text-text hover:border-primary/50 hover:bg-surface-elevated"
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
