/**
 * Client-Side Playback & Engagement Tracking Module (Task 15.2, ADR-0003)
 *
 * Implements in-memory queuing, periodic 10-second batching, guaranteed flush-on-hide
 * via sendBeacon / keepalive fetch, UTM capture on initial entry, device anonymous ID,
 * and user consent controls.
 */

import type {
  PlaybackEventPayload,
  PlaybackEventType,
  PlaybackPlatform,
  UtmParameters,
  BatchEventIngestRequest,
} from "@/types/analytics";

const FLUSH_INTERVAL_MS = 10_000;
const MAX_BATCH_SIZE = 50;
const MAX_QUEUE_BUFFER_SIZE = 150;

const COOKIE_ANON_ID = "dramashort_anon_id";
const COOKIE_CONSENT = "dramashort_consent";
const STORAGE_SESSION_ID = "dramashort_session_id";
const STORAGE_UTM = "dramashort_utm";
const STORAGE_CONSENT = "dramashort_analytics_consent";

// In-memory queue
let eventQueue: PlaybackEventPayload[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isInitialized = false;

// Cached in-memory IDs for current session
let cachedAnonId: string | null = null;
let cachedSessionId: string | null = null;
let cachedUtm: UtmParameters | null = null;

/**
 * UUID v4 generator with fallback
 */
function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Parses cookies in browser environment
 */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Sets a cookie in browser environment
 */
function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

/**
 * Checks whether analytics are enabled and consent is granted.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return true;

  // 1. Check environment variable toggle
  if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === "false") {
    return false;
  }

  // 2. Check localStorage consent
  try {
    const localConsent = window.localStorage.getItem(STORAGE_CONSENT);
    if (localConsent === "false") return false;
  } catch {}

  // 3. Check cookie consent
  const cookieConsent = getCookie(COOKIE_CONSENT);
  if (cookieConsent === "declined") return false;

  return true;
}

/**
 * Sets user analytics consent preference.
 */
export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_CONSENT, String(granted));
  } catch {}

  setCookie(COOKIE_CONSENT, granted ? "accepted" : "declined", 31536000); // 1 year

  if (!granted) {
    // Purge queue immediately on consent revocation
    eventQueue = [];
  }
}

/**
 * Resolves or generates the anonymous device identifier.
 */
export function getAnonId(): string {
  if (cachedAnonId) return cachedAnonId;

  if (typeof window === "undefined") {
    return generateUuid();
  }

  // Check cookie
  let id = getCookie(COOKIE_ANON_ID);
  if (id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    cachedAnonId = id;
    return id;
  }

  // Check localStorage fallback
  try {
    const stored = window.localStorage.getItem(COOKIE_ANON_ID);
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stored)) {
      id = stored;
    }
  } catch {}

  if (!id) {
    id = generateUuid();
  }

  // Persist for 2 years (63,072,000s)
  setCookie(COOKIE_ANON_ID, id, 63072000);
  try {
    window.localStorage.setItem(COOKIE_ANON_ID, id);
  } catch {}

  cachedAnonId = id;
  return id;
}

export const getAnonymousId = getAnonId;

/**
 * Resolves or generates the session identifier.
 */
export function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;

  if (typeof window === "undefined") {
    return generateUuid();
  }

  try {
    const stored = window.sessionStorage.getItem(STORAGE_SESSION_ID);
    if (stored) {
      cachedSessionId = stored;
      return stored;
    }
  } catch {}

  const newId = generateUuid();
  try {
    window.sessionStorage.setItem(STORAGE_SESSION_ID, newId);
  } catch {}

  cachedSessionId = newId;
  return newId;
}

/**
 * Resolves UTM parameters from current URL or sessionStorage.
 */
export function getUtmParameters(): UtmParameters {
  if (cachedUtm) return cachedUtm;
  if (typeof window === "undefined") return {};

  const utm: UtmParameters = {};

  try {
    const searchParams = new URLSearchParams(window.location.search);
    const source = searchParams.get("utm_source");
    const medium = searchParams.get("utm_medium");
    const campaign = searchParams.get("utm_campaign");
    const term = searchParams.get("utm_term");
    const content = searchParams.get("utm_content");

    // Telegram Mini App startapp / tgWebAppStartParam detection
    const tgParam =
      searchParams.get("tgWebAppStartParam") ||
      searchParams.get("startapp") ||
      searchParams.get("ref");

    if (source) utm.source = source;
    if (medium) utm.medium = medium;
    if (campaign) utm.campaign = campaign;
    if (term) utm.term = term;
    if (content) utm.content = content;

    if (!utm.source && tgParam) {
      utm.source = "telegram";
      utm.campaign = tgParam;
    }

    if (Object.keys(utm).length > 0) {
      window.sessionStorage.setItem(STORAGE_UTM, JSON.stringify(utm));
      cachedUtm = utm;
      return utm;
    }

    // Fall back to sessionStorage if previously captured in this session
    const stored = window.sessionStorage.getItem(STORAGE_UTM);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        cachedUtm = parsed;
        return parsed;
      }
    }
  } catch {}

  return {};
}

