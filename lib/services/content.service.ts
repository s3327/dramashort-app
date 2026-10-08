import { cache } from "react";
import { contentClient, getContentAdminClient, getTestContentClient } from "@/lib/supabase/content";
import type { Database } from "@/types/supabase-content";
import type {
  Title,
  TitleStatus,
  Drama,
  DramaStatus,
  Channel,
  Episode,
  HeroSlide,
  PlaybackSource,
  AdminEpisode,
  AdminEpisodeMedia,
  EpisodeMediaStatus,
  CreateEpisodeInput,
  BulkCreateEpisodesInput,
  BulkAssignMediaItem,
  UpdateEpisodeInput,
  AdminChannel,
  CreateChannelInput,
  UpdateChannelInput,
} from "@/types/content";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import { isUuid } from "@/lib/validation/drama";
import { type Result, ok, err } from "@/types/result";
import { getApiErrorMessage, readJsonSafely } from "@/lib/api/error-message";
import { adminFetch } from "@/lib/api/admin-fetch";

export type {
  Title,
  TitleStatus,
  Drama,
  DramaStatus,
  Channel,
  Episode,
  HeroSlide,
  PlaybackSource,
  AdminEpisode,
  AdminEpisodeMedia,
  EpisodeMediaStatus,
  CreateEpisodeInput,
  BulkCreateEpisodesInput,
  BulkAssignMediaItem,
  UpdateEpisodeInput,
  AdminChannel,
  CreateChannelInput,
  UpdateChannelInput,
};
export type { Result };

export type TitleRow = Database["public"]["Tables"]["titles"]["Row"];
export type DramaRow = TitleRow;
export type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
export type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];
export type EpisodeMediaRow = Database["public"]["Tables"]["episode_media"]["Row"];

/**
 * Adapter converting Supabase `titles` table row to frontend `Title` shape.
 * Maintains complete backwards compatibility with all existing components.
 */
export function mapTitleRowToTitle(row: TitleRow): Title {
  const joinedChannel = Array.isArray((row as any).channels)
    ? (row as any).channels[0]
    : (row as any).channels;
  const channelName = joinedChannel?.name || row.channel_name;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    poster: row.poster_url,
    synopsis: row.synopsis,
    channel: channelName,
    genre: row.genre,
    tags: row.tags || [],
    totalEpisodes: row.total_episodes,
    episodesAvailable:
      row.episodes_available !== undefined && row.episodes_available !== null
        ? Number(row.episodes_available)
        : undefined,
    rating: row.rating ? Number(row.rating) : undefined,
    views: row.views_count ?? 0,
    createdAt: row.created_at || new Date().toISOString(),
    status: (row.status as TitleStatus) || "Published",
    year: row.release_year ?? 2026,
    bannerUrl: row.banner_url || null,
    heroTagline: row.hero_tagline || null,
    featuredRank:
      row.featured_rank !== undefined && row.featured_rank !== null
        ? Number(row.featured_rank)
        : null,
    freeEpisodesCount:
      row.free_episodes_count !== undefined && row.free_episodes_count !== null
        ? Number(row.free_episodes_count)
        : 5,
    publishAt: row.publish_at || null,
    hasBeenPublished: row.has_been_published ?? (row.status === "Published"),
  };
}

/** Domain entity alias for mapTitleRowToTitle */
export const mapDramaRowToDrama = mapTitleRowToTitle;

export function mapChannelRowToChannel(row: ChannelRow & { drama_count?: number }): Channel {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    code: row.code,
    description: row.description || null,
    avatarUrl: row.avatar_url || null,
    bannerUrl: row.banner_url || null,
    createdAt: row.created_at || null,
    updatedAt: (row as any).updated_at || null,
    dramaCount: typeof row.drama_count === "number" ? row.drama_count : undefined,
  };
}

export function mapEpisodeRowToEpisode(
  row: Pick<EpisodeRow, "id" | "title_id" | "episode_number"> & Partial<EpisodeRow>
): Episode {
  return {
    id: row.id,
    titleId: row.title_id,
    episodeNumber: row.episode_number,
    title: row.title || `Episode ${row.episode_number}`,
    videoUrl: row.video_url || "",
    thumbnailUrl: row.thumbnail_url || "",
    durationSeconds: row.duration_seconds || 0,
    isFree: row.is_free ?? true,
    releaseAt: row.release_at || null,
    createdAt: row.created_at || undefined,
  };
}

