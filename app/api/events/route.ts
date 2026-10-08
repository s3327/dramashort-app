import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { apiError, apiSuccess } from "@/lib/api/responses";
import {
  checkRateLimit,
  createRateLimitResponse,
  applyRateLimitHeaders,
  getRateLimitKey,
} from "@/lib/security/rate-limiter";
import { insertPlaybackEvents } from "@/lib/services/analytics.service";
import {
  PLAYBACK_EVENT_TYPES,
  PLAYBACK_PLATFORMS,
  type PlaybackEventPayload,
  type PlaybackEventType,
  type PlaybackPlatform,
} from "@/types/analytics";

const MAX_BATCH_SIZE = 50;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COOKIE_ANON_ID = "dramashort_anon_id";

function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_REGEX.test(val.trim());
}

/**
 * POST /api/events
 * High-throughput, rate-limited playback & engagement telemetry ingestion endpoint (Task 15.1).
 * Accepts batches up to 50 events. Compatible with keepalive and navigator.sendBeacon.
 */
export async function POST(request: NextRequest) {
  // 1. Resolve user session early if available (for rate-limit key and user_id association)
  let userId: string | null = null;
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
    }
  } catch {
    // Guest viewer: ignore auth failure
  }

  // 2. Rate limit evaluation (120 req / min profile)
  const rateLimitKey = getRateLimitKey(request, userId);
  const rateLimit = checkRateLimit(rateLimitKey, "events");
  if (!rateLimit.allowed) {
    return createRateLimitResponse(rateLimit);
  }

  // 3. Extract and parse payload (supports application/json and text/plain for sendBeacon)
  let rawBody: unknown;
  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("text/plain")) {
      const text = await request.text();
      rawBody = text ? JSON.parse(text) : null;
    } else {
      rawBody = await request.json();
    }
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  if (!rawBody || typeof rawBody !== "object") {
    return apiError("VALIDATION_ERROR", "Request body must be a JSON object or array.", 400);
  }

  // 4. Normalize batch payload
  let candidateEvents: unknown[] = [];
  if (Array.isArray(rawBody)) {
    candidateEvents = rawBody;
  } else {
    const obj = rawBody as Record<string, unknown>;
    if (Array.isArray(obj.events)) {
      candidateEvents = obj.events;
    } else if (obj.event && typeof obj.event === "object") {
      candidateEvents = [obj.event];
    } else if ("eventType" in obj || "event_type" in obj) {
      candidateEvents = [obj];
    }
  }

  if (candidateEvents.length === 0) {
    return apiError("EMPTY_PAYLOAD", "No events provided in request payload.", 400);
  }

  if (candidateEvents.length > MAX_BATCH_SIZE) {
    return apiError(
      "BATCH_TOO_LARGE",
      `Event batch exceeds maximum limit of ${MAX_BATCH_SIZE} events.`,
      400,
      { maxBatchSize: MAX_BATCH_SIZE, received: candidateEvents.length }
    );
  }

  // 5. Resolve Anonymous Device ID from cookie or generate new one
  const existingCookieAnonId = request.cookies.get(COOKIE_ANON_ID)?.value;
  let resolvedAnonId = isValidUuid(existingCookieAnonId) ? existingCookieAnonId : null;
  let setAnonCookie = false;

  if (!resolvedAnonId) {
    // Check if first event provides a valid UUID anonId
    const firstEvent = candidateEvents[0] as Record<string, unknown>;
    const eventAnonId = firstEvent?.anonId || firstEvent?.anon_id;
    if (isValidUuid(eventAnonId)) {
      resolvedAnonId = eventAnonId;
    } else {
      resolvedAnonId = crypto.randomUUID();
    }
    setAnonCookie = true;
  }

  // 6. Validate and sanitize each event in the batch
  const validatedEvents: PlaybackEventPayload[] = [];

  for (let i = 0; i < candidateEvents.length; i++) {
    const raw = candidateEvents[i];
    if (!raw || typeof raw !== "object") {
      return apiError("VALIDATION_ERROR", `Event at index ${i} must be an object.`, 400);
    }

    const item = raw as Record<string, unknown>;

    // event_type / eventType
    const eventType = (item.eventType || item.event_type) as string;
    if (!eventType || typeof eventType !== "string") {
      return apiError("VALIDATION_ERROR", `Event at index ${i} missing required eventType.`, 400);
    }
    if (!PLAYBACK_EVENT_TYPES.includes(eventType as PlaybackEventType)) {
      return apiError(
        "VALIDATION_ERROR",
        `Event at index ${i} has invalid eventType: "${eventType}".`,
        400,
        { allowedEventTypes: PLAYBACK_EVENT_TYPES }
      );
    }

    // title_slug / titleSlug
    const titleSlug = (item.titleSlug || item.title_slug) as string;
    if (!titleSlug || typeof titleSlug !== "string" || !titleSlug.trim()) {
      return apiError("VALIDATION_ERROR", `Event at index ${i} missing required titleSlug.`, 400);
    }
    if (titleSlug.length > 200) {
      return apiError("VALIDATION_ERROR", `Event at index ${i} titleSlug exceeds 200 characters.`, 400);
    }

    // episode_number / episodeNumber
    const episodeNum = Number(item.episodeNumber ?? item.episode_number);
    if (!Number.isInteger(episodeNum) || episodeNum < 1) {
      return apiError(
        "VALIDATION_ERROR",
        `Event at index ${i} episodeNumber must be a positive integer.`,
        400
      );
    }

    // session_id / sessionId
    let sessionId = (item.sessionId || item.session_id) as string;
    if (!isValidUuid(sessionId)) {
      sessionId = crypto.randomUUID();
    }

    // anon_id / anonId
    let anonId = (item.anonId || item.anon_id) as string;
    if (!isValidUuid(anonId)) {
      anonId = resolvedAnonId;
    }

    // platform
    let platform = (item.platform || "web") as PlaybackPlatform;
    if (!PLAYBACK_PLATFORMS.includes(platform)) {
      platform = "web";
    }

    // position_seconds / duration_seconds
    const posSec =
      item.positionSeconds !== undefined && item.positionSeconds !== null
        ? Math.max(0, Number(item.positionSeconds) || 0)
        : null;
    const durSec =
      item.durationSeconds !== undefined && item.durationSeconds !== null
        ? Math.max(0, Number(item.durationSeconds) || 0)
        : null;

    // utm & payload caps
    const utm = (item.utm && typeof item.utm === "object" ? item.utm : {}) as Record<string, string>;
    const payload = (item.payload && typeof item.payload === "object" ? item.payload : {}) as Record<
      string,
      unknown
    >;

    validatedEvents.push({
      occurredAt: typeof item.occurredAt === "string" ? item.occurredAt : new Date().toISOString(),
      anonId,
      sessionId,
      titleSlug: titleSlug.trim(),
      episodeNumber: episodeNum,
      eventType: eventType as PlaybackEventType,
      platform,
      positionSeconds: posSec,
      durationSeconds: durSec,
      utm,
      payload,
    });
  }

  // 7. Insert events into database
  const result = await insertPlaybackEvents(validatedEvents, userId);

  if (!result.ok) {
    return apiError(
      "DATABASE_ERROR",
      result.errors?.[0] || "Failed to persist playback events.",
      500
    );
  }

  // 8. Construct response and set cookie if needed
  const response = apiSuccess(
    {
      accepted: validatedEvents.length,
      anonId: resolvedAnonId,
    },
    200
  );

  applyRateLimitHeaders(response, rateLimit);

  if (setAnonCookie && resolvedAnonId) {
    response.cookies.set(COOKIE_ANON_ID, resolvedAnonId, {
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // Accessible by client tracking modules
    });
  }

  return response;
}
