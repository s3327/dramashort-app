import "server-only";
import { createUserServiceRoleClient } from "@/lib/supabase/user-server";
import { contentClient } from "@/lib/supabase/content";
import {
  mapTitleRowToTitle,
  searchPublishedTitles,
  type PaginatedTitlesResult,
} from "@/lib/services/content.service";
import type { Title } from "@/types/content";
import type {
  PlaybackEventPayload,
  IngestEventsResult,
  TrendingPeriod,
  TrendingRankingItem,
  RollupJobResult,
} from "@/types/analytics";

export interface PlaybackEventDbRecord {
  occurred_at: string;
  user_id: string | null;
  anon_id: string;
  session_id: string;
  title_slug: string;
  episode_number: number;
  event_type: string;
  platform: string;
  position_seconds: number | null;
  duration_seconds: number | null;
  utm: Record<string, unknown>;
  payload: Record<string, unknown>;
}

/**
 * Inserts a batch of playback events into public.playback_events using service-role privileges.
 */
export async function insertPlaybackEvents(
  events: PlaybackEventPayload[],
  userId?: string | null
): Promise<IngestEventsResult> {
  if (!events || events.length === 0) {
    return { ok: true, accepted: 0, anonId: "" };
  }

  const primaryAnonId = events[0].anonId;

  const records: PlaybackEventDbRecord[] = events.map((e) => ({
    occurred_at: e.occurredAt || new Date().toISOString(),
    user_id: userId ?? null,
    anon_id: e.anonId,
    session_id: e.sessionId,
    title_slug: e.titleSlug,
    episode_number: e.episodeNumber,
    event_type: e.eventType,
    platform: e.platform || "web",
    position_seconds: e.positionSeconds ?? null,
    duration_seconds: e.durationSeconds ?? null,
    utm: (e.utm as Record<string, unknown>) || {},
    payload: e.payload || {},
  }));

  try {
    const supabase = createUserServiceRoleClient();
    const { error } = await supabase.from("playback_events").insert(records as any);

    if (error) {
      console.error("[AnalyticsService] Failed to insert playback events:", error);
      return {
        ok: false,
        accepted: 0,
        anonId: primaryAnonId,
        errors: [error.message],
      };
    }

    return {
      ok: true,
      accepted: records.length,
      anonId: primaryAnonId,
    };
  } catch (err: any) {
    console.error("[AnalyticsService] Unexpected exception during event ingestion:", err);
    return {
      ok: false,
      accepted: 0,
      anonId: primaryAnonId,
      errors: [err?.message || "Internal database error"],
    };
  }
}

/**
 * Calculates a time-decayed trending score across a window of daily data points (e.g. 7 days).
 * Formula: sum_{d=0..N} [ starts_d * (1 + avg_completion_d) / (1 + 0.15 * d) ]
 */
export function computeDecayedTrendingScore(
  dailyPoints: Array<{ daysAgo: number; starts: number; avgCompletion: number }>
): number {
  if (!dailyPoints || dailyPoints.length === 0) return 0;
  let totalScore = 0;
  for (const point of dailyPoints) {
    const starts = Math.max(0, point.starts || 0);
    const completion = Math.min(1, Math.max(0, point.avgCompletion || 0));
    const daysAgo = Math.max(0, point.daysAgo || 0);
    const weight = 1 + 0.15 * daysAgo;
    const dayScore = (starts * (1 + completion)) / weight;
    totalScore += dayScore;
  }
  return Math.round(totalScore * 10000) / 10000;
}

/**
 * Executes the daily telemetry rollup job (Task 15.3).
 * Invoked by /api/cron/rollup or administrative backfills.
 */
