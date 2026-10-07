/**
 * Canonical domain types for Content Catalog (Dramas, Episodes, Channels).
 * Decoupled from test fixtures and mock data.
 */

export type DramaStatus = "Published" | "Draft" | "Scheduled" | "Archived";

/**
 * @deprecated Use DramaStatus instead. Maintained for 100% backward compatibility.
 */
export type TitleStatus = DramaStatus;

/**
 * Canonical domain entity representing a short-form drama series (Task 13.4).
 */
export interface Drama {
  id: string;
  slug: string;
  title: string;
  poster: string;
  synopsis: string;
  channel: string;
  genre: string;
  tags: string[];
  totalEpisodes: number;
  episodesAvailable?: number;
  rating?: number;
  views: number;
  createdAt: string;
  status: DramaStatus;
  year: number;
}

/**
 * @deprecated Use Drama instead. Maintained for 100% backward compatibility.
 */
export type Title = Drama;

export interface Channel {
  id?: string;
  slug: string;
  name: string;
}

export interface Episode {
  id: string;
  titleId: string;
  episodeNumber: number;
  title: string;
  videoUrl?: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  isFree: boolean;
  createdAt?: string;
}

export interface HeroSlide {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  image: string;
  href: string;
}

export interface TrendingDrama {
  id: string;
  rank: number;
  title: string;
  poster: string;
  href: string;
}

/**
 * @deprecated Use TrendingDrama instead. Maintained for 100% backward compatibility.
 */
export type TrendingTitle = TrendingDrama;

export interface NewReleaseDrama {
  id: string;
  title: string;
  poster: string;
  href: string;
}

/**
 * @deprecated Use NewReleaseDrama instead. Maintained for 100% backward compatibility.
 */
export type NewReleaseTitle = NewReleaseDrama;

export interface PlaybackSource {
  url: string;
  expiresAt: string;
  provider: string;
  aspectRatio: string;
  durationSeconds: number;
}
