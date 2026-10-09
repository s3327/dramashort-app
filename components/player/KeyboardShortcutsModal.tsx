"use client";

import React, { useEffect } from "react";
import { Keyboard, X } from "lucide-react";

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface ShortcutEntry {
  keys: string[];
  description: string;
}

export interface ShortcutCategory {
  title: string;
  shortcuts: ShortcutEntry[];
}

export const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: "Playback Controls",
    shortcuts: [
      { keys: ["Space", "K"], description: "Toggle Play / Pause" },
      { keys: ["←", "J"], description: "Seek backward 5 seconds" },
      { keys: ["→", "L"], description: "Seek forward 5 seconds" },
    ],
  },
  {
    title: "Episode Navigation",
    shortcuts: [
      { keys: ["↓", "N"], description: "Navigate to Next Episode" },
      { keys: ["↑", "P"], description: "Navigate to Previous Episode" },
    ],
  },
  {
    title: "Audio & Display",
    shortcuts: [
      { keys: ["M"], description: "Toggle Audio Mute / Unmute" },
      { keys: ["Shift", "↑"], description: "Increase Volume (+10%)" },
      { keys: ["Shift", "↓"], description: "Decrease Volume (-10%)" },
      { keys: ["F"], description: "Toggle Fullscreen mode" },
      { keys: ["C"], description: "Toggle Subtitles / Closed Captions" },
      { keys: ["?"], description: "Open Keyboard Shortcuts Help" },
    ],
  },
];

export default function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl text-text-primary max-h-[90vh] overflow-y-auto space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Keyboard size={20} />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-base sm:text-lg font-bold">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-text-muted">Desktop playback and navigation hotkeys</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts Categories */}
        <div className="space-y-4">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.title} className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                {category.title}
              </h3>
              <div className="rounded-xl bg-white/[0.03] border border-white/10 divide-y divide-white/5 overflow-hidden">
                {category.shortcuts.map((sc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3.5 py-2.5 text-xs"
                  >
                    <span className="text-text-secondary">{sc.description}</span>
                    <div className="flex items-center gap-1.5">
                      {sc.keys.map((k, kIndex) => (
                        <React.Fragment key={kIndex}>
                          {kIndex > 0 && sc.keys.length === 2 && sc.keys[0] === "Shift" ? (
                            <span className="text-[10px] text-text-muted">+</span>
                          ) : kIndex > 0 ? (
                            <span className="text-[10px] text-text-muted">or</span>
                          ) : null}
                          <kbd className="px-2 py-0.5 rounded-md bg-white/10 border border-white/20 font-mono text-[11px] font-semibold text-white shadow-sm min-w-[24px] text-center inline-block">
                            {k}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between border-t border-white/10 text-xs text-text-muted">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/20 text-[10px] text-white">Esc</kbd> to close</span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text text-xs sm:text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export { KeyboardShortcutsModal };
