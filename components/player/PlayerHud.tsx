"use client";

import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ChevronDown,
  ChevronUp,
  VolumeX,
  Volume2,
  Maximize,
  Minimize,
  Subtitles,
  FastForward,
} from "lucide-react";

export type PlayerHudActionType =
  | "play"
  | "pause"
  | "seek_forward"
  | "seek_backward"
  | "next_episode"
  | "prev_episode"
  | "mute"
  | "unmute"
  | "volume"
  | "fullscreen"
  | "fullscreen_exit"
  | "subtitles"
  | "speed";

export type HudActionType = PlayerHudActionType;

export interface PlayerHudState {
  type: PlayerHudActionType;
  label: string;
  detail?: string;
  nonce: number;
}

export interface PlayerHudProps {
  hud: PlayerHudState | null;
}

/**
 * Center-Screen Visual HUD Feedback Overlay (Task 9.3).
 * Briefly displays action icons and feedback on hotkey or gesture trigger.
 */
export default function PlayerHud({ hud }: PlayerHudProps) {
  if (!hud) return null;

  const renderIcon = () => {
    switch (hud.type) {
      case "play":
        return <Play size={26} className="text-primary fill-current ml-0.5" />;
      case "pause":
        return <Pause size={26} className="text-primary fill-current" />;
      case "seek_backward":
        return <RotateCcw size={26} className="text-primary" />;
      case "seek_forward":
        return <RotateCw size={26} className="text-primary" />;
      case "next_episode":
        return <ChevronDown size={26} className="text-primary" />;
      case "prev_episode":
        return <ChevronUp size={26} className="text-primary" />;
      case "mute":
        return <VolumeX size={26} className="text-red-400" />;
      case "unmute":
      case "volume":
        return <Volume2 size={26} className="text-primary" />;
      case "fullscreen":
        return <Maximize size={26} className="text-primary" />;
      case "fullscreen_exit":
        return <Minimize size={26} className="text-primary" />;
      case "subtitles":
        return <Subtitles size={26} className="text-primary" />;
      case "speed":
        return <FastForward size={26} className="text-primary" />;
      default:
        return null;
    }
  };

  return (
    <div
      key={hud.nonce}
      role="status"
      aria-live="polite"
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-35 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      <div className="flex flex-col items-center justify-center min-w-[104px] px-5 py-3.5 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-md text-white shadow-2xl">
        <div className="mb-1">{renderIcon()}</div>
        <span className="text-xs font-bold tracking-wide text-center">{hud.label}</span>
        {hud.detail && (
          <span className="text-[10px] text-white/70 font-mono mt-0.5 text-center">
            {hud.detail}
          </span>
        )}
      </div>
    </div>
  );
}

export { PlayerHud };
