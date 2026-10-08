import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 14.2: Gesture Model Fixes & Mobile-First Touch Interactions", () => {
  describe("R1: Touch-Only Vertical Swipe & Desktop Drag Rejection", () => {
    it("verifies components/player/useSwipeNavigation.ts neutralizes desktop mouse dragging", () => {
      const swipeHookPath = path.resolve(process.cwd(), "components/player/useSwipeNavigation.ts");
      const swipeCode = fs.readFileSync(swipeHookPath, "utf-8");

      assert.ok(
        swipeCode.includes("handleMouseDown"),
        "Must declare handleMouseDown"
      );
      assert.ok(
        !swipeCode.includes("isDragging.current = true;\n  }, []);\n\n  const handleMouseMoveWithSwipe") &&
          !swipeCode.includes("touchStartY.current = e.clientY;\n    touchStartX.current = e.clientX;\n    isDragging.current = true;"),
        "Mouse down must NOT set isDragging to true"
      );
      assert.ok(
        swipeCode.includes("handleMouseMoveWithSwipe"),
        "Must export handleMouseMoveWithSwipe"
      );
      assert.ok(
        swipeCode.includes("handleMouseUp"),
        "Must export handleMouseUp"
      );
    });

    it("verifies components/VideoPlayer.tsx eliminates desktop mouse drag episode switching", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      // Verify handleMouseDown is a no-op for dragging
      const mouseMoveMatch = playerCode.match(/const handleMouseMoveWithSwipe = \(_?e: React\.MouseEvent<HTMLDivElement>\) => \{([\s\S]*?)\};/);
      assert.ok(mouseMoveMatch, "handleMouseMoveWithSwipe must be defined");
      assert.ok(
        !mouseMoveMatch[1].includes("setSwipeOffset(damped)"),
        "handleMouseMoveWithSwipe must NOT update swipeOffset on desktop mouse movements"
      );

      // Verify touch handlers retain vertical swipe navigation and damping
      assert.ok(
        playerCode.includes("deltaY * 0.45"),
        "VideoPlayer touch move must apply 0.45 rubberband damping"
      );
      assert.ok(
        playerCode.includes("onTouchStart={handleTouchStart}"),
        "VideoPlayer must bind onTouchStart"
      );
      assert.ok(
        playerCode.includes("onTouchMove={handleTouchMove}"),
        "VideoPlayer must bind onTouchMove"
      );
      assert.ok(
        playerCode.includes("onTouchEnd={handleTouchEnd}"),
        "VideoPlayer must bind onTouchEnd"
      );
      assert.ok(
        playerCode.includes("onTouchCancel={handleTouchCancel}"),
        "VideoPlayer must bind onTouchCancel"
      );
    });
  });

  describe("R2: CSS Containment (touch-action: none & overscroll-behavior: contain)", () => {
    it("verifies VideoPlayer container enforces touch-none and overscroll-contain", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      assert.ok(
        playerCode.includes("touch-none"),
        "VideoPlayer stage must apply touch-none"
      );
      assert.ok(
        playerCode.includes("overscroll-contain"),
        "VideoPlayer stage must apply overscroll-contain"
      );
    });

    it("verifies WatchOverlay applies touch-none and overscroll-contain", () => {
      const overlayPath = path.resolve(process.cwd(), "components/player/WatchOverlay.tsx");
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");

      assert.ok(
        overlayCode.includes("touch-none"),
        "WatchOverlay container must apply touch-none"
      );
      assert.ok(
        overlayCode.includes("overscroll-contain"),
        "WatchOverlay container must apply overscroll-contain"
      );
    });

    it("verifies WatchPlayerIsland stage wrapper applies touch-none and overscroll-contain", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes("touch-none overscroll-contain"),
        "WatchPlayerIsland player wrapper must apply touch-none overscroll-contain"
      );
    });
  });

  describe("R3: Responsive Double-Tap Seek Model", () => {
    const gesturesHookPath = path.resolve(process.cwd(), "components/player/usePlayerGestures.ts");
    const gesturesCode = fs.readFileSync(gesturesHookPath, "utf-8");

    it("verifies usePlayerGestures checks tap zone ratios (< 0.35 left, > 0.65 right)", () => {
      assert.ok(
        gesturesCode.includes("ratio < 0.35"),
        "Must check left 35% zone for backward seek"
      );
      assert.ok(
        gesturesCode.includes("onSeekRelative?.(-10)"),
        "Must seek -10s on left double tap"
      );
      assert.ok(
        gesturesCode.includes("ratio > 0.65"),
        "Must check right 35% zone for forward seek"
      );
      assert.ok(
        gesturesCode.includes("onSeekRelative?.(10)"),
        "Must seek +10s on right double tap"
      );
    });

    it("verifies usePlayerGestures debounces single tap by 260ms to prevent double-tap collision", () => {
      assert.ok(
        gesturesCode.includes("setTimeout"),
        "Must use setTimeout for debounced single tap"
      );
      assert.ok(
        gesturesCode.includes("260"),
        "Must debounce single tap candidate by 260ms"
      );
    });

    it("verifies WatchOverlay renders << 10s and 10s >> animated ripple indicators", () => {
      const overlayPath = path.resolve(process.cwd(), "components/player/WatchOverlay.tsx");
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");

      assert.ok(
        overlayCode.includes("<< 10s") || overlayCode.includes("&lt;&lt; 10s"),
        "WatchOverlay must render << 10s backward ripple"
      );
      assert.ok(
        overlayCode.includes("10s >>") || overlayCode.includes("10s &gt;&gt;"),
        "WatchOverlay must render 10s >> forward ripple"
      );
    });

    it("verifies VideoPlayer renders << 10s and 10s >> animated ripple indicators", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      assert.ok(
        playerCode.includes("<< 10s") || playerCode.includes("&lt;&lt; 10s"),
        "VideoPlayer must render << 10s backward ripple"
      );
      assert.ok(
        playerCode.includes("10s >>") || playerCode.includes("10s &gt;&gt;"),
        "VideoPlayer must render 10s >> forward ripple"
      );
    });
  });

  describe("R4: Long-Press 2× Speed Boost", () => {
    const gesturesHookPath = path.resolve(process.cwd(), "components/player/usePlayerGestures.ts");
    const gesturesCode = fs.readFileSync(gesturesHookPath, "utf-8");

    it("verifies usePlayerGestures detects 400ms long press and cancels on > 8px movement", () => {
      assert.ok(
        gesturesCode.includes("400"),
        "Long press timer must be 400ms"
      );
      assert.ok(
        gesturesCode.includes("onSetPlaybackRate?.(2)"),
        "Long press must temporarily trigger 2× playback rate"
      );
      assert.ok(
        gesturesCode.includes("Math.abs(deltaY) > 8") && gesturesCode.includes("cancelLongPress()"),
        "Must cancel long-press if movement exceeds 8px"
      );
    });

    it("verifies usePlayerGestures restores original playback rate upon pointer release", () => {
      assert.ok(
        gesturesCode.includes("onSetPlaybackRate?.(previousSpeedRef.current)"),
        "Must restore previous playback rate on touch end / cancel"
      );
    });

    it("verifies WatchOverlay and VideoPlayer render floating 2× Speed badge", () => {
      const overlayPath = path.resolve(process.cwd(), "components/player/WatchOverlay.tsx");
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");
      assert.ok(
        overlayCode.includes("2× Speed"),
        "WatchOverlay must render 2× Speed badge"
      );

      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");
      assert.ok(
        playerCode.includes("2× Speed"),
        "VideoPlayer must render 2× Speed badge"
      );
    });
  });

  describe("R5: Next Episode Poster Preloading", () => {
    it("verifies WatchPlayerIsland resolves next episode poster and renders preload resource hint", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes("nextEpData"),
        "Must find next episode data"
      );
      assert.ok(
        islandCode.includes('rel="preload"') && islandCode.includes('as="image"'),
        "Must render <link rel='preload' as='image' ... /> for next poster"
      );
    });
  });

  describe("R6: Barrel Exports & Component Integration", () => {
    it("verifies components/player/index.ts exports usePlayerGestures alongside other hooks", async () => {
      const playerModule = await import("@/components/player");
      assert.ok(playerModule.usePlayerGestures, "Must export usePlayerGestures");
      assert.ok(playerModule.useSwipeNavigation, "Must export useSwipeNavigation");
      assert.ok(playerModule.WatchOverlay, "Must export WatchOverlay");
      assert.ok(playerModule.VideoPlayer, "Must export VideoPlayer");
    });

    it("verifies WatchOverlay attaches gesture handlers to its central interactive area", () => {
      const overlayPath = path.resolve(process.cwd(), "components/player/WatchOverlay.tsx");
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");

      assert.ok(
        overlayCode.includes("onTouchStart={gestures.handleTouchStart}"),
        "WatchOverlay must bind gestures.handleTouchStart"
      );
      assert.ok(
        overlayCode.includes("onTouchMove={gestures.handleTouchMove}"),
        "WatchOverlay must bind gestures.handleTouchMove"
      );
      assert.ok(
        overlayCode.includes("onTouchEnd={gestures.handleTouchEnd}"),
        "WatchOverlay must bind gestures.handleTouchEnd"
      );
      assert.ok(
        overlayCode.includes("onTouchCancel={gestures.handleTouchCancel}"),
        "WatchOverlay must bind gestures.handleTouchCancel"
      );
    });
  });
});
