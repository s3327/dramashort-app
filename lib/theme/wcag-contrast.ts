/**
 * WCAG 2.1 AA Color Contrast Calculation Engine (Task 14.9).
 * Implements standard W3C relative luminance and contrast ratio algorithms
 * for programmatically verifying accessibility across light, soft, and dark themes.
 *
 * References:
 * - https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html (WCAG 1.4.3: 4.5:1)
 * - https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html (WCAG 1.4.11: 3.0:1)
 */

export type RgbTuple = [number, number, number];

/**
 * Converts an sRGB 8-bit channel value (0-255) to linear RGB.
 */
export function sRgbChannelToLinear(channel: number): number {
  const normalized = Math.max(0, Math.min(255, channel)) / 255;
  if (normalized <= 0.04045) {
    return normalized / 12.92;
  }
  return Math.pow((normalized + 0.055) / 1.055, 2.4);
}

/**
 * Computes the relative luminance of an RGB color according to WCAG 2.1 definition.
 * Returns a value between 0.0 (darkest black) and 1.0 (lightest white).
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const rLin = sRgbChannelToLinear(r);
  const gLin = sRgbChannelToLinear(g);
  const bLin = sRgbChannelToLinear(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

/**
 * Calculates the contrast ratio between two RGB colors.
 * Always returns a ratio >= 1.0 (e.g. 4.5 for 4.5:1).
 */
export function getContrastRatio(rgb1: RgbTuple, rgb2: RgbTuple): number {
  const lum1 = getRelativeLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const lum2 = getRelativeLuminance(rgb2[0], rgb2[1], rgb2[2]);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Blends a semi-transparent foreground RGB with a solid background RGB.
 */
export function blendRgbWithBackground(
  fg: RgbTuple,
  alpha: number,
  bg: RgbTuple
): RgbTuple {
  const clampedAlpha = Math.max(0, Math.min(1, alpha));
  return [
    Math.round(fg[0] * clampedAlpha + bg[0] * (1 - clampedAlpha)),
    Math.round(fg[1] * clampedAlpha + bg[1] * (1 - clampedAlpha)),
    Math.round(fg[2] * clampedAlpha + bg[2] * (1 - clampedAlpha)),
  ];
}

/**
 * System Theme Token RGB Palette Definitions
 * Derived from design-tokens/tokens.css
 */
export const THEME_PALETTES = {
  light: {
    bg: [255, 255, 255] as RgbTuple, // #FFFFFF
    text: [35, 19, 32] as RgbTuple, // #231320
    textMutedAlpha: 0.64,
    link: [198, 10, 88] as RgbTuple, // #C60A58 (primary-dark)
    btnPrimaryBg: [238, 41, 123] as RgbTuple, // #EE297B (primary)
    btnPrimaryText: [255, 247, 250] as RgbTuple, // #FFF7FA (text-light)
  },
  soft: {
    bg: [243, 231, 234] as RgbTuple, // #F3E7EA
    text: [35, 19, 32] as RgbTuple, // #231320
    textMutedAlpha: 0.64,
    link: [198, 10, 88] as RgbTuple, // #C60A58 (primary-dark)
    btnPrimaryBg: [238, 41, 123] as RgbTuple, // #EE297B
    btnPrimaryText: [255, 247, 250] as RgbTuple, // #FFF7FA
  },
  dark: {
    bg: [28, 18, 32] as RgbTuple, // #1C1220
    text: [255, 247, 250] as RgbTuple, // #FFF7FA
    textMutedAlpha: 0.66,
    link: [244, 195, 219] as RgbTuple, // #F4C3DB (secondary-light)
    btnPrimaryBg: [238, 41, 123] as RgbTuple, // #EE297B
    btnPrimaryText: [255, 247, 250] as RgbTuple, // #FFF7FA
  },
};

export interface ThemeContrastReport {
  theme: "light" | "soft" | "dark";
  textContrast: number;
  textPassesAA: boolean; // >= 4.5:1
  mutedTextContrast: number;
  mutedTextPassesAA: boolean; // >= 4.5:1
  linkContrast: number;
  linkPassesAA: boolean; // >= 4.5:1
  btnPrimaryContrast: number;
  btnPrimaryPassesUI: boolean; // >= 3.0:1 (UI components / large bold text)
}

/**
 * Validates WCAG AA contrast standards for a specified theme.
 */
export function verifyThemeContrast(
  theme: "light" | "soft" | "dark"
): ThemeContrastReport {
  const palette = THEME_PALETTES[theme];
  const mutedTextColor = blendRgbWithBackground(
    palette.text,
    palette.textMutedAlpha,
    palette.bg
  );

  const textContrast = getContrastRatio(palette.text, palette.bg);
  const mutedTextContrast = getContrastRatio(mutedTextColor, palette.bg);
  const linkContrast = getContrastRatio(palette.link, palette.bg);
  const btnPrimaryContrast = getContrastRatio(
    palette.btnPrimaryText,
    palette.btnPrimaryBg
  );

  return {
    theme,
    textContrast: Number(textContrast.toFixed(2)),
    textPassesAA: textContrast >= 4.5,
    mutedTextContrast: Number(mutedTextContrast.toFixed(2)),
    mutedTextPassesAA: mutedTextContrast >= 4.5,
    linkContrast: Number(linkContrast.toFixed(2)),
    linkPassesAA: linkContrast >= 4.5,
    btnPrimaryContrast: Number(btnPrimaryContrast.toFixed(2)),
    btnPrimaryPassesUI: btnPrimaryContrast >= 3.0,
  };
}

export function verifyAllThemes(): ThemeContrastReport[] {
  return (["light", "soft", "dark"] as const).map(verifyThemeContrast);
}
