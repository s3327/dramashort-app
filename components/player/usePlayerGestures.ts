"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UsePlayerGesturesOptions {
  onTogglePlay?: () => void;
  onSeekRelative?: (seconds: number) => void;
  onSetPlaybackRate?: (rate: number) => void;
  currentPlaybackRate?: number;
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  threshold?: number;
}

export interface SeekRippleState {
  direction: "left" | "right";
  visible: boolean;
}

export function usePlayerGestures({
  onTogglePlay,
  onSeekRelative,
  onSetPlaybackRate,
  currentPlaybackRate = 1,
  onNextEpisode,
  onPrevEpisode,
  threshold = 45,
}: UsePlayerGesturesOptions) {
  // Swipe navigation state (strictly touch pointers)
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [swipeHint, setSwipeHint] = useState<"next" | "prev" | null>(null);

  // Double-tap & single-tap detection
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const pendingTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [seekRipple, setSeekRipple] = useState<SeekRippleState | null>(null);
  const rippleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Long-press 2× speed state
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSpeedBoosted, setIsSpeedBoosted] = useState<boolean>(false);
  const previousSpeedRef = useRef<number>(currentPlaybackRate);

  // Keep previousSpeedRef updated when not actively boosted
  useEffect(() => {
    if (!isSpeedBoosted) {
      previousSpeedRef.current = currentPlaybackRate;
    }
  }, [currentPlaybackRate, isSpeedBoosted]);

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (pendingTapTimeoutRef.current) clearTimeout(pendingTapTimeoutRef.current);
      if (rippleTimeoutRef.current) clearTimeout(rippleTimeoutRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      touchStartY.current = touch.clientY;
      touchStartX.current = touch.clientX;
      isDragging.current = true;

      // Start 400ms long-press timer for 2× speed boost
      cancelLongPress();
      longPressTimerRef.current = setTimeout(() => {
        setIsSpeedBoosted(true);
        onSetPlaybackRate?.(2);
      }, 400);
    },
    [cancelLongPress, onSetPlaybackRate]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!isDragging.current || touchStartY.current === null || touchStartX.current === null) return;
      const touch = e.touches[0];
      const deltaY = touch.clientY - touchStartY.current;
      const deltaX = touch.clientX - touchStartX.current;

      // If user moves more than 8px, cancel long-press (it's a swipe, not a hold)
      if (Math.abs(deltaY) > 8 || Math.abs(deltaX) > 8) {
        cancelLongPress();
      }

      // Vertical swipe detection
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
    },
    [cancelLongPress]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      cancelLongPress();

      // If speed was boosted via long press, restore previous speed and dismiss
      if (isSpeedBoosted) {
        setIsSpeedBoosted(false);
        onSetPlaybackRate?.(previousSpeedRef.current);
        isDragging.current = false;
        touchStartY.current = null;
        touchStartX.current = null;
        setSwipeOffset(0);
        setSwipeHint(null);
        return;
      }

      // Handle vertical swipe episode navigation
      if (isDragging.current) {
        if (swipeOffset < -threshold) {
          onNextEpisode?.();
        } else if (swipeOffset > threshold) {
          onPrevEpisode?.();
        }
      }

      const wasSwiping = Math.abs(swipeOffset) > 10;
      isDragging.current = false;
      touchStartY.current = null;
      touchStartX.current = null;
      setSwipeOffset(0);
      setSwipeHint(null);

      // If user was not swiping, handle tap / double-tap detection
      if (!wasSwiping && e.changedTouches.length === 1) {
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

          // Check zone (left 35% vs right 35%)
          const ratio = clientX / width;
          if (ratio < 0.35) {
            onSeekRelative?.(-10);
            setSeekRipple({ direction: "left", visible: true });
          } else if (ratio > 0.65) {
            onSeekRelative?.(10);
            setSeekRipple({ direction: "right", visible: true });
          } else {
            // Center double-tap toggles play/pause
            onTogglePlay?.();
          }

          if (rippleTimeoutRef.current) clearTimeout(rippleTimeoutRef.current);
          rippleTimeoutRef.current = setTimeout(() => {
            setSeekRipple(null);
          }, 650);
        } else {
          // Single-tap candidate: delay to check for double tap
          lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
          if (pendingTapTimeoutRef.current) clearTimeout(pendingTapTimeoutRef.current);
          pendingTapTimeoutRef.current = setTimeout(() => {
            pendingTapTimeoutRef.current = null;
            onTogglePlay?.();
          }, 260);
        }
      }
    },
    [
      cancelLongPress,
      isSpeedBoosted,
      onSetPlaybackRate,
      swipeOffset,
      threshold,
      onNextEpisode,
      onPrevEpisode,
      onSeekRelative,
      onTogglePlay,
    ]
  );

  const handleTouchCancel = useCallback(() => {
    cancelLongPress();
    if (isSpeedBoosted) {
      setIsSpeedBoosted(false);
      onSetPlaybackRate?.(previousSpeedRef.current);
    }
    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;
    setSwipeOffset(0);
    setSwipeHint(null);
  }, [cancelLongPress, isSpeedBoosted, onSetPlaybackRate]);

  // Desktop click handler (mouse double-click or single-click)
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Don't trigger if target is an interactive child button/input
      const target = e.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("a") ||
        target.closest(".group\\/scrub")
      ) {
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const width = rect.width;
      const now = Date.now();

      const lastTap = lastTapRef.current;
      if (
        lastTap &&
        now - lastTap.time < 300 &&
        Math.abs(e.clientX - lastTap.x) < 40 &&
        Math.abs(e.clientY - lastTap.y) < 40
      ) {
        // Desktop double-click seek
        if (pendingTapTimeoutRef.current) {
          clearTimeout(pendingTapTimeoutRef.current);
          pendingTapTimeoutRef.current = null;
        }
        lastTapRef.current = null;

        const ratio = clientX / width;
        if (ratio < 0.35) {
          onSeekRelative?.(-10);
          setSeekRipple({ direction: "left", visible: true });
        } else if (ratio > 0.65) {
          onSeekRelative?.(10);
          setSeekRipple({ direction: "right", visible: true });
        } else {
          onTogglePlay?.();
        }

        if (rippleTimeoutRef.current) clearTimeout(rippleTimeoutRef.current);
        rippleTimeoutRef.current = setTimeout(() => {
          setSeekRipple(null);
        }, 650);
      } else {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        if (pendingTapTimeoutRef.current) clearTimeout(pendingTapTimeoutRef.current);
        pendingTapTimeoutRef.current = setTimeout(() => {
          pendingTapTimeoutRef.current = null;
          onTogglePlay?.();
        }, 260);
      }
    },
    [onSeekRelative, onTogglePlay]
  );

  return {
    swipeOffset,
    swipeHint,
    seekRipple,
    isSpeedBoosted,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleClick,
  };
}
