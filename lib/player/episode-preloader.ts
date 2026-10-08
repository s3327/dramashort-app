/**
 * Episode Preloader Module (Task 14.4)
 *
 * Provides intelligent preloading and caching of next episode playback metadata
 * and media assets (HLS manifest, first segment, and MP4 initial range).
 *
 * When the current episode hits 80% progress, this module warms up the next
 * episode so that swiping or auto-advancing results in instant first-frame
 * playback without a cold-start loading delay.
 */

import type { PlaybackSource } from "@/types/content";
import { getEpisodePlayback } from "@/lib/services/content.service";

// In-memory cache for preloaded episode playback metadata
const preloadedPlaybackCache = new Map<string, PlaybackSource>();

// In-flight request deduplication map
const inFlightPlaybackPreloads = new Map<string, Promise<PlaybackSource | null>>();

// Tracked media URLs already warmed up into the browser cache
const preloadedMediaUrls = new Set<string>();

/**
 * Synchronously retrieves a preloaded playback source if already cached in memory.
 */
export function getPreloadedEpisodePlayback(episodeId: string): PlaybackSource | null {
  if (!episodeId) return null;
  return preloadedPlaybackCache.get(episodeId) || null;
}

/**
 * Preloads the playback source metadata for an episode and optionally warms up its media.
 */
export async function preloadEpisodePlayback(
  episodeId: string,
  options?: { preloadMedia?: boolean }
): Promise<PlaybackSource | null> {
  if (!episodeId) return null;

  // Check synchronous cache first
  const cached = preloadedPlaybackCache.get(episodeId);
  if (cached) {
    if (options?.preloadMedia !== false && cached.url) {
      warmupMediaAsset(cached.url).catch(() => {});
    }
    return cached;
  }

  // Check in-flight promise to avoid redundant concurrent network calls
  const existingPromise = inFlightPlaybackPreloads.get(episodeId);
  if (existingPromise) {
    return existingPromise;
  }

  const preloadPromise = (async () => {
    try {
      const res = await getEpisodePlayback(episodeId);
      if (res.success && res.data) {
        preloadedPlaybackCache.set(episodeId, res.data);
        if (options?.preloadMedia !== false && res.data.url) {
          warmupMediaAsset(res.data.url).catch(() => {});
        }
        return res.data;
      }
      return null;
    } catch {
      return null;
    } finally {
      inFlightPlaybackPreloads.delete(episodeId);
    }
  })();

  inFlightPlaybackPreloads.set(episodeId, preloadPromise);
  return preloadPromise;
}

/**
 * Warms up a media asset by URL into the browser HTTP cache.
 * Dispatches to HLS manifest parser or MP4 byte-range preloader.
 */
export async function warmupMediaAsset(mediaUrl: string): Promise<void> {
  if (!mediaUrl || preloadedMediaUrls.has(mediaUrl)) return;
  preloadedMediaUrls.add(mediaUrl);

  const isHls = mediaUrl.includes(".m3u8") || mediaUrl.includes("application/x-mpegURL");
  if (isHls) {
    await preloadHlsManifestAndFirstSegment(mediaUrl);
  } else {
    await preloadMediaRange(mediaUrl);
  }
}

/**
 * Downloads an HLS manifest, parses the first segment (or sub-playlist),
 * and fetches the first segment so it is cached in the browser.
 */
export async function preloadHlsManifestAndFirstSegment(manifestUrl: string): Promise<void> {
  if (typeof fetch === "undefined" || !manifestUrl) return;

  try {
    const res = await fetch(manifestUrl, { mode: "cors" });
    if (!res.ok) return;
    const text = await res.text();

    // Check if master playlist containing variant sub-playlists (.m3u8)
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);

    // Find first non-comment URI line
    let firstUriLine = lines.find((line) => !line.startsWith("#"));

    if (firstUriLine) {
      const resolvedFirstUri = firstUriLine.startsWith("http://") || firstUriLine.startsWith("https://")
        ? firstUriLine
        : `${baseUrl}${firstUriLine}`;

      // If it's a child playlist, fetch child playlist and get its first segment
      if (resolvedFirstUri.includes(".m3u8")) {
        const childRes = await fetch(resolvedFirstUri, { mode: "cors" });
        if (childRes.ok) {
          const childText = await childRes.text();
          const childLines = childText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
          const childBaseUrl = resolvedFirstUri.substring(0, resolvedFirstUri.lastIndexOf("/") + 1);
          const segmentLine = childLines.find((l) => !l.startsWith("#"));
          if (segmentLine) {
            const segmentUrl = segmentLine.startsWith("http://") || segmentLine.startsWith("https://")
              ? segmentLine
              : `${childBaseUrl}${segmentLine}`;
            await preloadMediaRange(segmentUrl, 524288); // Preload first ~512KB
          }
        }
      } else {
        // It's directly a media segment (.ts / .m4s)
        await preloadMediaRange(resolvedFirstUri, 524288);
      }
    }
  } catch {
    // Ignore preloading errors silently
  }
}

/**
 * Preloads the initial byte range of a media file (default: first 512KB).
 */
export async function preloadMediaRange(mediaUrl: string, bytes = 524288): Promise<void> {
  if (typeof fetch === "undefined" || !mediaUrl) return;

  try {
    await fetch(mediaUrl, {
      mode: "cors",
      headers: {
        Range: `bytes=0-${bytes - 1}`,
      },
    });
  } catch {
    // Ignore range preload failure
  }
}

/**
 * Clears in-memory caches. Intended for testing or complete catalog teardown.
 */
export function clearPreloadCache(): void {
  preloadedPlaybackCache.clear();
  inFlightPlaybackPreloads.clear();
  preloadedMediaUrls.clear();
}
