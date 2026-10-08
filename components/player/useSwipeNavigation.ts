"use client";

import { useState, useRef, useCallback } from "react";

export interface UseSwipeNavigationOptions {
  onNextEpisode?: () => void;
  onPrevEpisode?: () => void;
  threshold?: number;
}

export function useSwipeNavigation({
  onNextEpisode,
  onPrevEpisode,
  threshold = 45,
}: UseSwipeNavigationOptions) {
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const isDragging = useRef<boolean>(false);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [swipeHint, setSwipeHint] = useState<"next" | "prev" | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      isDragging.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current || touchStartY.current === null || touchStartX.current === null) return;
    const currentY = e.touches[0].clientY;
    const currentX = e.touches[0].clientX;
    const deltaY = currentY - touchStartY.current;
    const deltaX = currentX - touchStartX.current;

    // Detect predominantly vertical swipe
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
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;

    if (swipeOffset < -threshold) {
      onNextEpisode?.();
    } else if (swipeOffset > threshold) {
      onPrevEpisode?.();
    }

    setSwipeOffset(0);
    setSwipeHint(null);
  }, [swipeOffset, threshold, onNextEpisode, onPrevEpisode]);

  const handleTouchCancel = useCallback(() => {
    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;
    setSwipeOffset(0);
    setSwipeHint(null);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    touchStartY.current = e.clientY;
    touchStartX.current = e.clientX;
    isDragging.current = true;
  }, []);

  const handleMouseMoveWithSwipe = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, onDefaultMove?: () => void) => {
      if (!isDragging.current || touchStartY.current === null || touchStartX.current === null) {
        onDefaultMove?.();
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
        onDefaultMove?.();
      }
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    touchStartY.current = null;
    touchStartX.current = null;

    if (swipeOffset < -threshold) {
      onNextEpisode?.();
    } else if (swipeOffset > threshold) {
      onPrevEpisode?.();
    }

    setSwipeOffset(0);
    setSwipeHint(null);
  }, [swipeOffset, threshold, onNextEpisode, onPrevEpisode]);

  return {
    isDragging,
    swipeOffset,
    swipeHint,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleMouseDown,
    handleMouseMoveWithSwipe,
    handleMouseUp,
  };
}