export interface TitleQueryOptions {
  query?: string;
  search?: string;
  genre?: string;
  channelId?: string;
  channelName?: string;
  channelSlug?: string;
  tags?: string[];
  sort?: "trending" | "newest" | "rating";
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export type DramaQueryOptions = TitleQueryOptions;

export interface PaginatedTitlesResult {
  items: Title[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string | null;
}

export type PaginatedDramasResult = PaginatedTitlesResult;

/**
 * Executes a server-side search and filtering query over the titles database with pagination.
 * Attempts high-performance `search_dramas` RPC (with GIN trigram indexing and total_count aggregation),
 * falling back transparently to indexed PostgREST queries if the remote database has not yet pushed the migration.
 */
export async function searchPublishedTitles(
  options?: TitleQueryOptions
): Promise<PaginatedTitlesResult> {
  const page = Math.max(1, options?.page || 1);
  const requestedSize =
    options?.pageSize !== undefined
      ? options.pageSize
      : options?.limit !== undefined
      ? options.limit
      : 24;
  const pageSize = Math.min(60, Math.max(1, requestedSize));
  const from =
    options?.offset !== undefined ? options.offset : (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const rawSearch = (options?.query || options?.search || "").trim();
    const cleanTerm = rawSearch ? rawSearch.replace(/[,()]/g, " ").trim() : "";
    const rawGenre = options?.genre ? options.genre.trim() : "";
    const cleanGenre =
      rawGenre &&
      rawGenre !== "All" &&
      rawGenre !== "All Genres"
        ? rawGenre
        : null;

    const cleanTags = options?.tags
      ? options.tags
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean)
      : [];

    // Channel resolution & validation
    let resolvedChannelId: string | null = options?.channelId || null;
    let channelFilterActive = Boolean(options?.channelId);

    if (!resolvedChannelId && options?.channelSlug) {
      channelFilterActive = true;
      const { data: ch } = await contentClient
        .from("channels")
        .select("id")
        .eq("slug", options.channelSlug.toLowerCase().trim())
        .maybeSingle();
      if (ch?.id) {
        resolvedChannelId = ch.id;
      } else {
        if (ENABLE_MOCK_FALLBACK) {
          return await filterMockTitles(options, page, pageSize);
        }
        return { items: [], total: 0, page, pageSize, totalPages: 1 };
      }
    } else if (
      !resolvedChannelId &&
      options?.channelName &&
      options.channelName.trim() !== "All" &&
      options.channelName.trim() !== "All Channels"
    ) {
      channelFilterActive = true;
      const { data: ch } = await contentClient
        .from("channels")
        .select("id")
        .eq("name", options.channelName.trim())
        .maybeSingle();
      if (ch?.id) {
        resolvedChannelId = ch.id;
      }
    }

    // Check if test client or standard client supports RPC
    const testClient = getTestContentClient();
    const shouldAttemptRpc = testClient
      ? typeof testClient.rpc === "function"
      : typeof (contentClient as any).rpc === "function";

    // Only attempt RPC if channel resolution succeeded (or no channel was requested),
    // and if resolvedChannelId is a valid UUID (PostgreSQL search_dramas requires UUID).
    const isValidRpcChannelId = !resolvedChannelId || isUuid(resolvedChannelId);
    const canAttemptRpc =
      shouldAttemptRpc &&
      (!channelFilterActive || (resolvedChannelId !== null && isValidRpcChannelId));

    if (canAttemptRpc) {
      try {
        const { data, count, error } = await (contentClient as any).rpc(
          "search_dramas",
          {
            query_text: cleanTerm || null,
            filter_genre: cleanGenre,
            filter_channel_id: resolvedChannelId,
            filter_tags: cleanTags.length > 0 ? cleanTags : null,
            sort_by: options?.sort || (cleanTerm ? "relevance" : "trending"),
            page_offset: from,
            page_limit: pageSize,
          },
          { count: "exact" }
        );

        if (!error && data !== null && data !== undefined) {
          let rawRows: any[] = [];
          let totalCount = 0;

          if (Array.isArray(data)) {
            rawRows = data;
            totalCount =
              rawRows.length > 0 && rawRows[0].total_count !== undefined
                ? Number(rawRows[0].total_count)
                : count !== null && count !== undefined
                ? count
                : rawRows.length;
          } else if (typeof data === "object") {
            if (Array.isArray((data as any).items)) {
              rawRows = (data as any).items;
              totalCount =
                typeof (data as any).total === "number"
                  ? (data as any).total
                  : rawRows.length;
            }
          }

          const items = rawRows.map(mapTitleRowToTitle);
          const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

          return {
            items,
            total: totalCount,
            page,
            pageSize,
            totalPages,
          };
        }
        if (error) {
          console.warn("search_dramas RPC unavailable, falling back to PostgREST:", error.message);
        }
      } catch (rpcErr) {
        console.warn("search_dramas RPC failed, falling back to PostgREST:", rpcErr);
      }
    }

    // Transparent fallback to PostgREST query
    let query = contentClient
      .from("titles")
      .select("*, channels(name, slug, code)", { count: "exact" })
      .eq("status", "Published");

    // Search query (matches title or synopsis)
    if (cleanTerm) {
      const escaped = escapePostgrestValue(cleanTerm);
      query = query.or(
        `title.ilike.%${escaped}%,synopsis.ilike.%${escaped}%`
      );
    }

    // Channel filtering
    if (resolvedChannelId) {
      query = query.eq("channel_id", resolvedChannelId);
    } else if (
      options?.channelName &&
      options.channelName.trim() !== "All" &&
      options.channelName.trim() !== "All Channels"
    ) {
      query = query.eq("channel_name", options.channelName.trim());
    }

    if (cleanGenre) {
      query = query.eq("genre", cleanGenre);
    }

    if (cleanTags.length > 0) {
      query = query.contains("tags", cleanTags);
    }

    // Deterministic sort order with ID as stable tie-breaker
    if (options?.sort === "newest") {
      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true });
    } else if (options?.sort === "rating") {
      query = query
        .order("rating", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });
    } else {
      query = query
        .order("views_count", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true });
    }

    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error || !data) {
      console.warn("Failed to query titles from Supabase:", error?.message);
      if (ENABLE_MOCK_FALLBACK) {
        return await filterMockTitles(options, page, pageSize);
      }
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
        error: error?.message || "Failed to query titles from database",
      };
    }

    const items = data.map(mapTitleRowToTitle);
    const total = count !== null ? count : items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  } catch (err) {
    console.error("Error in searchPublishedTitles:", err);
    if (ENABLE_MOCK_FALLBACK) {
      return await filterMockTitles(options, page, pageSize);
    }
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
      error: err instanceof Error ? err.message : "Error querying titles",
    };
  }
}

/** Domain alias for searchPublishedTitles */
export const searchDramas = searchPublishedTitles;

/**
 * Returns search results wrapped in the shared Result<T> type.
 */
export async function searchPublishedTitlesResult(
  options?: TitleQueryOptions
): Promise<Result<PaginatedTitlesResult>> {
  const res = await searchPublishedTitles(options);
  if (res.error) {
    return err(res.error);
  }
  return ok(res);
}

/** Canonical domain alias for searchPublishedTitlesResult */
export const searchDramasResult = searchPublishedTitlesResult;

