"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { AspectRatioMode } from "./PlayerTypes";
import {
  toggleFullscreen as toggleFullscreenAdapter,
  addFullscreenChangeListener,
  isFullscreenSupported as checkFullscreenSupported,
} from "@/lib/player/fullscreen-capabilities";

export interface UsePlayerControlsOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  defaultAspectMode?: AspectRatioMode;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
}

export function usePlayerControls({
  videoRef,
  containerRef,
  defaultAspectMode = "9:16",
  onNextEpisode,
  onPrevEpisode,
}: UsePlayerControlsOptions) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMutedState] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [aspectMode, setAspectModeState] = useState<AspectRatioMode>(defaultAspectMode);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Restore volume and aspect preferences from localStorage
  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem("dramashort_player_volume");
      const savedMuted = localStorage.getItem("dramashort_player_muted");
      const savedAspect = localStorage.getItem("dramashort_player_aspect") as AspectRatioMode | null;
      if (savedVolume !== null) {
        const parsed = parseFloat(savedVolume);
        if (!isNaN(parsed)) setVolumeState(parsed);
      }
      if (savedMuted !== null) setIsMutedState(savedMuted === "true");
      if (savedAspect && ["fit", "9:16", "16:9"].includes(savedAspect)) {
        setAspectModeState(savedAspect);
      }
    } catch {
      // LocalStorage unavailable
    }
  }, []);

  const setVolume = useCallback(
    (newVolume: number | ((prev: number) => number)) => {
      setVolumeState((prev) => {
        const val = typeof newVolume === "function" ? newVolume(prev) : newVolume;
        const clamped = Math.max(0, Math.min(1, val));
        if (videoRef.current) {
          videoRef.current.volume = clamped;
          videoRef.current.muted = clamped === 0;
        }
        try {
          localStorage.setItem("dramashort_player_volume", clamped.toString());
        } catch {}
        return clamped;
      });
    },
    [videoRef]
  );

  const setIsMuted = useCallback(
    (muted: boolean | ((prev: boolean) => boolean)) => {
      setIsMutedState((prev) => {
        const val = typeof muted === "function" ? muted(prev) : muted;
        if (videoRef.current) {
          videoRef.current.muted = val;
        }
        try {
          localStorage.setItem("dramashort_player_muted", val.toString());
          if (!val) {
            sessionStorage.setItem("dramashort_session_unmuted", "true");
          }
        } catch {}
        return val;
      });
    },
    [videoRef]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, [setIsMuted]);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      setPlaybackRateState(rate);
      if (videoRef.current) {
        videoRef.current.playbackRate = rate;
      }
    },
    [videoRef]
  );

  const setAspectMode = useCallback((mode: AspectRatioMode) => {
    setAspectModeState(mode);
    try {
      localStorage.setItem("dramashort_player_aspect", mode);
    } catch {}
  }, []);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    setControlsVisible(true);

    if (isPlaying && !showSpeedMenu && !showSettingsMenu && !isScrubbing) {
      controlsTimeoutRef.current = setTimeout(() => {
        controlsTimeoutRef.current = null;
        setControlsVisible(false);
      }, 3500);
    }
  }, [isPlaying, showSpeedMenu, showSettingsMenu, isScrubbing]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      if (video.ended) {
        video.currentTime = 0;
      }
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    resetControlsTimeout();
  }, [videoRef, resetControlsTimeout]);

  const seekRelative = useCallback(
    (seconds: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration)) return;
      const target = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
      video.currentTime = target;
      resetControlsTimeout();
    },
    [videoRef, resetControlsTimeout]
  );

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;

    // Handles iOS Safari native video fullscreen fallback
    if ((video as any)?.webkitEnterFullscreen && !container?.requestFullscreen) {
      try {
        (video as any).webkitEnterFullscreen();
        return;
      } catch {}
    }

    await toggleFullscreenAdapter(container, video, { aspectMode });
  }, [containerRef, videoRef, aspectMode]);

  const togglePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP not supported or rejected
    }
  }, [videoRef]);

  // Fullscreen change listener across Desktop, iOS Safari, and Telegram WebApp
  useEffect(() => {
    const cleanup = addFullscreenChangeListener(videoRef.current, (fs) => {
      setIsFullscreen(fs);
    });
    return cleanup;
  }, [videoRef]);

  // Controls auto-hide timer effect
  useEffect(() => {
    if (!isPlaying || showSpeedMenu || showSettingsMenu || isScrubbing) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      setControlsVisible(true);
    } else {
      resetControlsTimeout();
    }
  }, [isPlaying, showSpeedMenu, showSettingsMenu, isScrubbing, resetControlsTimeout]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekRelative(-10);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekRelative(10);
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          setIsMuted(false);
          resetControlsTimeout();
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          resetControlsTimeout();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          resetControlsTimeout();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "n":
          e.preventDefault();
          onNextEpisode?.();
          break;
        case "p":
          e.preventDefault();
          onPrevEpisode?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    togglePlay,
    seekRelative,
    setVolume,
    toggleMute,
    setIsMuted,
    toggleFullscreen,
    onNextEpisode,
    onPrevEpisode,
    resetControlsTimeout,
  ]);

  return {
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    isMuted,
    setIsMuted,
    toggleMute,
    playbackRate,
    setPlaybackRate,
    aspectMode,
    setAspectMode,
    isFullscreen,
    isFullscreenSupported: checkFullscreenSupported(videoRef.current, containerRef.current),
    toggleFullscreen,
    togglePip,
    controlsVisible,
    setControlsVisible,
    resetControlsTimeout,
    controlsTimeoutRef,
    showSpeedMenu,
    setShowSpeedMenu,
    showSettingsMenu,
    setShowSettingsMenu,
    isScrubbing,
    setIsScrubbing,
    togglePlay,
    seekRelative,
  };
}
