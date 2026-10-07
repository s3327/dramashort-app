import "server-only";
import { getContentAdminClient } from "@/lib/supabase/content";
import { getUserRole } from "@/lib/auth/roles";
import type { User } from "@supabase/supabase-js";
import { type Result, ok, err } from "@/lib/common/result";

export interface EpisodePlaybackInfo {
  episodeId: string;
  titleId: string;
  titleName: string;
  titleSlug: string;
  titleStatus: string;
  episodeNumber: number;
  isFree: boolean;
  videoUrl?: string | null;
  provider?: string | null;
  assetRef?: string | null;
  hlsUrl?: string | null;
  mp4Url?: string | null;
  durationSeconds?: number | null;
  aspectRatio?: string | null;
}

export type PlaybackAccessDenialReason =
  | "NOT_FOUND"
  | "UNPUBLISHED_TITLE"
  | "PAYMENT_REQUIRED"
  | "FORBIDDEN";

export interface PlaybackAccessResult {
  allowed: boolean;
  reason?: PlaybackAccessDenialReason;
  message?: string;
}

export interface ResolvedPlayback {
  url: string;
  expiresAt: string;
  provider: string;
  aspectRatio: string;
  durationSeconds: number;
}

/**
 * Determines whether a user (or guest) is entitled to stream an episode.
 * 
 * Rules:
 * 1. Title must be 'Published' for general public/guest access.
 *    If the title is in 'Draft', 'Scheduled', or 'Archived' status, access is denied
 *    unless the user possesses an administrative role ('admin' or 'editor').
 * 2. Freemium / Monetization Gate (Phase 8 Hook):
 *    - Currently, all episodes of published titles are accessible.
 *    - In Phase 8, this single function evaluates user coin balances, daily passes,
 *      and unlocked episode records in the User DB.
 */
export async function canAccessEpisode(
  user: User | null,
  episode: EpisodePlaybackInfo
): Promise<PlaybackAccessResult> {
  const isTitlePublished = episode.titleStatus === "Published";

  if (!isTitlePublished) {
    const role = user ? getUserRole(user) : null;
    const isStaff = role === "admin" || role === "editor";

    if (!isStaff) {
      return {
        allowed: false,
        reason: "UNPUBLISHED_TITLE",
        message: "This title is not currently published.",
      };
    }
  }

  // Phase 8 Monetization Hook:
  // If !episode.isFree, verify user entitlement (user_unlocked_episodes table in User DB).
  // For Phase 10, all published episodes remain accessible to preserve current UX.
  return {
    allowed: true,
  };
}

/**
 * Resolves the streaming media source and signed expiration for an episode.
 * Architecture Note (ADR-0003 / Task 10.6):
 * HLS manifests alone do not protect media segments. In production, providers such as
 * Cloudflare Stream, Mux, or Bunny Stream provide cryptographically signed playback tokens
 * or CDN signed cookies. This resolver generates the active stream URL and expiration.
 */
export function resolvePlaybackSession(
  info: EpisodePlaybackInfo,
  expiresInSeconds = 7200 // 2 hours
): ResolvedPlayback {
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  // Prefer HLS stream if available, otherwise MP4 fallback, then legacy video_url
  let streamUrl = info.hlsUrl || info.mp4Url || info.videoUrl || "";

  // Provider-specific token signing hook (Mux / Cloudflare / Bunny / Custom CDN)
  // Can be extended when provider signing keys are configured in environment variables.

  return {
    url: streamUrl,
    expiresAt,
    provider: info.provider || "custom",
    aspectRatio: info.aspectRatio || "9:16",
    durationSeconds: info.durationSeconds || 0,
  };
}

/**
 * Fetches episode details, parent title metadata, and privileged episode_media
 * records using the Content DB service role client.
 */
export async function getEpisodePlaybackInfo(
  episodeId: string
): Promise<EpisodePlaybackInfo | null> {
  const adminClient = getContentAdminClient();

  // 1. Fetch episode record
  const { data: episodeRow, error: epError } = await adminClient
    .from("episodes")
    .select("id, title_id, episode_number, is_free, duration_seconds, video_url")
    .eq("id", episodeId)
    .maybeSingle();

  if (epError) {
    console.error("[getEpisodePlaybackInfo] Episode query failed:", epError);
    return null;
  }

  if (!episodeRow) {
    return null;
  }

  // 2. Fetch parent title record
  const { data: titleRow, error: titleError } = await adminClient
    .from("titles")
    .select("id, title, slug, status")
    .eq("id", episodeRow.title_id)
    .maybeSingle();

  if (titleError) {
    console.error("[getEpisodePlaybackInfo] Title query failed:", titleError);
    return null;
  }

  if (!titleRow) {
    return null;
  }

  // 3. Fetch media records from privileged episode_media table
  const { data: mediaRows, error: mediaError } = await adminClient
    .from("episode_media")
    .select("id, provider, asset_ref, hls_url, mp4_url, duration_seconds, aspect_ratio, status")
    .eq("episode_id", episodeId)
    .eq("status", "ready")
    .order("created_at", { ascending: false });

  if (mediaError) {
    console.error("[getEpisodePlaybackInfo] Media query failed:", mediaError);
  }

  const primaryMedia = mediaRows && mediaRows.length > 0 ? mediaRows[0] : null;

  return {
    episodeId: episodeRow.id,
    titleId: titleRow.id,
    titleName: titleRow.title,
    titleSlug: titleRow.slug,
    titleStatus: titleRow.status,
    episodeNumber: episodeRow.episode_number,
    isFree: episodeRow.is_free ?? true,
    videoUrl: episodeRow.video_url,
    provider: primaryMedia?.provider || "custom",
    assetRef: primaryMedia?.asset_ref || null,
    hlsUrl: primaryMedia?.hls_url || null,
    mp4Url: primaryMedia?.mp4_url || null,
    durationSeconds: primaryMedia?.duration_seconds || episodeRow.duration_seconds || 0,
    aspectRatio: primaryMedia?.aspect_ratio || "9:16",
  };
}

/**
 * Entitlement check and signed stream resolution returning a standardized Result (Task 13.4).
 */
export async function getEpisodePlaybackResult(
  episodeId: string,
  user: User | null
): Promise<Result<ResolvedPlayback, string>> {
  const info = await getEpisodePlaybackInfo(episodeId);
  if (!info) {
    return err("Episode not found");
  }

  const access = await canAccessEpisode(user, info);
  if (!access.allowed) {
    return err(access.message || "Access denied");
  }

  const session = resolvePlaybackSession(info);
  return ok(session);
}