/**
 * In-memory fallback filtering for mock data during offline development.
 * Dynamically imports test data only when ENABLE_MOCK_FALLBACK is enabled.
 */
async function filterMockTitles(
  options?: TitleQueryOptions,
  page = 1,
  pageSize = 24
): Promise<PaginatedTitlesResult> {
  const { titles: mockTitles } = await import("@/data/titles.mock");
  const q = (options?.query || options?.search || "").trim().toLowerCase();
  const channelName = options?.channelName;
  const channelId = options?.channelId;
  const channelSlug = options?.channelSlug;
  const genre = options?.genre;
  const tags = options?.tags;

  const filtered = mockTitles.filter((item) => {
    const isPublished = item.status === "Published";
    const matchesQuery =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.synopsis.toLowerCase().includes(q);
    const matchesChannel =
      (!channelId &&
        !channelSlug &&
        (!channelName ||
          channelName === "All Channels" ||
          channelName === "All" ||
          item.channel === channelName)) ||
      (channelName &&
        (channelName === "All Channels" ||
          channelName === "All" ||
          item.channel === channelName));
    const matchesGenre =
      !genre ||
      genre === "All Genres" ||
      genre === "All" ||
      item.genre === genre;
    const matchesTags =
      !tags || tags.length === 0 || tags.every((t) => item.tags.includes(t));

    return (
      isPublished && matchesQuery && matchesChannel && matchesGenre && matchesTags
    );
  });

  if (options?.sort === "newest") {
    filtered.sort((a, b) => {
      const diff =
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  } else if (options?.sort === "rating") {
    filtered.sort((a, b) => {
      const diff = (b.rating || 0) - (a.rating || 0);
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  } else {
    filtered.sort((a, b) => {
      const diff = b.views - a.views;
      return diff !== 0 ? diff : a.id.localeCompare(b.id);
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Fetches all published titles with optional filtering and sorting.
 * Backward-compatible wrapper returning Title[] array.
 */
export async function getPublishedTitles(
  options?: TitleQueryOptions
): Promise<Title[]> {
  const result = await searchPublishedTitles(options);
  return result.items;
}

/** Domain alias for getPublishedTitles */
export const getPublishedDramas = getPublishedTitles;

/**
 * Fetches distinct available genres across all published dramas.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 * Leverages PostgreSQL `get_distinct_genres` RPC for in-database aggregation, eliminating client row downloads and 1,000-row limits.
 */
export const getDistinctGenres = cache(async function getDistinctGenres(): Promise<string[]> {
  const testClient = getTestContentClient();
  const shouldAttemptRpc = testClient
    ? typeof testClient.rpc === "function"
    : typeof (contentClient as any).rpc === "function";

  if (shouldAttemptRpc) {
    try {
      const { data, error } = await (contentClient as any).rpc("get_distinct_genres");
      if (!error && Array.isArray(data) && data.length > 0) {
        const genres = data
          .map((item: any) =>
            typeof item === "string" ? item.trim() : item?.genre?.trim()
          )
          .filter(Boolean);
        return Array.from(new Set(genres)).sort();
      }
      if (error) {
        console.warn("get_distinct_genres RPC unavailable, falling back:", error.message);
      }
    } catch (rpcErr) {
      console.warn("get_distinct_genres RPC failed, falling back:", rpcErr);
    }
  }

  try {
    const { data, error } = await contentClient
      .from("titles")
      .select("genre")
      .eq("status", "Published");
    if (!error && data && data.length > 0) {
      const set = new Set(
        data
          .map((r: any) => (typeof r.genre === "string" ? r.genre.trim() : ""))
          .filter(Boolean)
      );
      return Array.from(set).sort();
    }
  } catch (err) {
    console.warn("Failed to fetch distinct genres:", err);
  }
  if (ENABLE_MOCK_FALLBACK) {
    return [
      "Coming of Age",
      "Dark Romance",
      "Fantasy",
      "Marriage",
      "Military",
      "Period",
      "Rebirth",
      "Rivals",
      "Romance",
    ];
  }
  return [];
});

/**
 * Fetches popular taxonomy tags / tropes across all published dramas.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 * Leverages PostgreSQL `get_popular_tags` RPC for in-database frequency aggregation, eliminating client row downloads and 1,000-row limits.
 */
export const getPopularTags = cache(async function getPopularTags(
  limit = 50
): Promise<string[]> {
  const limitCount = Math.max(1, Math.min(200, limit || 50));
  const testClient = getTestContentClient();
  const shouldAttemptRpc = testClient
    ? typeof testClient.rpc === "function"
    : typeof (contentClient as any).rpc === "function";

  if (shouldAttemptRpc) {
    try {
      const { data, error } = await (contentClient as any).rpc("get_popular_tags", {
        limit_count: limitCount,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        const tags = data
          .map((item: any) =>
            typeof item === "string" ? item.trim() : item?.tag?.trim()
          )
          .filter(Boolean);
        return Array.from(new Set(tags));
      }
      if (error) {
        console.warn("get_popular_tags RPC unavailable, falling back:", error.message);
      }
    } catch (rpcErr) {
      console.warn("get_popular_tags RPC failed, falling back:", rpcErr);
    }
  }

  try {
    const { data, error } = await contentClient
      .from("titles")
      .select("tags")
      .eq("status", "Published");
    if (!error && data && data.length > 0) {
      const set = new Set(
        data
          .flatMap((r: any) => (Array.isArray(r.tags) ? r.tags : []))
          .map((t: any) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean)
      );
      return Array.from(set).sort().slice(0, limitCount);
    }
  } catch (err) {
    console.warn("Failed to fetch popular tags:", err);
  }
  if (ENABLE_MOCK_FALLBACK) {
    return [
      "CEO",
      "Revenge",
      "Marriage",
      "Second Chance",
      "Secret Identity",
      "Fake Marriage",
      "Romance",
      "Billionaire",
      "Villain",
      "Fantasy",
    ].slice(0, limitCount);
  }
  return [];
});

export interface TaxonomyCountsResult {
  genres: Array<{ genre: string; count: number }>;
  tags: Array<{ tag: string; count: number }>;
}

/**
 * Fetches unified taxonomy counts (genres and tags) computed directly inside PostgreSQL.
 * Wrapped in React.cache() for per-request query deduplication.
 */
export const getTaxonomyCounts = cache(async function getTaxonomyCounts(): Promise<TaxonomyCountsResult> {
  const testClient = getTestContentClient();
  const shouldAttemptRpc = testClient
    ? typeof testClient.rpc === "function"
    : typeof (contentClient as any).rpc === "function";

  if (shouldAttemptRpc) {
    try {
      const { data, error } = await (contentClient as any).rpc("get_taxonomy_counts");
      if (!error && data) {
        const rawGenres = Array.isArray((data as any).genres) ? (data as any).genres : [];
        const rawTags = Array.isArray((data as any).tags) ? (data as any).tags : [];
        return {
          genres: rawGenres.map((g: any) => ({
            genre: typeof g.genre === "string" ? g.genre.trim() : String(g.genre || ""),
            count: Number(g.count || 0),
          })),
          tags: rawTags.map((t: any) => ({
            tag: typeof t.tag === "string" ? t.tag.trim() : String(t.tag || ""),
            count: Number(t.count || 0),
          })),
        };
      }
      if (error) {
        console.warn("get_taxonomy_counts RPC unavailable:", error.message);
      }
    } catch (err) {
      console.warn("get_taxonomy_counts RPC failed:", err);
    }
  }

  if (ENABLE_MOCK_FALLBACK) {
    try {
      const { titles: mockTitles } = await import("@/data/titles.mock");
      const genreMap = new Map<string, number>();
      const tagMap = new Map<string, number>();
      for (const t of mockTitles) {
        if (t.status === "Published" && t.genre) {
          const g = t.genre.trim();
          if (g) genreMap.set(g, (genreMap.get(g) || 0) + 1);
        }
        if (t.status === "Published" && Array.isArray(t.tags)) {
          for (const rawTag of t.tags) {
            const tag = typeof rawTag === "string" ? rawTag.trim() : "";
            if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
          }
        }
      }
      return {
        genres: Array.from(genreMap.entries())
          .map(([genre, count]) => ({ genre, count }))
          .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre)),
        tags: Array.from(tagMap.entries())
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      };
    } catch {
      // Mock import failure, return empty arrays
    }
  }

  return { genres: [], tags: [] };
});

/**
 * Fetches a single title by its unique slug (e.g. "the-ceos-secret-wife-ds").
 * Also supports matching by partial or old slug format.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getTitleBySlug = cache(async function getTitleBySlug(slug: string): Promise<Title | null> {
  try {
    // 1. Try exact slug match
    let { data, error } = await contentClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .eq("slug", slug)
      .maybeSingle();

    // 2. If not found, try matching by prefix (for old slugs without channel acronym)
    if (!data && !error) {
      const { data: prefixMatch } = await contentClient
        .from("titles")
        .select("*, channels(name, slug, code)")
        .ilike("slug", `${slug}-%`)
        .limit(1)
        .maybeSingle();

      data = prefixMatch;
    }

    if (!data) return null;
    return mapTitleRowToTitle(data);
  } catch (err) {
    console.error("Error in getTitleBySlug:", err);
    return null;
  }
});

/** Domain alias for getTitleBySlug */
export const getDramaBySlug = getTitleBySlug;

/**
 * Fetches multiple titles matching a list of slugs from Supabase.
 */
export async function getTitlesBySlugs(slugs: string[]): Promise<Title[]> {
  if (!slugs || slugs.length === 0) return [];
  try {
    const { data, error } = await contentClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .in("slug", slugs);

    const foundMap = new Map<string, Title>();
    if (!error && data) {
      data.forEach((row) => {
        const title = mapTitleRowToTitle(row);
        foundMap.set(row.slug, title);
      });
    }

    // For any missing slugs, check if they match with a prefix or fallback
    const missingSlugs = slugs.filter((s) => !foundMap.has(s));
    if (missingSlugs.length > 0) {
      await Promise.all(
        missingSlugs.map(async (slug) => {
          const t = await getTitleBySlug(slug);
          if (t) {
            foundMap.set(slug, t);
          }
        })
      );
    }

    return slugs
      .map((s) => foundMap.get(s))
      .filter((t): t is Title => !!t);
  } catch (err) {
    console.error("Error in getTitlesBySlugs:", err);
    return [];
  }
}

/** Domain alias for getTitlesBySlugs */
export const getDramasBySlugs = getTitlesBySlugs;

/**
 * Fetches episodes for a specific title ID ordered by episode_number ascending.
 * Uses explicit non-sensitive public columns (excluding raw video_url).
 */
export async function getEpisodesByTitleId(titleId: string): Promise<Episode[]> {
  try {
    const { data, error } = await contentClient
      .from("episodes")
      .select("id, title_id, episode_number, title, thumbnail_url, duration_seconds, is_free, created_at")
      .eq("title_id", titleId)
      .order("episode_number", { ascending: true });

    if (error || !data) return [];
    return data.map((row) => mapEpisodeRowToEpisode(row));
  } catch (err) {
    console.error("Error in getEpisodesByTitleId:", err);
    return [];
  }
}

/** Domain alias for getEpisodesByTitleId */
export const getEpisodesByDramaId = getEpisodesByTitleId;



/**
 * Fetches secure server-gated playback session for an episode (Task 10.6).
 */
export async function getEpisodePlayback(
  episodeId: string
): Promise<{ success: boolean; data?: PlaybackSource; error?: string }> {
  try {
    const res = await fetch(`/api/playback/${encodeURIComponent(episodeId)}`);
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: PlaybackSource;
      error?: { code: string; message: string };
    } | null;

    if (!res.ok || !json?.success || !json.data) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to load playback (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Network error while loading video playback";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Top Trending titles for Home & Trending page.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getTopTrendingTitles = cache(async function getTopTrendingTitles(limit = 10): Promise<Title[]> {
  return getPublishedTitles({ sort: "trending", limit });
});

/** Domain alias for getTopTrendingTitles */
export const getTopTrendingDramas = getTopTrendingTitles;

/**
 * New Releases for Home & New Release page.
 */
export async function getNewReleaseTitles(limit = 12): Promise<Title[]> {
  return getPublishedTitles({ sort: "newest", limit });
}

/** Domain alias for getNewReleaseTitles */
export const getNewReleaseDramas = getNewReleaseTitles;

/**
 * Fetches all available channels.
 */
export async function getChannels(): Promise<Channel[]> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/channels");
      if (res.ok) {
        const body = (await readJsonSafely(res)) as { channels?: Channel[] } | null;
        if (body?.channels && Array.isArray(body.channels) && body.channels.length > 0) {
          return body.channels;
        }
      }
    } catch {
      // Fall through to contentClient
    }
  }

  try {
    const { data, error } = await contentClient
      .from("channels")
      .select("*")
      .order("name", { ascending: true });

    if (error || !data) return [];
    return data.map(mapChannelRowToChannel);
  } catch (err) {
    console.error("Error in getChannels:", err);
    return [];
  }
}

/**
 * Fetches a single channel by its slug.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getChannelBySlug = cache(async function getChannelBySlug(slug: string): Promise<Channel | null> {
  try {
    const normalized = (slug || "").toLowerCase().trim();
    let { data, error } = await contentClient
      .from("channels")
      .select("*")
      .eq("slug", normalized)
      .maybeSingle();

    if (!data && normalized) {
      const { data: fallbackData } = await contentClient
        .from("channels")
        .select("*")
        .ilike("slug", normalized)
        .maybeSingle();
      data = fallbackData;
    }

    if (error || !data) return null;
    return mapChannelRowToChannel(data);
  } catch (err) {
    console.error("Error in getChannelBySlug:", err);
    return null;
  }
});

/**
 * Generates hero slides from curated featured titles or top trending titles (Task 14.6).
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getHeroSlides = cache(async function getHeroSlides(): Promise<HeroSlide[]> {
  try {
    let titles: Title[] = [];

    // 1. Attempt to fetch curated titles if supported by client
    try {
      let query: any = contentClient
        .from("titles")
        .select("*, channels(name, slug, code)")
        .eq("status", "Published");

      if (typeof query.not === "function") {
        query = query.not("featured_rank", "is", null);
      }
      if (typeof query.order === "function") {
        query = query.order("featured_rank", { ascending: true });
      }
      if (typeof query.limit === "function") {
        query = query.limit(5);
      }
      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        titles = data.map(mapTitleRowToTitle);
      }
    } catch {
      // Fallback silently if table columns or query builder methods are not present in test mock
    }

    // 2. If fewer than 4 curated titles, supplement with top trending titles
    if (titles.length < 4) {
      const trending = await getTopTrendingTitles(4);
      if (Array.isArray(trending)) {
        const existingIds = new Set(titles.map((t) => t.id));
        for (const item of trending) {
          if (!existingIds.has(item.id)) {
            titles.push(item);
            existingIds.add(item.id);
          }
          if (titles.length >= 4) break;
        }
      }
    }

    if (!titles || titles.length === 0) {
      return [];
    }
    const defaultBadges = ["🔥 #1 Trending", "✨ New Episode Daily", "💎 Editor's Pick", "🎬 Fan Favorite"];

    return titles.map((t, idx) => ({
      id: `hs-${t.id}`,
      title: t.title,
      tagline: t.heroTagline || (t.synopsis.slice(0, 110) + (t.synopsis.length > 110 ? "..." : "")),
      badge: defaultBadges[idx % defaultBadges.length],
      image: t.bannerUrl || t.poster,
      bannerUrl: t.bannerUrl || null,
      posterUrl: t.poster,
      href: `/drama/${t.slug}`,
    }));
  } catch (err) {
    console.error("Error in getHeroSlides:", err);
    return [];
  }
});

/**
 * Escapes values used in PostgREST filter expressions (such as `.or()`),
 * escaping backslashes and double quotes, and stripping newlines.
 * Returns empty string for falsy/non-string values to prevent runtime errors.
 */
export function escapePostgrestValue(value?: string | null): string {
  if (!value || typeof value !== "string") {
    return "";
  }
  return value
    .replace(/\r?\n|\r/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
}

/**
 * Deterministic related titles lookup from the database.
 */
export async function getRelatedTitlesFromDb(
  drama: { slug: string; genre?: string; tags?: string[]; channel?: string },
  count = 8
): Promise<Title[]> {
  try {
    const escapedGenre = escapePostgrestValue(drama.genre);
    const escapedChannel = escapePostgrestValue(drama.channel);

    const orFilters: string[] = [];
    if (escapedGenre) {
      orFilters.push(`genre.eq."${escapedGenre}"`);
    }
    if (escapedChannel) {
      orFilters.push(`channel_name.eq."${escapedChannel}"`);
    }

    // 1. Fetch titles with matching genre or channel
    if (orFilters.length > 0) {
      const { data, error } = await contentClient
        .from("titles")
        .select("*, channels(name, slug, code)")
        .eq("status", "Published")
        .neq("slug", drama.slug)
        .or(orFilters.join(","))
        .limit(count);

      if (!error && data && data.length > 0) {
        return data.map(mapTitleRowToTitle);
      }
    }

    // 2. Fallback to latest published titles if no genre/channel matches
    const { data: latest } = await contentClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .eq("status", "Published")
      .neq("slug", drama.slug)
      .limit(count);

    return latest ? latest.map(mapTitleRowToTitle) : [];
  } catch {
    return [];
  }
}

/** Domain alias for getRelatedTitlesFromDb */
export const getRelatedDramasFromDb = getRelatedTitlesFromDb;

/**
 * Fetches a single drama by ID for administrative editing.
 * In the browser, queries through the authenticated Admin API (/api/admin/dramas/:id),
 * which bypasses RLS and returns drafts, scheduled, archived, and published dramas.
 * Never falls back to mock titles.
 */
export async function getDramaById(id: string): Promise<Drama | null> {
  if (!id) return null;

  // 1. Browser context: call the authenticated admin API endpoint
  if (typeof window !== "undefined") {
    try {
      const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}`);
      if (res.ok) {
        const body = (await readJsonSafely(res)) as { success?: boolean; data?: Drama } | null;
        if (body?.success && body.data) {
          return body.data;
        }
      }
    } catch (err) {
      console.warn("Admin API getDramaById lookup failed:", err);
    }
    return null;
  }

  // 2. Server-side or Node test context
  try {
    if (
      process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_CONTENT_SERVICE_ROLE_KEY
    ) {
      const adminClient = getContentAdminClient();
      const { data, error } = await adminClient
        .from("titles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return mapTitleRowToTitle(data);
      }
    } else {
      const { data, error } = await contentClient
        .from("titles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) {
        return mapTitleRowToTitle(data);
      }
    }
  } catch (err) {
    console.warn("Database getDramaById lookup failed:", err);
  }

  return null;
}

/** Domain entity alias for getDramaById */
export const getTitleById = getDramaById;

export interface AdminDramaQueryOptions {
  q?: string;
  channel?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface AdminDramasResult {
  items: Drama[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Fetches dramas for the administrative catalog via the authenticated Admin API.
 * Supports server-side search, channel filtering, status filtering, and pagination.
 * Never falls back to mock titles.
 */
export async function getAdminDramas(
  options?: AdminDramaQueryOptions
): Promise<AdminDramasResult> {
  const page = Math.max(1, options?.page || 1);
  const pageSize = Math.min(250, Math.max(1, options?.pageSize || 20));

  const params = new URLSearchParams();
  if (options?.q) params.set("q", options.q);
  if (options?.channel && options.channel !== "All Channels" && options.channel !== "All") {
    params.set("channel", options.channel);
  }
  if (options?.status && options.status !== "all" && options.status !== "All Statuses" && options.status !== "All") {
    params.set("status", options.status);
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (options?.sort) params.set("sort", options.sort);

  const queryString = `?${params.toString()}`;

  // 1. Browser context: call the authenticated admin API endpoint
  if (typeof window !== "undefined") {
    try {
      const res = await adminFetch(`/api/admin/dramas${queryString}`);
      if (res.ok) {
        const json = (await readJsonSafely(res)) as {
          success?: boolean;
          data?: AdminDramasResult | Drama[];
        } | null;
        if (json?.success && json.data) {
          if ("items" in json.data && Array.isArray(json.data.items)) {
            return json.data as AdminDramasResult;
          }
          if (Array.isArray(json.data)) {
            return {
              items: json.data,
              total: json.data.length,
              page,
              pageSize,
              totalPages: Math.max(1, Math.ceil(json.data.length / pageSize)),
            };
          }
        }
      }
    } catch (err) {
      console.warn("Admin API getAdminDramas fetch failed:", err);
    }
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 1,
    };
  }

  // 2. Server-side or Node test context
  try {
    if (
      process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_CONTENT_SERVICE_ROLE_KEY
    ) {
      const adminClient = getContentAdminClient();
      let query = adminClient
        .from("titles")
        .select("*, channels(name, slug, code)", { count: "exact" });

      if (options?.q?.trim()) {
        query = query.ilike("title", `%${options.q.trim()}%`);
      }
      if (options?.channel && options.channel !== "All Channels" && options.channel !== "All") {
        query = query.eq("channel_name", options.channel);
      }
      if (options?.status && options.status !== "all" && options.status !== "All Statuses" && options.status !== "All") {
        query = query.eq("status", options.status);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);

      const { data, count, error } = await query;
      if (!error && data) {
        const items = data.map(mapTitleRowToTitle);
        const total = count !== null && count !== undefined ? count : items.length;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
      }
    } else {
      let query = contentClient
        .from("titles")
        .select("*, channels(name, slug, code)", { count: "exact" });

      if (options?.q?.trim()) {
        query = query.ilike("title", `%${options.q.trim()}%`);
      }
      if (options?.channel && options.channel !== "All Channels" && options.channel !== "All") {
        query = query.eq("channel_name", options.channel);
      }
      if (options?.status && options.status !== "all" && options.status !== "All Statuses" && options.status !== "All") {
        query = query.eq("status", options.status);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);

      const { data, count, error } = await query;
      if (!error && data) {
        const items = data.map(mapTitleRowToTitle);
        const total = count !== null && count !== undefined ? count : items.length;
        return {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
      }
    }
  } catch (err) {
    console.warn("Database getAdminDramas lookup failed:", err);
  }

  return {
    items: [],
    total: 0,
    page,
    pageSize,
    totalPages: 1,
  };
}

export interface UpdateDramaPayload {
  title?: string;
  slug?: string;
  synopsis?: string;
  genre?: string;
  tags?: string[] | string;
  channel?: string;
  channel_name?: string;
  channel_code?: string;
  channel_id?: string | null;
  status?: TitleStatus;
  totalEpisodes?: number;
  total_episodes?: number;
  episodesAvailable?: number;
  episodes_available?: number;
  poster?: string;
  poster_url?: string;
  banner?: string;
  banner_url?: string;
  publishAt?: string | null;
  publish_at?: string | null;
}

/**
 * Persists changes to a Drama via the administrative API.
 * Updates Supabase Content DB with full verification.
 */
export async function updateDrama(
  id: string,
  payload: UpdateDramaPayload
): Promise<{ success: boolean; data?: Drama; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await readJsonSafely(res)) as { success?: boolean; data?: Drama } | null;
    if (!res.ok || !data?.success) {
      return {
        success: false,
        error: getApiErrorMessage(data, `Update failed with HTTP ${res.status}`),
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Network error while saving changes";
    return {
      success: false,
      error: msg,
    };
  }
}

/** Domain entity alias for updateDrama */
export const updateTitle = updateDrama;

export interface CreateDramaPayload {
  title: string;
  slug?: string;
  synopsis?: string;
  genre?: string;
  tags?: string[] | string;
  channel?: string;
  channel_name?: string;
  totalEpisodes?: number;
  total_episodes?: number;
  episodesAvailable?: number;
  episodes_available?: number;
  poster?: string;
  poster_url?: string;
  banner?: string;
  banner_url?: string;
  publishAt?: string | null;
  publish_at?: string | null;
  status?: TitleStatus;
}

/**
 * Creates a new Drama in the catalog via the administrative API.
 */
export async function createDrama(
  payload: CreateDramaPayload
): Promise<{ success: boolean; data?: Drama; error?: string }> {
  try {
    const res = await adminFetch("/api/admin/dramas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await readJsonSafely(res)) as { success?: boolean; data?: Drama } | null;
    if (!res.ok || !data?.success) {
      return {
        success: false,
        error: getApiErrorMessage(data, `Creation failed with HTTP ${res.status}`),
      };
    }

    return {
      success: true,
      data: data.data,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Network error while creating drama";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * @deprecated Use createDrama instead. Forwarded for 100% backward compatibility.
 */
export const createTitle = createDrama;

/**
 * Deletes or archives a Drama in the catalog via the administrative API.
 * Defaults to soft delete (Archived). Pass { hard: true } for hard deletion of never-published drafts.
 */
export async function deleteDrama(
  id: string,
  options?: { hard?: boolean }
): Promise<{ success: boolean; error?: string; hard?: boolean }> {
  try {
    const query = options?.hard ? "?hard=true" : "";
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}${query}`, {
      method: "DELETE",
    });

    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      error?: { message?: string };
      data?: { hard?: boolean };
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Delete failed with HTTP ${res.status}`),
      };
    }

    return { success: true, hard: json.data?.hard };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Network error while deleting drama";
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Soft deletes / archives a drama.
 */
export async function archiveDrama(
  id: string
): Promise<{ success: boolean; error?: string }> {
  return deleteDrama(id, { hard: false });
}

/**
 * @deprecated Use deleteDrama instead. Forwarded for 100% backward compatibility.
 */
export const deleteTitle = deleteDrama;

/**
 * ============================================================================
 * ADMIN EPISODE OPERATIONS (Task 16.1)
 * ============================================================================
 */

/**
 * Fetches all admin episodes for a drama, ordered by episode_number ASC.
 */
export async function getAdminEpisodes(
  dramaId: string
): Promise<{ success: boolean; data?: AdminEpisode[]; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(dramaId)}/episodes`);
    const json = (await readJsonSafely(res)) as { success?: boolean; data?: AdminEpisode[]; error?: string };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to load episodes (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      data: json.data || [],
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error loading episodes";
    return { success: false, error: msg };
  }
}

/**
 * Creates a single episode for a drama.
 */
export async function createAdminEpisode(
  dramaId: string,
  input: CreateEpisodeInput
): Promise<{ success: boolean; data?: AdminEpisode; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(dramaId)}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "single", ...input }),
    });

    const json = (await readJsonSafely(res)) as { success?: boolean; data?: AdminEpisode; error?: string };
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to create episode (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error creating episode";
    return { success: false, error: msg };
  }
}

