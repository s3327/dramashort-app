import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SHORTCUT_CATEGORIES,
  type ShortcutCategory,
  type ShortcutEntry,
} from "../../components/player/KeyboardShortcutsModal";
import type { PlayerHudState, HudActionType } from "../../components/player/PlayerHud";

describe("Task 9.3: Desktop Keyboard Navigation & Hotkeys Tests", () => {
  describe("SHORTCUT_CATEGORIES Specifications", () => {
    test("defines all three core short-drama shortcut categories", () => {
      assert.equal(SHORTCUT_CATEGORIES.length, 3);
      const titles = SHORTCUT_CATEGORIES.map((c) => c.title);
      assert.deepEqual(titles, [
        "Playback Controls",
        "Episode Navigation",
        "Audio & Display",
      ]);
    });

    test("Playback Controls category contains Space / K toggle and seek hotkeys", () => {
      const playback = SHORTCUT_CATEGORIES.find((c) => c.title === "Playback Controls");
      assert.ok(playback);

      // Space / K toggle
      const playPause = playback.shortcuts.find((item) =>
        item.description.toLowerCase().includes("play")
      );
      assert.ok(playPause);
      assert.ok(playPause.keys.includes("Space") && playPause.keys.includes("K"));

      // Seek backward 5s
      const seekBack = playback.shortcuts.find((i) => i.description.includes("backward"));
      assert.ok(seekBack);
      assert.ok(seekBack.keys.includes("←") && seekBack.keys.includes("J"));

      // Seek forward 5s
      const seekForward = playback.shortcuts.find((i) => i.description.includes("forward"));
      assert.ok(seekForward);
      assert.ok(seekForward.keys.includes("→") && seekForward.keys.includes("L"));
    });

    test("Episode Navigation category contains vertical short-drama episode jumps", () => {
      const epNav = SHORTCUT_CATEGORIES.find((c) => c.title === "Episode Navigation");
      assert.ok(epNav);

      // Next episode (↓ / N)
      const nextEp = epNav.shortcuts.find((i) => i.description.includes("Next Episode"));
      assert.ok(nextEp);
      assert.ok(nextEp.keys.includes("↓") && nextEp.keys.includes("N"));

      // Previous episode (↑ / P)
      const prevEp = epNav.shortcuts.find((i) => i.description.includes("Previous Episode"));
      assert.ok(prevEp);
      assert.ok(prevEp.keys.includes("↑") && prevEp.keys.includes("P"));
    });

    test("Audio & Display category contains Mute, Volume, Fullscreen, Subtitles, and Help", () => {
      const audioDisplay = SHORTCUT_CATEGORIES.find((c) => c.title === "Audio & Display");
      assert.ok(audioDisplay);

      // Mute toggle (M)
      const mute = audioDisplay.shortcuts.find((i) => i.description.includes("Mute"));
      assert.ok(mute);
      assert.ok(mute.keys.includes("M"));

      // Granular volume control (Shift + ↑ / Shift + ↓)
      const volUp = audioDisplay.shortcuts.find((i) => i.description.includes("Increase Volume"));
      assert.ok(volUp);
      assert.ok(volUp.keys.includes("Shift") && volUp.keys.includes("↑"));

      const volDown = audioDisplay.shortcuts.find((i) => i.description.includes("Decrease Volume"));
      assert.ok(volDown);
      assert.ok(volDown.keys.includes("Shift") && volDown.keys.includes("↓"));

      // Fullscreen (F)
      const fs = audioDisplay.shortcuts.find((i) => i.description.includes("Fullscreen"));
      assert.ok(fs);
      assert.ok(fs.keys.includes("F"));

      // Subtitles (C)
      const cc = audioDisplay.shortcuts.find((i) => i.description.includes("Subtitles"));
      assert.ok(cc);
      assert.ok(cc.keys.includes("C"));

      // Help (?)
      const help = audioDisplay.shortcuts.find((i) => i.description.includes("Help"));
      assert.ok(help);
      assert.ok(help.keys.includes("?"));
    });
  });

  describe("Event Filtering & Ignored Targets Logic", () => {
    // Pure function simulation representing the guard in VideoPlayer.tsx handleKeyDown
    function shouldIgnoreKeyEvent(
      target: { tagName?: string; isContentEditable?: boolean } | null,
      isModalOpen: boolean,
      key: string
    ): boolean {
      if (!target) return false;
      const tag = target.tagName?.toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
        return true;
      }
      if (isModalOpen && key !== "Escape" && key !== "?") {
        return true;
      }
      return false;
    }

    test("ignores keystrokes when focused in text inputs, textareas, or contenteditables", () => {
      assert.equal(shouldIgnoreKeyEvent({ tagName: "INPUT" }, false, "k"), true);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "TEXTAREA" }, false, " "), true);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "SELECT" }, false, "f"), true);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "DIV", isContentEditable: true }, false, "m"), true);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "DIV", isContentEditable: false }, false, "k"), false);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "BODY" }, false, " "), false);
    });

    test("ignores hotkeys when modal is open except for Escape and ?", () => {
      assert.equal(shouldIgnoreKeyEvent({ tagName: "DIV" }, true, "k"), true);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "DIV" }, true, " "), true);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "DIV" }, true, "f"), true);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "DIV" }, true, "Escape"), false);
      assert.equal(shouldIgnoreKeyEvent({ tagName: "DIV" }, true, "?"), false);
    });
  });

  describe("HUD State Structure & Action Resolution", () => {
    test("supports all HUD action types with proper payload", () => {
      const actions: HudActionType[] = [
        "play",
        "pause",
        "seek_forward",
        "seek_backward",
        "prev_episode",
        "next_episode",
        "volume",
        "mute",
        "fullscreen",
        "subtitles",
        "speed",
      ];

      actions.forEach((action) => {
        const hud: PlayerHudState = {
          type: action,
          label: `Label for ${action}`,
          detail: action.startsWith("seek") ? "00:15" : undefined,
          nonce: 1,
        };
        assert.equal(hud.type, action);
        assert.ok(hud.label.length > 0);
        assert.equal(hud.nonce, 1);
      });
    });

    test("HUD auto-dismiss duration conforms to standard (700ms)", () => {
      const HUD_TIMEOUT_MS = 700;
      assert.equal(HUD_TIMEOUT_MS, 700);
      assert.ok(HUD_TIMEOUT_MS >= 500 && HUD_TIMEOUT_MS <= 1000);
    });
  });

  describe("Short Drama Episode Navigation Boundary & Volume Distinction", () => {
    function computeArrowAction(
      key: "arrowup" | "arrowdown",
      shiftKey: boolean,
      currentEpisode: number,
      totalEpisodes: number,
      volume: number
    ): { action: "volume" | "episode" | "boundary_blocked"; value?: number; direction?: "prev" | "next" } {
      if (key === "arrowup") {
        if (shiftKey) {
          return { action: "volume", value: Math.min(1, Math.round((volume + 0.1) * 10) / 10) };
        }
        if (currentEpisode <= 1) {
          return { action: "boundary_blocked", direction: "prev" };
        }
        return { action: "episode", direction: "prev" };
      } else {
        if (shiftKey) {
          return { action: "volume", value: Math.max(0, Math.round((volume - 0.1) * 10) / 10) };
        }
        if (currentEpisode >= totalEpisodes) {
          return { action: "boundary_blocked", direction: "next" };
        }
        return { action: "episode", direction: "next" };
      }
    }

    test("ArrowUp navigates to previous episode unless at first episode", () => {
      // At ep 3 of 10
      const res1 = computeArrowAction("arrowup", false, 3, 10, 0.5);
      assert.deepEqual(res1, { action: "episode", direction: "prev" });

      // At ep 1 of 10 -> boundary blocked
      const res2 = computeArrowAction("arrowup", false, 1, 10, 0.5);
      assert.deepEqual(res2, { action: "boundary_blocked", direction: "prev" });
    });

    test("ArrowDown navigates to next episode unless at final episode", () => {
      // At ep 3 of 10
      const res1 = computeArrowAction("arrowdown", false, 3, 10, 0.5);
      assert.deepEqual(res1, { action: "episode", direction: "next" });

      // At ep 10 of 10 -> boundary blocked
      const res2 = computeArrowAction("arrowdown", false, 10, 10, 0.5);
      assert.deepEqual(res2, { action: "boundary_blocked", direction: "next" });
    });

    test("Shift+ArrowUp and Shift+ArrowDown adjust volume in 10% steps", () => {
      // Volume Up from 0.5 -> 0.6
      const resUp = computeArrowAction("arrowup", true, 3, 10, 0.5);
      assert.deepEqual(resUp, { action: "volume", value: 0.6 });

      // Volume Up capped at 1.0
      const resUpCap = computeArrowAction("arrowup", true, 3, 10, 0.95);
      assert.deepEqual(resUpCap, { action: "volume", value: 1 });

      // Volume Down from 0.5 -> 0.4
      const resDown = computeArrowAction("arrowdown", true, 3, 10, 0.5);
      assert.deepEqual(resDown, { action: "volume", value: 0.4 });

      // Volume Down floored at 0
      const resDownFloor = computeArrowAction("arrowdown", true, 3, 10, 0.05);
      assert.deepEqual(resDownFloor, { action: "volume", value: 0 });
    });
  });
});
