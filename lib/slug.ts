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
export function getChannelCode(channelNameOrSlug?: string): string {
  if (!channelNameOrSlug || typeof channelNameOrSlug !== "string") {
    return "ds";
  }

  const trimmed = channelNameOrSlug.trim();
  if (!trimmed) {
    return "ds";
  }

  if (CHANNEL_CODE_MAP[trimmed]) {
    return CHANNEL_CODE_MAP[trimmed];
  }

  // Derive acronym from capital letters or words
  const words = trimmed.replace(/[-_]/g, " ").trim().split(/\s+/);
  if (words.length > 1) {
    const acronym = words.map((w) => w[0]?.toLowerCase()).join("").slice(0, 4);
    if (acronym) return acronym;
  }
  return trimmed.slice(0, 3).toLowerCase() || "ds";
}

/**
 * Converts a drama title and channel code into a collision-proof slug.
 * e.g. ("The CEO's Secret Wife", "ds") -> "the-ceos-secret-wife-ds"
 */
export function createDramaSlug(title: string, channelCodeOrName?: string): string {
  const code = getChannelCode(channelCodeOrName);
  const base = (title || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove special characters
    .replace(/[\s_-]+/g, "-")  // collapse whitespaces and underscores to hyphens
    .replace(/^-+|-+$/g, ""); // trim hyphens

  const safeBase = base || "drama";
  return `${safeBase}-${code}`;
}

/**
 * Generates a candidate slug with optional numeric retry suffix:
 * Attempt 1: <title>-<channel_code>
 * Attempt 2: <title>-<channel_code>-2
 * Attempt 3: <title>-<channel_code>-3
 */
export function getDramaSlugCandidate(
  title: string,
  channelCodeOrName?: string,
  attempt = 1
): string {
  const baseSlug = createDramaSlug(title, channelCodeOrName);
  if (attempt <= 1) {
    return baseSlug;
  }
  return `${baseSlug}-${attempt}`;
}

/**
 * Generates a unique drama slug against the titles database table.
 * Retries with incrementing numeric suffix on collision (-2, -3, ...).
 */
export async function generateUniqueDramaSlug(
  client: any,
  title: string,
  channelCodeOrName?: string,
  excludeDramaId?: string,
  maxRetries = 100
): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const candidate = getDramaSlugCandidate(title, channelCodeOrName, attempt);
    let query = client
      .from("titles")
      .select("id")
      .eq("slug", candidate);

    if (excludeDramaId) {
      query = query.neq("id", excludeDramaId);
    }

    const { data, error } = await query.maybeSingle();
    // If no row exists with this candidate slug, it is unique and safe to use
    if (!error && !data) {
      return candidate;
    }
    // If a database error occurs, break early to prevent 100 repeated failing requests
    if (error) {
      break;
    }
  }

  // Fallback if max retries exceeded or database query failed: append timestamp
  const base = createDramaSlug(title, channelCodeOrName);
  return `${base}-${Date.now().toString(36)}`;
}
