"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  Share2,
  Layers,
  Flag,
  Play,
  Pause,
  Loader2,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  RotateCw,
  FastForward,
} from "lucide-react";
import { useFavorites } from "@/contexts/FavoritesContext";
import type { WatchOverlayProps } from "./PlayerTypes";
import { usePlayerGestures } from "./usePlayerGestures";

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function WatchOverlay({
  drama,
  currentEpisode,
  totalEpisodes,
  isPlaying,
  isBuffering,
  currentTime,
  duration,
  onTogglePlay,
  onOpenEpisodes,
  onNextEpisode,
  onPrevEpisode,
  onSeek,
  onSeekRelative,
  onSetPlaybackRate,
  currentPlaybackRate = 1,
  swipeHint,
}: WatchOverlayProps) {
  const { isFavorited, toggleFavorite } = useFavorites();
  const favorited = isFavorited(drama.slug);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const handleSeekRelative = useCallback(
    (seconds: number) => {
      if (onSeekRelative) {
        onSeekRelative(seconds);
      } else if (onSeek && duration > 0) {
        const targetTime = Math.max(0, Math.min(currentTime + seconds, duration));
        onSeek(targetTime / duration);
      } else if (typeof document !== "undefined") {
        const vid = document.querySelector("video");
        if (vid && Number.isFinite(vid.duration)) {
          vid.currentTime = Math.max(0, Math.min(vid.currentTime + seconds, vid.duration));
        }
      }
    },
    [onSeekRelative, onSeek, currentTime, duration]
  );

  const handleSetPlaybackRate = useCallback(
    (rate: number) => {
      if (onSetPlaybackRate) {
        onSetPlaybackRate(rate);
      } else if (typeof document !== "undefined") {
        const vid = document.querySelector("video");
        if (vid) vid.playbackRate = rate;
      }
    },
    [onSetPlaybackRate]
  );

  const gestures = usePlayerGestures({
    onTogglePlay,
    onSeekRelative: handleSeekRelative,
    onSetPlaybackRate: handleSetPlaybackRate,
    currentPlaybackRate,
    onNextEpisode,
    onPrevEpisode,
  });

  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `${drama.title} - Episode ${currentEpisode}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Watch ${title} on DramaShort`,
          url,
        });
      } catch {
        // User cancelled share
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        setShareToast("Link copied to clipboard!");
        setTimeout(() => setShareToast(null), 2500);
      } catch {}
    }
  }, [drama.title, currentEpisode]);

  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    onSeek?.(val);
  };

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const activeSwipeHint = swipeHint || gestures.swipeHint;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-20 touch-none overscroll-contain">
      {/* Top Header Bar */}
      <div className="pointer-events-auto flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <Link
          href={`/drama/${drama.slug}`}
          className="p-2 -ml-1 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Back to drama details"
        >
          <ArrowLeft size={20} />
        </Link>

        <div className="flex-1 min-w-0 text-center">
          <h1 className="text-white text-sm font-semibold truncate drop-shadow-md">
            {drama.title}
          </h1>
          <p className="text-white/70 text-xs font-medium">
            EP {currentEpisode} / {totalEpisodes}
          </p>
        </div>

        <button
          type="button"
          onClick={handleShare}
          className="p-2 -mr-1 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Share episode"
        >
          <Share2 size={18} />
        </button>
      </div>

      {/* Share Toast Notification */}
      {shareToast && (
        <div className="self-center bg-black/85 border border-white/20 text-white text-xs px-4 py-2 rounded-full backdrop-blur-md shadow-xl animate-in fade-in">
          {shareToast}
        </div>
      )}

      {/* Vertical Swipe Gesture Hint Badge */}
      {activeSwipeHint && (
        <div className="self-center flex items-center gap-2 rounded-full bg-black/80 border border-white/20 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md shadow-2xl animate-pulse">
          {activeSwipeHint === "next" ? (
            <>
              <ChevronUp size={16} className="text-primary" />
              <span>Next Episode</span>
            </>
          ) : (
            <>
              <ChevronDown size={16} className="text-primary" />
              <span>Previous Episode</span>
            </>
          )}
        </div>
      )}

      {/* Double Tap Seek Feedback Ripple */}
      {gestures.seekRipple && (
        <div
          className={`absolute inset-y-0 ${
            gestures.seekRipple.direction === "left" ? "left-6" : "right-6"
          } flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-200`}
        >
          <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-black/80 border border-white/20 text-white backdrop-blur-md shadow-2xl">
            {gestures.seekRipple.direction === "left" ? (
              <>
                <RotateCcw size={22} className="text-primary mb-1 animate-pulse" />
                <span className="text-xs font-bold tracking-wider">&lt;&lt; 10s</span>
              </>
            ) : (
              <>
                <RotateCw size={22} className="text-primary mb-1 animate-pulse" />
                <span className="text-xs font-bold tracking-wider">10s &gt;&gt;</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Long-Press 2× Speed Badge */}
      {gestures.isSpeedBoosted && (
        <div className="absolute top-16 inset-x-0 flex justify-center pointer-events-none z-30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-black text-xs font-bold shadow-2xl backdrop-blur-md">
            <FastForward size={14} className="animate-pulse" />
            <span>2× Speed</span>
          </div>
        </div>
      )}

      {/* Center Tap Area (Tap toggles play/pause, double-tap seeks, long-press speeds up, swipe navigates) */}
      <div
        className="pointer-events-auto flex-1 flex items-center justify-center cursor-pointer select-none touch-none"
        onClick={onTogglePlay}
        onTouchStart={gestures.handleTouchStart}
        onTouchMove={gestures.handleTouchMove}
        onTouchEnd={gestures.handleTouchEnd}
        onTouchCancel={gestures.handleTouchCancel}
      >
        {isBuffering ? (
          <div className="p-4 rounded-full bg-black/60 backdrop-blur-md text-white animate-spin">
            <Loader2 size={32} />
          </div>
        ) : !isPlaying ? (
          <div className="p-5 rounded-full bg-black/60 backdrop-blur-md text-white shadow-2xl border border-white/10 scale-100 hover:scale-105 transition-transform">
            <Play size={32} fill="white" className="ml-1" />
          </div>
        ) : null}
      </div>

      {/* Right-Side Vertical Floating Action Rail */}
      <div className="pointer-events-auto absolute right-3 bottom-24 flex flex-col items-center gap-4">
        {/* Favorite Button */}
        <button
          type="button"
          onClick={() => toggleFavorite(drama.slug)}
          className="flex flex-col items-center gap-1 text-white group"
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
        >
          <div
            className={`p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${
              favorited
                ? "bg-red-500/20 text-red-500 border border-red-500/40"
                : "bg-black/60 text-white/90 hover:text-white border border-white/10"
            }`}
          >
            <Heart size={20} className={favorited ? "fill-red-500" : ""} />
          </div>
          <span className="text-[10px] font-medium text-white/80 drop-shadow">
            {favorited ? "Favorited" : "Favorite"}
          </span>
        </button>

        {/* Episodes Bottom Sheet Trigger */}
        <button
          type="button"
          onClick={onOpenEpisodes}
          className="flex flex-col items-center gap-1 text-white group"
          aria-label="View all episodes"
        >
          <div className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/90 hover:text-white border border-white/10 backdrop-blur-md transition-all shadow-lg">
            <Layers size={20} />
          </div>
          <span className="text-[10px] font-medium text-white/80 drop-shadow">
            Episodes
          </span>
        </button>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShare}
          className="flex flex-col items-center gap-1 text-white group"
          aria-label="Share episode"
        >
          <div className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/90 hover:text-white border border-white/10 backdrop-blur-md transition-all shadow-lg">
            <Share2 size={20} />
          </div>
          <span className="text-[10px] font-medium text-white/80 drop-shadow">
            Share
          </span>
        </button>

        {/* Report Issue Button */}
        <Link
          href={`/contact?category=playback&title=${encodeURIComponent(
            drama.slug
          )}&ep=${currentEpisode}&titleName=${encodeURIComponent(drama.title)}`}
          className="flex flex-col items-center gap-1 text-white/80 hover:text-red-400 group"
          aria-label="Report playback issue"
        >
          <div className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white/90 hover:text-red-400 border border-white/10 backdrop-blur-md transition-all shadow-lg">
            <Flag size={20} />
          </div>
          <span className="text-[10px] font-medium text-white/80 drop-shadow">
            Report
          </span>
        </Link>
      </div>

      {/* Bottom Timeline Scrubber */}
      <div className="pointer-events-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="flex items-center justify-between text-[11px] font-mono text-white/80 mb-1.5 px-0.5">
          <span>{formatTime(currentTime)}</span>
          <span className="text-white/60">{formatTime(duration)}</span>
        </div>

        {/* Touch Scrubber */}
        <div className="relative w-full h-2 flex items-center group cursor-pointer">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progressRatio}
            onChange={handleScrubChange}
            aria-label="Video seek scrubber"
            className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}

export { WatchOverlay };