/**
 * Bulk-creates a range of episodes (e.g. 1 to 80).
 */
export async function bulkCreateAdminEpisodes(
  dramaId: string,
  input: BulkCreateEpisodesInput
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(dramaId)}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "bulk_range", ...input }),
    });

    const json = (await readJsonSafely(res)) as { success?: boolean; data?: { createdCount: number }; error?: string };
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to bulk create episodes (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      count: json.data?.createdCount ?? 0,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error bulk creating episodes";
    return { success: false, error: msg };
  }
}

/**
 * Bulk-assigns media URLs or provider asset IDs.
 */
export async function bulkAssignMedia(
  dramaId: string,
  items: BulkAssignMediaItem[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(dramaId)}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "bulk_media", items }),
    });

    const json = (await readJsonSafely(res)) as { success?: boolean; data?: { updatedCount: number }; error?: string };
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to bulk assign media (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      count: json.data?.updatedCount ?? 0,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error bulk assigning media";
    return { success: false, error: msg };
  }
}

/**
 * Reorders episodes in sequential order.
 */
export async function reorderAdminEpisodes(
  dramaId: string,
  orderedEpisodeIds: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(dramaId)}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "reorder", orderedEpisodeIds }),
    });

    const json = (await readJsonSafely(res)) as { success?: boolean; error?: string };
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to reorder episodes (HTTP ${res.status})`),
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error reordering episodes";
    return { success: false, error: msg };
  }
}

/**
 * Updates free_episodes_count for a drama.
 */
export async function updateFreeEpisodesCount(
  dramaId: string,
  count: number,
  syncExistingEpisodes = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(dramaId)}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "update_free_count", freeEpisodesCount: count, syncExistingEpisodes }),
    });

    const json = (await readJsonSafely(res)) as { success?: boolean; error?: string };
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to update free episodes count (HTTP ${res.status})`),
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error updating free episodes count";
    return { success: false, error: msg };
  }
}

