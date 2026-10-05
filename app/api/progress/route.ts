import { NextRequest } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { apiError, apiSuccess } from "@/lib/api/responses";

export interface WatchProgressPayload {
  titleSlug: string;
  episodeNumber: number;
  progress?: number;
  positionSeconds?: number;
  durationSeconds?: number;
}

/**
 * POST /api/progress
 * Reliable background beacon endpoint for flushing watch progress (Task 12.3).
 * Invoked on visibilitychange (hidden) and pagehide with fetch(..., { keepalive: true }).
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (!body || typeof body !== "object") {
    return apiError("VALIDATION_ERROR", "Request body must be an object.", 400);
  }

  const payload = body as Partial<WatchProgressPayload>;

  if (typeof payload.titleSlug !== "string" || !payload.titleSlug.trim()) {
    return apiError("VALIDATION_ERROR", "titleSlug is required.", 400);
  }

  const titleSlug = payload.titleSlug.trim();
  if (titleSlug.length > 200) {
    return apiError("VALIDATION_ERROR", "titleSlug exceeds 200 characters.", 400);
  }

  const ep = Number(payload.episodeNumber);
  if (!Number.isInteger(ep) || ep < 1) {
    return apiError("VALIDATION_ERROR", "episodeNumber must be a positive integer.", 400);
  }

  const posSec = Math.max(0, Math.floor(Number(payload.positionSeconds) || 0));
  const durSec = Math.max(0, Math.floor(Number(payload.durationSeconds) || 0));

  let ratio = Number(payload.progress) || 0;
  if (durSec > 0) {
    ratio = Math.min(1.0, Math.max(0.0, posSec / durSec));
  } else {
    ratio = Math.min(1.0, Math.max(0.0, ratio));
  }

  try {
    const supabase = await createUserServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      // Unauthenticated guest: progress saved to client-side localStorage
      return apiSuccess({ saved: false, guest: true });
    }

    const { error: upsertErr } = await supabase.from("watch_history").upsert(
      {
        user_id: user.id,
        title_slug: titleSlug,
        episode_number: ep,
        progress: ratio,
        position_seconds: posSec,
        duration_seconds: durSec,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,title_slug" }
    );

    if (upsertErr) {
      console.error("[POST /api/progress] Supabase upsert error:", upsertErr);
      return apiError("DATABASE_ERROR", "Failed to persist watch progress.", 500);
    }

    return apiSuccess({ saved: true });
  } catch (err) {
    console.error("[POST /api/progress] Unexpected error:", err);
    return apiError("INTERNAL_ERROR", "Failed to process progress update.", 500);
  }
}