export async function runDailyRollupJob(options?: {
  targetDate?: string;
}): Promise<RollupJobResult> {
  const targetDate = options?.targetDate || new Date().toISOString().slice(0, 10);
  const startTime = Date.now();

  try {
    const supabase = createUserServiceRoleClient();
    let processedTitles = 0;
    let processedEpisodes = 0;
    let rpcSucceeded = false;

    // 1. Attempt database RPC function execution
    try {
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)(
        "rollup_daily_playback_stats",
        { target_date: targetDate }
      );

      if (!rpcError && rpcData && typeof rpcData === "object") {
        rpcSucceeded = true;
        processedTitles = Number((rpcData as any).processed_titles || 0);
        processedEpisodes = Number((rpcData as any).processed_episodes || 0);
      }
    } catch {
      rpcSucceeded = false;
    }

    // 2. TypeScript fallback if RPC is not installed or returns an error
    if (!rpcSucceeded) {
      const nextDate = new Date(new Date(targetDate).getTime() + 86400000)
        .toISOString()
        .slice(0, 10);

      const { data: events, error: fetchErr } = await supabase
        .from("playback_events")
        .select("title_slug, episode_number, event_type, anon_id")
        .gte("occurred_at", `${targetDate}T00:00:00.000Z`)
        .lt("occurred_at", `${nextDate}T00:00:00.000Z`);

      if (!fetchErr && Array.isArray(events) && events.length > 0) {
        const epGroups = new Map<
          string,
          {
            titleSlug: string;
            episodeNumber: number;
            starts: number;
            completes: number;
            viewers: Set<string>;
          }
        >();

        const titleGroups = new Map<
          string,
          {
            titleSlug: string;
            starts: number;
            completes: number;
            viewers: Set<string>;
            ep1Viewers: Set<string>;
            ep2Viewers: Set<string>;
          }
        >();

        for (const ev of events as any[]) {
          const slug = ev.title_slug;
          const epNum = Number(ev.episode_number || 1);
          const epKey = `${slug}:${epNum}`;

          if (!epGroups.has(epKey)) {
            epGroups.set(epKey, {
              titleSlug: slug,
              episodeNumber: epNum,
              starts: 0,
              completes: 0,
              viewers: new Set(),
            });
          }
          const epEntry = epGroups.get(epKey)!;
          if (ev.anon_id) epEntry.viewers.add(ev.anon_id);
          if (ev.event_type === "episode_start") epEntry.starts++;
          if (ev.event_type === "episode_complete") epEntry.completes++;

          if (!titleGroups.has(slug)) {
            titleGroups.set(slug, {
              titleSlug: slug,
              starts: 0,
              completes: 0,
              viewers: new Set(),
              ep1Viewers: new Set(),
              ep2Viewers: new Set(),
            });
          }
          const tEntry = titleGroups.get(slug)!;
          if (ev.anon_id) tEntry.viewers.add(ev.anon_id);
          if (ev.event_type === "episode_start") {
            tEntry.starts++;
            if (epNum === 1 && ev.anon_id) tEntry.ep1Viewers.add(ev.anon_id);
            if (epNum === 2 && ev.anon_id) tEntry.ep2Viewers.add(ev.anon_id);
          }
          if (ev.event_type === "episode_complete") {
            tEntry.completes++;
          }
        }

        const epRecords = Array.from(epGroups.values()).map((g) => {
          const avgComp = g.starts > 0 ? Math.min(1, g.completes / g.starts) : 0;
          return {
            title_slug: g.titleSlug,
            episode_number: g.episodeNumber,
            stat_date: targetDate,
            starts: g.starts,
            completes: g.completes,
            unique_viewers: g.viewers.size,
            avg_completion: Math.round(avgComp * 10000) / 10000,
            updated_at: new Date().toISOString(),
          };
        });

        if (epRecords.length > 0) {
          await supabase.from("episode_stats_daily").upsert(epRecords as any, {
            onConflict: "title_slug,episode_number,stat_date",
          });
          processedEpisodes = epRecords.length;
        }

        const titleRecords = Array.from(titleGroups.values()).map((g) => {
          const avgComp = g.starts > 0 ? Math.min(1, g.completes / g.starts) : 0;
          const ep1To2 =
            g.ep1Viewers.size > 0
              ? Math.min(1, g.ep2Viewers.size / g.ep1Viewers.size)
              : 0;
          const baseScore = g.starts * (1 + avgComp);
          return {
            title_slug: g.titleSlug,
            stat_date: targetDate,
            starts: g.starts,
            completes: g.completes,
            unique_viewers: g.viewers.size,
            avg_completion: Math.round(avgComp * 10000) / 10000,
            ep1_to_ep2_rate: Math.round(ep1To2 * 10000) / 10000,
            trending_score: Math.round(baseScore * 10000) / 10000,
            updated_at: new Date().toISOString(),
          };
        });

        if (titleRecords.length > 0) {
          await supabase.from("title_stats_daily").upsert(titleRecords as any, {
            onConflict: "title_slug,stat_date",
          });
          processedTitles = titleRecords.length;
        }
      }
    }

    // 3. Compute 7-day rolling time-decayed trending scores
    const sevenDaysAgo = new Date(new Date(targetDate).getTime() - 6 * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data: recentRows } = await supabase
      .from("title_stats_daily")
      .select("title_slug, stat_date, starts, avg_completion")
      .gte("stat_date", sevenDaysAgo)
      .lte("stat_date", targetDate);

    if (recentRows && recentRows.length > 0) {
      const byTitle = new Map<
        string,
        Array<{ daysAgo: number; starts: number; avgCompletion: number }>
      >();
      const targetTime = new Date(targetDate).getTime();

      for (const row of recentRows as any[]) {
        const slug = row.title_slug;
        if (!byTitle.has(slug)) byTitle.set(slug, []);
        const rowTime = new Date(row.stat_date).getTime();
        const daysAgo = Math.max(0, Math.round((targetTime - rowTime) / 86400000));
        byTitle.get(slug)!.push({
          daysAgo,
          starts: Number(row.starts || 0),
          avgCompletion: Number(row.avg_completion || 0),
        });
      }

      for (const [slug, points] of byTitle.entries()) {
        const decayedScore = computeDecayedTrendingScore(points);
        await supabase
          .from("title_stats_daily")
          .update({
            trending_score: decayedScore,
            updated_at: new Date().toISOString(),
          } as any)
          .eq("title_slug", slug)
          .eq("stat_date", targetDate);
      }
    }

    return {
      ok: true,
      date: targetDate,
      processedTitles,
      processedEpisodes,
      durationMs: Date.now() - startTime,
    };
  } catch (err: any) {
    console.error("[AnalyticsService] Rollup job failed:", err);
    return {
      ok: false,
      date: targetDate,
      processedTitles: 0,
      processedEpisodes: 0,
      durationMs: Date.now() - startTime,
      error: err?.message || "Rollup job exception",
    };
  }
}

