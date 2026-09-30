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
  X,
} from "lucide-react";

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
  autoPlay = false,
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

  // UI & control states
  const [controlsVisible, setControlsVisible] = useState(true);
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>("fit");
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

  // Vertical Swipe Gesture States (Swipe Up = Next, Swipe Down = Prev)
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [swipeHint, setSwipeHint] = useState<"next" | "prev" | null>(null);

  // Restore volume preference from localStorage
  useEffect(() => {
    try {
      const savedVolume = localStorage.getItem("dramashort_player_volume");
      const savedMuted = localStorage.getItem("dramashort_player_muted");
      const savedAspect = localStorage.getItem("dramashort_player_aspect") as AspectRatioMode | null;
      if (savedVolume !== null) setVolume(parseFloat(savedVolume));
      if (savedMuted !== null) setIsMuted(savedMuted === "true");
      if (savedAspect && ["fit", "9:16", "16:9"].includes(savedAspect)) {
        setAspectMode(savedAspect);
      }
    } catch {
      // ignore in incognito/SSR
    }
  }, []);

  // Update volume on video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Video Source / HLS setup
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setHasError(null);
    setIsBuffering(true);
    setNextCountdown(null);

    // Destroy existing Hls instance if any
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = src.includes(".m3u8") || src.includes("application/x-mpegURL");

    if (isHls) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          if (initialProgressSeconds > 0) {
            video.currentTime = initialProgressSeconds;
          }
          if (autoPlay) {
            video.play().catch(() => setIsPlaying(false));
          }
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                setHasError("Playback error: unable to load HLS stream");
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS for Safari/iOS
        video.src = src;
        if (initialProgressSeconds > 0) {
          video.currentTime = initialProgressSeconds;
        }
        if (autoPlay) {
          video.play().catch(() => setIsPlaying(false));
        }
      } else {
        setHasError("Your browser does not support HLS video streaming");
      }
    } else {
      // Standard MP4 / WebM
      video.src = src;
      if (initialProgressSeconds > 0) {
        video.currentTime = initialProgressSeconds;
      }
      if (autoPlay) {
        video.play().catch(() => setIsPlaying(false));
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, autoPlay, initialProgressSeconds]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Controls auto-hide timer
  const resetControlsTimeout = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && !showSpeedMenu && !showSettingsMenu && !isScrubbing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying, showSpeedMenu, showSettingsMenu, isScrubbing]);

  const handleMouseMove = () => {
    resetControlsTimeout();
  };

  const handleMouseLeave = () => {
    if (isPlaying && !showSpeedMenu && !showSettingsMenu && !isScrubbing) {
      setControlsVisible(false);
    }
  };

  // Play / Pause toggle
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Seek relative
  const seekRelative = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, video.duration || 0));
  }, []);

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

  // Fullscreen
  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

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
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current || touchStartY.current === null || touchStartX.current === null) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - touchStartY.current;
    const deltaX = currentX - touchStartX.current;

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

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;

    if (swipeOffset < -45) {
      // Swiped UP -> Next Episode
      if (currentEpisode < totalEpisodes && onNextEpisode) {
        onNextEpisode();
      }
    } else if (swipeOffset > 45) {
      // Swiped DOWN -> Previous Episode
      if (currentEpisode > 1 && onPrevEpisode) {
        onPrevEpisode();
      }
    }

    setSwipeOffset(0);
    setSwipeHint(null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest(".group\\/scrub")
    ) {
      return;
    }
    touchStartY.current = e.clientY;
    touchStartX.current = e.clientX;
    isDragging.current = true;
  };

  const handleMouseMoveWithSwipe = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current || touchStartY.current === null || touchStartX.current === null) {
      handleMouseMove();
      return;
    }
    const deltaY = e.clientY - touchStartY.current;
    const deltaX = e.clientX - touchStartX.current;

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
    } else {
      handleMouseMove();
    }
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;

    if (swipeOffset < -45) {
      if (currentEpisode < totalEpisodes && onNextEpisode) {
        onNextEpisode();
      }
    } else if (swipeOffset > 45) {
      if (currentEpisode > 1 && onPrevEpisode) {
        onPrevEpisode();
      }
    }

    setSwipeOffset(0);
    setSwipeHint(null);
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

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          resetControlsTimeout();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          seekRelative(-10);
          resetControlsTimeout();
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          seekRelative(10);
          resetControlsTimeout();
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
          if (currentEpisode < totalEpisodes && onNextEpisode) {
            onNextEpisode();
          }
          break;
        case "p":
          e.preventDefault();
          if (currentEpisode > 1 && onPrevEpisode) {
            onPrevEpisode();
          }
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
    toggleMute,
    seekRelative,
    currentEpisode,
    totalEpisodes,
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
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = setInterval(() => {
        setNextCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            onNextEpisode();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const cancelNextCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setNextCountdown(null);
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

    let targetTime = 0;
    if (initialProgressSeconds && initialProgressSeconds > 0 && initialProgressSeconds < dur - 2) {
      targetTime = initialProgressSeconds;
    } else if (
      initialProgressRatio &&
      initialProgressRatio > 0.02 &&
      initialProgressRatio < 0.95 &&
      dur > 0
    ) {
      targetTime = dur * initialProgressRatio;
    }

    if (targetTime > 0) {
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
      setResumeNotification({
        formatted: formatTime(targetTime),
        ratio: targetTime / dur,
      });

      const timer = setTimeout(() => {
        setResumeNotification(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  };

  // Aspect Ratio Container Classes
  const aspectContainerClasses = useMemo(() => {
    switch (aspectMode) {
      case "9:16":
        return "aspect-[9/16] max-h-[82vh] max-w-[420px] mx-auto";
      case "16:9":
        return "aspect-video w-full";
      case "fit":
      default:
        return "aspect-video w-full sm:max-h-[75vh]";
    }
  }, [aspectMode]);

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
      className={`relative group select-none overflow-hidden rounded-xl bg-black shadow-2xl transition-all ${aspectContainerClasses} flex items-center justify-center`}
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
            setIsBuffering(false);
            setHasError("Error loading video stream. Please check your connection.");
          }}
        />
      </div>

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
              setResumeNotification(null);
            }}
            className="text-white/60 hover:text-white ml-0.5"
            aria-label="Dismiss resume notification"
          >
            <X size={13} />
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
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/95 text-white shadow-xl hover:scale-110 active:scale-95 transition-all duration-200"
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
            onClick={() => {
              setHasError(null);
              setIsBuffering(true);
              const video = videoRef.current;
              if (video) {
                video.load();
                video.play().catch(() => {});
              }
            }}
            className="px-4 py-2 rounded-md bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text text-sm font-semibold transition-colors"
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
              className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                cancelNextCountdown();
                onNextEpisode?.();
              }}
              className="px-5 py-2 rounded-md bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text text-sm font-semibold flex items-center gap-2 transition-colors"
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
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-xs font-medium backdrop-blur-md transition-colors"
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
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
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
          onMouseMove={handleScrubMove}
          onMouseEnter={() => setIsScrubbing(true)}
          onMouseLeave={() => {
            setIsScrubbing(false);
            setHoverTime(null);
          }}
          onClick={handleScrubClick}
          className="relative h-2 hover:h-3 group/scrub bg-white/25 hover:bg-white/35 rounded-full cursor-pointer transition-all duration-150 flex items-center"
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
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors"
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
              onClick={onPrevEpisode}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <SkipBack size={17} />
            </button>

            {/* Next Episode */}
            <button
              type="button"
              aria-label="Next Episode"
              title="Next Episode (N)"
              disabled={currentEpisode >= totalEpisodes || !onNextEpisode}
              onClick={onNextEpisode}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <SkipForward size={17} />
            </button>

            {/* Seek -10s */}
            <button
              type="button"
              aria-label="Seek backward 10 seconds"
              title="Rewind 10s (Left Arrow)"
              onClick={() => seekRelative(-10)}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors"
            >
              <RotateCcw size={17} />
            </button>

            {/* Seek +10s */}
            <button
              type="button"
              aria-label="Seek forward 10 seconds"
              title="Forward 10s (Right Arrow)"
              onClick={() => seekRelative(10)}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors"
            >
              <RotateCw size={17} />
            </button>

            {/* Volume Control */}
            <div className="flex items-center group/vol gap-1.5 ml-1">
              <button
                type="button"
                aria-label={isMuted ? "Unmute" : "Mute"}
                onClick={toggleMute}
                className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors"
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
                className="w-14 sm:w-20 h-1.5 accent-primary bg-white/30 rounded-lg cursor-pointer transition-all"
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
            {/* Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu((v) => !v)}
                className="px-2 py-1 rounded-md hover:bg-white/15 text-xs font-semibold text-white tracking-wide transition-colors"
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
                      className={`px-3 py-1 text-left text-xs font-medium hover:bg-primary hover:text-white transition-colors ${
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
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors"
            >
              <PictureInPicture2 size={17} />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-md hover:bg-white/15 text-white transition-colors"
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
