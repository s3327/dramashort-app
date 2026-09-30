import { contentClient } from "@/lib/supabase/content";
import type { Database } from "@/types/supabase-content";
import type { Title, TitleStatus } from "@/data/titles.mock";
import type { Channel } from "@/data/channels.mock";
import type { HeroSlide } from "@/data/hero-slides.mock";

export type TitleRow = Database["public"]["Tables"]["titles"]["Row"];
export type DramaRow = TitleRow;
export type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];
export type EpisodeRow = Database["public"]["Tables"]["episodes"]["Row"];

/** Canonical domain entity alias: media items stored in database are Dramas */
export type Drama = Title;

export type Episode = {
  id: string;
  titleId: string;
  episodeNumber: number;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isFree: boolean;
};

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
    slug: row.slug,
    name: row.name,
  };
}

export function mapEpisodeRowToEpisode(row: EpisodeRow): Episode {
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

/**
 * Fetches all published titles with optional filtering and sorting.
 */
export async function getPublishedTitles(options?: {
  channelName?: string;
  channelSlug?: string;
  genre?: string;
  search?: string;
  sort?: "trending" | "newest" | "rating";
  limit?: number;
  offset?: number;
}): Promise<Title[]> {
  try {
    let query = contentClient
      .from("titles")
      .select("*")
      .eq("status", "Published");

    if (options?.channelName) {
      query = query.eq("channel_name", options.channelName);
    }

    if (options?.genre && options.genre !== "All" && options.genre !== "All Genres") {
      query = query.eq("genre", options.genre);
    }

    if (options?.search) {
      query = query.ilike("title", `%${options.search.trim()}%`);
    }

    if (options?.sort === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (options?.sort === "rating") {
      query = query.order("rating", { ascending: false });
    } else {
      // Default to trending
      query = query.order("views_count", { ascending: false });
    }

    if (options?.limit) {
      const from = options.offset || 0;
      query = query.range(from, from + options.limit - 1);
    }

    const { data, error } = await query;
    if (error || !data) {
      console.warn("Failed to fetch titles from Supabase:", error?.message);
      return [];
    }

    return data.map(mapTitleRowToTitle);
  } catch (err) {
    console.error("Error in getPublishedTitles:", err);
    return [];
  }
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
 */
export async function getEpisodesByTitleId(titleId: string): Promise<Episode[]> {
  try {
    const { data, error } = await contentClient
      .from("episodes")
      .select("*")
      .eq("title_id", titleId)
      .order("episode_number", { ascending: true });

    if (error || !data) return [];
    return data.map(mapEpisodeRowToEpisode);
  } catch (err) {
    console.error("Error in getEpisodesByTitleId:", err);
    return [];
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
