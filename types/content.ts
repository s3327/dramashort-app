/**
 * Canonical domain types for Content Catalog (Dramas, Episodes, Channels).
 * Decoupled from test fixtures and mock data.
 */

export type TitleStatus = "Published" | "Draft" | "Scheduled" | "Archived";

export interface Title {
  id: string;
  slug: string;
  title: string;
  poster: string;
  synopsis: string;
  channel: string;
  genre: string;
  tags: string[];
  totalEpisodes: number;
  rating?: number;
  views: number;
  createdAt: string;
  status: TitleStatus;
  year: number;
}

/** Domain alias for Title */
export type Drama = Title;

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

export interface TrendingTitle {
  id: string;
  rank: number;
  title: string;
  poster: string;
  href: string;
}

export interface NewReleaseTitle {
  id: string;
  title: string;
  poster: string;
  href: string;
}

export interface PlaybackSource {
  url: string;
  expiresAt: string;
  provider: string;
  aspectRatio: string;
  durationSeconds: number;
}
