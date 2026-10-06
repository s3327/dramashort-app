import type { HlsConfig } from "hls.js";

/**
 * Maximum number of consecutive fatal network retries with exponential backoff before error overlay.
 */
export const MAX_NETWORK_RETRIES = 3;

/**
 * Maximum number of consecutive fatal media recoveries before error overlay.
 */
export const MAX_MEDIA_RECOVERIES = 2;

/**
 * Base delay for exponential backoff in milliseconds (1s -> 2s -> 4s).
 */
export const RETRY_BASE_DELAY_MS = 1000;

/**
 * Display duration for the floating auto-resume notification pill.
 */
export const RESUME_NOTIFICATION_DURATION_MS = 6000;

/**
 * HLS.js configuration tuned for short-form VOD episodes (~1–2 minutes).
 *
 * - lowLatencyMode: false (disables low-latency live streaming heuristics, saving overhead for VOD)
 * - backBufferLength: 15s (keeps a lean backward buffer to prevent browser memory bloat)
 * - maxBufferLength: 30s (buffers up to 30s ahead, covering 25-50% of an entire episode)
 * - maxMaxBufferLength: 60s (caps forward buffer preventing excessive segment pre-fetching)
 * - maxBufferSize: 30MB (capped memory footprint)
 */
export const HLS_SHORT_VOD_CONFIG: Partial<HlsConfig> = {
  enableWorker: true,
  lowLatencyMode: false,
  backBufferLength: 15,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 30 * 1000 * 1000,
};

/**
 * Calculates exponential backoff delay in milliseconds.
 *
 * @param retryCount 0-indexed attempt count (0 -> 1s, 1 -> 2s, 2 -> 4s)
 * @param baseDelayMs Base delay in milliseconds (defaults to 1000ms)
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseDelayMs: number = RETRY_BASE_DELAY_MS
): number {
  const safeCount = Number.isFinite(retryCount) && retryCount > 0 ? Math.floor(retryCount) : 0;
  const safeBase = Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? baseDelayMs : RETRY_BASE_DELAY_MS;
  return safeBase * Math.pow(2, safeCount);
}

export type NetworkErrorAction =
  | { type: "retry"; delayMs: number; nextRetries: number }
  | { type: "fatal"; reason: string };

/**
 * Evaluates a fatal network error and determines whether to retry or transition to fatal error.
 */
export function handleNetworkError(
  currentRetries: number,
  maxRetries: number = MAX_NETWORK_RETRIES,
  baseDelayMs: number = RETRY_BASE_DELAY_MS
): NetworkErrorAction {
  const safeRetries = Number.isFinite(currentRetries) && currentRetries > 0 ? Math.floor(currentRetries) : 0;
  if (safeRetries < maxRetries) {
    const delayMs = calculateBackoffDelay(safeRetries, baseDelayMs);
    return {
      type: "retry",
      delayMs,
      nextRetries: safeRetries + 1,
    };
  }
  return {
    type: "fatal",
    reason: "Network error: unable to load video stream. Please check your internet connection.",
  };
}

export type MediaErrorAction =
  | { type: "recover"; nextRecoveries: number }
  | { type: "fatal"; reason: string };

/**
 * Evaluates a fatal media error and determines whether to recover or transition to fatal error.
 */
export function handleMediaError(
  currentRecoveries: number,
  maxRecoveries: number = MAX_MEDIA_RECOVERIES
): MediaErrorAction {
  const safeRecoveries = Number.isFinite(currentRecoveries) && currentRecoveries > 0 ? Math.floor(currentRecoveries) : 0;
  if (safeRecoveries < maxRecoveries) {
    return {
      type: "recover",
      nextRecoveries: safeRecoveries + 1,
    };
  }
  return {
    type: "fatal",
    reason: "Playback error: unable to recover media stream.",
  };
}

