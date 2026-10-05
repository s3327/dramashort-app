import { contentClient, getContentAdminClient } from "@/lib/supabase/content";
import type { Database } from "@/types/supabase-content";
import type {
  Title,
  TitleStatus,
  Drama,
  Channel,
  Episode,
  HeroSlide,
  PlaybackSource,
} from "@/types/content";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import { type Result, ok, err } from "@/types/result";
import { getApiErrorMessage, readJsonSafely } from "@/lib/api/error-message";
import { adminFetch } from "@/lib/api/admin-fetch";

export type { Title, TitleStatus, Drama, Channel, Episode, HeroSlide, PlaybackSource };
export type { Result };

export type TitleRow = Database["public"]["Tables"]["titles"]["Row"];
export type DramaRow = TitleRow;
export type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
export type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];



/**
 * Adapter converting Supabase `titles` table row to frontend `Title` shape.
 * Maintains complete backwards compatibility with all existing components.
 */
export function mapTitleRowToTitle(row: TitleRow): Title {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    poster: row.poster_url,
    synopsis: row.synopsis,
    channel: row.channel_name,
    genre: row.genre,
    tags: row.tags || [],
    totalEpisodes: row.total_episodes,
    rating: row.rating ? Number(row.rating) : undefined,
    views: row.views_count ?? 0,
    createdAt: row.created_at || new Date().toISOString(),
    status: (row.status as TitleStatus) || "Published",
    year: row.release_year ?? 2026,
  };
}

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
    let query = contentClient
      .from("titles")
      .select("*", { count: "exact" })
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
 */
export async function getDistinctGenres(): Promise<string[]> {
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
}

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
 * Fetches a single title by its unique slug (e.g. "the-ceos-secret-wife-ds").
 * Also supports matching by partial or old slug format.
 */
export async function getTitleBySlug(slug: string): Promise<Title | null> {
  try {
    // 1. Try exact slug match
    let { data, error } = await contentClient
      .from("titles")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    // 2. If not found, try matching by prefix (for old slugs without channel acronym)
    if (!data && !error) {
      const { data: prefixMatch } = await contentClient
        .from("titles")
        .select("*")
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
}

/**
 * Fetches multiple titles matching a list of slugs from Supabase.
 */
export async function getTitlesBySlugs(slugs: string[]): Promise<Title[]> {
  if (!slugs || slugs.length === 0) return [];
  try {
    const { data, error } = await contentClient
      .from("titles")
      .select("*")
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
 */
export async function getTopTrendingTitles(limit = 10): Promise<Title[]> {
  return getPublishedTitles({ sort: "trending", limit });
}

/**
 * New Releases for Home & New Release page.
 */
export async function getNewReleaseTitles(limit = 12): Promise<Title[]> {
  return getPublishedTitles({ sort: "newest", limit });
}

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
 */
export async function getChannelBySlug(slug: string): Promise<Channel | null> {
  try {
    const { data, error } = await contentClient
      .from("channels")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) return null;
    return mapChannelRowToChannel(data);
  } catch (err) {
    console.error("Error in getChannelBySlug:", err);
    return null;
  }
}

/**
 * Generates hero slides from top trending titles.
 */
export async function getHeroSlides(): Promise<HeroSlide[]> {
  const titles = await getTopTrendingTitles(4);
  if (!titles || titles.length === 0) {
    return [];
  }
  const defaultBadges = ["🔥 #1 Trending", "✨ New Episode Daily", "💎 Editor's Pick", "🎬 Fan Favorite"];

  return titles.map((t, idx) => ({
    id: `hs-${t.id}`,
    title: t.title,
    tagline: t.synopsis.slice(0, 85) + (t.synopsis.length > 85 ? "..." : ""),
    badge: defaultBadges[idx % defaultBadges.length],
    image: t.poster,
    href: `/drama/${t.slug}`,
  }));
}

/**
 * Deterministic related titles lookup from the database.
 */
export async function getRelatedTitlesFromDb(
  drama: { slug: string; genre: string; tags: string[]; channel: string },
  count = 8
): Promise<Title[]> {
  try {
    // 1. Fetch titles with matching genre or channel
    const { data, error } = await contentClient
      .from("titles")
      .select("*")
      .eq("status", "Published")
      .neq("slug", drama.slug)
      .or(`genre.eq."${drama.genre}",channel_name.eq."${drama.channel}"`)
      .limit(count);

    if (!error && data && data.length > 0) {
      return data.map(mapTitleRowToTitle);
    }

    // 2. Fallback to latest published titles if no genre/channel matches
    const { data: latest } = await contentClient
      .from("titles")
      .select("*")
      .eq("status", "Published")
      .neq("slug", drama.slug)
      .limit(count);

    return latest ? latest.map(mapTitleRowToTitle) : [];
  } catch {
    return [];
  }
}

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
        .select("*", { count: "exact" });

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
        .select("*", { count: "exact" });

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
  poster?: string;
  poster_url?: string;
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
  synopsis?: string;
  genre?: string;
  tags?: string[] | string;
  channel?: string;
  channel_name?: string;
  totalEpisodes?: number;
  total_episodes?: number;
  poster?: string;
  poster_url?: string;
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

/** Domain entity alias for createDrama */
export const createTitle = createDrama;

