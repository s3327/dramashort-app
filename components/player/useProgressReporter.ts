"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RESUME_NOTIFICATION_DURATION_MS } from "@/lib/player/streaming-robustness";
import {
  trackPlaybackStart,
  trackPlaybackProgress,
  trackPlaybackComplete,
} from "@/lib/analytics/track";

export interface UseProgressReporterOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  initialProgressSeconds?: number;
  initialProgressRatio?: number;
  onTimeUpdate?: (currentTime: number, duration: number, progressRatio: number) => void;
  onPause?: (currentTime: number, duration: number, progressRatio: number) => void;
  onEnded?: () => void;
  /**
   * Optional analytics tracking configuration (Task 15.2)
   */
  tracking?: {
    titleSlug: string;
    episodeNumber: number;
    enabled?: boolean;
  };
}

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

export function useProgressReporter({
  videoRef,
  initialProgressSeconds = 0,
  initialProgressRatio,
  onTimeUpdate,
  onPause,
  onEnded,
  tracking,
}: UseProgressReporterOptions) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [resumeNotification, setResumeNotification] = useState<{
    formatted: string;
    ratio: number;
  } | null>(null);

  const hasAppliedInitialProgressRef = useRef<boolean>(false);
  const resumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    milestoneTrackerRef.current = {
      hasStarted: false,
      has25: false,
      has50: false,
      has75: false,
      hasCompleted: false,
    };
  }, [tracking?.titleSlug, tracking?.episodeNumber]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const dur = video.duration;
    if (Number.isFinite(dur) && dur > 0) {
      setDuration(dur);
    }

    if (hasAppliedInitialProgressRef.current) {
      return;
    }

    let targetTime = 0;
    if (initialProgressSeconds && initialProgressSeconds > 2) {
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

    if (targetTime > 0 && Number.isFinite(dur) && Number.isFinite(targetTime)) {
      video.currentTime = targetTime;
      setCurrentTime(targetTime);
      setResumeNotification({
        formatted: formatTime(targetTime),
        ratio: targetTime / dur,
      });
      hasAppliedInitialProgressRef.current = true;
    }
  }, [videoRef, initialProgressRatio, initialProgressSeconds]);

  // Reactive resume if initialProgress arrives asynchronously after metadata
  useEffect(() => {
    if (hasAppliedInitialProgressRef.current) return;
    const video = videoRef.current;
    if (!video) return;

    if (video.currentTime > 2) {
      hasAppliedInitialProgressRef.current = true;
      return;
    }

    const dur = video.duration;
    let targetTime = 0;

    if (
      initialProgressSeconds &&
      initialProgressSeconds > 2 &&
      Number.isFinite(dur) &&
      initialProgressSeconds < dur
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
  }, [videoRef, initialProgressRatio, initialProgressSeconds]);

  // Auto-dismiss resume notification pill
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

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const curr = video.currentTime;
    const dur = video.duration;
    setCurrentTime(curr);

    if (Number.isFinite(dur) && dur > 0) {
      setDuration(dur);
      const ratio = curr / dur;
      onTimeUpdate?.(curr, dur, ratio);

      if (tracking && tracking.enabled !== false && tracking.titleSlug) {
        const durSec = Math.floor(dur);
        const posSec = Math.floor(curr);

        if (!milestoneTrackerRef.current.hasStarted && curr > 0.1) {
          milestoneTrackerRef.current.hasStarted = true;
          trackPlaybackStart({
            titleSlug: tracking.titleSlug,
            episodeNumber: tracking.episodeNumber,
            durationSeconds: durSec,
          });
        }
        if (!milestoneTrackerRef.current.has25 && ratio >= 0.25) {
          milestoneTrackerRef.current.has25 = true;
          trackPlaybackProgress({
            titleSlug: tracking.titleSlug,
            episodeNumber: tracking.episodeNumber,
            milestone: 25,
            positionSeconds: posSec,
            durationSeconds: durSec,
          });
        }
        if (!milestoneTrackerRef.current.has50 && ratio >= 0.50) {
          milestoneTrackerRef.current.has50 = true;
          trackPlaybackProgress({
            titleSlug: tracking.titleSlug,
            episodeNumber: tracking.episodeNumber,
            milestone: 50,
            positionSeconds: posSec,
            durationSeconds: durSec,
          });
        }
        if (!milestoneTrackerRef.current.has75 && ratio >= 0.75) {
          milestoneTrackerRef.current.has75 = true;
          trackPlaybackProgress({
            titleSlug: tracking.titleSlug,
            episodeNumber: tracking.episodeNumber,
            milestone: 75,
            positionSeconds: posSec,
            durationSeconds: durSec,
          });
        }
      }
    }

    if (video.buffered.length > 0 && Number.isFinite(dur) && dur > 0) {
      const buffEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered(Math.min(1, buffEnd / dur));
    }
  }, [videoRef, onTimeUpdate, tracking]);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0 && onPause) {
      onPause(video.currentTime, video.duration, video.currentTime / video.duration);
    }
  }, [videoRef, onPause]);

  const handleEnded = useCallback(() => {
    if (
      tracking &&
      tracking.enabled !== false &&
      tracking.titleSlug &&
      !milestoneTrackerRef.current.hasCompleted
    ) {
      milestoneTrackerRef.current.hasCompleted = true;
      trackPlaybackComplete({
        titleSlug: tracking.titleSlug,
        episodeNumber: tracking.episodeNumber,
        durationSeconds: Math.floor(duration),
      });
    }
    onEnded?.();
  }, [onEnded, tracking, duration]);

  const dismissResumeNotification = useCallback(() => {
    if (resumeTimeoutRef.current) {
      clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setResumeNotification(null);
  }, []);

  const seekToBeginning = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setCurrentTime(0);
    }
    dismissResumeNotification();
  }, [videoRef, dismissResumeNotification]);

  return {
    currentTime,
    duration,
    buffered,
    resumeNotification,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePause,
    handleEnded,
    dismissResumeNotification,
    seekToBeginning,
    resumeTimeoutRef,
    hasAppliedInitialProgressRef,
    milestoneTrackerRef,
  };
}
