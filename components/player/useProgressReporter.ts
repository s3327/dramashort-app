"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { RESUME_NOTIFICATION_DURATION_MS } from "@/lib/player/streaming-robustness";

export interface UseProgressReporterOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  initialProgressSeconds?: number;
  initialProgressRatio?: number;
  onTimeUpdate?: (currentTime: number, duration: number, progressRatio: number) => void;
  onPause?: (currentTime: number, duration: number, progressRatio: number) => void;
  onEnded?: () => void;
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
    }

    if (video.buffered.length > 0 && Number.isFinite(dur) && dur > 0) {
      const buffEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered(Math.min(1, buffEnd / dur));
    }
  }, [videoRef, onTimeUpdate]);

  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration > 0 && onPause) {
      onPause(video.currentTime, video.duration, video.currentTime / video.duration);
    }
  }, [videoRef, onPause]);

  const handleEnded = useCallback(() => {
    onEnded?.();
  }, [onEnded]);

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
  };
}
