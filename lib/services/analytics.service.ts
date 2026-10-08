import "server-only";
import { createUserServiceRoleClient } from "@/lib/supabase/user-server";
import type { PlaybackEventPayload, IngestEventsResult } from "@/types/analytics";

export interface PlaybackEventDbRecord {
  occurred_at: string;
  user_id: string | null;
  anon_id: string;
  session_id: string;
  title_slug: string;
  episode_number: number;
  event_type: string;
  platform: string;
  position_seconds: number | null;
  duration_seconds: number | null;
  utm: Record<string, unknown>;
  payload: Record<string, unknown>;
}

/**
 * Inserts a batch of playback events into public.playback_events using service-role privileges.
 */
export async function insertPlaybackEvents(
  events: PlaybackEventPayload[],
  userId?: string | null
): Promise<IngestEventsResult> {
  if (!events || events.length === 0) {
    return { ok: true, accepted: 0, anonId: "" };
  }

  const primaryAnonId = events[0].anonId;

  const records: PlaybackEventDbRecord[] = events.map((e) => ({
    occurred_at: e.occurredAt || new Date().toISOString(),
    user_id: userId ?? null,
    anon_id: e.anonId,
    session_id: e.sessionId,
    title_slug: e.titleSlug,
    episode_number: e.episodeNumber,
    event_type: e.eventType,
    platform: e.platform || "web",
    position_seconds: e.positionSeconds ?? null,
    duration_seconds: e.durationSeconds ?? null,
    utm: (e.utm as Record<string, unknown>) || {},
    payload: e.payload || {},
  }));

  try {
    const supabase = createUserServiceRoleClient();
    const { error } = await supabase.from("playback_events").insert(records as any);

    if (error) {
      console.error("[AnalyticsService] Failed to insert playback events:", error);
      return {
        ok: false,
        accepted: 0,
        anonId: primaryAnonId,
        errors: [error.message],
      };
    }

    return {
      ok: true,
      accepted: records.length,
      anonId: primaryAnonId,
    };
  } catch (err: any) {
    console.error("[AnalyticsService] Unexpected exception during event ingestion:", err);
    return {
      ok: false,
      accepted: 0,
      anonId: primaryAnonId,
      errors: [err?.message || "Internal database error"],
    };
  }
}