/**
 * Updates a single episode metadata or media fields.
 */
export async function updateAdminEpisode(
  episodeId: string,
  input: UpdateEpisodeInput
): Promise<{ success: boolean; data?: AdminEpisode; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/episodes/${encodeURIComponent(episodeId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = (await readJsonSafely(res)) as { success?: boolean; data?: AdminEpisode; error?: string };
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to update episode (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error updating episode";
    return { success: false, error: msg };
  }
}

/**
 * Deletes a single episode and renumbers remaining episodes.
 */
export async function deleteAdminEpisode(
  episodeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/episodes/${encodeURIComponent(episodeId)}`, {
      method: "DELETE",
    });

    const json = (await readJsonSafely(res)) as { success?: boolean; error?: string };
    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to delete episode (HTTP ${res.status})`),
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error deleting episode";
    return { success: false, error: msg };
  }
}

export interface ScheduledPublishingPreview {
  totalScheduled: number;
  dueNowCount: number;
  upcomingCount: number;
  nextPublishAt: string | null;
  dueDramas: Array<{ id: string; title: string; slug: string; publish_at: string }>;
  upcomingDramas: Array<{ id: string; title: string; slug: string; publish_at: string }>;
}

export interface ScheduledPublishingResult {
  message: string;
  publishedCount: number;
  skippedCount: number;
  publishedDramas: Array<{ id: string; title: string; slug: string }>;
  skippedDramas: Array<{ id: string; title: string; reason: string }>;
}

