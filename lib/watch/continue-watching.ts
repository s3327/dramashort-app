import type { WatchHistoryRow } from "@/lib/services/user.service";

export interface DramaMeta {
  title: string;
  poster: string;
  totalEpisodes: number;
  channel?: string;
}

export interface ContinueWatchingEntry {
  id: string;
  slug: string;
  title: string;
  poster: string;
  episodeNumber: number;
  totalEpisodes: number;
  episodeLabel: string;
  progress: number; // 0..1 ratio within target episode
  positionSeconds?: number;
  durationSeconds?: number;
  href: string;
  channel?: string;
}

/**
 * Derives Continue Watching entries from user/guest watch history rows and drama metadata.
 *
 * Rules (Task 12.3):
 * 1. Progress ratio is derived from position_seconds / duration_seconds if duration > 0,
 *    otherwise falls back to row.progress.
 * 2. If the user finished the entire series (episode >= totalEpisodes AND progress >= 0.95),
 *    the drama is considered finished and is omitted from Continue Watching.
 * 3. If an individual episode is finished (progress >= 0.95) and subsequent episodes exist:
 *    - Advance to episode + 1.
 *    - Reset progress ratio to 0.
 *    - Label as "Up Next: EP X of Y".
 * 4. Freshly selected episodes or in-progress episodes (< 0.95):
 *    - Retain current episode.
 *    - Retain progress ratio (0 if newly selected).
 *    - Label as "EP X of Y".
 * 5. Returns up to maxVisible entries (default 8).
 */
export function deriveContinueWatching(
  historyRows: WatchHistoryRow[],
  dramasBySlug: Map<string, DramaMeta>,
  maxVisible = 8
): ContinueWatchingEntry[] {
  const result: ContinueWatchingEntry[] = [];

  for (const row of historyRows) {
    const drama = dramasBySlug.get(row.title_slug);
    if (!drama) {
      continue;
    }

    const total = Math.max(1, drama.totalEpisodes || 1);

    // Derive ratio from position / duration if available, else fallback to progress
    const rawProgress =
      row.duration_seconds && row.duration_seconds > 0
        ? Math.min(1.0, Math.max(0.0, (row.position_seconds || 0) / row.duration_seconds))
        : Math.min(1.0, Math.max(0.0, row.progress || 0));

    // Finished series: reached or exceeded total episodes AND finished watching
    const isFinishedSeries = row.episode_number >= total && rawProgress >= 0.95;
    if (isFinishedSeries) {
      continue;
    }

    let targetEp = row.episode_number;
    let displayProgress = rawProgress;
    let label = `EP ${targetEp} of ${total}`;

    // Finished current episode: advance to next episode with 0% progress
    if (rawProgress >= 0.95 && targetEp < total) {
      targetEp = row.episode_number + 1;
      displayProgress = 0;
      label = `Up Next: EP ${targetEp} of ${total}`;
    }

    result.push({
      id: row.id || `cw-${row.title_slug}`,
      slug: row.title_slug,
      title: drama.title,
      poster: drama.poster,
      episodeNumber: targetEp,
      totalEpisodes: total,
      episodeLabel: label,
      progress: displayProgress,
      positionSeconds: targetEp === row.episode_number ? row.position_seconds : 0,
      durationSeconds: targetEp === row.episode_number ? row.duration_seconds : 0,
      href: `/watch/${row.title_slug}?ep=${targetEp}`,
      channel: drama.channel,
    });

    if (result.length >= maxVisible) {
      break;
    }
  }

  return result;
}
