import { titles, hashSlug } from "@/data/titles.mock";
import type { Title } from "@/types/content";

// Deterministic shuffle (seeded by the current title's slug) rather than
// Math.random() directly — keeps server and client render in sync (no
// hydration mismatch) while still feeling different from title to title.
function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// TODO: this genre/tag/channel matching is a stand-in. Once real user
// watch history exists in the database, related titles should come from
// an actual recommendation schema instead — configurable from Admin
// Settings, the same way the Trending period will be.
export function getRelatedTitles(
  drama: { slug: string; genre: string; tags: string[]; channel: string },
  count = 8
): Title[] {
  const others = titles.filter((item) => item.slug !== drama.slug);

  const matches = others.filter(
    (item) =>
      item.genre === drama.genre ||
      item.channel === drama.channel ||
      item.tags.some((tag) => drama.tags.includes(tag))
  );

  const seed = hashSlug(drama.slug);
  const shuffledMatches = seededShuffle(matches, seed);

  if (shuffledMatches.length >= count) {
    return shuffledMatches.slice(0, count);
  }

  // Not enough genre/tag/channel matches — pad with other titles so the
  // section still has a reasonable number of cards.
  const usedSlugs = new Set(shuffledMatches.map((i) => i.slug));
  const remaining = seededShuffle(
    others.filter((item) => !usedSlugs.has(item.slug)),
    seed + 1
  );

  return [...shuffledMatches, ...remaining].slice(0, count);
}
