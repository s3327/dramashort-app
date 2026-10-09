"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import Hls from "hls.js";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Smartphone,
  Monitor,
  Tv,
  Loader2,
  AlertCircle,
  Settings,
  ChevronUp,
  ChevronDown,
  FastForward,
  X,
  Subtitles,
  Keyboard,
} from "lucide-react";
import SubtitleOverlay from "@/components/player/SubtitleOverlay";
import SubtitleSettingsModal from "@/components/player/SubtitleSettingsModal";
import PlayerHud, { type PlayerHudState, type PlayerHudActionType } from "@/components/player/PlayerHud";
import KeyboardShortcutsModal from "@/components/player/KeyboardShortcutsModal";
import type { SubtitleTrack, SubtitleCue, SubtitleSettings } from "@/types/subtitles";
import { loadSubtitleSettings, saveSubtitleSettings } from "@/types/subtitles";
import { getDefaultDemoTracks, findActiveCue, parseVtt } from "@/lib/player/subtitles";
import {
  HLS_SHORT_VOD_CONFIG,
  MAX_NETWORK_RETRIES,
  MAX_MEDIA_RECOVERIES,
  RETRY_BASE_DELAY_MS,
  RESUME_NOTIFICATION_DURATION_MS,
  calculateBackoffDelay,
} from "@/lib/player/streaming-robustness";
import {
  toggleFullscreen as toggleFullscreenAdapter,
  addFullscreenChangeListener,
} from "@/lib/player/fullscreen-capabilities";

export {
  HLS_SHORT_VOD_CONFIG,
  MAX_NETWORK_RETRIES,
  MAX_MEDIA_RECOVERIES,
  RETRY_BASE_DELAY_MS,
  RESUME_NOTIFICATION_DURATION_MS,
  calculateBackoffDelay,
};

export type AspectRatioMode = "fit" | "9:16" | "16:9";

export interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  dramaTitle?: string;
  currentEpisode: number;
  totalEpisodes: number;
  initialProgressSeconds?: number;
  initialProgressRatio?: number;
  autoPlay?: boolean;
  aspectRatio?: string;
  isMobileFullViewport?: boolean;
  subtitles?: SubtitleTrack[];
  onTimeUpdate?: (currentTime: number, duration: number, progressRatio: number) => void;
  onPause?: (currentTime: number, duration: number, progressRatio: number) => void;
  onEnded?: () => void;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({
  src,
  poster,
  title,
  dramaTitle,
  currentEpisode,
  totalEpisodes,
  initialProgressSeconds = 0,
  initialProgressRatio,
  autoPlay = true,
  aspectRatio,
  isMobileFullViewport = false,
  subtitles,
  onTimeUpdate,
  onPause,
  onEnded,
  onNextEpisode,
  onPrevEpisode,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const networkRetryCountRef = useRef<number>(0);
  const mediaRecoveryCountRef = useRef<number>(0);
  const hasAppliedInitialProgressRef = useRef<boolean>(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  // Playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState<string | null>(null);
  const [showUnmutePill, setShowUnmutePill] = useState<boolean>(false);

  // UI & control states
  const [controlsVisible, setControlsVisible] = useState(true);
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>(() => {
    if (aspectRatio === "16:9") return "16:9";
    if (aspectRatio === "fit") return "fit";
    return "9:16";
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [resumeNotification, setResumeNotification] = useState<{
    formatted: string;
    ratio: number;
  } | null>(null);

  // Subtitle & Closed Caption State (Task 9.2)
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => {
    return loadSubtitleSettings();
  });
  const [isSubtitleModalOpen, setIsSubtitleModalOpen] = useState(false);

  const effectiveTracks = useMemo<SubtitleTrack[]>(() => {
    if (subtitles && subtitles.length > 0) {
      return subtitles;
    }
    return getDefaultDemoTracks(dramaTitle || title, currentEpisode);
  }, [subtitles, dramaTitle, title, currentEpisode]);

  const activeTrack = useMemo(() => {
    if (subtitleSettings.language === "off") return null;
    return effectiveTracks.find((t) => t.language === subtitleSettings.language) || null;
  }, [effectiveTracks, subtitleSettings.language]);

  const [activeCues, setActiveCues] = useState<SubtitleCue[]>(() => activeTrack?.cues || []);

  useEffect(() => {
    if (!activeTrack) {
      setActiveCues([]);
      return;
    }
    if (activeTrack.cues && activeTrack.cues.length > 0) {
      setActiveCues(activeTrack.cues);
      return;
    }
    if (activeTrack.src) {
      let isCurrent = true;
      fetch(activeTrack.src)
        .then((res) => (res.ok ? res.text() : ""))
        .then((text) => {
          if (!isCurrent) return;
          if (text) {
            setActiveCues(parseVtt(text));
          }
        })
        .catch(() => {});
      return () => {
        isCurrent = false;
      };
    }
    setActiveCues([]);
  }, [activeTrack]);

  const currentActiveCue = useMemo(() => {
    if (subtitleSettings.language === "off") return null;
    return findActiveCue(activeCues, currentTime);
  }, [subtitleSettings.language, activeCues, currentTime]);

  const toggleSubtitlesQuick = useCallback(() => {
    setSubtitleSettings((prev) => {
      const nextLang = prev.language === "off" ? "en" : "off";
      const next = { ...prev, language: nextLang };
      saveSubtitleSettings(next);
      return next;
    });
  }, []);

  // Ensure native browser textTrack cues are hidden to prevent duplicate text rendering
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !video.textTracks) return;
    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      track.mode = "hidden";
    }
  }, [effectiveTracks, currentTime]);

  // Keyboard Shortcuts Modal & Visual HUD Feedback State (Task 9.3)
  const [isKeyboardModalOpen, setIsKeyboardModalOpen] = useState(false);
  const [hudState, setHudState] = useState<PlayerHudState | null>(null);
  const hudTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerHud = useCallback(
    (type: PlayerHudActionType, label: string, detail?: string) => {
      if (hudTimerRef.current) {
        clearTimeout(hudTimerRef.current);
        hudTimerRef.current = null;
      }
      setHudState((prev) => ({
        type,
        label,
        detail,
        nonce: (prev?.nonce || 0) + 1,
      }));
      hudTimerRef.current = setTimeout(() => {
        setHudState(null);
        hudTimerRef.current = null;
      }, 750);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (hudTimerRef.current) {
        clearTimeout(hudTimerRef.current);
        hudTimerRef.current = null;
      }
    };
  }, []);

  // Vertical Swipe Gesture States (Swipe Up = Next, Swipe Down = Prev)
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [swipeHint, setSwipeHint] = useState<"next" | "prev" | null>(null);

  // Double-tap & single-tap detection
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const pendingTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [seekRipple, setSeekRipple] = useState<{ direction: "left" | "right"; visible: boolean } | null>(null);
  const rippleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Long-press 2× speed boost state
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSpeedBoosted, setIsSpeedBoosted] = useState<boolean>(false);
  const previousSpeedRef = useRef<number>(1);

  // Restore volume preference from localStorage & session unmute status
  useEffect(() => {
    try {
      const sessionUnmuted = typeof sessionStorage !== "undefined" && sessionStorage.getItem("dramashort_session_unmuted") === "true";
      const savedVolume = localStorage.getItem("dramashort_player_volume");
      const savedMuted = localStorage.getItem("dramashort_player_muted");
      const savedAspect = localStorage.getItem("dramashort_player_aspect") as AspectRatioMode | null;
      if (savedVolume !== null) setVolume(parseFloat(savedVolume));
      if (savedAspect && ["fit", "9:16", "16:9"].includes(savedAspect)) {
        setAspectMode(savedAspect);
      }
      if (sessionUnmuted) {
        if (savedMuted !== null) setIsMuted(savedMuted === "true");
        else setIsMuted(false);
      } else {
        // Unmuted session not yet established: start muted to guarantee browser autoplay
        setIsMuted(true);
        setShowUnmutePill(true);
      }
    } catch {
      // ignore in incognito/SSR
    }
  }, []);

  const handleTapToUnmute = useCallback(() => {
    setIsMuted(false);
    setShowUnmutePill(false);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume > 0 ? volume : 1;
    }
    try {
      sessionStorage.setItem("dramashort_session_unmuted", "true");
      localStorage.setItem("dramashort_player_muted", "false");
    } catch {}
  }, [volume]);

  // Update volume on video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Manual retry handler for error overlay
  const handleRetryPlayback = useCallback(() => {
    setHasError(null);
    setIsBuffering(true);
    networkRetryCountRef.current = 0;
    mediaRecoveryCountRef.current = 0;
    hasAppliedInitialProgressRef.current = false;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setReloadIndex((prev) => prev + 1);
  }, []);

  // Video Source / HLS setup & Robustness Lifecycle
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Clear prior timers and reset episode-specific state
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }

    // Reset retry counters on episode change or source reload
    networkRetryCountRef.current = 0;
    mediaRecoveryCountRef.current = 0;
    hasAppliedInitialProgressRef.current = false;

    setHasError(null);
    setIsBuffering(true);
    setNextCountdown(null);
    setResumeNotification(null);

    // Destroy existing Hls instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = src.includes(".m3u8") || src.includes("application/x-mpegURL");

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls(HLS_SHORT_VOD_CONFIG);
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          if (initialProgressSeconds > 0) {
            video.currentTime = initialProgressSeconds;
          }
          if (autoPlay || reloadIndex > 0) {
            video.play().catch(() => {
              if (!video.muted) {
                video.muted = true;
                setIsMuted(true);
                setShowUnmutePill(true);
                video.play().catch(() => setIsPlaying(false));
              } else {
                setIsPlaying(false);
              }
            });
          }
        });

        // Successful segment download resets network retry counter
        hls.on(Hls.Events.FRAG_LOADED, () => {
          networkRetryCountRef.current = 0;
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (networkRetryCountRef.current < MAX_NETWORK_RETRIES) {
                  const delay = calculateBackoffDelay(networkRetryCountRef.current);
                  networkRetryCountRef.current += 1;
                  setIsBuffering(true);
                  if (retryTimeoutRef.current) {
                    clearTimeout(retryTimeoutRef.current);
                  }
                  retryTimeoutRef.current = setTimeout(() => {
                    retryTimeoutRef.current = null;
                    if (hlsRef.current) {
                      hlsRef.current.startLoad();
                    }
                  }, delay);
                } else {
                  if (retryTimeoutRef.current) {
                    clearTimeout(retryTimeoutRef.current);
                    retryTimeoutRef.current = null;
                  }
                  if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                  }
                  setIsBuffering(false);
                  setHasError("Network error: unable to load video stream. Please check your internet connection.");
                }
                break;

              case Hls.ErrorTypes.MEDIA_ERROR:
                if (mediaRecoveryCountRef.current < MAX_MEDIA_RECOVERIES) {
                  mediaRecoveryCountRef.current += 1;
                  setIsBuffering(true);
                  hls.recoverMediaError();
                } else {
                  if (hlsRef.current) {
                    hlsRef.current.destroy();
                    hlsRef.current = null;
                  }
                  setIsBuffering(false);
                  setHasError("Playback error: unable to recover media stream.");
                }
                break;

              default:
                if (hlsRef.current) {
                  hlsRef.current.destroy();
                  hlsRef.current = null;
                }
                setIsBuffering(false);
                setHasError("Playback error: unable to load HLS stream.");
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS for Safari/iOS
        video.src = src;
        video.load();
        if (initialProgressSeconds > 0) {
          video.currentTime = initialProgressSeconds;
        }
        if (autoPlay || reloadIndex > 0) {
          video.play().catch(() => {
            if (!video.muted) {
              video.muted = true;
              setIsMuted(true);
              setShowUnmutePill(true);
              video.play().catch(() => setIsPlaying(false));
            } else {
              setIsPlaying(false);
            }
          });
        }
      } else {
        setHasError("Your browser does not support HLS video streaming");
      }
    } else {
      // Standard MP4 / WebM
      video.src = src;
      video.load();
      if (initialProgressSeconds > 0) {
        video.currentTime = initialProgressSeconds;
      }
      if (autoPlay || reloadIndex > 0) {
        video.play().catch(() => {
          if (!video.muted) {
            video.muted = true;
            setIsMuted(true);
            setShowUnmutePill(true);
            video.play().catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
        });
      }
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
      if (video) {
        video.pause();
      }
    };
  }, [src, currentEpisode, autoPlay, initialProgressSeconds, reloadIndex]);

  // Global unmount cleanup effect for all timers
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (pendingTapTimeoutRef.current) {
        clearTimeout(pendingTapTimeoutRef.current);
        pendingTapTimeoutRef.current = null;
      }
      if (rippleTimeoutRef.current) {
        clearTimeout(rippleTimeoutRef.current);
        rippleTimeoutRef.current = null;
      }
      if (video) {
        video.pause();
      }
    };
  }, []);

  // Fullscreen change listener across Desktop, iOS Safari, and Telegram WebApp
  useEffect(() => {
    const cleanup = addFullscreenChangeListener(videoRef.current, (fs) => {
      setIsFullscreen(fs);
    });
    return cleanup;
  }, []);

  const cancelNextCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setNextCountdown(null);
  }, []);

  const goToNextEpisode = useCallback(() => {
    cancelNextCountdown();
    if (currentEpisode < totalEpisodes && onNextEpisode) {
      onNextEpisode();
    }
  }, [cancelNextCountdown, currentEpisode, totalEpisodes, onNextEpisode]);

  const goToPrevEpisode = useCallback(() => {
    cancelNextCountdown();
    if (currentEpisode > 1 && onPrevEpisode) {
      onPrevEpisode();
    }
  }, [cancelNextCountdown, currentEpisode, onPrevEpisode]);

  // Cancel active countdown if user disables autoPlayNext
  useEffect(() => {
    if (!autoPlayNext) {
      cancelNextCountdown();
    }
  }, [autoPlayNext, cancelNextCountdown]);

  // Controls auto-hide timer
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = null;
    }
    if (isPlaying && !showSpeedMenu && !showSettingsMenu && !isScrubbing) {
      controlsTimeoutRef.current = setTimeout(() => {
        controlsTimeoutRef.current = null;
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, showSpeedMenu, showSettingsMenu, isScrubbing]);

  // Keep controls visible and clear auto-hide timer when paused, scrubbing, or menus are open
  useEffect(() => {
    if (!isPlaying || showSpeedMenu || showSettingsMenu || isScrubbing) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      setControlsVisible(true);
    }
  }, [isPlaying, showSpeedMenu, showSettingsMenu, isScrubbing]);

  // Keep controls visible when subtitle or keyboard settings modal is open
  useEffect(() => {
    if (isSubtitleModalOpen || isKeyboardModalOpen) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = null;
      }
      setControlsVisible(true);
    }
  }, [isSubtitleModalOpen, isKeyboardModalOpen]);

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const handleMouseLeave = () => {
    if (
      isPlaying &&
      !showSpeedMenu &&
      !showSettingsMenu &&
      !isScrubbing &&
      !isSubtitleModalOpen &&
      !isKeyboardModalOpen
    ) {
      setControlsVisible(false);
    }
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    cancelNextCountdown();

    if (video.paused || video.ended) {
      if (video.ended) {
        video.currentTime = 0;
      }
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [cancelNextCountdown]);

  // Seek relative
  const seekRelative = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    cancelNextCountdown();
    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || 0));
  }, [cancelNextCountdown]);

  // Volume slider
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    try {
      localStorage.setItem("dramashort_player_volume", val.toString());
      localStorage.setItem("dramashort_player_muted", (val === 0).toString());
    } catch {
      // ignore
    }
  };

  // Toggle Mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("dramashort_player_muted", next.toString());
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Playback Rate
  const handleRateSelect = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSpeedMenu(false);
  };

  // Aspect mode change
  const handleAspectChange = (mode: AspectRatioMode) => {
    setAspectMode(mode);
    try {
      localStorage.setItem("dramashort_player_aspect", mode);
    } catch {
      // ignore
    }
    setShowSettingsMenu(false);
  };

  // Fullscreen (Desktop, iOS Safari webkitEnterFullscreen, Telegram WebApp)
  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    const video = videoRef.current;
    if (!container && !video) return;

    if ((video as any)?.webkitEnterFullscreen && !container?.requestFullscreen) {
      try {
        (video as any).webkitEnterFullscreen();
        return;
      } catch {}
    }

    await toggleFullscreenAdapter(container, video, { aspectMode });
  }, [aspectMode]);

  // Picture in Picture
  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP not supported or rejected:", err);
    }
  };

  // Scrub bar handlers
  const handleScrubMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = scrubBarRef.current;
    if (!bar || duration <= 0) return;
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const ratio = x / rect.width;
    setHoverPosition(x);
    setHoverTime(ratio * duration);
  };

  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = scrubBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || duration <= 0) return;
    cancelNextCountdown();
    const rect = bar.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const targetTime = (x / rect.width) * duration;
    video.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Vertical Swipe Gesture Handlers (TikTok / ReelShort style episode navigation)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest(".group\\/scrub")
    ) {
      return;
    }
    if (e.touches.length !== 1) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;

    // Start 400ms long-press timer for 2× speed boost
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && isPlaying) {
        previousSpeedRef.current = video.playbackRate;
        video.playbackRate = 2.0;
        setIsSpeedBoosted(true);
      }
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current || touchStartY.current === null || touchStartX.current === null) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - touchStartY.current;
    const deltaX = currentX - touchStartX.current;

    // If movement exceeds 8px, cancel long-press (it's a swipe, not a hold)
    if (Math.abs(deltaY) > 8 || Math.abs(deltaX) > 8) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }

    // Only engage if movement is primarily vertical
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 8) {
      const damped = deltaY * 0.45;
      setSwipeOffset(damped);
      if (deltaY < -20) {
        setSwipeHint("next");
      } else if (deltaY > 20) {
        setSwipeHint("prev");
      } else {
        setSwipeHint(null);
      }
    }
  };

  const handleTouchEnd = (e?: React.TouchEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // If speed was boosted via long press, restore previous speed and dismiss
    if (isSpeedBoosted) {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = previousSpeedRef.current || playbackRate;
      }
      setIsSpeedBoosted(false);
      isDragging.current = false;
      touchStartY.current = null;
      touchStartX.current = null;
      setSwipeOffset(0);
      setSwipeHint(null);
      return;
    }

    if (!isDragging.current) return;

    const wasSwiping = Math.abs(swipeOffset) > 10;
    if (swipeOffset < -45) {
      // Swiped UP -> Next Episode
      goToNextEpisode();
    } else if (swipeOffset > 45) {
      // Swiped DOWN -> Previous Episode
      goToPrevEpisode();
    }

    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;
    setSwipeOffset(0);
    setSwipeHint(null);

    // Double-tap & single-tap detection
    if (!wasSwiping && e && e.changedTouches && e.changedTouches.length === 1) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const touch = e.changedTouches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = touch.clientX - rect.left;
      const width = rect.width;
      const now = Date.now();

      const lastTap = lastTapRef.current;
      if (
        lastTap &&
        now - lastTap.time < 300 &&
        Math.abs(touch.clientX - lastTap.x) < 40 &&
        Math.abs(touch.clientY - lastTap.y) < 40
      ) {
        // Double-tap detected: cancel pending single tap
        if (pendingTapTimeoutRef.current) {
          clearTimeout(pendingTapTimeoutRef.current);
          pendingTapTimeoutRef.current = null;
        }
        lastTapRef.current = null;

        const ratio = clientX / width;
        if (ratio < 0.35) {
          seekRelative(-10);
          setSeekRipple({ direction: "left", visible: true });
        } else if (ratio > 0.65) {
          seekRelative(10);
          setSeekRipple({ direction: "right", visible: true });
        } else {
          togglePlay();
        }

        if (rippleTimeoutRef.current) clearTimeout(rippleTimeoutRef.current);
        rippleTimeoutRef.current = setTimeout(() => {
          setSeekRipple(null);
        }, 650);
      } else {
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
        if (pendingTapTimeoutRef.current) clearTimeout(pendingTapTimeoutRef.current);
        pendingTapTimeoutRef.current = setTimeout(() => {
          pendingTapTimeoutRef.current = null;
          togglePlay();
        }, 260);
      }
    }
  };

  const handleTouchCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (isSpeedBoosted) {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = previousSpeedRef.current || playbackRate;
      }
      setIsSpeedBoosted(false);
    }
    if (!isDragging.current) return;
    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;
    setSwipeOffset(0);
    setSwipeHint(null);
  };

  // Mouse drag episode navigation is neutralized to prevent desktop drag accidents.
  // Desktop navigation is strictly handled via buttons, keyboard shortcuts, and sidebar tiles.
  const handleMouseDown = (_e: React.MouseEvent<HTMLDivElement>) => {
    // No-op for episode navigation
  };

  const handleMouseMoveWithSwipe = (_e: React.MouseEvent<HTMLDivElement>) => {
    handleMouseMove();
  };

  const handleMouseUp = () => {
    // No-op for episode navigation
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in text inputs or textareas
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      // Safeguard: ignore global hotkeys if modal dialogs are open
      if (isSubtitleModalOpen || isKeyboardModalOpen) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k": {
          e.preventDefault();
          const video = videoRef.current;
          const willPlay = video ? video.paused || video.ended : !isPlaying;
          togglePlay();
          triggerHud(willPlay ? "play" : "pause", willPlay ? "Play" : "Pause");
          resetControlsTimeout();
          break;
        }
        case "arrowleft":
        case "j": {
          e.preventDefault();
          seekRelative(-5);
          const target = Math.max(0, currentTime - 5);
          triggerHud("seek_backward", "-5s", formatTime(target));
          resetControlsTimeout();
          break;
        }
        case "arrowright":
        case "l": {
          e.preventDefault();
          seekRelative(5);
          const target = Math.min(duration, currentTime + 5);
          triggerHud("seek_forward", "+5s", formatTime(target));
          resetControlsTimeout();
          break;
        }
        case "arrowup": {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift + ArrowUp = Volume Up (+10%)
            const nextVol = Math.min(1, Math.round((volume + 0.1) * 10) / 10);
            setVolume(nextVol);
            setIsMuted(false);
            if (videoRef.current) {
              videoRef.current.volume = nextVol;
              videoRef.current.muted = false;
            }
            triggerHud("volume", `Volume ${Math.round(nextVol * 100)}%`);
          } else {
            // ArrowUp = Previous Episode (Short Drama vertical navigation)
            if (currentEpisode > 1 && onPrevEpisode) {
              goToPrevEpisode();
              triggerHud("prev_episode", `Episode ${currentEpisode - 1}`, `Ep ${currentEpisode - 1} of ${totalEpisodes}`);
            } else {
              triggerHud("prev_episode", "First Episode", "Episode 1");
            }
          }
          resetControlsTimeout();
          break;
        }
        case "arrowdown": {
          e.preventDefault();
          if (e.shiftKey) {
            // Shift + ArrowDown = Volume Down (-10%)
            const nextVol = Math.max(0, Math.round((volume - 0.1) * 10) / 10);
            setVolume(nextVol);
            setIsMuted(nextVol === 0);
            if (videoRef.current) {
              videoRef.current.volume = nextVol;
              videoRef.current.muted = nextVol === 0;
            }
            triggerHud("volume", nextVol === 0 ? "Muted" : `Volume ${Math.round(nextVol * 100)}%`);
          } else {
            // ArrowDown = Next Episode (Short Drama vertical navigation)
            if (currentEpisode < totalEpisodes && onNextEpisode) {
              goToNextEpisode();
              triggerHud("next_episode", `Episode ${currentEpisode + 1}`, `Ep ${currentEpisode + 1} of ${totalEpisodes}`);
            } else {
              triggerHud("next_episode", "Latest Episode", `Episode ${totalEpisodes}`);
            }
          }
          resetControlsTimeout();
          break;
        }
        case "m": {
          e.preventDefault();
          const nextMuted = !isMuted;
          toggleMute();
          triggerHud(nextMuted ? "mute" : "unmute", nextMuted ? "Muted" : "Unmuted");
          resetControlsTimeout();
          break;
        }
        case "f": {
          e.preventDefault();
          toggleFullscreen();
          triggerHud(isFullscreen ? "fullscreen_exit" : "fullscreen", isFullscreen ? "Exit Fullscreen" : "Fullscreen");
          break;
        }
        case "n": {
          e.preventDefault();
          if (currentEpisode < totalEpisodes && onNextEpisode) {
            goToNextEpisode();
            triggerHud("next_episode", `Episode ${currentEpisode + 1}`, `Ep ${currentEpisode + 1} of ${totalEpisodes}`);
          } else {
            triggerHud("next_episode", "Latest Episode", `Episode ${totalEpisodes}`);
          }
          resetControlsTimeout();
          break;
        }
        case "p": {
          e.preventDefault();
          if (currentEpisode > 1 && onPrevEpisode) {
            goToPrevEpisode();
            triggerHud("prev_episode", `Episode ${currentEpisode - 1}`, `Ep ${currentEpisode - 1} of ${totalEpisodes}`);
          } else {
            triggerHud("prev_episode", "First Episode", "Episode 1");
          }
          resetControlsTimeout();
          break;
        }
        case "c": {
          e.preventDefault();
          toggleSubtitlesQuick();
          const willBe = subtitleSettings.language === "off" ? "en" : "off";
          triggerHud("subtitles", willBe === "off" ? "Subtitles: OFF" : `Subtitles: ${willBe.toUpperCase()}`);
          resetControlsTimeout();
          break;
        }
        case "?":
        case "/": {
          if (e.key === "?" || e.shiftKey) {
            e.preventDefault();
            setIsKeyboardModalOpen(true);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    currentEpisode,
    totalEpisodes,
    subtitleSettings.language,
    isSubtitleModalOpen,
    isKeyboardModalOpen,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    toggleSubtitlesQuick,
    triggerHud,
    seekRelative,
    goToNextEpisode,
    goToPrevEpisode,
    onNextEpisode,
    onPrevEpisode,
    resetControlsTimeout,
  ]);

  // Handle Video Ended & Auto Next
  const handleVideoEnded = () => {
    setIsPlaying(false);
    onEnded?.();

    if (autoPlayNext && currentEpisode < totalEpisodes && onNextEpisode) {
      setNextCountdown(3);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      countdownIntervalRef.current = setInterval(() => {
        setNextCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            onNextEpisode();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Video Event Listeners
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const curr = video.currentTime;
    const dur = video.duration || 0;
    setCurrentTime(curr);
    setDuration(dur);

    if (video.buffered.length > 0 && dur > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered((bufferedEnd / dur) * 100);
    }

    if (dur > 0 && onTimeUpdate) {
      onTimeUpdate(curr, dur, curr / dur);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    setDuration(dur);
    setIsBuffering(false);

    if (hasAppliedInitialProgressRef.current) {
      return;
    }

    let targetTime = 0;
    if (
      initialProgressSeconds &&
      initialProgressSeconds > 0 &&
      Number.isFinite(dur) &&
      dur > 2 &&
      initialProgressSeconds < dur - 2
    ) {
      targetTime = initialProgressSeconds;
    } else if (
      initialProgressRatio &&
      initialProgressRatio > 0.02 &&
      initialProgressRatio < 0.95 &&
      Number.isFinite(dur) &&
      dur > 0
    ) {
      targetTime = dur * initialProgressRatio;
    }

    if (targetTime > 0 && Number.isFinite(targetTime)) {
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
      setResumeNotification({
        formatted: formatTime(targetTime),
        ratio: targetTime / dur,
      });
      hasAppliedInitialProgressRef.current = true;
    }
  };

  // Apply initial progress if it resolves asynchronously after metadata has already loaded
  useEffect(() => {
    if (hasAppliedInitialProgressRef.current) return;
    const video = videoRef.current;
    if (!video) return;
    const dur = video.duration || 0;
    if (!Number.isFinite(dur) || dur <= 0) return;

    // Do not jump backwards if user has already actively played past 2 seconds
    if (video.currentTime > 2) {
      hasAppliedInitialProgressRef.current = true;
      return;
    }

    let targetTime = 0;
    if (
      initialProgressSeconds &&
      initialProgressSeconds > 0 &&
      Number.isFinite(dur) &&
      dur > 2 &&
      initialProgressSeconds < dur - 2
    ) {
      targetTime = initialProgressSeconds;
    } else if (
      initialProgressRatio &&
      initialProgressRatio > 0.02 &&
      initialProgressRatio < 0.95 &&
      Number.isFinite(dur) &&
      dur > 0
    ) {
      targetTime = dur * initialProgressRatio;
    }

    if (targetTime > 0 && Number.isFinite(targetTime)) {
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
      setResumeNotification({
        formatted: formatTime(targetTime),
        ratio: targetTime / dur,
      });
      hasAppliedInitialProgressRef.current = true;
    }
  }, [initialProgressRatio, initialProgressSeconds]);

  // Auto-dismiss resume notification pill with proper React ref & effect lifecycle
  useEffect(() => {
    if (!resumeNotification) return;

    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
    }

    resumeTimeoutRef.current = setTimeout(() => {
      setResumeNotification(null);
      resumeTimeoutRef.current = null;
    }, RESUME_NOTIFICATION_DURATION_MS);

    return () => {
      if (resumeTimeoutRef.current) {
        clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    };
  }, [resumeNotification]);

  // Aspect Ratio Container Classes
  const aspectContainerClasses = useMemo(() => {
    if (isMobileFullViewport) {
      switch (aspectMode) {
        case "16:9":
          return "w-full aspect-video md:aspect-[9/16] md:max-h-[82vh] md:max-w-[420px] mx-auto";
        case "fit":
          return "w-full aspect-video sm:max-h-[75vh]";
        case "9:16":
        default:
          return "w-full h-full md:aspect-[9/16] md:max-h-[82vh] md:max-w-[420px] mx-auto";
      }
    }
    switch (aspectMode) {
      case "9:16":
        return "aspect-[9/16] max-h-[82vh] max-w-[420px] mx-auto";
      case "16:9":
        return "aspect-video w-full";
      case "fit":
      default:
        return "aspect-video w-full sm:max-h-[75vh]";
    }
  }, [aspectMode, isMobileFullViewport]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMoveWithSwipe}
      onMouseLeave={() => {
        handleMouseUp();
        handleMouseLeave();
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      className={`relative group select-none overflow-hidden touch-none overscroll-contain ${isMobileFullViewport ? "rounded-none md:rounded-xl" : "rounded-xl"} bg-black shadow-2xl transition-all ${aspectContainerClasses} flex items-center justify-center`}
    >
      {/* Ambient background blur for 9:16 mode on widescreen displays */}
      {aspectMode === "9:16" && poster && (
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none opacity-30">
          <Image
            src={poster}
            alt=""
            fill
            className="object-cover blur-3xl scale-125 transform"
            priority={false}
          />
        </div>
      )}

      {/* Main Video Element (with subtle rubberband transform on swipe) */}
      <div
        style={{
          transform: `translateY(${swipeOffset}px)`,
          transition: isDragging.current ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        className="w-full h-full flex items-center justify-center"
      >
        <video
          ref={videoRef}
          playsInline
          className={`w-full h-full cursor-pointer ${
            aspectMode === "9:16" ? "object-cover" : "object-contain"
          }`}
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
            networkRetryCountRef.current = 0;
            mediaRecoveryCountRef.current = 0;
          }}
          onPause={() => {
            setIsPlaying(false);
            const video = videoRef.current;
            if (video && video.duration > 0 && onPause) {
              onPause(video.currentTime, video.duration, video.currentTime / video.duration);
            }
          }}
          onEnded={handleVideoEnded}
          onError={() => {
            // If HLS.js is actively managing playback and recovery, allow HLS event handlers to manage retries/recoveries
            if (hlsRef.current) return;
            setIsBuffering(false);
            setHasError((prev) => prev || "Error loading video stream. Please check your connection.");
          }}
        >
          {effectiveTracks.map((track) => (
            <track
              key={track.id || track.language}
              kind="subtitles"
              src={track.src}
              srcLang={track.language}
              label={track.label}
              default={track.language === subtitleSettings.language}
            />
          ))}
        </video>
      </div>

      {/* High-Readability Custom Subtitle Overlay (Task 9.2) */}
      <SubtitleOverlay
        cue={currentActiveCue}
        settings={subtitleSettings}
        isControlsVisible={controlsVisible}
      />

      {/* Visual Feedback HUD Overlay (Task 9.3) */}
      <PlayerHud hud={hudState} />

      {/* Auto-Resume Floating Pill Indicator */}
      {resumeNotification && (
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2.5 rounded-full bg-black/85 border border-primary/50 px-3.5 py-1.5 text-xs text-white backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-top-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
          <span>
            Resumed at {resumeNotification.formatted} ({Math.round(resumeNotification.ratio * 100)}%)
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (videoRef.current) {
                videoRef.current.currentTime = 0;
                setCurrentTime(0);
              }
              if (resumeTimeoutRef.current) {
                clearTimeout(resumeTimeoutRef.current);
                resumeTimeoutRef.current = null;
              }
              setResumeNotification(null);
            }}
            className="text-primary hover:text-primary-hover font-semibold underline underline-offset-2 ml-1 text-[11px]"
          >
            Start over
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (resumeTimeoutRef.current) {
                clearTimeout(resumeTimeoutRef.current);
                resumeTimeoutRef.current = null;
              }
              setResumeNotification(null);
            }}
            className="text-white/60 hover:text-white ml-0.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
            aria-label="Dismiss resume notification"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Tap to Unmute Floating Pill Indicator (Task 14.4) */}
      {showUnmutePill && isMuted && isPlaying && (
        <div className="absolute top-4 inset-x-0 z-30 flex justify-center pointer-events-auto animate-in fade-in slide-in-from-top-2">
          <button
            type="button"
            onClick={handleTapToUnmute}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/85 backdrop-blur-md border border-white/20 text-white shadow-2xl hover:bg-black/95 active:scale-95 transition-all text-xs sm:text-sm font-semibold tracking-wide group focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            aria-label="Tap to unmute audio"
          >
            <VolumeX size={16} className="text-primary group-hover:scale-110 transition-transform animate-pulse" />
            <span>Tap to unmute</span>
          </button>
        </div>
      )}

      {/* Vertical Swipe Gesture Floating Badge Indicator */}
      {swipeHint && (
        <div
          className={`absolute inset-x-0 flex justify-center pointer-events-none z-30 transition-all duration-200 ${
            swipeHint === "next" ? "top-16" : "bottom-20"
          }`}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/90 border border-primary/60 text-white text-xs font-bold backdrop-blur-md shadow-2xl animate-pulse">
            {swipeHint === "next" ? (
              <>
                <ChevronUp size={16} className="text-primary animate-bounce" />
                <span>
                  {currentEpisode < totalEpisodes
                    ? `Release to Play Episode ${currentEpisode + 1}`
                    : "You're on the latest episode"}
                </span>
              </>
            ) : (
              <>
                <ChevronDown size={16} className="text-primary animate-bounce" />
                <span>
                  {currentEpisode > 1
                    ? `Release to Play Episode ${currentEpisode - 1}`
                    : "You're on the first episode"}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Double Tap Seek Feedback Ripple */}
      {seekRipple && (
        <div
          className={`absolute inset-y-0 ${
            seekRipple.direction === "left" ? "left-6" : "right-6"
          } flex items-center justify-center pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-200`}
        >
          <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-black/80 border border-white/20 text-white backdrop-blur-md shadow-2xl">
            {seekRipple.direction === "left" ? (
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

      {/* Long-Press 2× Speed Floating Badge */}
      {isSpeedBoosted && (
        <div className="absolute top-14 inset-x-0 flex justify-center pointer-events-none z-30 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-black text-xs font-bold shadow-2xl backdrop-blur-md">
            <FastForward size={14} className="animate-pulse" />
            <span>2× Speed</span>
          </div>
        </div>
      )}

      {/* Buffering Spinner */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/30 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-black/60 border border-white/10 text-white">
            <Loader2 className="w-9 h-9 animate-spin text-primary" />
            <span className="text-xs font-medium tracking-wide">Buffering...</span>
          </div>
        </div>
      )}

      {/* Play/Pause Center Indicator on Click */}
      {!isPlaying && !isBuffering && !hasError && nextCountdown === null && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center cursor-pointer bg-black/20"
        >
          <button
            type="button"
            aria-label="Play Episode"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/95 text-white shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <Play size={28} className="ml-1 fill-current" />
          </button>
        </div>
      )}

      {/* Error Fallback Overlay */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/90 text-white text-center">
          <AlertCircle className="w-12 h-12 text-danger mb-3" />
          <h3 className="font-semibold text-lg mb-1">Playback Error</h3>
          <p className="text-sm text-text-muted max-w-md mb-4">{hasError}</p>
          <button
            type="button"
            onClick={handleRetryPlayback}
            className="px-4 py-2 rounded-md bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            Retry Playback
          </button>
        </div>
      )}

      {/* Next Episode Countdown Overlay */}
      {nextCountdown !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-sm text-white text-center z-30">
          <span className="text-xs uppercase tracking-wider text-text-muted mb-2 font-semibold">
            Up Next
          </span>
          <h3 className="font-display font-bold text-xl sm:text-2xl mb-1">
            Episode {currentEpisode + 1}
          </h3>
          <p className="text-sm text-text-muted mb-4">
            Playing automatically in <span className="font-bold text-primary">{nextCountdown}s</span>
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancelNextCountdown}
              className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={goToNextEpisode}
              className="px-5 py-2 rounded-md bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text text-sm font-semibold flex items-center gap-2 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <Play size={15} className="fill-current" />
              Play Now
            </button>
          </div>
        </div>
      )}

      {/* Top Header Overlay */}
      <div
        className={`absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between text-white transition-opacity duration-300 pointer-events-auto ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-primary/90 text-[11px] font-bold tracking-wide uppercase text-white">
              EP {currentEpisode}
            </span>
            <h2 className="text-sm font-semibold truncate drop-shadow-sm">
              {dramaTitle || "Drama"}
            </h2>
          </div>
          {title && <p className="text-xs text-white/70 truncate mt-0.5">{title}</p>}
        </div>

        {/* Aspect Ratio & Auto-Next Quick Toggles */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            title={`Aspect ratio: ${aspectMode}`}
            onClick={() => {
              const next: AspectRatioMode =
                aspectMode === "fit" ? "9:16" : aspectMode === "9:16" ? "16:9" : "fit";
              handleAspectChange(next);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-xs font-medium backdrop-blur-md transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {aspectMode === "9:16" ? (
              <>
                <Smartphone size={13} />
                <span>9:16</span>
              </>
            ) : aspectMode === "16:9" ? (
              <>
                <Tv size={13} />
                <span>16:9</span>
              </>
            ) : (
              <>
                <Monitor size={13} />
                <span>Fit</span>
              </>
            )}
          </button>

          <button
            type="button"
            title="Auto-play Next Episode"
            onClick={() => setAutoPlayNext((v) => !v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              autoPlayNext
                ? "bg-primary text-white"
                : "bg-white/15 hover:bg-white/25 text-white/80"
            }`}
          >
            Auto-Next: {autoPlayNext ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Bottom Controls Overlay */}
      <div
        className={`absolute bottom-0 inset-x-0 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col gap-2.5 text-white transition-opacity duration-300 pointer-events-auto ${
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrub Bar Container */}
        <div
          ref={scrubBarRef}
          role="slider"
          aria-label="Seek time slider"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              seekRelative(-5);
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              seekRelative(5);
            }
          }}
          onMouseMove={handleScrubMove}
          onMouseEnter={() => setIsScrubbing(true)}
          onMouseLeave={() => {
            setIsScrubbing(false);
            setHoverTime(null);
          }}
          onClick={handleScrubClick}
          className="relative h-2 hover:h-3 group/scrub bg-white/25 hover:bg-white/35 rounded-full cursor-pointer transition-all duration-150 flex items-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          {/* Hover Timestamp Preview Badge */}
          {hoverTime !== null && (
            <div
              style={{ left: `${hoverPosition}px` }}
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-white/15 text-[11px] font-mono text-white pointer-events-none shadow-md"
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Buffered track */}
          <div
            style={{ width: `${buffered}%` }}
            className="absolute left-0 top-0 bottom-0 bg-white/30 rounded-full pointer-events-none"
          />

          {/* Played track */}
          <div
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            className="absolute left-0 top-0 bottom-0 bg-primary rounded-full pointer-events-none flex items-center justify-end"
          >
            {/* Scrubber thumb handle */}
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md scale-0 group-hover/scrub:scale-100 transition-transform -mr-1.5" />
          </div>
        </div>

        {/* Action Controls Row */}
        <div className="flex items-center justify-between gap-3">
          {/* Left Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Play/Pause */}
            <button
              type="button"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {isPlaying ? (
                <Pause size={19} className="fill-current" />
              ) : (
                <Play size={19} className="fill-current" />
              )}
            </button>

            {/* Previous Episode */}
            <button
              type="button"
              aria-label="Previous Episode"
              title="Previous Episode (P)"
              disabled={currentEpisode <= 1 || !onPrevEpisode}
              onClick={goToPrevEpisode}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <SkipBack size={17} />
            </button>

            {/* Next Episode */}
            <button
              type="button"
              aria-label="Next Episode"
              title="Next Episode (N)"
              disabled={currentEpisode >= totalEpisodes || !onNextEpisode}
              onClick={goToNextEpisode}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <SkipForward size={17} />
            </button>

            {/* Seek -10s */}
            <button
              type="button"
              aria-label="Seek backward 10 seconds"
              title="Rewind 10s (Left Arrow)"
              onClick={() => seekRelative(-10)}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <RotateCcw size={17} />
            </button>

            {/* Seek +10s */}
            <button
              type="button"
              aria-label="Seek forward 10 seconds"
              title="Forward 10s (Right Arrow)"
              onClick={() => seekRelative(10)}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <RotateCw size={17} />
            </button>

            {/* Volume Control */}
            <div className="flex items-center group/vol gap-1.5 ml-1">
              <button
                type="button"
                aria-label={isMuted ? "Unmute" : "Mute"}
                onClick={toggleMute}
                className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX size={18} />
                ) : volume < 0.5 ? (
                  <Volume1 size={18} />
                ) : (
                  <Volume2 size={18} />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume slider"
                className="w-14 sm:w-20 h-1.5 accent-primary bg-white/30 rounded-lg cursor-pointer transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              />
            </div>

            {/* Timestamp Counter */}
            <div className="text-xs font-mono text-white/90 ml-1.5 hidden sm:block">
              <span>{formatTime(currentTime)}</span>
              <span className="text-white/40 mx-1">/</span>
              <span className="text-white/60">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            {/* Subtitles & Closed Captions (Task 9.2) */}
            <button
              type="button"
              title={`Subtitles (${subtitleSettings.language.toUpperCase()}) - Press C to toggle`}
              aria-label="Subtitles and Closed Captions"
              onClick={() => setIsSubtitleModalOpen(true)}
              className={`p-1.5 sm:p-2 rounded-md transition-colors flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                subtitleSettings.language !== "off"
                  ? "bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30"
                  : "hover:bg-white/15 text-white"
              }`}
            >
              <Subtitles size={17} />
              <span className="text-[10px] font-bold uppercase hidden sm:inline">
                {subtitleSettings.language !== "off" ? subtitleSettings.language : "CC"}
              </span>
            </button>

            {/* Keyboard Shortcuts Cheat-sheet Button (Task 9.3) */}
            <button
              type="button"
              title="Keyboard Shortcuts (?) - Press ? for cheat-sheet"
              aria-label="Keyboard Shortcuts"
              onClick={() => setIsKeyboardModalOpen(true)}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none hidden sm:flex items-center"
            >
              <Keyboard size={17} />
            </button>

            {/* Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="px-2 py-1 rounded-md hover:bg-white/15 text-xs font-semibold text-white tracking-wide transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 py-1.5 w-24 rounded-lg bg-black/95 border border-white/15 backdrop-blur-md shadow-2xl flex flex-col z-30">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">
                    Speed
                  </div>
                  {SPEED_OPTIONS.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => handleRateSelect(rate)}
                      className={`px-3 py-1 text-left text-xs font-medium hover:bg-primary hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                        playbackRate === rate ? "text-primary font-bold" : "text-white"
                      }`}
                    >
                      {rate === 1 ? "1.0x (Normal)" : `${rate}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Picture in Picture */}
            <button
              type="button"
              title="Picture in Picture"
              aria-label="Picture in Picture"
              onClick={togglePiP}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <PictureInPicture2 size={17} />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Subtitle & Caption Settings Modal (Task 9.2) */}
      <SubtitleSettingsModal
        isOpen={isSubtitleModalOpen}
        onClose={() => setIsSubtitleModalOpen(false)}
        settings={subtitleSettings}
        onChangeSettings={(newSettings) => {
          setSubtitleSettings(newSettings);
          saveSubtitleSettings(newSettings);
        }}
        availableTracks={effectiveTracks}
      />

      {/* Keyboard Shortcuts Cheat-sheet Modal (Task 9.3) */}
      <KeyboardShortcutsModal
        isOpen={isKeyboardModalOpen}
        onClose={() => setIsKeyboardModalOpen(false)}
      />
    </div>
  );
}
