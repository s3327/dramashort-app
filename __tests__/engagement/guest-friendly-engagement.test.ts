import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isGuestPromptDismissed,
  setGuestPromptDismissed,
  clearGuestPromptDismissed,
  trackGuestEngagementEvent,
  GUEST_PROMPT_FAV_DISMISSED_KEY,
  GUEST_PROMPT_EP3_DISMISSED_KEY,
  type GuestEngagementEventData,
} from "@/lib/analytics/guest-engagement";
import { readReturnUrl, returnUrlQuery } from "@/lib/navigation/safe-redirect";
import {
  saveGuestWatchProgress,
  getGuestWatchProgress,
  clearGuestWatchHistory,
} from "@/lib/client/user";

// Polyfill minimal window and localStorage environment for Node runner
const storage = new Map<string, string>();
const eventListeners: Record<string, ((e: any) => void)[]> = {};

const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = {
    localStorage: mockLocalStorage,
    dispatchEvent: (e: any) => {
      const listeners = eventListeners[e.type] || [];
      listeners.forEach((fn) => fn(e));
      return true;
    },
    addEventListener: (type: string, fn: any) => {
      eventListeners[type] = eventListeners[type] || [];
      eventListeners[type].push(fn);
    },
    removeEventListener: (type: string, fn: any) => {
      if (eventListeners[type]) {
        eventListeners[type] = eventListeners[type].filter((cb) => cb !== fn);
      }
    },
  };
} else if (!(globalThis as any).window.localStorage) {
  (globalThis as any).window.localStorage = mockLocalStorage;
}

if (typeof (globalThis as any).localStorage === "undefined") {
  (globalThis as any).localStorage = mockLocalStorage;
}

