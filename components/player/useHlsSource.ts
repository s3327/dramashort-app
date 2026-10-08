"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  HLS_SHORT_VOD_CONFIG,
  MAX_NETWORK_RETRIES,
  MAX_MEDIA_RECOVERIES,
  calculateBackoffDelay,
} from "@/lib/player/streaming-robustness";

export interface UseHlsSourceOptions {
  src: string;
  autoPlay?: boolean;
  onBufferingChange?: (buffering: boolean) => void;
  onErrorChange?: (error: string | null) => void;
}

export function useHlsSource({
  src,
  autoPlay = false,
  onBufferingChange,
  onErrorChange,
}: UseHlsSourceOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const networkRetryCountRef = useRef<number>(0);
  const mediaRecoveryCountRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);
  const [hasError, setHasError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const setError = useCallback(
    (err: string | null) => {
      setHasError(err);
      onErrorChange?.(err);
    },
    [onErrorChange]
  );

  const setBuffering = useCallback(
    (buffering: boolean) => {
      setIsBuffering(buffering);
      onBufferingChange?.(buffering);
    },
    [onBufferingChange]
  );

  const handleRetryPlayback = useCallback(() => {
    setError(null);
    setBuffering(true);
    networkRetryCountRef.current = 0;
    mediaRecoveryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    setReloadIndex((idx) => idx + 1);
  }, [setBuffering, setError]);

  const resetRetryCounters = useCallback(() => {
    networkRetryCountRef.current = 0;
    mediaRecoveryCountRef.current = 0;
    setBuffering(false);
  }, [setBuffering]);

  // HLS stream binding & lifecycle management
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setBuffering(true);
    networkRetryCountRef.current = 0;
    mediaRecoveryCountRef.current = 0;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHlsStream = src.includes(".m3u8") || src.includes("application/x-mpegURL");

    if (isHlsStream && Hls.isSupported()) {
      const hls = new Hls(HLS_SHORT_VOD_CONFIG);
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setBuffering(false);
        if (autoPlay || reloadIndex > 0) {
          video.play().catch(() => {});
        }
      });

      hls.on(Hls.Events.FRAG_LOADED, () => {
        networkRetryCountRef.current = 0;
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (networkRetryCountRef.current < MAX_NETWORK_RETRIES) {
              const delay = calculateBackoffDelay(networkRetryCountRef.current);
              networkRetryCountRef.current += 1;
              setBuffering(true);
              if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
              retryTimeoutRef.current = setTimeout(() => {
                retryTimeoutRef.current = null;
                if (hlsRef.current) {
                  hlsRef.current.startLoad();
                }
              }, delay);
            } else {
              setBuffering(false);
              setError("Network error: unable to load video stream. Please check your connection.");
              hls.destroy();
              hlsRef.current = null;
            }
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            if (mediaRecoveryCountRef.current < MAX_MEDIA_RECOVERIES) {
              mediaRecoveryCountRef.current += 1;
              setBuffering(true);
              hls.recoverMediaError();
            } else {
              setBuffering(false);
              setError("Playback error: unable to recover media stream.");
              hls.destroy();
              hlsRef.current = null;
            }
            break;

          default:
            setBuffering(false);
            setError("Fatal playback error encountered.");
            hls.destroy();
            hlsRef.current = null;
            break;
        }
      });
    } else {
      // Native HLS for Safari or direct MP4/WebM video
      video.src = src;
      video.load();
      if (autoPlay || reloadIndex > 0) {
        video.play().catch(() => {});
      }
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.pause();
      }
    };
  }, [src, autoPlay, reloadIndex, setBuffering, setError]);

  return {
    videoRef,
    hlsRef,
    hasError,
    setHasError: setError,
    isBuffering,
    setIsBuffering: setBuffering,
    handleRetryPlayback,
    resetRetryCounters,
    networkRetryCountRef,
    mediaRecoveryCountRef,
  };
}