/**
 * Previews upcoming scheduled content and counts items due for publication.
 */
export async function getScheduledPublishingPreview(): Promise<{
  success: boolean;
  data?: ScheduledPublishingPreview;
  error?: string;
}> {
  try {
    const res = await adminFetch("/api/admin/dramas/publish-scheduled", {
      method: "GET",
    });

    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: ScheduledPublishingPreview;
      error?: string;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to load scheduled preview (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error fetching scheduled preview";
    return { success: false, error: msg };
  }
}

/**
 * Manually executes the scheduled publisher job, promoting eligible dramas to 'Published'.
 */
export async function executeScheduledPublishing(): Promise<{
  success: boolean;
  data?: ScheduledPublishingResult;
  error?: string;
}> {
  try {
    const res = await adminFetch("/api/admin/dramas/publish-scheduled", {
      method: "POST",
    });

    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: ScheduledPublishingResult;
      error?: string;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to execute scheduled publishing (HTTP ${res.status})`),
      };
    }

    return {
      success: true,
      data: json.data,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error running scheduled publishing";
    return { success: false, error: msg };
  }
}

export interface BulkDramasPayload {
  action: "publish" | "unpublish" | "archive" | "move_channel";
  ids: string[];
  channelName?: string;
}

export interface BulkDramasResult {
  action: string;
  total: number;
  affected: number;
  skipped: number;
  errors: Array<{ id: string; title?: string; error: string }>;
}

/**
 * Executes a bulk operation on selected dramas (publish, unpublish, archive, move_channel).
 */
export async function bulkUpdateDramas(
  payload: BulkDramasPayload
): Promise<{ success: boolean; data?: BulkDramasResult; error?: string }> {
  try {
    const res = await adminFetch("/api/admin/dramas/bulk", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: BulkDramasResult;
      error?: any;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Bulk operation failed (HTTP ${res.status})`),
      };
    }

    return { success: true, data: json.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error performing bulk operation";
    return { success: false, error: msg };
  }
}