describe("Task 14.8: Guest-Friendly Engagement", () => {
  describe("R1: Unblocked Guest Actions & Static Contracts", () => {
    const actionsPath = path.resolve(
      process.cwd(),
      "components/islands/DramaInteractiveActions.tsx"
    );
    const actionsCode = fs.readFileSync(actionsPath, "utf-8");

    it("verifies DramaInteractiveActions allows guests to toggle favorites directly", () => {
      // Must not contain `if (!isLoggedIn) { setIsLoginRequiredOpen(true); return; }` blocking favorites
      assert.ok(
        !actionsCode.includes("if (!isLoggedIn) {\n      setIsLoginRequiredOpen(true);\n      return;\n    }\n    const wasFavorited = favorited;"),
        "Must not block guest favorites with login required modal"
      );
      assert.ok(
        actionsCode.includes("const ok = await toggleFavorite(slug);"),
        "Must directly toggle favorite via useFavorites"
      );
    });

    it("verifies DramaInteractiveActions allows guests to open Add to List directly", () => {
      assert.ok(
        !actionsCode.includes("handleOpenAddToList = () => {\n    if (!isLoggedIn)"),
        "Must not block Add to List for guests"
      );
      assert.ok(
        actionsCode.includes("setIsAddToListOpen(true)"),
        "Must open Add to List modal for guests"
      );
    });

    it("verifies DramaInteractiveActions preserves LoginRequiredModal for contract compatibility", () => {
      assert.ok(
        actionsCode.includes('import LoginRequiredModal from "@/components/LoginRequiredModal";'),
        "Must import LoginRequiredModal"
      );
      assert.ok(
        actionsCode.includes("<LoginRequiredModal"),
        "Must retain LoginRequiredModal component in JSX"
      );
    });

    it("verifies DramaInteractiveActions mounts GuestEngagementModal with favorite trigger", () => {
      assert.ok(
        actionsCode.includes('import GuestEngagementModal from "@/components/engagement/GuestEngagementModal";'),
        "Must import GuestEngagementModal"
      );
      assert.ok(
        actionsCode.includes('trigger="favorite"'),
        "Must pass trigger='favorite' to GuestEngagementModal"
      );
      assert.ok(
        actionsCode.includes("projectedCount >= 2"),
        "Must check 2nd favorite milestone"
      );
    });

    it("verifies WatchOverlay provides toast feedback on favorite toggle and supports milestone trigger", () => {
      const overlayPath = path.resolve(
        process.cwd(),
        "components/player/WatchOverlay.tsx"
      );
      const overlayCode = fs.readFileSync(overlayPath, "utf-8");

      assert.ok(
        overlayCode.includes("toggleFavorite(drama.slug)"),
        "Must invoke toggleFavorite on drama.slug"
      );
      assert.ok(
        overlayCode.includes("Saved to Favorites") ||
          overlayCode.includes("Removed from Favorites"),
        "Must provide toast feedback upon favorite toggling"
      );
      assert.ok(
        overlayCode.includes("onGuestPromptTrigger"),
        "Must support onGuestPromptTrigger prop"
      );
    });
  });

  describe("R2: Soft Engagement Prompt & Telemetry Helper", () => {
    beforeEach(() => {
      clearGuestPromptDismissed();
    });

    it("evaluates dismissal status and respects local storage keys", () => {
      assert.equal(
        isGuestPromptDismissed("favorite"),
        false,
        "Favorite prompt starts not dismissed"
      );
      assert.equal(
        isGuestPromptDismissed("episode_3"),
        false,
        "Episode 3 prompt starts not dismissed"
      );

      setGuestPromptDismissed("favorite");
      assert.equal(
        isGuestPromptDismissed("favorite"),
        true,
        "Favorite prompt is marked dismissed"
      );
      assert.equal(
        isGuestPromptDismissed("episode_3"),
        false,
        "Episode 3 prompt remains independent"
      );

      setGuestPromptDismissed("episode_3");
      assert.equal(
        isGuestPromptDismissed("episode_3"),
        true,
        "Episode 3 prompt is marked dismissed"
      );

      clearGuestPromptDismissed();
      assert.equal(isGuestPromptDismissed("favorite"), false);
      assert.equal(isGuestPromptDismissed("episode_3"), false);
    });

    it("verifies trackGuestEngagementEvent dispatches custom DOM event", () => {
      const events: GuestEngagementEventData[] = [];
      const listener = (e: Event) => {
        const ce = e as CustomEvent<GuestEngagementEventData>;
        events.push(ce.detail);
      };

      if (typeof window !== "undefined") {
        window.addEventListener("dramashort:guest-engagement", listener);
      }

      trackGuestEngagementEvent({
        action: "shown",
        trigger: "favorite",
        dramaSlug: "the-secret-heir",
      });

      trackGuestEngagementEvent({
        action: "cta_click",
        trigger: "episode_3",
        dramaSlug: "the-secret-heir",
        episodeNumber: 3,
      });

      if (typeof window !== "undefined") {
        window.removeEventListener("dramashort:guest-engagement", listener);
        assert.equal(events.length, 2);
        assert.equal(events[0].action, "shown");
        assert.equal(events[0].trigger, "favorite");
        assert.equal(events[1].action, "cta_click");
        assert.equal(events[1].trigger, "episode_3");
        assert.equal(events[1].episodeNumber, 3);
      }
    });

    it("verifies GuestEngagementModal component structure and CTAs", () => {
      const modalPath = path.resolve(
        process.cwd(),
        "components/engagement/GuestEngagementModal.tsx"
      );
      const modalCode = fs.readFileSync(modalPath, "utf-8");

      assert.ok(
        modalCode.includes("Create Free Account"),
        "Must offer primary 'Create Free Account' CTA"
      );
      assert.ok(
        modalCode.includes("Maybe Later"),
        "Must offer polite 'Maybe Later' dismiss button"
      );
      assert.ok(
        modalCode.includes("Log in") || modalCode.includes("Log In"),
        "Must offer secondary login link"
      );
      assert.ok(
        modalCode.includes("returnUrlQuery(returnUrl)"),
        "Must append safe returnUrlQuery to signup link"
      );
    });
  });

  describe("R3: Episode 3 Milestone & Auto-Advance Control in WatchPlayerIsland", () => {
    const islandPath = path.resolve(
      process.cwd(),
      "components/watch/WatchPlayerIsland.tsx"
    );
    const islandCode = fs.readFileSync(islandPath, "utf-8");

    it("verifies handleVideoEnded inspects Episode 3 completion for unauthenticated guest", () => {
      assert.ok(
        islandCode.includes("currentEpisode === 3"),
        "Must check for currentEpisode === 3 in video completion"
      );
      assert.ok(
        islandCode.includes('isGuestPromptDismissed("episode_3")'),
        "Must check dismissal state for episode_3"
      );
      assert.ok(
        islandCode.includes("setGuestPromptOpen(true)"),
        "Must open guest prompt when episode 3 finishes"
      );
    });

    it("verifies auto-advance pauses during prompt and resumes on dismissal", () => {
      assert.ok(
        islandCode.includes("handleCloseGuestPrompt"),
        "Must define handleCloseGuestPrompt"
      );
      assert.ok(
        islandCode.includes("handleSelectEpisode(currentEpisode + 1)"),
        "Must advance to next episode when prompt is closed"
      );
    });

    it("verifies WatchPlayerIsland mounts GuestEngagementModal with returnUrl preserving episode", () => {
      assert.ok(
        islandCode.includes("<GuestEngagementModal"),
        "Must render GuestEngagementModal in WatchPlayerIsland"
      );
      assert.ok(
        islandCode.includes("returnUrl={`/watch/${drama.slug}?ep=${currentEpisode}`}"),
        "Must configure returnUrl containing active episode"
      );
    });
  });

  describe("R4: Post-Signup Return Loop & Playback Position Restoration", () => {
    beforeEach(() => {
      clearGuestWatchHistory();
    });

    it("verifies returnUrlQuery preserves episode query string", () => {
      const targetUrl = "/watch/the-secret-heir?ep=3";
      const query = returnUrlQuery(targetUrl);

      assert.ok(
        query.includes("returnUrl="),
        "Must generate returnUrl query parameter"
      );
      assert.ok(
        decodeURIComponent(query).includes(targetUrl),
        "Must contain decoded target watch URL with episode query"
      );
    });

    it("verifies readReturnUrl parses watch destination with episode query param", () => {
      const dummyParams = {
        get: (key: string) => {
          if (key === "returnUrl") return "/watch/the-secret-heir?ep=3";
          return null;
        },
      };

      const resolved = readReturnUrl(dummyParams);
      assert.equal(
        resolved,
        "/watch/the-secret-heir?ep=3",
        "readReturnUrl must preserve episode query parameter"
      );
    });

    it("verifies guest watch history persists episode, position, and duration", () => {
      const slug = "test-guest-drama";
      saveGuestWatchProgress(slug, 3, 0.45, 45, 100);

      const saved = getGuestWatchProgress(slug);
      assert.ok(saved !== null, "Saved guest watch progress must exist");
      assert.equal(saved?.title_slug, slug);
      assert.equal(saved?.episode_number, 3);
      assert.equal(saved?.position_seconds, 45);
      assert.equal(saved?.duration_seconds, 100);
      assert.equal(saved?.progress, 0.45);
    });
  });
});
