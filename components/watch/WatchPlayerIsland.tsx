"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Flag, Film, Tv, Star, Eye, Coins, Lock } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import EpisodeSheet from "@/components/player/EpisodeSheet";
import WatchOverlay from "@/components/player/WatchOverlay";
import GuestEngagementModal from "@/components/engagement/GuestEngagementModal";
import EpisodeUnlockModal, { AUTO_UNLOCK_STORAGE_KEY } from "@/components/player/EpisodeUnlockModal";
import DailyCheckInModal from "@/components/rewards/DailyCheckInModal";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import SubtitleSettingsModal from "@/components/player/SubtitleSettingsModal";
import { loadSubtitleSettings, saveSubtitleSettings, type SubtitleSettings } from "@/types/subtitles";
import {
  type GuestEngagementTrigger,
  isGuestPromptDismissed,
} from "@/lib/analytics/guest-engagement";
import type { Title, Episode, PlaybackSource } from "@/types/content";
import type { WalletInfo } from "@/types/wallet";
import { getEpisodePlayback } from "@/lib/services/content.service";
import { getClientWallet, unlockEpisodeClient } from "@/lib/services/wallet.service";
import { useAuth } from "@/contexts/AuthContext";
import {
  getWatchProgress,
  getGuestWatchProgress,
  upsertWatchProgress,
  saveGuestWatchProgress,
} from "@/lib/services/user.service";
import {
  toggleFullscreen,
  addFullscreenChangeListener,
} from "@/lib/player/fullscreen-capabilities";
import {
  preloadEpisodePlayback,
  getPreloadedEpisodePlayback,
} from "@/lib/player/episode-preloader";
import {
  trackPlaybackStart,
  trackPlaybackProgress,
  trackPlaybackComplete,
  trackPlaybackSkip,
  trackEpisodeUnlock,
  trackPaywallView,
  flushEvents,
} from "@/lib/analytics/track";

const EPISODES_PER_TAB = 40;

export interface WatchPlayerIslandProps {
  drama: Title;
  initialEpisodes: Episode[];
  initialEpisode?: number;
}