/**
 * Detects current client platform: web, pwa, or tma.
 */
export function getPlatform(): PlaybackPlatform {
  if (typeof window === "undefined") return "web";

  // Check Telegram WebApp environment
  const win = window as unknown as {
    Telegram?: { WebApp?: { initData?: string; platform?: string } };
  };
  if (win.Telegram?.WebApp && win.Telegram.WebApp.initData !== undefined) {
    return "tma";
  }

  // Check Progressive Web App standalone mode
  if (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean })?.standalone === true
  ) {
    return "pwa";
  }

  return "web";
}

/**
 * Flushes queued events to the backend ingestion endpoint.
 */
export async function flushEvents(options: { sync?: boolean } = {}): Promise<number> {
  if (eventQueue.length === 0) return 0;

  // Drain a batch of up to MAX_BATCH_SIZE
  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
  if (batch.length === 0) return 0;

  const payload: BatchEventIngestRequest = { events: batch };
  const jsonString = JSON.stringify(payload);

  if (options.sync && typeof window !== "undefined") {
    // 1. Try sendBeacon with text/plain (handled gracefully by Task 15.1 route)
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const sent = navigator.sendBeacon("/api/events", jsonString);
        if (sent) return batch.length;
      } catch {}
    }

    // 2. Fall back to fetch with keepalive: true
    if (typeof fetch === "function") {
      try {
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: jsonString,
          keepalive: true,
        }).catch(() => {});
        return batch.length;
      } catch {}
    }
    return batch.length;
  }

  // Asynchronous standard flush
  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: jsonString,
    });

    if (!res.ok) {
      // Re-queue unhandled items if queue is not full
      if (eventQueue.length < MAX_QUEUE_BUFFER_SIZE) {
        eventQueue.unshift(...batch);
      }
      return 0;
    }

    return batch.length;
  } catch (err) {
    // Re-queue on network error
    if (eventQueue.length < MAX_QUEUE_BUFFER_SIZE) {
      eventQueue.unshift(...batch);
    }
    return 0;
  }
}

/**
 * Initializes client tracking lifecycle listeners and flush interval.
 */
export function initTracking(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // 1. Setup periodic timer
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      flushEvents().catch(() => {});
    }, FLUSH_INTERVAL_MS);

    // Unref timer in Node / testing environments so it doesn't block exit
    if (typeof flushTimer === "object" && flushTimer !== null && typeof (flushTimer as unknown as { unref?: () => void }).unref === "function") {
      (flushTimer as unknown as { unref: () => void }).unref();
    }
  }

  // 2. Flush on visibility hidden
  if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushEvents({ sync: true }).catch(() => {});
      }
    });
  }

  // 3. Flush on pagehide / beforeunload
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", () => {
      flushEvents({ sync: true }).catch(() => {});
    });
    window.addEventListener("beforeunload", () => {
      flushEvents({ sync: true }).catch(() => {});
    });
  }
}

export interface TrackEventInput {
  titleSlug: string;
  episodeNumber: number;
  eventType: PlaybackEventType;
  platform?: PlaybackPlatform;
  positionSeconds?: number | null;
  durationSeconds?: number | null;
  utm?: UtmParameters;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

/**
 * Primary event tracking function.
 * Enqueues event into the in-memory queue and flushes when full.
 */
export function trackEvent(input: TrackEventInput): void {
  if (!hasAnalyticsConsent()) {
    return;
  }

  // Initialize tracking lifecycle if needed
  if (!isInitialized && typeof window !== "undefined") {
    initTracking();
  }

  const fullEvent: PlaybackEventPayload = {
    eventId: generateUuid(),
    occurredAt: input.occurredAt || new Date().toISOString(),
    anonId: getAnonId(),
    sessionId: getSessionId(),
    titleSlug: input.titleSlug,
    episodeNumber: input.episodeNumber,
    eventType: input.eventType,
    platform: input.platform || getPlatform(),
    positionSeconds: input.positionSeconds !== undefined ? input.positionSeconds : null,
    durationSeconds: input.durationSeconds !== undefined ? input.durationSeconds : null,
    utm: input.utm || getUtmParameters(),
    payload: input.payload,
  };

  if (eventQueue.length < MAX_QUEUE_BUFFER_SIZE) {
    eventQueue.push(fullEvent);
  }
}

// ==========================================
// Specialized Semantic Helper Functions
// ==========================================

export function trackPlaybackStart(params: {
  titleSlug: string;
  episodeNumber: number;
  durationSeconds?: number;
}): void {
  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber,
    eventType: "episode_start",
    positionSeconds: 0,
    durationSeconds: params.durationSeconds,
  });
}

