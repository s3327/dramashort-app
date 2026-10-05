export const SUPPORT_CATEGORIES = [
  "general",
  "playback",
  "billing",
  "content",
  "account",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
