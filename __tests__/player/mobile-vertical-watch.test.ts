import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 14.1: Full-Screen Vertical Watch Mode & Player Modularization", () => {
  describe("R1: Full-Screen Immersive Watch Shell (< md)", () => {
    const watchPagePath = path.resolve(process.cwd(), "app/watch/[slug]/page.tsx");
    const watchPageCode = fs.readFileSync(watchPagePath, "utf-8");

    it("verifies Header and Footer are hidden on mobile (< md)", () => {
      assert.ok(
        watchPageCode.includes('<div className="hidden md:block">\n        <Header />\n      </div>') ||
          (watchPageCode.includes("hidden md:block") && watchPageCode.includes("<Header />")),
        "Header must be wrapped with hidden md:block on watch route"
      );
      assert.ok(
        watchPageCode.includes('<div className="hidden md:block">\n        <Footer />\n      </div>') ||
          (watchPageCode.includes("hidden md:block") && watchPageCode.includes("<Footer />")),
        "Footer must be wrapped with hidden md:block on watch route"
      );
    });

    it("verifies breadcrumbs and back link are hidden on mobile viewports (< md)", () => {
      assert.ok(
        watchPageCode.includes("hidden md:flex items-center justify-between gap-4 mb-4"),
        "Breadcrumbs container must be hidden md:flex"
      );
    });

    it("verifies main container spans full mobile viewport (100dvh)", () => {
      assert.ok(
        watchPageCode.includes("w-full h-[100dvh] p-0 m-0 overflow-hidden md:h-auto"),
        "Main element must fill 100dvh with zero padding on mobile"
      );
    });

    it("verifies WatchPlayerIsland hides desktop metadata box and desktop sidebar on mobile", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes('<div className="hidden md:block mt-4 p-4 rounded-xl bg-surface border border-border shadow-sm">'),
        "Desktop metadata box must have hidden md:block"
      );
      assert.ok(
        islandCode.includes('<aside className="hidden md:block w-full lg:w-80 shrink-0">'),
        "Desktop episode sidebar must have hidden md:block"
      );
      assert.ok(
        islandCode.includes("h-[100dvh] md:h-auto"),
        "WatchPlayerIsland must support 100dvh on mobile"
      );
    });
  });

  describe("R2: Default Aspect Ratio & episode_media Framing", () => {
    const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
    const playerCode = fs.readFileSync(playerPath, "utf-8");

    it("verifies VideoPlayer default aspectMode initializes to 9:16 instead of fit", () => {
      assert.ok(
        playerCode.includes('return "9:16";'),
        "VideoPlayer must default to 9:16"
      );
      assert.ok(
        !playerCode.includes('useState<AspectRatioMode>("fit");'),
        "VideoPlayer must not have static fit default"
      );
    });

    it("verifies VideoPlayerProps accepts aspectRatio and isMobileFullViewport props", () => {
      assert.ok(
        playerCode.includes("aspectRatio?: string;"),
        "VideoPlayerProps must declare aspectRatio prop"
      );
      assert.ok(
        playerCode.includes("isMobileFullViewport?: boolean;"),
        "VideoPlayerProps must declare isMobileFullViewport prop"
      );
    });

    it("verifies aspectContainerClasses adapts to isMobileFullViewport", () => {
      assert.ok(
        playerCode.includes("if (isMobileFullViewport) {"),
        "aspectContainerClasses must handle isMobileFullViewport"
      );
      assert.ok(
        playerCode.includes("w-full h-full md:aspect-[9/16]"),
        "isMobileFullViewport must fill full height and width on mobile"
      );
    });

    it("verifies WatchPlayerIsland supplies aspectRatio and isMobileFullViewport to VideoPlayer", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes('aspectRatio={playbackSource?.aspectRatio || "9:16"}'),
        "WatchPlayerIsland must pass playbackSource aspectRatio fallback to 9:16"
      );
      assert.ok(
        islandCode.includes("isMobileFullViewport={true}"),
        "WatchPlayerIsland must set isMobileFullViewport to true"
      );
    });
  });

  describe("R3: Episode Bottom Sheet (components/player/EpisodeSheet.tsx)", () => {
    const sheetPath = path.resolve(process.cwd(), "components/player/EpisodeSheet.tsx");

    it("verifies EpisodeSheet component file exists", () => {
      assert.ok(fs.existsSync(sheetPath), "EpisodeSheet.tsx must exist");
    });

    it("verifies EpisodeSheet accessibility attributes and modal behavior", () => {
      const sheetCode = fs.readFileSync(sheetPath, "utf-8");
      assert.ok(sheetCode.includes('role="dialog"'), "Must declare role='dialog'");
      assert.ok(sheetCode.includes('aria-modal="true"'), "Must declare aria-modal='true'");
      assert.ok(sheetCode.includes("e.key === \"Escape\""), "Must handle Escape key to close");
      assert.ok(sheetCode.includes('document.body.style.overflow = "hidden"'), "Must lock body scroll when open");
    });

    it("verifies EpisodeSheet chunks episodes into ranges of 40", () => {
      const sheetCode = fs.readFileSync(sheetPath, "utf-8");
      assert.ok(sheetCode.includes("const EPISODES_PER_TAB = 40;"), "Tab size must be 40");
      assert.ok(sheetCode.includes("Math.ceil(totalEpisodes / EPISODES_PER_TAB)"), "Must compute tab count");
      assert.ok(sheetCode.includes("{tab.start}-{tab.end}"), "Must display tab range label");
    });

    it("verifies EpisodeSheet renders state indicators (active, available, soon, locked)", () => {
      const sheetCode = fs.readFileSync(sheetPath, "utf-8");
      assert.ok(sheetCode.includes("ring-primary") && sheetCode.includes("active"), "Must highlight active episode");
      assert.ok(sheetCode.includes("title=\"Coming soon\""), "Must handle unavailable episodes");
      assert.ok(sheetCode.includes("isLocked"), "Must identify locked episodes");
    });
  });

  describe("R4: Mobile Watch Overlay (components/player/WatchOverlay.tsx)", () => {
    const overlayPath = path.resolve(process.cwd(), "components/player/WatchOverlay.tsx");

    it("verifies WatchOverlay component file exists", () => {
      assert.ok(fs.existsSync(overlayPath), "WatchOverlay.tsx must exist");
    });

    it("verifies WatchOverlay top bar renders back link, title, and episode counter", () => {
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");
      assert.ok(overlayCode.includes("href={`/drama/${drama.slug}`}"), "Must link back to drama page");
      assert.ok(overlayCode.includes("{drama.title}"), "Must render drama title");
      assert.ok(overlayCode.includes("EP {currentEpisode} / {totalEpisodes}"), "Must render EP counter");
    });

    it("verifies WatchOverlay vertical action rail renders Favorite, Episodes, Share, Report", () => {
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");
      assert.ok(overlayCode.includes("useFavorites"), "Must bind useFavorites hook");
      assert.ok(overlayCode.includes("toggleFavorite(drama.slug)"), "Must invoke toggleFavorite");
      assert.ok(overlayCode.includes("onClick={onOpenEpisodes}"), "Must trigger onOpenEpisodes");
      assert.ok(overlayCode.includes("onClick={handleShare}"), "Must trigger handleShare");
      assert.ok(overlayCode.includes("category=playback"), "Must link to report issue with playback category");
    });

    it("verifies WatchOverlay provides center tap play/pause and bottom scrubber", () => {
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");
      assert.ok(overlayCode.includes("onClick={onTogglePlay}"), "Must bind center tap to onTogglePlay");
      assert.ok(overlayCode.includes('type="range"'), "Must render range input for seeking");
      assert.ok(overlayCode.includes("onSeek?.(val)"), "Must invoke onSeek on scrub change");
    });
  });

  describe("R5: Player Modularization & Hook Exports", () => {
    it("verifies components/player/index.ts exports all hooks and components", async () => {
      const playerModule = await import("@/components/player");
      assert.ok(playerModule.VideoPlayer, "Must export VideoPlayer");
      assert.ok(playerModule.EpisodeSheet, "Must export EpisodeSheet");
      assert.ok(playerModule.WatchOverlay, "Must export WatchOverlay");
      assert.ok(playerModule.useHlsSource, "Must export useHlsSource hook");
      assert.ok(playerModule.usePlayerControls, "Must export usePlayerControls hook");
      assert.ok(playerModule.useSwipeNavigation, "Must export useSwipeNavigation hook");
      assert.ok(playerModule.useProgressReporter, "Must export useProgressReporter hook");
    });

    it("verifies useSwipeNavigation handles vertical touch gestures and cancel events", () => {
      const swipeHookPath = path.resolve(process.cwd(), "components/player/useSwipeNavigation.ts");
      const swipeCode = fs.readFileSync(swipeHookPath, "utf-8");

      assert.ok(swipeCode.includes("handleTouchStart"), "Must define handleTouchStart");
      assert.ok(swipeCode.includes("handleTouchMove"), "Must define handleTouchMove");
      assert.ok(swipeCode.includes("handleTouchEnd"), "Must define handleTouchEnd");
      assert.ok(swipeCode.includes("handleTouchCancel"), "Must define handleTouchCancel");
      assert.ok(swipeCode.includes("deltaY * 0.45"), "Must apply rubberband damping");
    });

    it("verifies usePlayerControls provides iOS webkitEnterFullscreen fallback", () => {
      const controlsHookPath = path.resolve(process.cwd(), "components/player/usePlayerControls.ts");
      const controlsCode = fs.readFileSync(controlsHookPath, "utf-8");

      assert.ok(
        controlsCode.includes("webkitEnterFullscreen"),
        "usePlayerControls must support webkitEnterFullscreen for iOS Safari"
      );
    });

    it("verifies useHlsSource manages exponential backoff and cleanup on unmount", () => {
      const hlsHookPath = path.resolve(process.cwd(), "components/player/useHlsSource.ts");
      const hlsCode = fs.readFileSync(hlsHookPath, "utf-8");

      assert.ok(hlsCode.includes("calculateBackoffDelay"), "Must calculate exponential backoff");
      assert.ok(hlsCode.includes("MAX_NETWORK_RETRIES"), "Must bound retries by MAX_NETWORK_RETRIES");
      assert.ok(hlsCode.includes("video.pause()"), "Must pause video on unmount");
    });
  });
});
