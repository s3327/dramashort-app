import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isFullscreenSupported,
  getIsFullscreen,
  enterFullscreen,
  exitFullscreen,
  toggleFullscreen,
  addFullscreenChangeListener,
} from "@/lib/player/fullscreen-capabilities";

describe("Task 14.3: iOS & In-App Browser Fullscreen Support", () => {
  describe("R1: Fullscreen Capability Detection across Platforms", () => {
    it("detects fullscreen support when document.fullscreenEnabled is true", () => {
      // Setup mock DOM environment
      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {
          fullscreenEnabled: true,
        };
        const supported = isFullscreenSupported();
        assert.equal(supported, true);
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });

    it("detects fullscreen support for iOS Safari via video.webkitEnterFullscreen", () => {
      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {
          fullscreenEnabled: false,
        };
        const mockVideo = {
          webkitEnterFullscreen: () => {},
          webkitSupportsFullscreen: true,
        } as any;
        const supported = isFullscreenSupported(mockVideo, null);
        assert.equal(supported, true);
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });

    it("detects fullscreen support inside Telegram Mini App (window.Telegram.WebApp)", () => {
      const originalWindow = globalThis.window;
      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {
          fullscreenEnabled: false,
        };
        (globalThis as any).window = {
          Telegram: {
            WebApp: {
              expand: () => {},
            },
          },
        };
        const supported = isFullscreenSupported(null, null);
        assert.equal(supported, true);
      } finally {
        (globalThis as any).window = originalWindow;
        (globalThis as any).document = originalDoc;
      }
    });

    it("evaluates getIsFullscreen correctly across standard, iOS, and Telegram", () => {
      const originalDoc = globalThis.document;
      const originalWindow = globalThis.window;
      try {
        // Standard document fullscreen
        (globalThis as any).document = {
          fullscreenElement: {},
        };
        assert.equal(getIsFullscreen(), true);

        // Document not fullscreen, but iOS video displaying fullscreen
        (globalThis as any).document = {
          fullscreenElement: null,
        };
        const mockVideo = {
          webkitDisplayingFullscreen: true,
        } as any;
        assert.equal(getIsFullscreen(mockVideo), true);

        // Telegram WebApp isFullscreen
        (globalThis as any).window = {
          Telegram: {
            WebApp: {
              isFullscreen: true,
            },
          },
        };
        assert.equal(getIsFullscreen(null), true);
      } finally {
        (globalThis as any).document = originalDoc;
        (globalThis as any).window = originalWindow;
      }
    });
  });

  describe("R2: iOS Safari & WebKit Enter/Exit Fullscreen Flow", () => {
    it("calls video.webkitEnterFullscreen when container.requestFullscreen is unavailable or on iOS", async () => {
      let webkitCalled = false;
      const mockVideo = {
        webkitEnterFullscreen: () => {
          webkitCalled = true;
        },
      } as any;

      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {};
        const success = await enterFullscreen(null, mockVideo);
        assert.equal(success, true);
        assert.equal(webkitCalled, true);
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });

    it("falls back to video.webkitEnterFullscreen when container.requestFullscreen rejects (in-app browser webview)", async () => {
      let fallbackCalled = false;
      const mockContainer = {
        requestFullscreen: async () => {
          throw new Error("Permissions policy violation or NotAllowedError");
        },
      } as any;
      const mockVideo = {
        webkitEnterFullscreen: () => {
          fallbackCalled = true;
        },
      } as any;

      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {};
        const success = await enterFullscreen(mockContainer, mockVideo);
        assert.equal(success, true);
        assert.equal(fallbackCalled, true);
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });

    it("calls video.webkitExitFullscreen when exiting fullscreen on iOS Safari", async () => {
      let exitCalled = false;
      const mockVideo = {
        webkitExitFullscreen: () => {
          exitCalled = true;
        },
      } as any;

      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {
          fullscreenElement: null,
        };
        const success = await exitFullscreen(mockVideo);
        assert.equal(success, true);
        assert.equal(exitCalled, true);
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });
  });

  describe("R3: Telegram Mini App (TMA) Fullscreen Flow", () => {
    it("calls Telegram.WebApp.requestFullscreen when available", async () => {
      let requestFsCalled = false;
      const originalWindow = globalThis.window;
      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {};
        (globalThis as any).window = {
          Telegram: {
            WebApp: {
              requestFullscreen: () => {
                requestFsCalled = true;
              },
            },
          },
        };
        const success = await enterFullscreen();
        assert.equal(success, true);
        assert.equal(requestFsCalled, true);
      } finally {
        (globalThis as any).window = originalWindow;
        (globalThis as any).document = originalDoc;
      }
    });

    it("falls back to Telegram.WebApp.expand on older Telegram client versions", async () => {
      let expandCalled = false;
      const originalWindow = globalThis.window;
      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {};
        (globalThis as any).window = {
          Telegram: {
            WebApp: {
              expand: () => {
                expandCalled = true;
              },
            },
          },
        };
        const success = await enterFullscreen();
        assert.equal(success, true);
        assert.equal(expandCalled, true);
      } finally {
        (globalThis as any).window = originalWindow;
        (globalThis as any).document = originalDoc;
      }
    });

    it("calls Telegram.WebApp.exitFullscreen on exiting fullscreen in Telegram", async () => {
      let exitCalled = false;
      const originalWindow = globalThis.window;
      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {};
        (globalThis as any).window = {
          Telegram: {
            WebApp: {
              exitFullscreen: () => {
                exitCalled = true;
              },
            },
          },
        };
        const success = await exitFullscreen();
        assert.equal(success, true);
        assert.equal(exitCalled, true);
      } finally {
        (globalThis as any).window = originalWindow;
        (globalThis as any).document = originalDoc;
      }
    });
  });

  describe("R4: Event Listener Subscriptions & Lifecycle", () => {
    it("subscribes to iOS WebKit video events (webkitbeginfullscreen, webkitendfullscreen, webkitpresentationmodechanged)", () => {
      const listeners: Record<string, Function> = {};
      const mockVideo = {
        addEventListener: (event: string, handler: Function) => {
          listeners[event] = handler;
        },
        removeEventListener: (event: string) => {
          delete listeners[event];
        },
      } as any;

      const originalDoc = globalThis.document;
      try {
        (globalThis as any).document = {
          addEventListener: () => {},
          removeEventListener: () => {},
        };

        let fsState = false;
        const cleanup = addFullscreenChangeListener(mockVideo, (isFs) => {
          fsState = isFs;
        });

        assert.ok(listeners.webkitbeginfullscreen, "Must bind webkitbeginfullscreen");
        assert.ok(listeners.webkitendfullscreen, "Must bind webkitendfullscreen");
        assert.ok(listeners.webkitpresentationmodechanged, "Must bind webkitpresentationmodechanged");

        // Simulate native iOS entering fullscreen
        listeners.webkitbeginfullscreen();
        assert.equal(fsState, true);

        // Simulate native iOS exiting fullscreen
        listeners.webkitendfullscreen();
        assert.equal(fsState, false);

        cleanup();
        assert.equal(Object.keys(listeners).length, 0);
      } finally {
        (globalThis as any).document = originalDoc;
      }
    });
  });

  describe("R5: Component & Code Contracts", () => {
    it("verifies components/player/usePlayerControls.ts imports and wires cross-platform fullscreen", () => {
      const controlsHookPath = path.resolve(process.cwd(), "components/player/usePlayerControls.ts");
      const controlsCode = fs.readFileSync(controlsHookPath, "utf-8");

      assert.ok(
        controlsCode.includes("fullscreen-capabilities"),
        "Must import from fullscreen-capabilities"
      );
      assert.ok(
        controlsCode.includes("webkitEnterFullscreen"),
        "Must support webkitEnterFullscreen for iOS Safari"
      );
      assert.ok(
        controlsCode.includes("addFullscreenChangeListener"),
        "Must use addFullscreenChangeListener"
      );
      assert.ok(
        controlsCode.includes("isFullscreenSupported"),
        "Must expose isFullscreenSupported"
      );
    });

    it("verifies components/VideoPlayer.tsx wires cross-platform fullscreen adapter", () => {
      const playerPath = path.resolve(process.cwd(), "components/VideoPlayer.tsx");
      const playerCode = fs.readFileSync(playerPath, "utf-8");

      assert.ok(
        playerCode.includes("fullscreen-capabilities"),
        "VideoPlayer must import from fullscreen-capabilities"
      );
      assert.ok(
        playerCode.includes("webkitEnterFullscreen"),
        "VideoPlayer must support webkitEnterFullscreen"
      );
      assert.ok(
        playerCode.includes("addFullscreenChangeListener"),
        "VideoPlayer must register addFullscreenChangeListener"
      );
    });

    it("verifies components/player/WatchOverlay.tsx renders fullscreen button in top header bar", () => {
      const overlayPath = path.resolve(process.cwd(), "components/player/WatchOverlay.tsx");
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");

      assert.ok(
        overlayCode.includes("handleToggleFullscreen") || overlayCode.includes("onToggleFullscreen"),
        "WatchOverlay must wire fullscreen toggle handler"
      );
      assert.ok(
        overlayCode.includes("aria-label={isFullscreen ? \"Exit Fullscreen\" : \"Fullscreen\"}") ||
          overlayCode.includes("Fullscreen"),
        "WatchOverlay must have accessible fullscreen aria-label"
      );
      assert.ok(
        overlayCode.includes("<Maximize") && overlayCode.includes("<Minimize"),
        "WatchOverlay must render Maximize and Minimize icons"
      );
    });

    it("verifies components/watch/WatchPlayerIsland.tsx wires fullscreen state to WatchOverlay", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const islandCode = fs.readFileSync(islandPath, "utf-8");

      assert.ok(
        islandCode.includes("onToggleFullscreen={handleToggleFullscreen}"),
        "WatchPlayerIsland must pass onToggleFullscreen to WatchOverlay"
      );
      assert.ok(
        islandCode.includes("isFullscreen={isFullscreenState}"),
        "WatchPlayerIsland must pass isFullscreen to WatchOverlay"
      );
    });
  });
});
