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
  signedToken?: string;
  signedUrl?: string;
}

import { createUserServiceRoleClient } from "@/lib/supabase/user-server";

/**
 * Determines whether a user (or guest) is entitled to stream an episode.
 * 
 * Rules:
 * 1. Title must be 'Published' for general public/guest access.
 *    If the title is in 'Draft', 'Scheduled', or 'Archived' status, access is denied
 *    unless the user possesses an administrative role ('admin' or 'editor').
 * 2. Freemium / Monetization Gate (Phase 8):
 *    - Free episodes (isFree === true) are accessible to all viewers of published titles.
 *    - Locked episodes (isFree === false) require:
 *      a) Authenticated user (guests receive PAYMENT_REQUIRED: 'Sign in to watch locked episodes.')
 *      b) Staff bypass ('admin' or 'editor')
 *      c) Active VIP pass (wallets.is_vip === true and vip_expires_at in future)
 *      d) Entitlement in user_unlocked_episodes for (user_id, drama_id, episode_number)
 */
export async function canAccessEpisode(
  user: User | null,
  episode: EpisodePlaybackInfo,
  userDbClient?: any
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

  // Phase 8 Monetization Gate
  if (!episode.isFree) {
    if (!user) {
      return {
        allowed: false,
        reason: "PAYMENT_REQUIRED",
        message: "Sign in to watch locked episodes.",
      };
    }

    const role = getUserRole(user);
    const isStaff = role === "admin" || role === "editor";
    if (isStaff) {
      return { allowed: true };
    }

    try {
      const client = userDbClient || (await createUserServiceRoleClient());

      // 1. Check VIP pass status
      const { data: wallet } = await client
        .from("wallets")
        .select("is_vip, vip_expires_at")
        .eq("user_id", user.id)
        .maybeSingle();

      const isVipActive =
        Boolean(wallet?.is_vip) &&
        (!wallet?.vip_expires_at || new Date(wallet.vip_expires_at) > new Date());

      if (isVipActive) {
        return { allowed: true };
      }

      // 2. Check user_unlocked_episodes entitlement
      const { data: unlocked } = await client
        .from("user_unlocked_episodes")
        .select("id")
        .eq("user_id", user.id)
        .eq("drama_id", episode.titleId)
        .eq("episode_number", episode.episodeNumber)
        .maybeSingle();

      if (unlocked) {
        return { allowed: true };
      }
    } catch {
      // In offline / fallback test environments without user DB configured, proceed to deny
    }

    return {
      allowed: false,
      reason: "PAYMENT_REQUIRED",
      message: "This episode requires 10 coins to unlock.",
    };
  }

  return {
    allowed: true,
  };
}

import { createHmac, timingSafeEqual } from "node:crypto";


/**
 * Generates an HMAC-SHA256 signed playback token bound to the episode and expiration epoch.
 */
export function signPlaybackToken(
  episodeId: string,
  expiresEpochMs: number,
  secret = process.env.PLAYBACK_SIGNING_SECRET || "default_playback_signing_secret"
): string {
  const payload = `${episodeId}:${expiresEpochMs}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies the validity and expiration of a signed playback token.
 */
export function verifyPlaybackToken(
  episodeId: string,
  token: string,
  expiresEpochMs: number,
  secret = process.env.PLAYBACK_SIGNING_SECRET || "default_playback_signing_secret"
): boolean {
  if (!token || !expiresEpochMs) return false;
  if (Date.now() > expiresEpochMs) return false; // Expired token

  const expected = signPlaybackToken(episodeId, expiresEpochMs, secret);
  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expected);

  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

/**
 * Appends signed token and expiration query parameters to a streaming media URL.
 */
export function signPlaybackUrl(
  streamUrl: string,
  episodeId: string,
  expiresInSeconds = 900,
  secret?: string
): { url: string; token: string; expiresAt: string; expiresEpochMs: number } {
  const expiresEpochMs = Date.now() + expiresInSeconds * 1000;
  const token = signPlaybackToken(episodeId, expiresEpochMs, secret);
  const separator = streamUrl.includes("?") ? "&" : "?";
  const signedUrl = streamUrl ? `${streamUrl}${separator}token=${token}&expires=${expiresEpochMs}` : "";

  return {
    url: signedUrl,
    token,
    expiresAt: new Date(expiresEpochMs).toISOString(),
    expiresEpochMs,
  };
}

/**
 * Resolves the streaming media source and signed expiration for an episode.
 * Architecture Note (ADR-0003): Signed playback delivery.
 * Security Hardening (Step 10):
 * Generates cryptographically signed playback tokens with 15-minute expiration (900s).
 */
export function resolvePlaybackSession(
  info: EpisodePlaybackInfo,
  expiresInSeconds = 900 // 15 minutes (P1 Step 10)
): ResolvedPlayback {
  const expiresEpochMs = Date.now() + expiresInSeconds * 1000;
  const expiresAt = new Date(expiresEpochMs).toISOString();

  // Prefer HLS stream if available, otherwise MP4 fallback, then legacy video_url
  const streamUrl = info.hlsUrl || info.mp4Url || info.videoUrl || "";
  const signedToken = info.episodeId ? signPlaybackToken(info.episodeId, expiresEpochMs) : undefined;
  const signedUrl = streamUrl && signedToken
    ? `${streamUrl}${streamUrl.includes("?") ? "&" : "?"}token=${signedToken}&expires=${expiresEpochMs}`
    : streamUrl;

  const shouldEnforceSignedUrl = process.env.REQUIRE_SIGNED_PLAYBACK === "true";

  return {
    url: shouldEnforceSignedUrl ? signedUrl : streamUrl,
    signedUrl,
    signedToken,
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
