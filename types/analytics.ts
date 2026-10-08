/**
 * Analytics Domain Models & Types (Task 15.1, ADR-0003)
 */

export const PLAYBACK_EVENT_TYPES = [
  "episode_start",
  "episode_progress_25",
  "episode_progress_50",
  "episode_progress_75",
  "episode_complete",
  "episode_skip",
  "share",
  "favorite_add",
  "guest_prompt_shown",
  "guest_prompt_cta",
  "guest_prompt_dismiss",
  // Phase 8 Paywall ready placeholders
  "paywall_view",
  "episode_unlock",
] as const;

export type PlaybackEventType = (typeof PLAYBACK_EVENT_TYPES)[number];

export const PLAYBACK_PLATFORMS = ["web", "pwa", "tma"] as const;
export type PlaybackPlatform = (typeof PLAYBACK_PLATFORMS)[number];

export interface UtmParameters {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  [key: string]: string | undefined;
}

export interface PlaybackEventPayload {
  eventId?: string; // Optional client-generated deduplication ID
  occurredAt?: string; // ISO 8601 string
  anonId: string; // UUID of client device/visitor
  sessionId: string; // UUID of current watch session
  titleSlug: string;
  episodeNumber: number;
  eventType: PlaybackEventType;
  platform?: PlaybackPlatform;
  positionSeconds?: number | null;
  durationSeconds?: number | null;
  utm?: UtmParameters;
  payload?: Record<string, unknown>;
}

export interface BatchEventIngestRequest {
  events?: PlaybackEventPayload[];
  event?: PlaybackEventPayload;
}

export interface IngestEventsResult {
  ok: boolean;
  accepted: number;
  anonId: string;
  errors?: string[];
}
