import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  preloadEpisodePlayback,
  getPreloadedEpisodePlayback,
  preloadHlsManifestAndFirstSegment,
  preloadMediaRange,
  warmupMediaAsset,
  clearPreloadCache,
} from "../../lib/player/episode-preloader";
import * as playerExports from "../../components/player";

describe("Task 14.4: Autoplay, Preloading & Episode Transitions", () => {
  beforeEach(() => {
    clearPreloadCache();
  });

  afterEach(() => {
    clearPreloadCache();
  });

  describe("R1: Episode Preloader Module & In-Memory Caching", () => {
    it("returns null for uncached episode ID via getPreloadedEpisodePlayback", () => {
      const cached = getPreloadedEpisodePlayback("non-existent-uuid");
      assert.equal(cached, null);
    });

    it("preloads and caches playback source in memory", async () => {
      const fakeEpId = "11111111-2222-3333-4444-555555555555";

      // Mock global fetch for getEpisodePlayback
      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes(`/api/playback/${fakeEpId}`)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                url: "https://stream.example.com/hls/ep2/master.m3u8",
                type: "hls",
                aspectRatio: "9:16",
                duration: 90,
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
              },
            }),
          } as Response;
        }
        if (urlStr.includes(".m3u8")) {
          return {
            ok: true,
            status: 200,
            text: async () => "#EXTM3U\n#EXT-X-VERSION:3\nsegment1.ts\nsegment2.ts\n",
          } as Response;
        }
        return {
          ok: true,
          status: 206,
          headers: new Headers({ "content-range": "bytes 0-524287/1000000" }),
        } as Response;
      }) as typeof fetch;

      try {
        const preloaded = await preloadEpisodePlayback(fakeEpId);
        assert.ok(preloaded, "Must return preloaded playback data");
        assert.equal(preloaded.url, "https://stream.example.com/hls/ep2/master.m3u8");
        assert.equal(preloaded.aspectRatio, "9:16");

        // Synchronous retrieval must now hit cache
        const cached = getPreloadedEpisodePlayback(fakeEpId);
        assert.ok(cached, "Synchronous cache lookup must succeed");
        assert.equal(cached.url, "https://stream.example.com/hls/ep2/master.m3u8");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("deduplicates concurrent in-flight preload requests for the same episode ID", async () => {
      const fakeEpId = "22222222-3333-4444-5555-666666666666";
      let networkCalls = 0;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes(`/api/playback/${fakeEpId}`)) {
          networkCalls++;
          await new Promise((r) => setTimeout(r, 20));
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: {
                url: "https://stream.example.com/video2.mp4",
                type: "mp4",
                aspectRatio: "9:16",
              },
            }),
          } as Response;
        }
        return { ok: true, status: 200 } as Response;
      }) as typeof fetch;

      try {
        const [res1, res2, res3] = await Promise.all([
          preloadEpisodePlayback(fakeEpId, { preloadMedia: false }),
          preloadEpisodePlayback(fakeEpId, { preloadMedia: false }),
          preloadEpisodePlayback(fakeEpId, { preloadMedia: false }),
        ]);

        assert.equal(networkCalls, 1, "Must make exactly 1 network call for deduplicated requests");
        assert.equal(res1?.url, "https://stream.example.com/video2.mp4");
        assert.equal(res2?.url, "https://stream.example.com/video2.mp4");
        assert.equal(res3?.url, "https://stream.example.com/video2.mp4");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles HLS manifest parsing and first segment warmup", async () => {
      const fetchedUrls: string[] = [];
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        fetchedUrls.push(urlStr);
        if (urlStr.endsWith("master.m3u8")) {
          return {
            ok: true,
            status: 200,
            text: async () => "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=800000\n720p.m3u8",
          } as Response;
        }
        if (urlStr.endsWith("720p.m3u8")) {
          return {
            ok: true,
            status: 200,
            text: async () => "#EXTM3U\n#EXTINF:4.0,\nseg_0001.ts",
          } as Response;
        }
        return { ok: true, status: 200 } as Response;
      }) as typeof fetch;

      try {
        await preloadHlsManifestAndFirstSegment("https://cdn.example.com/stream/master.m3u8");
        assert.ok(
          fetchedUrls.some((u) => u.includes("master.m3u8")),
          "Must fetch master manifest"
        );
        assert.ok(
          fetchedUrls.some((u) => u.includes("720p.m3u8")),
          "Must fetch child variant playlist"
        );
        assert.ok(
          fetchedUrls.some((u) => u.includes("seg_0001.ts")),
          "Must prefetch first media segment"
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles MP4 range preloading and clears cache safely", async () => {
      let rangeHeaderSent = false;
      const originalFetch = globalThis.fetch;

      globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
        const headers = init?.headers as Record<string, string> | undefined;
        if (headers && headers.Range) {
          rangeHeaderSent = true;
        }
        return { ok: true, status: 206 } as Response;
      }) as typeof fetch;

      try {
        await preloadMediaRange("https://cdn.example.com/clip.mp4", 262144);
        assert.equal(rangeHeaderSent, true, "Must send byte range header for initial chunk");

        // Warmup dispatcher
        await warmupMediaAsset("https://cdn.example.com/clip2.mp4");

        // Clear cache
        clearPreloadCache();
        assert.equal(getPreloadedEpisodePlayback("any-id"), null);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("R2: Muted Autoplay on Entry & 'Tap to Unmute' Pill", () => {
    it("verifies WatchOverlay renders floating 'Tap to unmute' pill when isMuted and isPlaying", () => {
      const overlayPath = path.resolve(process.cwd(), "components/player/WatchOverlay.tsx");
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");

      assert.ok(
        overlayCode.includes("Tap to unmute"),
        "WatchOverlay must render 'Tap to unmute' pill"
      );
      assert.ok(
        overlayCode.includes("VolumeX"),
        "WatchOverlay must render VolumeX icon for muted state"
      );
      assert.ok(
        overlayCode.includes("aria-label=\"Tap to unmute audio\""),
        "WatchOverlay pill must provide accessible aria-label"
      );
      assert.ok(
        overlayCode.includes("handleToggleMute"),
        "WatchOverlay must wire handleToggleMute to unmute pill button"
      );
      assert.ok(
        overlayCode.includes("dramashort_session_unmuted"),
        "WatchOverlay must persist session unmute choice in sessionStorage"
      );
    });

    it("verifies VideoPlayer renders floating 'Tap to unmute' pill and restores session state", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      assert.ok(
        playerCode.includes("showUnmutePill && isMuted && isPlaying"),
        "VideoPlayer must conditionally display Tap to unmute pill"
      );
      assert.ok(
        playerCode.includes("handleTapToUnmute"),
        "VideoPlayer must define handleTapToUnmute callback"
      );
      assert.ok(
        playerCode.includes("sessionStorage.getItem(\"dramashort_session_unmuted\")"),
        "VideoPlayer must check sessionStorage for previous unmute consent"
      );
      assert.ok(
        playerCode.includes("sessionStorage.setItem(\"dramashort_session_unmuted\", \"true\")"),
        "VideoPlayer must write session unmute consent upon tapping unmute"
      );
    });

    it("verifies VideoPlayer autoPlay prop defaults to true", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      assert.ok(
        playerCode.includes("autoPlay = true,"),
        "VideoPlayerProps autoPlay must default to true for vertical watch experience"
      );
    });

    it("verifies VideoPlayer catches unmuted playback rejections and falls back to muted autoplay", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      // Verify resilient play catch handler exists
      assert.ok(
        playerCode.includes("if (!video.muted) {\n                video.muted = true;\n                setIsMuted(true);\n                setShowUnmutePill(true);"),
        "HLS MANIFEST_PARSED must catch unmuted play failure and retry with muted=true"
      );
      assert.ok(
        playerCode.includes("video.play().catch(() => {\n            if (!video.muted) {\n              video.muted = true;\n              setIsMuted(true);\n              setShowUnmutePill(true);"),
        "Native HLS must catch unmuted play failure and retry with muted=true"
      );
    });
  });

  describe("R3: 80% Progress Threshold Episode Preloading", () => {
    it("verifies WatchPlayerIsland triggers preloadEpisodePlayback when progress >= 80%", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes("progressRatio >= 0.8 && currentEpisode < totalEps"),
        "WatchPlayerIsland must detect 80% progress boundary"
      );
      assert.ok(
        islandCode.includes("preloadEpisodePlayback(nextEp.id)"),
        "WatchPlayerIsland must trigger preloadEpisodePlayback for next episode"
      );
    });

    it("verifies WatchPlayerIsland checks getPreloadedEpisodePlayback before network fetch", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes("getPreloadedEpisodePlayback(currentEpData.id)"),
        "WatchPlayerIsland must check synchronous preloaded cache"
      );
      assert.ok(
        islandCode.includes("setPlaybackSource(preloaded)"),
        "WatchPlayerIsland must apply preloaded playback source immediately"
      );
      assert.ok(
        islandCode.includes("setPlaybackLoading(false)"),
        "WatchPlayerIsland must skip loading spinner when preloaded"
      );
    });
  });

  describe("R4: Default Auto-Next & Smooth Episode Advancement", () => {
    it("verifies WatchPlayerIsland initializes autoPlayNext to true by default", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes("localStorage.getItem(\"dramashort_player_autonext\")"),
        "WatchPlayerIsland must check localStorage for user preference"
      );
      assert.ok(
        islandCode.includes("return true; // Auto-next enabled by default"),
        "WatchPlayerIsland must return true as default auto-next state"
      );
    });

    it("verifies WatchPlayerIsland advances to next episode when video ends and autoPlayNext is active", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes("if (autoPlayNext && currentEpisode < totalEps) {\n      handleSelectEpisode(currentEpisode + 1);"),
        "handleVideoEnded must auto-advance to currentEpisode + 1"
      );
    });
  });

  describe("R5: Deep-Link Instant Playback & Component Contracts", () => {
    it("verifies components/player/index.ts exports preloader utilities and types", () => {
      assert.ok(typeof playerExports.preloadEpisodePlayback === "function");
      assert.ok(typeof playerExports.getPreloadedEpisodePlayback === "function");
      assert.ok(typeof playerExports.clearPreloadCache === "function");
    });

    it("verifies WatchOverlayProps declares isMuted, onToggleMute, and showUnmutePill", () => {
      const typesPath = path.resolve(process.cwd(), "components/player/PlayerTypes.ts");
      const typesCode = fs.readFileSync(typesPath, "utf-8");

      assert.ok(typesCode.includes("isMuted?: boolean;"));
      assert.ok(typesCode.includes("onToggleMute?: () => void;"));
      assert.ok(typesCode.includes("showUnmutePill?: boolean;"));
    });

    it("verifies WatchPlayerIsland wires isMuted and onToggleMute to WatchOverlay", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(islandCode.includes("isMuted={isMutedState}"));
      assert.ok(islandCode.includes("onToggleMute={handleToggleMute}"));
      assert.ok(islandCode.includes("showUnmutePill={showUnmutePillState}"));
    });
  });

  describe("R6: Critical Invariant Protection (Zero Regressions)", () => {
    it("preserves exact string invariants tested by player-streaming-robustness", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      assert.ok(playerCode.includes("autoPlay || reloadIndex > 0"));
      assert.ok(playerCode.includes("video.src = src;\n        video.load();"));
      assert.ok(playerCode.includes("networkRetryCountRef.current < MAX_NETWORK_RETRIES"));
      assert.ok(playerCode.includes("hls.recoverMediaError();"));
      assert.ok(playerCode.includes("if (!autoPlayNext) {\n      cancelNextCountdown();\n    }"));
      assert.ok(playerCode.includes("onTouchCancel={handleTouchCancel}"));
    });
  });
});
