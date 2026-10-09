"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Lock, Check } from "lucide-react";
import type { EpisodeSheetProps } from "./PlayerTypes";

const EPISODES_PER_TAB = 40;

export default function EpisodeSheet({
  isOpen,
  onClose,
  currentEpisode,
  totalEpisodes,
  episodes,
  onSelectEpisode,
  dramaTitle,
  unlockedEpisodeNumbers,
  freeEpisodesCount = 5,
  isVip = false,
  onSelectLockedEpisode,
}: EpisodeSheetProps) {
  const maxTab = Math.max(0, Math.ceil(totalEpisodes / EPISODES_PER_TAB) - 1);
  const [activeTab, setActiveTab] = useState<number>(() => {
    return Math.min(maxTab, Math.floor((Math.max(1, currentEpisode) - 1) / EPISODES_PER_TAB));
  });

  // Keep active tab in sync when currentEpisode changes
  useEffect(() => {
    setActiveTab(Math.min(maxTab, Math.floor((Math.max(1, currentEpisode) - 1) / EPISODES_PER_TAB)));
  }, [currentEpisode, maxTab]);

  // Lock body scroll and handle Escape key while sheet is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const episodeTabs = useMemo(() => {
    return Array.from({ length: Math.ceil(totalEpisodes / EPISODES_PER_TAB) }, (_, i) => {
      const start = i * EPISODES_PER_TAB + 1;
      const end = Math.min((i + 1) * EPISODES_PER_TAB, totalEpisodes);
      return { start, end };
    });
  }, [totalEpisodes]);

  const allEpisodesList = useMemo(() => {
    return Array.from({ length: totalEpisodes }, (_, i) => i + 1);
  }, [totalEpisodes]);

  const visibleEpisodes = useMemo(() => {
    return allEpisodesList.slice(
      activeTab * EPISODES_PER_TAB,
      activeTab * EPISODES_PER_TAB + EPISODES_PER_TAB
    );
  }, [allEpisodesList, activeTab]);

  const availableEpisodesCount = useMemo(() => {
    return episodes.filter(
      (e) => Boolean((e.videoUrl && e.videoUrl.trim() !== "") || e.id)
    ).length;
  }, [episodes]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Episodes for ${dramaTitle || "Drama"}`}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-h-[75vh] bg-surface border-t border-border rounded-t-2xl flex flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Swipe Handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div>
            <h2 className="font-display font-bold text-base text-text">Episodes</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {totalEpisodes} episodes &middot; {availableEpisodesCount} available
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close episodes sheet"
            className="p-1.5 rounded-full text-text-muted hover:text-text hover:bg-surface-elevated transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Range Tabs (if > 40 episodes) */}
        {episodeTabs.length > 1 && (
          <div className="flex gap-1.5 px-5 py-2.5 overflow-x-auto border-b border-border">
            {episodeTabs.map((tab, idx) => {
              const active = idx === activeTab;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveTab(idx)}
                  aria-current={active}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
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
        <div className="p-5 overflow-y-auto max-h-[50vh]">
          <div className="grid grid-cols-5 gap-2.5">
            {visibleEpisodes.map((ep) => {
              const active = ep === currentEpisode;
              const epData = episodes.find((e) => e.episodeNumber === ep);
              const isAvailable = Boolean(
                (epData?.videoUrl && epData.videoUrl.trim() !== "") || epData?.id
              );
              const isUnlocked = isVip || (unlockedEpisodeNumbers ? unlockedEpisodeNumbers.has(ep) : false);
              const isFree = epData?.isFree ?? (ep <= freeEpisodesCount);
              const isLocked = isAvailable && !isFree && !isUnlocked;

              if (!isAvailable) {
                return (
                  <div
                    key={ep}
                    title="Coming soon"
                    aria-disabled="true"
                    aria-label={`Episode ${ep}, coming soon`}
                    className="aspect-square rounded-xl text-xs font-bold flex flex-col items-center justify-center bg-bg/50 border border-border/40 text-text-muted/40 cursor-not-allowed select-none"
                  >
                    <span>{ep}</span>
                    <span className="text-[9px] uppercase tracking-wider font-medium text-text-muted/50 mt-0.5">
                      Soon
                    </span>
                  </div>
                );
              }

              return (
                <button
                  key={ep}
                  type="button"
                  onClick={() => {
                    if (isLocked && onSelectLockedEpisode) {
                      onSelectLockedEpisode(ep);
                    } else {
                      onSelectEpisode(ep);
                    }
                    onClose();
                  }}
                  aria-current={active}
                  aria-label={
                    active
                      ? `Episode ${ep}, currently playing`
                      : isLocked
                      ? `Episode ${ep}, locked`
                      : `Episode ${ep}`
                  }
                  className={`relative aspect-square rounded-xl text-xs font-bold flex flex-col items-center justify-center transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                    active
                      ? "bg-btn-primary text-btn-primary-text ring-2 ring-primary ring-offset-2 ring-offset-surface shadow-md scale-105"
                      : "bg-bg border border-border text-text hover:text-primary hover:border-primary/50 hover:bg-surface-elevated"
                  }`}
                >
                  <span>{ep}</span>
                  {active && (
                    <span className="absolute bottom-1 text-[9px] flex items-center gap-0.5">
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                  {isLocked && !active && (
                    <span className="absolute top-1 right-1 text-text-muted">
                      <Lock size={10} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export { EpisodeSheet };
