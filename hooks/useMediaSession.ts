"use client";

import { useEffect, useRef } from "react";

export interface UseMediaSessionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  title?: string;
  dramaTitle?: string;
  channelName?: string;
  poster?: string;
  currentEpisode?: number;
  totalEpisodes?: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  onSeek?: (seconds: number) => void;
}

export interface MediaArtworkEntry {
  src: string;
  sizes: string;
  type: string;
}

/**
 * Builds standard resolution artwork list for MediaMetadata.
 */
export function generateArtworkList(posterUrl?: string): MediaArtworkEntry[] {
  if (!posterUrl || posterUrl.trim() === "") {
    return [
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ];
  }

  const mime = posterUrl.endsWith(".png")
    ? "image/png"
    : posterUrl.endsWith(".webp")
    ? "image/webp"
    : "image/jpeg";

  return [
    { src: posterUrl, sizes: "96x96", type: mime },
    { src: posterUrl, sizes: "128x128", type: mime },
    { src: posterUrl, sizes: "192x192", type: mime },
    { src: posterUrl, sizes: "256x256", type: mime },
    { src: posterUrl, sizes: "384x384", type: mime },
    { src: posterUrl, sizes: "512x512", type: mime },
  ];
}

/**
 * Safely bounds position state parameters for navigator.mediaSession.setPositionState.
 */
export function clampPositionState(
  currentTime: number,
  duration: number,
  playbackRate = 1
): { duration: number; position: number; playbackRate: number } | null {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(currentTime) ||
    currentTime < 0
  ) {
    return null;
  }

  const safeDuration = duration;
  const safePosition = Math.min(currentTime, safeDuration);
  const safePlaybackRate =
    Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;

  return {
    duration: safeDuration,
    position: safePosition,
    playbackRate: safePlaybackRate,
  };
}

/**
 * Hook to integrate the native OS Media Session API (navigator.mediaSession).
 * Enables lock-screen controls, smartwatch integration, notification controls,
 * and Bluetooth headset skip/playback actions.
 */
export function useMediaSession({
  videoRef,
  title,
  dramaTitle,
  channelName,
  poster,
  currentEpisode = 1,
  totalEpisodes = 1,
  isPlaying,
  currentTime,
  duration,
  playbackRate = 1,
  onPlay,
  onPause,
  onNextEpisode,
  onPrevEpisode,
  onSeek,
}: UseMediaSessionOptions) {
  // Store dynamic callbacks in refs to avoid re-attaching action listeners on every render
  const callbacksRef = useRef({
    onPlay,
    onPause,
    onNextEpisode,
    onPrevEpisode,
    onSeek,
    currentEpisode,
    totalEpisodes,
    currentTime,
    duration,
  });

  useEffect(() => {
    callbacksRef.current = {
      onPlay,
      onPause,
      onNextEpisode,
      onPrevEpisode,
      onSeek,
      currentEpisode,
      totalEpisodes,
      currentTime,
      duration,
    };
  });

  // 1. Update MediaMetadata when title, dramaTitle, channelName, or poster changes
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const effectiveTitle =
      title || (currentEpisode ? `Episode ${currentEpisode}` : "Playing Video");
    const effectiveArtist = dramaTitle || "DramaShort";
    const effectiveAlbum = channelName || "DramaShort Originals";
    const artwork = generateArtworkList(poster);

    try {
      if (typeof window.MediaMetadata !== "undefined") {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: effectiveTitle,
          artist: effectiveArtist,
          album: effectiveAlbum,
          artwork,
        });
      }
    } catch (err) {
      // In case browser throws on malformed metadata
      console.warn("[useMediaSession] Failed to set MediaMetadata:", err);
    }
  }, [title, dramaTitle, channelName, poster, currentEpisode]);

  // 2. Synchronize playbackState (playing | paused | none)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    } catch {}
  }, [isPlaying]);

  // 3. Synchronize position state (duration, position, playbackRate)
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("mediaSession" in navigator) ||
      !("setPositionState" in navigator.mediaSession)
    ) {
      return;
    }

    const safeState = clampPositionState(currentTime, duration, playbackRate);
    if (!safeState) return;

    try {
      navigator.mediaSession.setPositionState(safeState);
    } catch {}
  }, [currentTime, duration, playbackRate]);

  // 4. Attach OS action handlers (play, pause, nexttrack, previoustrack, seekto, seekforward, seekbackward, stop)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    const session = navigator.mediaSession;

    const safeSetAction = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null
    ) => {
      try {
        session.setActionHandler(action, handler);
      } catch {}
    };

    safeSetAction("play", () => {
      if (callbacksRef.current.onPlay) {
        callbacksRef.current.onPlay();
      } else if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
    });

    safeSetAction("pause", () => {
      if (callbacksRef.current.onPause) {
        callbacksRef.current.onPause();
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    });

    safeSetAction("previoustrack", () => {
      const { currentEpisode: ep, onPrevEpisode: prev } = callbacksRef.current;
      if (ep > 1 && prev) {
        prev();
      }
    });

    safeSetAction("nexttrack", () => {
      const { currentEpisode: ep, totalEpisodes: total, onNextEpisode: next } =
        callbacksRef.current;
      if (ep < total && next) {
        next();
      }
    });

    safeSetAction("seekbackward", (details) => {
      const offset = details.seekOffset || 10;
      const target = Math.max(0, callbacksRef.current.currentTime - offset);
      if (callbacksRef.current.onSeek) {
        callbacksRef.current.onSeek(target);
      } else if (videoRef.current) {
        videoRef.current.currentTime = target;
      }
    });

    safeSetAction("seekforward", (details) => {
      const offset = details.seekOffset || 10;
      const target = Math.min(
        callbacksRef.current.duration || 0,
        callbacksRef.current.currentTime + offset
      );
      if (callbacksRef.current.onSeek) {
        callbacksRef.current.onSeek(target);
      } else if (videoRef.current) {
        videoRef.current.currentTime = target;
      }
    });

    safeSetAction("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        const target = Math.max(
          0,
          Math.min(callbacksRef.current.duration || 0, details.seekTime)
        );
        if (callbacksRef.current.onSeek) {
          callbacksRef.current.onSeek(target);
        } else if (videoRef.current) {
          if (details.fastSeek && "fastSeek" in videoRef.current) {
            (videoRef.current as any).fastSeek(target);
          } else {
            videoRef.current.currentTime = target;
          }
        }
      }
    });

    safeSetAction("stop", () => {
      if (callbacksRef.current.onPause) {
        callbacksRef.current.onPause();
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
      if (callbacksRef.current.onSeek) {
        callbacksRef.current.onSeek(0);
      } else if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
    });

    return () => {
      const actions: MediaSessionAction[] = [
        "play",
        "pause",
        "previoustrack",
        "nexttrack",
        "seekbackward",
        "seekforward",
        "seekto",
        "stop",
      ];
      actions.forEach((act) => safeSetAction(act, null));
    };
  }, [videoRef]);
}
