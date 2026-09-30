"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type SiteTheme = "light" | "soft" | "dark";

const STORAGE_KEY = "dramashort-theme";
const DEFAULT_THEME: SiteTheme = "soft";
const VALID_THEMES: SiteTheme[] = ["light", "soft", "dark"];

type ThemeContextValue = {
  theme: SiteTheme;
  setTheme: (theme: SiteTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Wraps the whole app (see app/layout.tsx) so the chosen theme persists
// across navigation without remounting. Only the public "app" pages read
// this — the login/signup/landing gateway keeps its fixed dark branding,
// and Admin keeps its own fixed light theme, both intentionally unrelated
// to a visitor's personal site-theme preference.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<SiteTheme>(DEFAULT_THEME);

  // localStorage isn't available during SSR, so the saved preference is
  // restored right after mount instead.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && VALID_THEMES.includes(stored as SiteTheme)) {
      setThemeState(stored as SiteTheme);
    }
  }, []);

  const setTheme = (next: SiteTheme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