/**
 * Queries aggregated trending performance items for a given period (24h, 7d, 30d).
 */
export async function getTrendingStats(
  period: TrendingPeriod = "7d",
  limit: number = 24
): Promise<TrendingRankingItem[]> {
  try {
    const supabase = createUserServiceRoleClient();
    const daysWindow = period === "24h" ? 1 : period === "30d" ? 30 : 7;
    const sinceDate = new Date(Date.now() - daysWindow * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from("title_stats_daily")
      .select("title_slug, stat_date, starts, completes, unique_viewers, avg_completion, trending_score")
      .gte("stat_date", sinceDate)
      .order("stat_date", { ascending: false });

    if (error || !data || data.length === 0) {
      return [];
    }

    const bySlug = new Map<
      string,
      {
        titleSlug: string;
        starts: number;
        completes: number;
        uniqueViewers: number;
        dailyPoints: Array<{ daysAgo: number; starts: number; avgCompletion: number }>;
      }
    >();

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = new Date(todayStr).getTime();

    for (const row of data as any[]) {
      const slug = row.title_slug;
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          titleSlug: slug,
          starts: 0,
          completes: 0,
          uniqueViewers: 0,
          dailyPoints: [],
        });
      }
      const entry = bySlug.get(slug)!;
      entry.starts += Number(row.starts || 0);
      entry.completes += Number(row.completes || 0);
      entry.uniqueViewers = Math.max(entry.uniqueViewers, Number(row.unique_viewers || 0));

      const rowDateMs = new Date(row.stat_date).getTime();
      const daysAgo = Math.max(0, Math.round((todayMs - rowDateMs) / 86400000));
      entry.dailyPoints.push({
        daysAgo,
        starts: Number(row.starts || 0),
        avgCompletion: Number(row.avg_completion || 0),
      });
    }

    const items: TrendingRankingItem[] = [];
    for (const [slug, entry] of bySlug.entries()) {
      const avgCompletion =
        entry.starts > 0
          ? Math.min(1, Math.round((entry.completes / entry.starts) * 10000) / 10000)
          : 0;
      const score = computeDecayedTrendingScore(entry.dailyPoints);
      items.push({
        titleSlug: slug,
        trendingScore: score,
        starts: entry.starts,
        completes: entry.completes,
        uniqueViewers: entry.uniqueViewers,
        avgCompletion,
      });
    }

    items.sort((a, b) => b.trendingScore - a.trendingScore);
    return items.slice(0, limit);
  } catch (err) {
    console.warn("[AnalyticsService] Failed to query trending stats:", err);
    return [];
  }
}

/**
 * Retrieves paginated published titles ranked by engagement momentum in the given period.
 * Transparently falls back to the content catalog when no rollup stats exist yet.
 */
export async function getTrendingTitles(options?: {
  period?: TrendingPeriod;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedTitlesResult> {
  const period = options?.period || "7d";
  const page = Math.max(1, options?.page || 1);
  const requestedSize = options?.pageSize !== undefined ? options.pageSize : 24;
  const pageSize = Math.min(60, Math.max(1, requestedSize));

  try {
    const trendingStats = await getTrendingStats(period, 100);

    if (trendingStats.length > 0) {
      const slugs = trendingStats.map((s) => s.titleSlug);
      const { data: titleRows, error } = await contentClient
        .from("titles")
        .select("*, channels(name, slug, code)")
        .in("slug", slugs)
        .eq("status", "Published");

      if (!error && titleRows && titleRows.length > 0) {
        const titlesBySlug = new Map<string, Title>();
        for (const row of titleRows) {
          const t = mapTitleRowToTitle(row as any);
          titlesBySlug.set(t.slug, t);
        }

        const orderedItems: Title[] = [];
        for (const stat of trendingStats) {
          const title = titlesBySlug.get(stat.titleSlug);
          if (title) {
            orderedItems.push(title);
          }
        }

        if (orderedItems.length > 0) {
          const total = orderedItems.length;
          const totalPages = Math.max(1, Math.ceil(total / pageSize));
          const from = (page - 1) * pageSize;
          const pagedItems = orderedItems.slice(from, from + pageSize);

          return {
            items: pagedItems,
            total,
            page,
            pageSize,
            totalPages,
          };
        }
      }
    }
  } catch (err) {
    console.warn("[AnalyticsService] Error resolving trending titles, falling back to catalog:", err);
  }

  // Resilient fallback to content catalog sorted by trending (views)
  return await searchPublishedTitles({
    sort: "trending",
    page,
    pageSize,
  });
}

