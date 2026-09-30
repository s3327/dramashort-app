/**
 * Known default channel abbreviations.
 * Fallback will generate an acronym from channel name if not in map.
 */
export const CHANNEL_CODE_MAP: Record<string, string> = {
  "DramaShort Originals": "ds",
  "dramashort-originals": "ds",
  "Velvet Frame": "vf",
  "velvet-frame": "vf",
  "Golden Hour Studios": "ghs",
  "golden-hour-studios": "ghs",
  "Nightingale Pictures": "np",
  "nightingale-pictures": "np",
};

/**
 * Resolves or derives a short acronym for a given channel name or slug.
 * e.g., "Moonlight Pictures" -> "mp"
 */
export function getChannelCode(channelNameOrSlug: string): string {
  if (CHANNEL_CODE_MAP[channelNameOrSlug]) {
    return CHANNEL_CODE_MAP[channelNameOrSlug];
  }

  // Derive acronym from capital letters or words
  const words = channelNameOrSlug.replace(/[-_]/g, " ").trim().split(/\s+/);
  if (words.length > 1) {
    return words.map((w) => w[0]?.toLowerCase()).join("").slice(0, 4);
  }
  return channelNameOrSlug.slice(0, 3).toLowerCase();
}

/**
 * Converts a drama title and channel code into a collision-proof slug.
 * e.g. ("The CEO's Secret Wife", "ds") -> "the-ceos-secret-wife-ds"
 */
export function createDramaSlug(title: string, channelCodeOrName: string): string {
  const code = getChannelCode(channelCodeOrName);
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove special characters
    .replace(/[\s_-]+/g, "-")  // collapse whitespaces and underscores to hyphens
    .replace(/^-+|-+$/g, ""); // trim hyphens

  return `${base}-${code}`;
}
