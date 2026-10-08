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
  bannerUrl?: string | null;
  heroTagline?: string | null;
  featuredRank?: number | null;
  freeEpisodesCount?: number;
  publishAt?: string | null;
  hasBeenPublished?: boolean;
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
  releaseAt?: string | null;
  createdAt?: string;
}

export type EpisodeMediaStatus = "missing" | "processing" | "ready" | "error";

export interface AdminEpisodeMedia {
  id?: string;
  provider: string;
  assetRef?: string | null;
  hlsUrl?: string | null;
  mp4Url?: string | null;
  durationSeconds?: number;
  aspectRatio?: string;
  status: EpisodeMediaStatus;
}

export interface AdminEpisode {
  id: string;
  titleId: string;
  episodeNumber: number;
  title: string;
  thumbnailUrl: string | null;
  durationSeconds: number;
  isFree: boolean;
  releaseAt?: string | null;
  createdAt: string;
  mediaStatus: EpisodeMediaStatus;
  media?: AdminEpisodeMedia | null;
}

export interface CreateEpisodeInput {
  episodeNumber?: number;
  title?: string;
  durationSeconds?: number;
  isFree?: boolean;
  thumbnailUrl?: string | null;
  releaseAt?: string | null;
  videoUrl?: string | null;
  hlsUrl?: string | null;
  mp4Url?: string | null;
  assetRef?: string | null;
  provider?: string;
}

export interface BulkCreateEpisodesInput {
  startNumber: number;
  endNumber: number;
  titleTemplate?: string;
  autoFree?: boolean;
}

export interface BulkAssignMediaItem {
  episodeNumber: number;
  urlOrAssetId: string;
  provider?: string;
  durationSeconds?: number;
}

export interface UpdateEpisodeInput {
  title?: string;
  durationSeconds?: number;
  isFree?: boolean;
  thumbnailUrl?: string | null;
  releaseAt?: string | null;
  hlsUrl?: string | null;
  mp4Url?: string | null;
  assetRef?: string | null;
  provider?: string;
  status?: EpisodeMediaStatus;
}

export interface HeroSlide {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  image: string;
  href: string;
  bannerUrl?: string | null;
  posterUrl?: string;
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
