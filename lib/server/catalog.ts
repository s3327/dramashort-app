import "server-only";
import { cache } from "react";
import { contentClient } from "@/lib/supabase/content";
import type { Database } from "@/types/supabase-content";
import type {
  Drama,
  Title,
  DramaStatus,
  TitleStatus,
  Channel,
  Episode,
  HeroSlide,
  PlaybackSource,
} from "@/types/content";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import { type Result, ok, err } from "@/lib/common/result";

export type { Drama, Title, DramaStatus, TitleStatus, Channel, Episode, HeroSlide, PlaybackSource };

export type DramaRow = Database["public"]["Tables"]["titles"]["Row"];
export type TitleRow = DramaRow;
export type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
export type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];

/**
 * Adapter converting Supabase `titles` table row to canonical `Drama` shape.
 * Maintains complete backwards compatibility with all existing components and Title callers.
 */
export function mapDramaRowToDrama(row: DramaRow): Drama {
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
    status: (row.status as DramaStatus) || "Published",
    year: row.release_year ?? 2026,
  };
}

/** Backward-compatible alias for mapDramaRowToDrama */
export const mapTitleRowToTitle = mapDramaRowToDrama;

export function mapChannelRowToChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
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
  };
}

export interface DramaQueryOptions {
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

export type TitleQueryOptions = DramaQueryOptions;

export interface PaginatedDramasResult {
  items: Drama[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string | null;
}

export type PaginatedTitlesResult = PaginatedDramasResult;

/**
 * Escapes values used in PostgREST filter expressions (.or()),
 * escaping backslashes and double quotes, and stripping newlines.
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
 * Executes a server-side search and filtering query over the titles database with pagination.
 */
export const searchDramas = cache(async function searchDramas(
  options?: DramaQueryOptions
): Promise<PaginatedDramasResult> {
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
    let query = contentClient
      .from("titles")
      .select("*, channels(name, slug, code)", { count: "exact" })
      .eq("status", "Published");

    // Search query (matches title or synopsis)
    const rawSearch = (options?.query || options?.search || "").trim();
    if (rawSearch) {
      const cleanTerm = rawSearch.replace(/[,()]/g, " ").trim();
      if (cleanTerm) {
        query = query.or(
          `title.ilike.%${cleanTerm}%,synopsis.ilike.%${cleanTerm}%`
        );
      }
    }

    // Channel filtering: prioritize channelId, then channelSlug, then channelName
    if (options?.channelId) {
      query = query.eq("channel_id", options.channelId);
    } else if (options?.channelSlug) {
      const { data: ch } = await contentClient
        .from("channels")
        .select("id")
        .eq("slug", options.channelSlug)
        .maybeSingle();
      if (ch?.id) {
        query = query.eq("channel_id", ch.id);
      }
    } else if (
      options?.channelName &&
      options.channelName !== "All" &&
      options.channelName !== "All Channels"
    ) {
      query = query.eq("channel_name", options.channelName);
    }

    if (
      options?.genre &&
      options.genre !== "All" &&
      options.genre !== "All Genres"
    ) {
      query = query.eq("genre", options.genre);
    }

    if (options?.tags && options.tags.length > 0) {
      query = query.contains("tags", options.tags);
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

    const items = data.map(mapDramaRowToDrama);
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
    console.error("Error in searchDramas:", err);
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
});

/** Backward-compatible alias for searchDramas */
export const searchPublishedTitles = searchDramas;

/**
 * Returns search results wrapped in the standardized Result<T> type.
 */
export async function searchDramasResult(
  options?: DramaQueryOptions
): Promise<Result<PaginatedDramasResult, string>> {
  const res = await searchDramas(options);
  if (res.error) {
    return err(res.error);
  }
  return ok(res);
}

/** Backward-compatible alias for searchDramasResult */
export const searchPublishedTitlesResult = searchDramasResult;

/**
 * In-memory fallback filtering for mock data during offline development.
 */
async function filterMockTitles(
  options?: DramaQueryOptions,
  page = 1,
  pageSize = 24
): Promise<PaginatedDramasResult> {
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
 * Fetches all published dramas with optional filtering and sorting.
 */
export async function getPublishedDramas(
  options?: DramaQueryOptions
): Promise<Drama[]> {
  const result = await searchDramas(options);
  return result.items;
}

/** Backward-compatible alias for getPublishedDramas */
export const getPublishedTitles = getPublishedDramas;

/**
 * Fetches distinct available genres across all published dramas.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getDistinctGenres = cache(async function getDistinctGenres(): Promise<string[]> {
  try {
    const { data, error } = await contentClient
      .from("titles")
      .select("genre")
      .eq("status", "Published");
    if (!error && data && data.length > 0) {
      const set = new Set(data.map((r) => r.genre).filter(Boolean));
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
 */
export async function getPopularTags(): Promise<string[]> {
  try {
    const { data, error } = await contentClient
      .from("titles")
      .select("tags")
      .eq("status", "Published");
    if (!error && data && data.length > 0) {
      const set = new Set(data.flatMap((r) => r.tags || []).filter(Boolean));
      return Array.from(set).sort();
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
    ];
  }
  return [];
}

/**
 * Fetches a single drama by its unique slug (e.g. "the-ceos-secret-wife-ds").
 * Also supports matching by prefix for old slug format.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getDramaBySlug = cache(async function getDramaBySlug(slug: string): Promise<Drama | null> {
  try {
    // 1. Try exact slug match
    let { data, error } = await contentClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .eq("slug", slug)
      .maybeSingle();

    // 2. If not found, try matching by prefix
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
    return mapDramaRowToDrama(data);
  } catch (err) {
    console.error("Error in getDramaBySlug:", err);
    return null;
  }
});

/** Backward-compatible alias for getDramaBySlug */
export const getTitleBySlug = getDramaBySlug;

/**
 * Result-wrapped drama lookup by slug.
 */
export async function getDramaBySlugResult(
  slug: string
): Promise<Result<Drama, string>> {
  const drama = await getDramaBySlug(slug);
  if (!drama) {
    return err(`Drama not found with slug: ${slug}`);
  }
  return ok(drama);
}

/** Backward-compatible alias for getDramaBySlugResult */
export const getTitleBySlugResult = getDramaBySlugResult;

/**
 * Fetches multiple dramas matching a list of slugs from Supabase.
 */
export async function getDramasBySlugs(slugs: string[]): Promise<Drama[]> {
  if (!slugs || slugs.length === 0) return [];
  try {
    const { data, error } = await contentClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .in("slug", slugs);

    const foundMap = new Map<string, Drama>();
    if (!error && data) {
      data.forEach((row) => {
        const drama = mapDramaRowToDrama(row);
        foundMap.set(row.slug, drama);
      });
    }

    const missingSlugs = slugs.filter((s) => !foundMap.has(s));
    if (missingSlugs.length > 0) {
      await Promise.all(
        missingSlugs.map(async (slug) => {
          const d = await getDramaBySlug(slug);
          if (d) {
            foundMap.set(slug, d);
          }
        })
      );
    }

    return slugs
      .map((s) => foundMap.get(s))
      .filter((d): d is Drama => !!d);
  } catch (err) {
    console.error("Error in getDramasBySlugs:", err);
    return [];
  }
}

/** Backward-compatible alias for getDramasBySlugs */
export const getTitlesBySlugs = getDramasBySlugs;

/**
 * Fetches episodes for a specific drama ID ordered by episode_number ascending.
 */
export async function getEpisodesByDramaId(dramaId: string): Promise<Episode[]> {
  try {
    const { data, error } = await contentClient
      .from("episodes")
      .select("id, title_id, episode_number, title, thumbnail_url, duration_seconds, is_free, created_at")
      .eq("title_id", dramaId)
      .order("episode_number", { ascending: true });

    if (error || !data) return [];
    return data.map((row) => mapEpisodeRowToEpisode(row));
  } catch (err) {
    console.error("Error in getEpisodesByDramaId:", err);
    return [];
  }
}

/** Backward-compatible alias for getEpisodesByDramaId */
export const getEpisodesByTitleId = getEpisodesByDramaId;

/**
 * Top Trending dramas for Home & Trending page.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getTrendingDramas = cache(async function getTrendingDramas(limit = 10): Promise<Drama[]> {
  return getPublishedDramas({ sort: "trending", limit });
});

/** Backward-compatible alias for getTrendingDramas */
export const getTopTrendingTitles = getTrendingDramas;

/**
 * New Releases for Home & New Release page.
 */
export async function getNewReleaseDramas(limit = 12): Promise<Drama[]> {
  return getPublishedDramas({ sort: "newest", limit });
}

/** Backward-compatible alias for getNewReleaseDramas */
export const getNewReleaseTitles = getNewReleaseDramas;

/**
 * Fetches all available channels.
 */
export async function getChannels(): Promise<Channel[]> {
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
 * Result-wrapped channel lookup by slug.
 */
export async function getChannelBySlugResult(
  slug: string
): Promise<Result<Channel, string>> {
  const channel = await getChannelBySlug(slug);
  if (!channel) {
    return err(`Channel not found with slug: ${slug}`);
  }
  return ok(channel);
}

/**
 * Generates hero slides from top trending dramas.
 * Wrapped in React.cache() for per-request query deduplication across layouts and pages.
 */
export const getHeroSlides = cache(async function getHeroSlides(): Promise<HeroSlide[]> {
  const dramas = await getTrendingDramas(4);
  if (!dramas || dramas.length === 0) {
    return [];
  }
  const defaultBadges = ["🔥 #1 Trending", "✨ New Episode Daily", "💎 Editor's Pick", "🎬 Fan Favorite"];

  return dramas.map((d, idx) => ({
    id: `hs-${d.id}`,
    title: d.title,
    tagline: d.synopsis.slice(0, 85) + (d.synopsis.length > 85 ? "..." : ""),
    badge: defaultBadges[idx % defaultBadges.length],
    image: d.poster,
    href: `/drama/${d.slug}`,
  }));
});

/**
 * Deterministic related dramas lookup from the database.
 */
export async function getRelatedDramasFromDb(
  drama: { slug: string; genre?: string; tags?: string[]; channel?: string },
  count = 8
): Promise<Drama[]> {
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

    if (orFilters.length > 0) {
      const { data, error } = await contentClient
        .from("titles")
        .select("*, channels(name, slug, code)")
        .eq("status", "Published")
        .neq("slug", drama.slug)
        .or(orFilters.join(","))
        .limit(count);

      if (!error && data && data.length > 0) {
        return data.map(mapDramaRowToDrama);
      }
    }

    const { data: latest } = await contentClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .eq("status", "Published")
      .neq("slug", drama.slug)
      .limit(count);

    return latest ? latest.map(mapDramaRowToDrama) : [];
  } catch {
    return [];
  }
}

/** Backward-compatible alias for getRelatedDramasFromDb */
export const getRelatedTitlesFromDb = getRelatedDramasFromDb;