/**
 * Duplicates an existing drama (metadata only) into a new Draft.
 */
export async function duplicateDrama(
  id: string
): Promise<{ success: boolean; data?: Drama; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}/duplicate`, {
      method: "POST",
    });

    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: Drama;
      error?: any;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to duplicate drama (HTTP ${res.status})`),
      };
    }

    return { success: true, data: json.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error duplicating drama";
    return { success: false, error: msg };
  }
}

/**
 * Generates a signed preview URL for an unpublished drama.
 */
export async function getDramaPreviewUrl(
  id: string
): Promise<{ success: boolean; previewUrl?: string; token?: string; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}/preview`);
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: { previewUrl: string; token: string };
      error?: any;
    };

    if (!res.ok || !json?.success || !json.data?.previewUrl) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to generate preview URL (HTTP ${res.status})`),
      };
    }

    return { success: true, previewUrl: json.data.previewUrl, token: json.data.token };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error generating preview URL";
    return { success: false, error: msg };
  }
}

/**
 * Fetches all channels with live database drama counts for administrative management.
 */
export async function getAdminChannels(): Promise<{
  success: boolean;
  data?: AdminChannel[];
  error?: string;
}> {
  try {
    const res = await adminFetch("/api/admin/channels");
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: { channels: AdminChannel[] };
      error?: any;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to load channels (HTTP ${res.status})`),
      };
    }

    return { success: true, data: json.data?.channels || [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error loading channels";
    return { success: false, error: msg };
  }
}

/**
 * Creates a new channel.
 */
export async function createAdminChannel(
  input: CreateChannelInput
): Promise<{ success: boolean; data?: AdminChannel; error?: string }> {
  try {
    const res = await adminFetch("/api/admin/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: AdminChannel;
      error?: any;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to create channel (HTTP ${res.status})`),
      };
    }

    return { success: true, data: json.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error creating channel";
    return { success: false, error: msg };
  }
}

/**
 * Updates an existing channel.
 */
export async function updateAdminChannel(
  id: string,
  input: UpdateChannelInput
): Promise<{ success: boolean; data?: AdminChannel; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/channels/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: AdminChannel;
      error?: any;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to update channel (HTTP ${res.status})`),
      };
    }

    return { success: true, data: json.data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error updating channel";
    return { success: false, error: msg };
  }
}

/**
 * Deletes a channel. Prevents deletion if active dramas exist.
 */
export async function deleteAdminChannel(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await adminFetch(`/api/admin/channels/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: { deleted: boolean };
      error?: any;
    };

    if (!res.ok || !json?.success) {
      return {
        success: false,
        error: getApiErrorMessage(json, `Failed to delete channel (HTTP ${res.status})`),
      };
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Network error deleting channel";
    return { success: false, error: msg };
  }
}



