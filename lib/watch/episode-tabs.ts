/**
 * Pure helper module for episode pagination, tab ranges, and adjacent episode navigation.
 * Centralizes short-drama episode sheet and drawer pagination logic (Task 17.1).
 */

export const DEFAULT_EPISODES_PER_TAB = 40;

export interface EpisodeTabRange {
  index: number;
  start: number;
  end: number;
  label: string;
}

/**
 * Clamps episode number within [1, totalEpisodes].
 */
export function clampEpisodeNumber(
  episodeNumber: number,
  totalEpisodes: number
): number {
  const safeTotal = Math.max(1, totalEpisodes || 1);
  if (Number.isNaN(episodeNumber) || episodeNumber < 1) {
    return 1;
  }
  if (episodeNumber >= safeTotal) {
    return safeTotal;
  }
  return Math.min(safeTotal, Math.max(1, Math.floor(episodeNumber)));
}

/**
 * Computes list of episode tab ranges for a given series total.
 */
export function calculateEpisodeTabs(
  totalEpisodes: number,
  episodesPerTab = DEFAULT_EPISODES_PER_TAB
): EpisodeTabRange[] {
  const safeTotal = Math.max(1, totalEpisodes || 1);
  const safePerTab = Math.max(1, episodesPerTab || DEFAULT_EPISODES_PER_TAB);
  const tabCount = Math.ceil(safeTotal / safePerTab);

  return Array.from({ length: tabCount }, (_, i) => {
    const start = i * safePerTab + 1;
    const end = Math.min((i + 1) * safePerTab, safeTotal);
    return {
      index: i,
      start,
      end,
      label: start === end ? `${start}` : `${start}-${end}`,
    };
  });
}

/**
 * Computes 0-based active tab index containing a specific episode number.
 */
export function computeActiveTabForEpisode(
  episodeNumber: number,
  totalEpisodes: number,
  episodesPerTab = DEFAULT_EPISODES_PER_TAB
): number {
  const safeTotal = Math.max(1, totalEpisodes || 1);
  const safePerTab = Math.max(1, episodesPerTab || DEFAULT_EPISODES_PER_TAB);
  const maxTab = Math.max(0, Math.ceil(safeTotal / safePerTab) - 1);
  const clampedEp = clampEpisodeNumber(episodeNumber, safeTotal);

  const tabIndex = Math.floor((clampedEp - 1) / safePerTab);
  return Math.min(maxTab, Math.max(0, tabIndex));
}

/**
 * Returns array of episode numbers (1-indexed) belonging to the requested tab.
 */
export function getEpisodesForTab(
  tabIndex: number,
  totalEpisodes: number,
  episodesPerTab = DEFAULT_EPISODES_PER_TAB
): number[] {
  const tabs = calculateEpisodeTabs(totalEpisodes, episodesPerTab);
  if (tabIndex < 0 || tabIndex >= tabs.length) {
    return [];
  }
  const tab = tabs[tabIndex];
  return Array.from({ length: tab.end - tab.start + 1 }, (_, i) => tab.start + i);
}

/**
 * Determines adjacent episode number for navigation, enforcing series boundaries.
 * Returns null if attempted navigation falls outside [1, totalEpisodes].
 */
export function getAdjacentEpisode(
  currentEpisode: number,
  totalEpisodes: number,
  direction: "prev" | "next"
): number | null {
  const safeTotal = Math.max(1, totalEpisodes || 1);
  const clamped = clampEpisodeNumber(currentEpisode, safeTotal);

  if (direction === "prev") {
    return clamped > 1 ? clamped - 1 : null;
  } else {
    return clamped < safeTotal ? clamped + 1 : null;
  }
}
