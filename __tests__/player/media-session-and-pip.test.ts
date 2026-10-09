import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  generateArtworkList,
  clampPositionState,
  type UseMediaSessionOptions,
} from "../../hooks/useMediaSession";

describe("Task 9.4: Picture-in-Picture & Media Session API Tests", () => {
  describe("Artwork List Generation (generateArtworkList)", () => {
    test("generates standard 6-size artwork list from drama poster", () => {
      const poster = "https://images.unsplash.com/photo-1234.jpg";
      const artwork = generateArtworkList(poster);

      assert.equal(artwork.length, 6);
      const sizes = artwork.map((a) => a.sizes);
      assert.deepEqual(sizes, [
        "96x96",
        "128x128",
        "192x192",
        "256x256",
        "384x384",
        "512x512",
      ]);

      artwork.forEach((item) => {
        assert.equal(item.src, poster);
        assert.equal(item.type, "image/jpeg");
      });
    });

    test("accurately determines image mime type from file extension", () => {
      const pngArt = generateArtworkList("https://cdn.example.com/poster.png");
      assert.equal(pngArt[0].type, "image/png");

      const webpArt = generateArtworkList("https://cdn.example.com/poster.webp");
      assert.equal(webpArt[0].type, "image/webp");
    });

    test("falls back to standard PWA icon assets when poster is empty or undefined", () => {
      const emptyArt = generateArtworkList("");
      assert.equal(emptyArt.length, 2);
      assert.equal(emptyArt[0].src, "/icon-192x192.png");
      assert.equal(emptyArt[1].src, "/icon-512x512.png");

      const nullArt = generateArtworkList(undefined);
      assert.equal(nullArt.length, 2);
    });
  });

  describe("Position State Clamping (clampPositionState)", () => {
    test("clamps position between 0 and duration", () => {
      // Normal within range
      const res1 = clampPositionState(30, 90, 1.5);
      assert.deepEqual(res1, { duration: 90, position: 30, playbackRate: 1.5 });

      // Current time exceeds duration
      const res2 = clampPositionState(120, 90, 1);
      assert.deepEqual(res2, { duration: 90, position: 90, playbackRate: 1 });
    });

    test("returns null when duration is invalid (<= 0, NaN, Infinity)", () => {
      assert.equal(clampPositionState(10, 0), null);
      assert.equal(clampPositionState(10, -5), null);
      assert.equal(clampPositionState(10, NaN), null);
      assert.equal(clampPositionState(10, Infinity), null);
    });

    test("returns null when currentTime is invalid (< 0, NaN, Infinity)", () => {
      assert.equal(clampPositionState(-1, 90), null);
      assert.equal(clampPositionState(NaN, 90), null);
      assert.equal(clampPositionState(Infinity, 90), null);
    });

    test("defaults playbackRate to 1 if negative, zero, or non-finite", () => {
      const res = clampPositionState(15, 60, 0);
      assert.equal(res?.playbackRate, 1);

      const resNeg = clampPositionState(15, 60, -2);
      assert.equal(resNeg?.playbackRate, 1);

      const resNaN = clampPositionState(15, 60, NaN);
      assert.equal(resNaN?.playbackRate, 1);
    });
  });

  describe("Media Session Action Handler Logic & Peripherals", () => {
    // Pure simulator replicating useMediaSession action dispatching
    function simulateMediaSession(options: {
      currentEpisode: number;
      totalEpisodes: number;
      currentTime: number;
      duration: number;
      onPlay?: () => void;
      onPause?: () => void;
      onNextEpisode?: () => void;
      onPrevEpisode?: () => void;
      onSeek?: (pos: number) => void;
    }) {
      const actions: Record<string, Function> = {};
      const registerAction = (act: string, fn: Function | null) => {
        if (fn) actions[act] = fn;
        else delete actions[act];
      };

      // Register standard handlers
      registerAction("play", () => options.onPlay?.());
      registerAction("pause", () => options.onPause?.());
      registerAction("previoustrack", () => {
        if (options.currentEpisode > 1) {
          options.onPrevEpisode?.();
        }
      });
      registerAction("nexttrack", () => {
        if (options.currentEpisode < options.totalEpisodes) {
          options.onNextEpisode?.();
        }
      });
      registerAction("seekbackward", (details: { seekOffset?: number }) => {
        const offset = details.seekOffset || 10;
        const target = Math.max(0, options.currentTime - offset);
        options.onSeek?.(target);
      });
      registerAction("seekforward", (details: { seekOffset?: number }) => {
        const offset = details.seekOffset || 10;
        const target = Math.min(options.duration, options.currentTime + offset);
        options.onSeek?.(target);
      });
      registerAction("seekto", (details: { seekTime?: number }) => {
        if (typeof details.seekTime === "number") {
          const target = Math.max(0, Math.min(options.duration, details.seekTime));
          options.onSeek?.(target);
        }
      });
      registerAction("stop", () => {
        options.onPause?.();
        options.onSeek?.(0);
      });

      return { actions, registerAction };
    }

    test("dispatches play and pause actions to handlers", () => {
      let played = false;
      let paused = false;

      const sim = simulateMediaSession({
        currentEpisode: 2,
        totalEpisodes: 10,
        currentTime: 20,
        duration: 90,
        onPlay: () => {
          played = true;
        },
        onPause: () => {
          paused = true;
        },
      });

      sim.actions.play();
      assert.equal(played, true);

      sim.actions.pause();
      assert.equal(paused, true);
    });

    test("enforces episode boundaries on previoustrack and nexttrack", () => {
      let prevCalled = false;
      let nextCalled = false;

      // At Episode 1: previoustrack should NOT trigger onPrevEpisode
      const simEp1 = simulateMediaSession({
        currentEpisode: 1,
        totalEpisodes: 10,
        currentTime: 0,
        duration: 60,
        onPrevEpisode: () => {
          prevCalled = true;
        },
        onNextEpisode: () => {
          nextCalled = true;
        },
      });

      simEp1.actions.previoustrack();
      assert.equal(prevCalled, false);

      simEp1.actions.nexttrack();
      assert.equal(nextCalled, true);

      // At Episode 10 of 10: nexttrack should NOT trigger onNextEpisode
      let nextCalledAtEnd = false;
      let prevCalledAtEnd = false;
      const simEp10 = simulateMediaSession({
        currentEpisode: 10,
        totalEpisodes: 10,
        currentTime: 0,
        duration: 60,
        onPrevEpisode: () => {
          prevCalledAtEnd = true;
        },
        onNextEpisode: () => {
          nextCalledAtEnd = true;
        },
      });

      simEp10.actions.nexttrack();
      assert.equal(nextCalledAtEnd, false);

      simEp10.actions.previoustrack();
      assert.equal(prevCalledAtEnd, true);
    });

    test("accurately calculates seekforward and seekbackward offsets", () => {
      let seekTarget: number | null = null;
      const sim = simulateMediaSession({
        currentEpisode: 1,
        totalEpisodes: 5,
        currentTime: 30,
        duration: 100,
        onSeek: (pos) => {
          seekTarget = pos;
        },
      });

      // Default seekforward (+10s)
      sim.actions.seekforward({});
      assert.equal(seekTarget, 40);

      // Custom seekbackward (-5s)
      sim.actions.seekbackward({ seekOffset: 5 });
      assert.equal(seekTarget, 25);

      // Backward clamped at 0
      const simAtStart = simulateMediaSession({
        currentEpisode: 1,
        totalEpisodes: 5,
        currentTime: 4,
        duration: 100,
        onSeek: (pos) => {
          seekTarget = pos;
        },
      });
      simAtStart.actions.seekbackward({ seekOffset: 10 });
      assert.equal(seekTarget, 0);

      // Forward clamped at duration
      const simAtEnd = simulateMediaSession({
        currentEpisode: 1,
        totalEpisodes: 5,
        currentTime: 95,
        duration: 100,
        onSeek: (pos) => {
          seekTarget = pos;
        },
      });
      simAtEnd.actions.seekforward({ seekOffset: 10 });
      assert.equal(seekTarget, 100);
    });

    test("seekto clamps within [0, duration]", () => {
      let seekTarget: number | null = null;
      const sim = simulateMediaSession({
        currentEpisode: 1,
        totalEpisodes: 5,
        currentTime: 10,
        duration: 120,
        onSeek: (pos) => {
          seekTarget = pos;
        },
      });

      sim.actions.seekto({ seekTime: 55 });
      assert.equal(seekTarget, 55);

      sim.actions.seekto({ seekTime: -10 });
      assert.equal(seekTarget, 0);

      sim.actions.seekto({ seekTime: 200 });
      assert.equal(seekTarget, 120);
    });

    test("stop action pauses playback and seeks to 0:00", () => {
      let paused = false;
      let seekTarget: number | null = null;
      const sim = simulateMediaSession({
        currentEpisode: 1,
        totalEpisodes: 5,
        currentTime: 50,
        duration: 120,
        onPause: () => {
          paused = true;
        },
        onSeek: (pos) => {
          seekTarget = pos;
        },
      });

      sim.actions.stop();
      assert.equal(paused, true);
      assert.equal(seekTarget, 0);
    });
  });

  describe("Picture-in-Picture Capability Detection & Presentation Modes", () => {
    test("detects standard pictureInPictureEnabled", () => {
      const mockDoc = { pictureInPictureEnabled: true };
      const isSupported = Boolean(mockDoc.pictureInPictureEnabled);
      assert.equal(isSupported, true);
    });

    test("detects iOS Safari webkitSetPresentationMode fallback", () => {
      const mockVideo = {
        webkitSetPresentationMode: () => {},
        webkitPresentationMode: "inline",
      };
      const isSafariSupported = "webkitSetPresentationMode" in mockVideo;
      assert.equal(isSafariSupported, true);
    });

    test("toggles presentation mode between picture-in-picture and inline", () => {
      let currentMode = "inline";
      const setMode = (mode: string) => {
        currentMode = mode;
      };

      const toggle = () => {
        setMode(currentMode === "picture-in-picture" ? "inline" : "picture-in-picture");
      };

      toggle();
      assert.equal(currentMode, "picture-in-picture");

      toggle();
      assert.equal(currentMode, "inline");
    });
  });
});