export function trackPlaybackProgress(params: {
  titleSlug: string;
  episodeNumber: number;
  milestone: 25 | 50 | 75;
  positionSeconds: number;
  durationSeconds: number;
}): void {
  const eventType: PlaybackEventType =
    params.milestone === 25
      ? "episode_progress_25"
      : params.milestone === 50
      ? "episode_progress_50"
      : "episode_progress_75";

  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber,
    eventType,
    positionSeconds: params.positionSeconds,
    durationSeconds: params.durationSeconds,
  });
}

export function trackPlaybackComplete(params: {
  titleSlug: string;
  episodeNumber: number;
  durationSeconds?: number;
}): void {
  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber,
    eventType: "episode_complete",
    positionSeconds: params.durationSeconds || null,
    durationSeconds: params.durationSeconds,
  });
}

export function trackPlaybackSkip(params: {
  titleSlug: string;
  episodeNumber: number;
  positionSeconds?: number;
  durationSeconds?: number;
}): void {
  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber,
    eventType: "episode_skip",
    positionSeconds: params.positionSeconds || null,
    durationSeconds: params.durationSeconds,
  });
}

export function trackShare(params: {
  titleSlug: string;
  episodeNumber: number;
  platform?: PlaybackPlatform;
  shareMethod?: string;
}): void {
  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber,
    eventType: "share",
    platform: params.platform,
    payload: params.shareMethod ? { method: params.shareMethod } : undefined,
  });
}

export function trackFavorite(params: {
  titleSlug: string;
  episodeNumber?: number;
}): void {
  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber || 1,
    eventType: "favorite_add",
  });
}

export function trackGuestPrompt(params: {
  action: "shown" | "cta_click" | "dismiss";
  trigger: "favorite" | "episode_3";
  titleSlug?: string;
  episodeNumber?: number;
}): void {
  const eventType: PlaybackEventType =
    params.action === "shown"
      ? "guest_prompt_shown"
      : params.action === "cta_click"
      ? "guest_prompt_cta"
      : "guest_prompt_dismiss";

  trackEvent({
    titleSlug: params.titleSlug || "unknown",
    episodeNumber: params.episodeNumber || 1,
    eventType,
    payload: { trigger: params.trigger },
  });
}

/**
 * Tracks an experiment exposure event when a user is exposed to an A/B test variant (Task 15.5).
 */
export function trackExperimentExposure(params: {
  experimentId: string;
  variantId: string;
  metadata?: Record<string, unknown>;
}): void {
  trackEvent({
    titleSlug: "platform",
    episodeNumber: 1,
    eventType: "experiment_exposure",
    payload: {
      experimentId: params.experimentId,
      variantId: params.variantId,
      ...(params.metadata || {}),
    },
  });
}

/**
 * Tracks a paywall presentation event when a locked episode is encountered (Task 8.3 / Task 15.2).
 */
export function trackPaywallView(params: {
  titleSlug: string;
  episodeNumber: number;
  source?: "navigation" | "drawer" | "auto_next" | "initial_load";
}): void {
  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber,
    eventType: "paywall_view",
    payload: {
      source: params.source || "navigation",
    },
  });
}

/**
 * Tracks an episode unlock event when coins are spent or VIP bypass unlocks an episode (Task 8.3 / Task 15.2).
 */
export function trackEpisodeUnlock(params: {
  titleSlug: string;
  episodeNumber: number;
  coinsSpent: number;
  isBundle?: boolean;
  episodesCount?: number;
  isVip?: boolean;
}): void {
  trackEvent({
    titleSlug: params.titleSlug,
    episodeNumber: params.episodeNumber,
    eventType: "episode_unlock",
    payload: {
      coinsSpent: params.coinsSpent,
      isBundle: Boolean(params.isBundle),
      episodesCount: params.episodesCount || 1,
      isVip: Boolean(params.isVip),
    },
  });
}

/**
 * Testing utilities for isolating unit tests
 */
export function _resetTrackingForTesting(): void {
  eventQueue = [];
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  isInitialized = false;
  cachedAnonId = null;
  cachedSessionId = null;
  cachedUtm = null;
}

export function _getEventQueue(): PlaybackEventPayload[] {
  return [...eventQueue];
}
