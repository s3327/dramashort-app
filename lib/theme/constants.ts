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
