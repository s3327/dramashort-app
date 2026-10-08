"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type SiteTheme = "light" | "soft" | "dark";

export const THEME_STORAGE_KEY = "dramashort-theme";
export const THEME_COOKIE_NAME = "dramashort-theme";
export const DEFAULT_THEME: SiteTheme = "dark";
export const VALID_THEMES: SiteTheme[] = ["light", "soft", "dark"];

export const THEME_COLORS: Record<SiteTheme, string> = {
  light: "#FFFFFF",
  soft: "#F3E7EA",
  dark: "#1C1220",
};

export function isValidTheme(theme: unknown): theme is SiteTheme {
  return typeof theme === "string" && VALID_THEMES.includes(theme as SiteTheme);
}

export function getThemeColor(theme: SiteTheme): string {
  return THEME_COLORS[theme] || THEME_COLORS[DEFAULT_THEME];
}

type ThemeContextValue = {
  theme: SiteTheme;
  setTheme: (theme: SiteTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: SiteTheme;
}

/**
 * ThemeProvider synchronizes theme state across React, cookies (for zero-flash SSR),
 * and localStorage, updating <html> data-theme and colorScheme on change.
 */
export function ThemeProvider({ children, initialTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<SiteTheme>(() => {
    if (initialTheme && isValidTheme(initialTheme)) {
      return initialTheme;
    }
    return DEFAULT_THEME;
  });

  // Client hydration check: ensure localStorage matches cookie, or hydrate from localStorage if cookie was missing
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && isValidTheme(stored) && stored !== theme) {
        setThemeState(stored);
        document.documentElement.setAttribute("data-theme", stored);
        document.documentElement.style.colorScheme = stored === "dark" ? "dark" : "light";
        document.cookie = `${THEME_COOKIE_NAME}=${stored}; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {
      // Storage access blocked or restricted
    }
  }, [theme]);

  const setTheme = (next: SiteTheme) => {
    if (!isValidTheme(next)) return;
    setThemeState(next);

    // Apply attribute immediately to <html> element
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.style.colorScheme = next === "dark" ? "dark" : "light";

      // Synchronize mobile browser theme-color meta tag
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", getThemeColor(next));
      }

      // Persist to cookie for server-side SSR on future navigations & reloads
      document.cookie = `${THEME_COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;

      // Persist to localStorage for client continuity
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // LocalStorage may fail in private mode
      }
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