export default function WatchPlayerIsland({
  drama,
  initialEpisodes,
  initialEpisode: serverInitialEpisode,
}: WatchPlayerIslandProps) {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const initialEpParam = searchParams ? searchParams.get("ep") : null;

  const resolvedInitialEp = useMemo(() => {
    if (initialEpParam) {
      const parsed = parseInt(initialEpParam, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    if (serverInitialEpisode && serverInitialEpisode > 0) {
      return serverInitialEpisode;
    }
    return 1;
  }, [initialEpParam, serverInitialEpisode]);

  const totalEps = drama.totalEpisodes || 1;
  const maxTab = Math.max(0, Math.ceil(totalEps / EPISODES_PER_TAB) - 1);

  const [dbEpisodes, setDbEpisodes] = useState<Episode[]>(initialEpisodes);
  const [currentEpisode, setCurrentEpisode] = useState<number>(resolvedInitialEp);
  const [savedProgressRatio, setSavedProgressRatio] = useState<number | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<number>(() => {
    const computedTab = Math.floor((Math.max(1, resolvedInitialEp) - 1) / EPISODES_PER_TAB);
    return Math.min(maxTab, computedTab);
  });
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dramashort_player_autonext");
        if (saved !== null) return saved === "true";
      } catch {}
    }
    return true; // Auto-next enabled by default (Task 14.4)
  });
  const [isMutedState, setIsMutedState] = useState<boolean>(() => {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem("dramashort_session_unmuted") !== "true";
    }
    return true;
  });
  const [showUnmutePillState, setShowUnmutePillState] = useState<boolean>(() => {
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem("dramashort_session_unmuted") !== "true";
    }
    return true;
  });

  const handleToggleMute = useCallback(() => {
    const vid = document.querySelector("video");
    setIsMutedState((prev) => {
      const nextMuted = !prev;
      if (vid) {
        vid.muted = nextMuted;
      }
      if (!nextMuted) {
        setShowUnmutePillState(false);
        try {
          sessionStorage.setItem("dramashort_session_unmuted", "true");
        } catch {}
      }
      return nextMuted;
    });
  }, []);

  const lastRecordedSecondRef = useRef<number>(-1);
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [currentTimeState, setCurrentTimeState] = useState(0);
  const [durationState, setDurationState] = useState(0);
  const [isEpisodeSheetOpen, setIsEpisodeSheetOpen] = useState(false);
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [guestPromptTrigger, setGuestPromptTrigger] = useState<GuestEngagementTrigger>("episode_3");

  // Phase 8: Wallet & Paywall states
  const [userWallet, setUserWallet] = useState<WalletInfo | null>(null);
  const [unlockedEpisodeNumbers, setUnlockedEpisodeNumbers] = useState<Set<number>>(new Set());
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isDailyCheckInModalOpen, setIsDailyCheckInModalOpen] = useState(false);
  const [isLoginRequiredModalOpen, setIsLoginRequiredModalOpen] = useState(false);
  const [isSubtitleModalOpen, setIsSubtitleModalOpen] = useState(false);
  const [subtitleSettings, setSubtitleSettings] = useState<SubtitleSettings>(() => {
    return loadSubtitleSettings();
  });
  const [pendingLockedEpisode, setPendingLockedEpisode] = useState<number | null>(null);
  const [autoUnlockToast, setAutoUnlockToast] = useState<string | null>(null);

  const refreshUserWallet = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getClientWallet(drama.id);
      if (res?.wallet) {
        setUserWallet(res.wallet);
      }
    } catch {}
  }, [user, drama.id]);

  // Fetch user wallet and unlocked episodes for this drama
  useEffect(() => {
    if (!user) {
      setUserWallet(null);
      setUnlockedEpisodeNumbers(new Set());
      return;
    }

    let isMounted = true;
    getClientWallet(drama.id).then((res) => {
      if (!isMounted || !res) return;
      if (res.wallet) setUserWallet(res.wallet);
      if (res.unlockedEpisodes && res.unlockedEpisodes.length > 0) {
        setUnlockedEpisodeNumbers(new Set(res.unlockedEpisodes));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user, drama.id]);

  const freeLimit = drama.freeEpisodesCount ?? 5;
  const remainingLockedCount = useMemo(() => {
    return dbEpisodes.filter((ep) => {
      const isFree = ep.isFree ?? (ep.episodeNumber <= freeLimit);
      const isUnlocked = Boolean(userWallet?.isVip || unlockedEpisodeNumbers.has(ep.episodeNumber));
      return !isFree && !isUnlocked;
    }).length;
  }, [dbEpisodes, freeLimit, userWallet?.isVip, unlockedEpisodeNumbers]);

  // Synchronize when initialEpisodes changes
  useEffect(() => {
    if (initialEpisodes && initialEpisodes.length > 0) {
      setDbEpisodes(initialEpisodes);
    }
  }, [initialEpisodes]);

  // Latest progress ref for background beacons and unmount flush
  const currentProgressRef = useRef<{
    episode: number;
    progressRatio: number;
    positionSeconds: number;
    durationSeconds: number;
  }>({
    episode: currentEpisode,
    progressRatio: 0,
    positionSeconds: 0,
    durationSeconds: 0,
  });

  // Analytics milestone tracker ref (Task 15.2)
  const milestoneTrackerRef = useRef<{
    hasStarted: boolean;
    has25: boolean;
    has50: boolean;
    has75: boolean;
    hasCompleted: boolean;
  }>({
    hasStarted: false,
    has25: false,
    has50: false,
    has75: false,
    hasCompleted: false,
  });

  useEffect(() => {
    currentProgressRef.current.episode = currentEpisode;
  }, [currentEpisode]);

  // Load saved watch position and resume point for this drama
  useEffect(() => {
    let isMounted = true;

    async function loadResumePoint() {
      const targetSlug = drama.slug;
      let match = null;
      if (user) {
        match = await getWatchProgress(user.id, targetSlug);
      } else {
        match = getGuestWatchProgress(targetSlug);
      }

      if (!isMounted) return;

      if (match) {
        // If an explicit ?ep= query parameter was not passed, use the last watched episode
        if (!initialEpParam && match.episode_number > 0) {
          setCurrentEpisode(match.episode_number);
          setActiveTab(Math.min(maxTab, Math.floor((match.episode_number - 1) / EPISODES_PER_TAB)));
        }

        // Offer resume position if current episode matches saved progress and is between 2% and 95%
        const epToCheck = initialEpParam ? parseInt(initialEpParam, 10) : match.episode_number;
        const progressRatio =
          match.duration_seconds && match.duration_seconds > 0
            ? (match.position_seconds || 0) / match.duration_seconds
            : match.progress;

        if (epToCheck === match.episode_number && progressRatio > 0.02 && progressRatio < 0.95) {
          setSavedProgressRatio(progressRatio);
        }
      } else if (initialEpParam) {
        const ep = parseInt(initialEpParam, 10);
        if (!isNaN(ep) && ep > 0) {
          setCurrentEpisode(ep);
          setActiveTab(Math.min(maxTab, Math.floor((ep - 1) / EPISODES_PER_TAB)));
        }
      }
    }

    loadResumePoint();

    return () => {
      isMounted = false;
    };
  }, [user, drama.slug, initialEpParam, maxTab]);

  const recordProgress = useCallback(
    (
      epNum: number,
      progressRatio: number,
      positionSec = 0,
      durationSec = 0,
      keepalive = false
    ) => {
      const targetSlug = drama.slug;
      if (user) {
        if (keepalive && typeof window !== "undefined") {
          try {
            fetch("/api/progress", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                titleSlug: targetSlug,
                episodeNumber: epNum,
                progress: progressRatio,
                positionSeconds: positionSec,
                durationSeconds: durationSec,
              }),
              keepalive: true,
            }).catch(() => {});
          } catch {
            // Ignore beacon errors during unload
          }
        } else {
          upsertWatchProgress(
            user.id,
            targetSlug,
            epNum,
            progressRatio,
            positionSec,
            durationSec
          );
        }
      } else {
        saveGuestWatchProgress(
          targetSlug,
          epNum,
          progressRatio,
          positionSec,
          durationSec
        );
      }
    },
    [user, drama.slug]
  );

  const proceedToSelectEpisode = useCallback(
    (ep: number) => {
      // Task 15.2: Track skip if current episode was started but not finished
      if (
        milestoneTrackerRef.current.hasStarted &&
        !milestoneTrackerRef.current.hasCompleted &&
        currentProgressRef.current.progressRatio < 0.95
      ) {
        trackPlaybackSkip({
          titleSlug: drama.slug,
          episodeNumber: currentProgressRef.current.episode,
          positionSeconds: currentProgressRef.current.positionSeconds,
          durationSeconds: currentProgressRef.current.durationSeconds,
        });
      }

      // Reset milestone tracking for new episode
      milestoneTrackerRef.current = {
        hasStarted: false,
        has25: false,
        has50: false,
        has75: false,
        hasCompleted: false,
      };

      setCurrentEpisode(ep);
      setActiveTab(Math.min(maxTab, Math.floor((Math.max(1, ep) - 1) / EPISODES_PER_TAB)));
      setAutoPlayNext(true);
      setSavedProgressRatio(undefined);
      setIsEpisodeSheetOpen(false);
      setIsPlayingState(true);

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("ep", ep.toString());
        window.history.replaceState(null, "", url.toString());
      }

      currentProgressRef.current = {
        episode: ep,
        progressRatio: 0,
        positionSeconds: 0,
        durationSeconds: 0,
      };
      recordProgress(ep, 0, 0, 0);
    },
    [maxTab, recordProgress, drama.slug]
  );

  const handleSelectEpisode = useCallback(
    async (ep: number) => {
      const targetEpData = dbEpisodes.find((e) => e.episodeNumber === ep);
      const freeThreshold = drama.freeEpisodesCount ?? 5;
      const isFree = targetEpData?.isFree ?? (ep <= freeThreshold);
      const isUnlocked = Boolean(userWallet?.isVip || unlockedEpisodeNumbers.has(ep));

      if (!isFree && !isUnlocked) {
        if (!user) {
          setPendingLockedEpisode(ep);
          setIsLoginRequiredModalOpen(true);
          return;
        }

        const autoUnlock =
          typeof window !== "undefined" &&
          localStorage.getItem(AUTO_UNLOCK_STORAGE_KEY) === "true";

        if (autoUnlock && targetEpData?.id && (userWallet?.balance ?? 0) >= 10) {
          const res = await unlockEpisodeClient({
            dramaId: drama.id,
            dramaSlug: drama.slug,
            episodeId: targetEpData.id,
            episodeNumber: ep,
            cost: 10,
          });

          if (res.success) {
            setUserWallet((prev) => (prev ? { ...prev, balance: res.newBalance } : null));
            setUnlockedEpisodeNumbers((prev) => new Set([...prev, ep]));
            setAutoUnlockToast(`Episode ${ep} auto-unlocked (-10 coins)`);
            setTimeout(() => setAutoUnlockToast(null), 3000);

            trackEpisodeUnlock({
              titleSlug: drama.slug,
              episodeNumber: ep,
              coinsSpent: res.coinsSpent,
              isBundle: false,
              episodesCount: 1,
              isVip: res.isVipUnlock,
            });

            proceedToSelectEpisode(ep);
            return;
          }
        }

        setPendingLockedEpisode(ep);
        setIsUnlockModalOpen(true);
        return;
      }

      proceedToSelectEpisode(ep);
    },
    [dbEpisodes, drama.id, drama.slug, drama.freeEpisodesCount, userWallet, unlockedEpisodeNumbers, user, proceedToSelectEpisode]
  );

  const handleTimeUpdate = useCallback(
    (currentTime: number, duration: number, progressRatio: number) => {
      const positionSec = Math.floor(currentTime);
      const durationSec = Math.floor(duration);

      setCurrentTimeState(currentTime);
      setDurationState(duration);
      setIsPlayingState(true);

      currentProgressRef.current = {
        episode: currentEpisode,
        progressRatio,
        positionSeconds: positionSec,
        durationSeconds: durationSec,
      };

      // Task 15.2: Track playback milestones
      if (durationSec > 0) {
        if (!milestoneTrackerRef.current.hasStarted && currentTime > 0.1) {
          milestoneTrackerRef.current.hasStarted = true;
          trackPlaybackStart({
            titleSlug: drama.slug,
            episodeNumber: currentEpisode,
            durationSeconds: durationSec,
          });
        }
        if (!milestoneTrackerRef.current.has25 && progressRatio >= 0.25) {
          milestoneTrackerRef.current.has25 = true;
          trackPlaybackProgress({
            titleSlug: drama.slug,
            episodeNumber: currentEpisode,
            milestone: 25,
            positionSeconds: positionSec,
            durationSeconds: durationSec,
          });
        }
        if (!milestoneTrackerRef.current.has50 && progressRatio >= 0.50) {
          milestoneTrackerRef.current.has50 = true;
          trackPlaybackProgress({
            titleSlug: drama.slug,
            episodeNumber: currentEpisode,
            milestone: 50,
            positionSeconds: positionSec,
            durationSeconds: durationSec,
          });
        }
        if (!milestoneTrackerRef.current.has75 && progressRatio >= 0.75) {
          milestoneTrackerRef.current.has75 = true;
          trackPlaybackProgress({
            titleSlug: drama.slug,
            episodeNumber: currentEpisode,
            milestone: 75,
            positionSeconds: positionSec,
            durationSeconds: durationSec,
          });
        }
      }

      if (
        positionSec > 0 &&
        positionSec % 10 === 0 &&
        positionSec !== lastRecordedSecondRef.current &&
        durationSec > 0
      ) {
        lastRecordedSecondRef.current = positionSec;
        recordProgress(currentEpisode, progressRatio, positionSec, durationSec);
      }

      // Task 14.4: Preload next episode at 80% progress threshold
      if (progressRatio >= 0.8 && currentEpisode < totalEps) {
        const nextEp = dbEpisodes.find((e) => e.episodeNumber === currentEpisode + 1);
        if (nextEp?.id) {
          preloadEpisodePlayback(nextEp.id).catch(() => {});
        }
      }
    },
    [currentEpisode, totalEps, dbEpisodes, recordProgress, drama.slug]
  );

  const handlePause = useCallback(
    (currentTime: number, duration: number, progressRatio: number) => {
      const positionSec = Math.floor(currentTime);
      const durationSec = Math.floor(duration);

      setCurrentTimeState(currentTime);
      setDurationState(duration);
      setIsPlayingState(false);

      currentProgressRef.current = {
        episode: currentEpisode,
        progressRatio,
        positionSeconds: positionSec,
        durationSeconds: durationSec,
      };
      if (durationSec > 0) {
        recordProgress(currentEpisode, progressRatio, positionSec, durationSec);
      }
    },
    [currentEpisode, recordProgress]
  );

  const handleVideoEnded = useCallback(() => {
    const dur = currentProgressRef.current.durationSeconds || 0;
    setIsPlayingState(false);
    currentProgressRef.current = {
      episode: currentEpisode,
      progressRatio: 1.0,
      positionSeconds: dur,
      durationSeconds: dur,
    };
    recordProgress(currentEpisode, 1.0, dur, dur);

    // Task 15.2: Track playback complete
    if (!milestoneTrackerRef.current.hasCompleted) {
      milestoneTrackerRef.current.hasCompleted = true;
      trackPlaybackComplete({
        titleSlug: drama.slug,
        episodeNumber: currentEpisode,
        durationSeconds: dur,
      });
    }

    // Soft engagement prompt (Task 14.8): Trigger when guest finishes Episode 3
    if (!user && currentEpisode === 3 && !isGuestPromptDismissed("episode_3")) {
      setGuestPromptTrigger("episode_3");
      setGuestPromptOpen(true);
      return;
    }

    // Auto-advance to next episode (Task 14.4)
    if (autoPlayNext && currentEpisode < totalEps) {
      handleSelectEpisode(currentEpisode + 1);
    }
  }, [currentEpisode, totalEps, autoPlayNext, user, recordProgress, handleSelectEpisode, drama.slug]);

  const handleCloseGuestPrompt = useCallback(() => {
    setGuestPromptOpen(false);
    if (guestPromptTrigger === "episode_3" && autoPlayNext && currentEpisode < totalEps) {
      handleSelectEpisode(currentEpisode + 1);
    }
  }, [guestPromptTrigger, autoPlayNext, currentEpisode, totalEps, handleSelectEpisode]);

  const handleTogglePlay = useCallback(() => {
    const vid = document.querySelector("video");
    if (!vid) return;
    if (vid.paused) {
      if (vid.ended) vid.currentTime = 0;
      vid.play().catch(() => {});
      setIsPlayingState(true);
    } else {
      vid.pause();
      setIsPlayingState(false);
    }
  }, []);

  const [isFullscreenState, setIsFullscreenState] = useState(false);

  useEffect(() => {
    const vid = document.querySelector("video");
    const cleanup = addFullscreenChangeListener(vid, (fs) => {
      setIsFullscreenState(fs);
    });
    return cleanup;
  }, [currentEpisode]);

  // Reliable progress flush on visibilitychange, pagehide, and beforeunload
  useEffect(() => {
    const flushCurrentProgress = () => {
      const { episode, progressRatio, positionSeconds, durationSeconds } =
        currentProgressRef.current;
      if (progressRatio > 0 && progressRatio < 1.0) {
        recordProgress(
          episode,
          progressRatio,
          positionSeconds,
          durationSeconds,
          true
        );
      }
      // Task 15.2: Flush client analytics queue on background / page exit
      flushEvents({ sync: true }).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushCurrentProgress();
      }
    };

    const handlePageHide = () => {
      flushCurrentProgress();
    };

    const handleBeforeUnload = () => {
      flushCurrentProgress();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      flushCurrentProgress();
    };
  }, [recordProgress]);

  const currentEpData = dbEpisodes.find((e) => e.episodeNumber === currentEpisode);

  const [playbackSource, setPlaybackSource] = useState<PlaybackSource | null>(null);
  const [playbackLoading, setPlaybackLoading] = useState<boolean>(() => {
    return Boolean(currentEpData?.id && !currentEpData?.videoUrl);
  });
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const handleRetryPlayback = useCallback(() => {
    setPlaybackError(null);
    setPlaybackLoading(true);
    setRetryNonce((n) => n + 1);
  }, []);

  // Fetch secure server-gated playback session whenever the active episode changes or retry is triggered
  useEffect(() => {
    if (!currentEpData?.id) {
      setPlaybackSource(null);
      setPlaybackError(null);
      setPlaybackLoading(false);
      return;
    }

    // Synchronous check of preloaded cache (Task 14.4)
    if (retryNonce === 0) {
      const preloaded = getPreloadedEpisodePlayback(currentEpData.id);
      if (preloaded) {
        setPlaybackSource(preloaded);
        setPlaybackError(null);
        setPlaybackLoading(false);
        return;
      }
    }

    let isMounted = true;
    setPlaybackLoading(true);
    setPlaybackError(null);

    getEpisodePlayback(currentEpData.id).then((res) => {
      if (!isMounted) return;
      setPlaybackLoading(false);
      if (res.success && res.data) {
        setPlaybackSource(res.data);
      } else {
        const isPaywallError =
          res.error?.includes("PAYMENT_REQUIRED") ||
          res.error?.includes("requires 10 coins") ||
          res.error?.includes("unlock this episode");

        if (isPaywallError) {
          if (!user) {
            setPendingLockedEpisode(currentEpisode);
            setIsLoginRequiredModalOpen(true);
          } else {
            setPendingLockedEpisode(currentEpisode);
            setIsUnlockModalOpen(true);
          }
        } else {
          setPlaybackError(res.error || "Failed to load video stream.");
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [currentEpData?.id, retryNonce, user, currentEpisode]);

  const handleModalUnlocked = useCallback(
    (newBalance: number, isBundle?: boolean) => {
      setUserWallet((prev) => (prev ? { ...prev, balance: newBalance } : null));
      if (isBundle) {
        setUnlockedEpisodeNumbers(
          new Set(Array.from({ length: totalEps }, (_, i) => i + 1))
        );
      } else {
        const epToUnlock = pendingLockedEpisode || currentEpisode;
        setUnlockedEpisodeNumbers((prev) => new Set([...prev, epToUnlock]));
      }
      setIsUnlockModalOpen(false);

      if (pendingLockedEpisode && pendingLockedEpisode !== currentEpisode) {
        proceedToSelectEpisode(pendingLockedEpisode);
      } else {
        handleRetryPlayback();
      }
    },
    [pendingLockedEpisode, currentEpisode, totalEps, proceedToSelectEpisode, handleRetryPlayback]
  );

  const handleToggleFullscreen = useCallback(() => {
    const vid = document.querySelector("video");
    const container = vid?.parentElement;
    toggleFullscreen(container as HTMLElement, vid, {
      aspectMode: playbackSource?.aspectRatio || "9:16",
    });
  }, [playbackSource?.aspectRatio]);

  const videoSrc =
    playbackSource?.url && playbackSource.url.trim() !== ""
      ? playbackSource.url
      : currentEpData?.videoUrl && currentEpData.videoUrl.trim() !== ""
      ? currentEpData.videoUrl
      : "";

  const availableEpisodesCount = dbEpisodes.filter(
    (e) => Boolean((e.videoUrl && e.videoUrl.trim() !== "") || e.id)
  ).length;

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

  const nextEpData = dbEpisodes.find((e) => e.episodeNumber === currentEpisode + 1);
  const nextPoster = nextEpData?.thumbnailUrl || (currentEpisode < totalEps ? drama.poster : undefined);

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start w-full h-[100dvh] md:h-auto">
      {/* Next Episode Poster Preloading Hint */}
      {nextPoster && (
        <link rel="preload" as="image" href={nextPoster} key={`preload-poster-${currentEpisode + 1}`} />
      )}

      {/* Main Video Streaming Player */}
      <div className="flex-1 w-full min-w-0 h-[100dvh] md:h-auto relative flex flex-col justify-center">
        {playbackError && (
          <div
            role="alert"
            className="mb-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs sm:text-sm font-medium flex items-center justify-between"
          >
            <span>{playbackError}</span>
          </div>
        )}
        {videoSrc ? (
          <div className="relative w-full h-full md:h-auto flex items-center justify-center touch-none overscroll-contain">
            <VideoPlayer
              key={`${drama.slug}-${currentEpisode}`}
              src={videoSrc}
              poster={drama.poster}
              title={currentEpData?.title || `Episode ${currentEpisode}`}
              dramaTitle={drama.title}
              currentEpisode={currentEpisode}
              totalEpisodes={totalEps}
              initialProgressRatio={savedProgressRatio}
              autoPlay={autoPlayNext}
              aspectRatio={playbackSource?.aspectRatio || "9:16"}
              isMobileFullViewport={true}
              onTimeUpdate={handleTimeUpdate}
              onPause={handlePause}
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
            {/* Mobile Watch Overlay (< md) */}
            <div className="block md:hidden">
              <WatchOverlay
                drama={{ slug: drama.slug, title: drama.title, poster: drama.poster }}
                currentEpisode={currentEpisode}
                totalEpisodes={totalEps}
                isPlaying={isPlayingState}
                isBuffering={playbackLoading}
                currentTime={currentTimeState}
                duration={durationState}
                onTogglePlay={handleTogglePlay}
                onOpenEpisodes={() => setIsEpisodeSheetOpen(true)}
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
                onSeek={(ratio) => {
                  const vid = document.querySelector("video");
                  if (vid && Number.isFinite(vid.duration)) {
                    vid.currentTime = ratio * vid.duration;
                  }
                }}
                onSeekRelative={(seconds) => {
                  const vid = document.querySelector("video");
                  if (vid && Number.isFinite(vid.duration)) {
                    vid.currentTime = Math.max(0, Math.min(vid.currentTime + seconds, vid.duration));
                  }
                }}
                onSetPlaybackRate={(rate) => {
                  const vid = document.querySelector("video");
                  if (vid) {
                    vid.playbackRate = rate;
                  }
                }}
                onToggleFullscreen={handleToggleFullscreen}
                isFullscreen={isFullscreenState}
                isMuted={isMutedState}
                onToggleMute={handleToggleMute}
                showUnmutePill={showUnmutePillState}
                onOpenSubtitles={() => setIsSubtitleModalOpen(true)}
                onGuestPromptTrigger={(trigger) => {
                  if (!user && !isGuestPromptDismissed(trigger)) {
                    setGuestPromptTrigger(trigger);
                    setGuestPromptOpen(true);
                  }
                }}
              />
            </div>
          </div>
        ) : playbackLoading || (currentEpData?.id && !playbackError) ? (
          <div className="w-full aspect-video rounded-xl bg-surface border border-border flex flex-col items-center justify-center text-center p-6 text-text animate-pulse">
            <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mb-3" />
            <p className="text-xs text-text-muted">Loading video stream...</p>
          </div>
        ) : playbackError ? (
          <div className="w-full aspect-video rounded-xl bg-surface border border-border flex flex-col items-center justify-center text-center p-6 text-text">
            <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-3">
              <Film size={24} />
            </div>
            <h3 className="font-semibold text-base mb-1">
              Unable to load episode stream
            </h3>
            <p className="text-xs text-text-muted max-w-sm mb-4">
              {playbackError}
            </p>
            <button
              type="button"
              onClick={handleRetryPlayback}
              className="px-4 py-2 text-xs font-semibold rounded-full bg-btn-primary text-btn-primary-text hover:bg-btn-primary-hover transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="w-full aspect-video rounded-xl bg-surface border border-border flex flex-col items-center justify-center text-center p-6 text-text">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Film size={24} />
            </div>
            <h3 className="font-semibold text-base mb-1">
              This episode isn&apos;t available yet
            </h3>
            <p className="text-xs text-text-muted max-w-sm">
              We&apos;re preparing the media for Episode {currentEpisode}. Please check back soon or select another episode.
            </p>
          </div>
        )}

        {/* Video Meta Info */}
        <div className="hidden md:block mt-4 p-4 rounded-xl bg-surface border border-border shadow-sm">
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
                href={`/contact?category=playback&title=${encodeURIComponent(
                  drama.slug
                )}&ep=${currentEpisode}&titleName=${encodeURIComponent(drama.title)}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-danger px-3 py-1.5 rounded-md border border-border bg-bg hover:border-danger/30 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
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
      <aside className="hidden md:block w-full lg:w-80 shrink-0">
        <div className="bg-surface border border-border rounded-xl shadow-sm p-4 sticky top-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display font-bold text-base text-text">Episodes</h2>
            <span className="text-xs font-medium text-text-muted">
              {totalEps} episodes &middot; {availableEpisodesCount} available
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
                    className={`flex-1 min-w-[54px] rounded-md py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
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
              const epData = dbEpisodes.find((e) => e.episodeNumber === ep);
              const isAvailable = Boolean(
                (epData?.videoUrl && epData.videoUrl.trim() !== "") || epData?.id
              );

              if (!isAvailable) {
                return (
                  <div
                    key={ep}
                    title="Coming soon"
                    aria-disabled="true"
                    aria-label={`Episode ${ep}, coming soon`}
                    className="aspect-square rounded-lg text-xs font-bold flex flex-col items-center justify-center bg-bg/50 border border-border/40 text-text-muted/40 cursor-not-allowed select-none"
                  >
                    <span>{ep}</span>
                    <span className="text-[9px] uppercase tracking-wider font-medium text-text-muted/50 mt-0.5">Soon</span>
                  </div>
                );
              }

              const isUnlocked = Boolean(userWallet?.isVip || unlockedEpisodeNumbers.has(ep));
              const isFree = epData?.isFree ?? (ep <= freeLimit);
              const isLocked = isAvailable && !isFree && !isUnlocked;

              return (
                <button
                  key={ep}
                  type="button"
                  onClick={() => handleSelectEpisode(ep)}
                  aria-current={active}
                  aria-label={
                    active
                      ? `Episode ${ep}, currently playing`
                      : isLocked
                      ? `Episode ${ep}, locked`
                      : `Episode ${ep}`
                  }
                  className={`relative aspect-square rounded-lg text-xs font-bold transition-all duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                    active
                      ? "bg-btn-primary text-btn-primary-text ring-2 ring-primary ring-offset-2 ring-offset-bg shadow-md scale-105"
                      : "bg-bg border border-border text-text-muted hover:text-text hover:border-primary/50 hover:bg-surface-elevated"
                  }`}
                >
                  <span>{ep}</span>
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
      </aside>

      {/* Mobile Episode Picker Bottom Sheet */}
      <EpisodeSheet
        isOpen={isEpisodeSheetOpen}
        onClose={() => setIsEpisodeSheetOpen(false)}
        currentEpisode={currentEpisode}
        totalEpisodes={totalEps}
        episodes={dbEpisodes}
        onSelectEpisode={handleSelectEpisode}
        dramaTitle={drama.title}
        unlockedEpisodeNumbers={unlockedEpisodeNumbers}
        freeEpisodesCount={freeLimit}
        isVip={Boolean(userWallet?.isVip)}
        onSelectLockedEpisode={handleSelectEpisode}
      />

      {/* Auto-Unlock Notification Toast */}
      {autoUnlockToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-amber-500 text-black font-bold text-xs shadow-xl flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom duration-200"
        >
          <Coins size={14} />
          <span>{autoUnlockToast}</span>
        </div>
      )}

      {/* Episode Coin Unlock Modal (Task 8.3) */}
      {(() => {
        const epForModal = pendingLockedEpisode
          ? dbEpisodes.find((e) => e.episodeNumber === pendingLockedEpisode) || {
              id: `ep-${pendingLockedEpisode}`,
              episodeNumber: pendingLockedEpisode,
              title: `Episode ${pendingLockedEpisode}`,
            }
          : currentEpData || {
              id: `ep-${currentEpisode}`,
              episodeNumber: currentEpisode,
              title: `Episode ${currentEpisode}`,
            };

        return (
          <EpisodeUnlockModal
            open={isUnlockModalOpen}
            onClose={() => setIsUnlockModalOpen(false)}
            drama={{
              id: drama.id,
              slug: drama.slug,
              title: drama.title,
              poster: drama.poster,
            }}
            episode={{
              id: epForModal.id,
              episodeNumber: epForModal.episodeNumber,
              title: epForModal.title,
            }}
            remainingLockedCount={remainingLockedCount}
            userBalance={userWallet?.balance ?? 0}
            isVip={Boolean(userWallet?.isVip)}
            onUnlocked={handleModalUnlocked}
            onOpenCheckIn={() => setIsDailyCheckInModalOpen(true)}
          />
        );
      })()}

      {/* Daily Check-In & Streak Rewards Modal (Task 8.4) */}
      <DailyCheckInModal
        open={isDailyCheckInModalOpen}
        onClose={() => {
          setIsDailyCheckInModalOpen(false);
          refreshUserWallet();
        }}
        onBalanceUpdated={(newBalance) => {
          setUserWallet((prev) => (prev ? { ...prev, balance: newBalance } : null));
        }}
      />

      {/* Guest Login Required Modal (Task 8.3) */}
      <LoginRequiredModal
        open={isLoginRequiredModalOpen}
        onClose={() => setIsLoginRequiredModalOpen(false)}
        message={`Sign in or create an account to unlock Episode ${
          pendingLockedEpisode || currentEpisode
        } of ${drama.title}.`}
      />

      {/* Guest Soft Engagement Modal (Task 14.8) */}
      <GuestEngagementModal
        open={guestPromptOpen}
        onClose={handleCloseGuestPrompt}
        trigger={guestPromptTrigger}
        dramaTitle={drama.title}
        dramaSlug={drama.slug}
        episodeNumber={currentEpisode}
        returnUrl={`/watch/${drama.slug}?ep=${currentEpisode}`}
      />

      {/* Subtitle & Caption Settings Modal (Task 9.2) */}
      <SubtitleSettingsModal
        isOpen={isSubtitleModalOpen}
        onClose={() => setIsSubtitleModalOpen(false)}
        settings={subtitleSettings}
        onChangeSettings={(newSettings) => {
          setSubtitleSettings(newSettings);
          saveSubtitleSettings(newSettings);
        }}
      />
    </div>
  );
}

export { WatchPlayerIsland };
