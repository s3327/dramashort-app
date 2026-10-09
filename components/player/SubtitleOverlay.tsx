"use client";

import React from "react";
import type { SubtitleCue, SubtitleSettings } from "@/types/subtitles";

export interface SubtitleOverlayProps {
  cue: SubtitleCue | null;
  settings: SubtitleSettings;
  className?: string;
  isControlsVisible?: boolean;
}

/**
 * Custom High-Readability Video Subtitle Overlay (Task 9.2).
 * Renders active cue text above player scrub bar with custom font size, color,
 * and background opacity pill options.
 */
export default function SubtitleOverlay({
  cue,
  settings,
  className = "",
  isControlsVisible = false,
}: SubtitleOverlayProps) {
  if (!cue || !cue.text || settings.language === "off") {
    return null;
  }

  // 1. Resolve Font Size
  let fontSizeClass = "text-sm sm:text-base md:text-lg";
  if (settings.fontSize === "small") {
    fontSizeClass = "text-xs sm:text-sm";
  } else if (settings.fontSize === "large") {
    fontSizeClass = "text-base sm:text-lg md:text-xl font-bold";
  }

  // 2. Resolve Text Color & Drop Shadow
  const textColorClass =
    settings.textColor === "yellow"
      ? "text-yellow-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
      : "text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]";

  // 3. Resolve Background Style
  let bgClass = "bg-black/60 backdrop-blur-xs px-3.5 py-1.5 rounded-lg border border-white/10 shadow-lg";
  if (settings.backgroundColor === "transparent") {
    bgClass = "px-2 py-0.5";
  } else if (settings.backgroundColor === "solid-black") {
    bgClass = "bg-black/95 px-3.5 py-1.5 rounded-lg border border-white/20 shadow-2xl";
  }

  // 4. Dynamic bottom spacing based on controls visibility
  const bottomPositionClass = isControlsVisible
    ? "bottom-20 sm:bottom-24"
    : "bottom-8 sm:bottom-12";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`absolute inset-x-4 sm:inset-x-12 ${bottomPositionClass} z-20 flex justify-center pointer-events-none transition-all duration-200 select-none ${className}`}
    >
      <div
        className={`max-w-2xl text-center whitespace-pre-line leading-snug transition-transform duration-150 animate-in fade-in zoom-in-95 ${bgClass} ${fontSizeClass} ${textColorClass}`}
        style={{
          textShadow:
            settings.backgroundColor === "transparent"
              ? "0 2px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,1)"
              : "0 1px 3px rgba(0,0,0,0.8)",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
}

export { SubtitleOverlay };
