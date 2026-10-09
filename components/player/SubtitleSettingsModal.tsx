"use client";

import React, { useEffect, useCallback, useMemo } from "react";
import {
  Subtitles,
  X,
  Check,
  RotateCcw,
  Sliders,
  Languages,
} from "lucide-react";
import {
  type SubtitleSettings,
  type SubtitleTrack,
  type SubtitleFontSize,
  type SubtitleTextColor,
  type SubtitleBackgroundColor,
  SUPPORTED_SUBTITLE_LANGUAGES,
  DEFAULT_SUBTITLE_SETTINGS,
} from "@/types/subtitles";

export interface SubtitleSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SubtitleSettings;
  onChangeSettings: (settings: SubtitleSettings) => void;
  availableTracks?: SubtitleTrack[];
}

export default function SubtitleSettingsModal({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  availableTracks = [],
}: SubtitleSettingsModalProps) {
  // Close on Escape key press
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

  const updateSetting = useCallback(
    <K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) => {
      onChangeSettings({
        ...settings,
        [key]: value,
      });
    },
    [settings, onChangeSettings]
  );

  const handleReset = useCallback(() => {
    onChangeSettings({ ...DEFAULT_SUBTITLE_SETTINGS });
  }, [onChangeSettings]);

  // Preview text in matching language
  const previewText = useMemo(() => {
    switch (settings.language) {
      case "id":
        return "Tunggu! Semua tentang malam itu adalah kebohongan.";
      case "es":
        return "¡Espera! Todo sobre esa noche fue una mentira.";
      case "zh":
        return "等等！关于那天晚上的一切，全都是谎言。";
      default:
        return "Wait! Everything about that night was a lie.";
    }
  }, [settings.language]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="subtitle-settings-title"
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
              <Subtitles size={20} />
            </div>
            <div>
              <h2 id="subtitle-settings-title" className="text-base sm:text-lg font-bold">
                Subtitle & Caption Settings
              </h2>
              <p className="text-xs text-text-muted">Customize language and readability overlay</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close subtitle settings"
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Preview Box */}
        <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-zinc-900 to-black border border-white/10 p-5 flex flex-col items-center justify-center min-h-[110px] text-center shadow-inner">
          <span className="absolute top-2 left-2.5 text-[10px] uppercase font-bold tracking-wider text-text-muted/60 flex items-center gap-1">
            <Sliders size={11} /> Live Preview
          </span>
          {settings.language === "off" ? (
            <p className="text-xs text-text-muted italic pt-2">Subtitles are turned off</p>
          ) : (
            <div
              className={`max-w-md transition-all duration-150 ${
                settings.fontSize === "small"
                  ? "text-xs sm:text-sm"
                  : settings.fontSize === "large"
                  ? "text-base sm:text-lg font-bold"
                  : "text-sm sm:text-base font-medium"
              } ${
                settings.textColor === "yellow" ? "text-yellow-300" : "text-white"
              } ${
                settings.backgroundColor === "transparent"
                  ? "bg-transparent px-2"
                  : settings.backgroundColor === "solid-black"
                  ? "bg-black/95 px-3 py-1 rounded-md border border-white/20 shadow-md"
                  : "bg-black/60 backdrop-blur-xs px-3 py-1 rounded-md border border-white/10 shadow-md"
              }`}
              style={{
                textShadow:
                  settings.backgroundColor === "transparent"
                    ? "0 2px 4px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.9)"
                    : "0 1px 2px rgba(0,0,0,0.8)",
              }}
            >
              {previewText}
            </div>
          )}
        </div>

        {/* Section 1: Language Selection */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-muted uppercase tracking-wider">
            <Languages size={14} />
            <span>Language</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Off Option */}
            <button
              type="button"
              onClick={() => updateSetting("language", "off")}
              className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                settings.language === "off"
                  ? "bg-primary/20 border-primary text-white font-semibold shadow-sm"
                  : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>Off</span>
              {settings.language === "off" && <Check size={14} className="text-primary" />}
            </button>

            {/* Standard Supported Languages */}
            {SUPPORTED_SUBTITLE_LANGUAGES.map((lang) => {
              const isSelected = settings.language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => updateSetting("language", lang.code)}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-primary/20 border-primary text-white font-semibold shadow-sm"
                      : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span>{lang.label}</span>
                    <span className="text-[10px] text-text-muted">{lang.localLabel}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-primary ml-1.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Font Size */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
            Font Size
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "small", label: "Small", sub: "A-" },
                { id: "medium", label: "Medium", sub: "A" },
                { id: "large", label: "Large", sub: "A+" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateSetting("fontSize", item.id as SubtitleFontSize)}
                className={`py-2 px-3 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all ${
                  settings.fontSize === item.id
                    ? "bg-primary/20 border-primary text-white font-semibold"
                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="font-bold text-sm">{item.sub}</span>
                <span className="text-[11px]">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Text Color */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
            Text Color
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "white", label: "White", swatch: "bg-white", textClass: "text-white" },
                {
                  id: "yellow",
                  label: "High-contrast Yellow",
                  swatch: "bg-yellow-400",
                  textClass: "text-yellow-400",
                },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateSetting("textColor", item.id as SubtitleTextColor)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                  settings.textColor === item.id
                    ? "bg-primary/20 border-primary text-white font-semibold"
                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full ${item.swatch} shadow-sm shrink-0`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Section 4: Background Opacity Pill */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
            Background Opacity
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "transparent", label: "Transparent", preview: "Shadow only" },
                { id: "semi-black", label: "50% Black", preview: "Semi-black" },
                { id: "solid-black", label: "Solid Black", preview: "100% Opacity" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  updateSetting("backgroundColor", item.id as SubtitleBackgroundColor)
                }
                className={`py-2 px-2.5 rounded-xl border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all text-center ${
                  settings.backgroundColor === item.id
                    ? "bg-primary/20 border-primary text-white font-semibold"
                    : "bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="font-semibold text-xs">{item.label}</span>
                <span className="text-[10px] text-text-muted">{item.preview}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between border-t border-white/10">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-white transition-colors py-2 px-2 rounded-lg"
          >
            <RotateCcw size={13} />
            <span>Reset to Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text text-xs sm:text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export { SubtitleSettingsModal };
