/**
 * Multi-Language Subtitle and Closed Caption Domain Types & Persistence (Task 9.2).
 */

export type SubtitleLanguageCode = "off" | "en" | "id" | "es" | "zh";

export type SubtitleFontSize = "small" | "medium" | "large";

export type SubtitleTextColor = "white" | "yellow";

export type SubtitleBackgroundColor = "transparent" | "semi-black" | "solid-black";

export interface SubtitleCue {
  id?: string;
  startTime: number; // in seconds (fractional allowed)
  endTime: number;   // in seconds
  text: string;
}

export interface SubtitleTrack {
  id: string;
  language: string; // e.g., "en", "id", "es", "zh"
  label: string;    // e.g., "English", "Indonesian", "Español", "中文"
  src?: string;     // URL or static path to .vtt file
  cues?: SubtitleCue[];
  default?: boolean;
}

export interface SubtitleSettings {
  language: string; // "off" or language code like "en", "id", etc.
  fontSize: SubtitleFontSize;
  textColor: SubtitleTextColor;
  backgroundColor: SubtitleBackgroundColor;
}

export interface SubtitleLanguageOption {
  code: string;
  label: string;
  localLabel: string;
}

export const SUPPORTED_SUBTITLE_LANGUAGES: SubtitleLanguageOption[] = [
  { code: "en", label: "English", localLabel: "English" },
  { code: "id", label: "Indonesian", localLabel: "Bahasa Indonesia" },
  { code: "es", label: "Spanish", localLabel: "Español" },
  { code: "zh", label: "Chinese", localLabel: "中文" },
];

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  language: "en",
  fontSize: "medium",
  textColor: "white",
  backgroundColor: "semi-black",
};

export const SUBTITLE_SETTINGS_STORAGE_KEY = "dramashort_subtitle_settings";

/**
 * Loads persisted subtitle settings from localStorage with SSR fallback and validation.
 */
export function loadSubtitleSettings(): SubtitleSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SUBTITLE_SETTINGS };
  }
  try {
    const raw = localStorage.getItem(SUBTITLE_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SUBTITLE_SETTINGS };
    const parsed = JSON.parse(raw);

    const validFontSizes: SubtitleFontSize[] = ["small", "medium", "large"];
    const validColors: SubtitleTextColor[] = ["white", "yellow"];
    const validBackgrounds: SubtitleBackgroundColor[] = ["transparent", "semi-black", "solid-black"];

    return {
      language: typeof parsed.language === "string" ? parsed.language : DEFAULT_SUBTITLE_SETTINGS.language,
      fontSize: validFontSizes.includes(parsed.fontSize) ? parsed.fontSize : DEFAULT_SUBTITLE_SETTINGS.fontSize,
      textColor: validColors.includes(parsed.textColor) ? parsed.textColor : DEFAULT_SUBTITLE_SETTINGS.textColor,
      backgroundColor: validBackgrounds.includes(parsed.backgroundColor) ? parsed.backgroundColor : DEFAULT_SUBTITLE_SETTINGS.backgroundColor,
    };
  } catch {
    return { ...DEFAULT_SUBTITLE_SETTINGS };
  }
}

/**
 * Persists updated subtitle settings to localStorage.
 */
export function saveSubtitleSettings(settings: SubtitleSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SUBTITLE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}
