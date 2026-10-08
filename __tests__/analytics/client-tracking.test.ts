import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  trackEvent,
  flushEvents,
  getAnonId,
  getSessionId,
  getUtmParameters,
  getPlatform,
  hasAnalyticsConsent,
  setAnalyticsConsent,
  trackPlaybackStart,
  trackPlaybackProgress,
  trackPlaybackComplete,
  trackPlaybackSkip,
  trackShare,
  trackFavorite,
  trackGuestPrompt,
  _resetTrackingForTesting,
  _getEventQueue,
} from "@/lib/analytics/track";

describe("Task 15.2: Client Tracking Module (`lib/analytics/track.ts`)", () => {
  // Mock browser globals
  let originalWindow: typeof globalThis.window;
  let originalDocument: typeof globalThis.document;
  let originalNavigator: typeof globalThis.navigator;
  let originalFetch: typeof globalThis.fetch;
  let originalEnv: string | undefined;

  let mockStorage: Record<string, string> = {};
  let mockSessionStorage: Record<string, string> = {};
  let mockCookies: string = "";
  let fetchCalls: Array<{ url: string; options: RequestInit }> = [];
  let beaconCalls: Array<{ url: string; data: string | Blob }> = [];

  beforeEach(() => {
    _resetTrackingForTesting();
    mockStorage = {};
    mockSessionStorage = {};
    mockCookies = "";
    fetchCalls = [];
    beaconCalls = [];
    originalEnv = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS;
    delete process.env.NEXT_PUBLIC_ENABLE_ANALYTICS;

    // Setup global window / document mocks
    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    const mockSessionStore = {
      getItem: (key: string) => mockSessionStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockSessionStorage[key] = String(val);
      },
      removeItem: (key: string) => {
        delete mockSessionStorage[key];
      },
      clear: () => {
        mockSessionStorage = {};
      },
    };

    const listeners: Record<string, Array<() => void>> = {};

    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: mockLocalStorage,
        sessionStorage: mockSessionStore,
        location: {
          search: "?utm_source=twitter&utm_medium=cpc&utm_campaign=launch2026",
        },
        matchMedia: () => ({ matches: false }),
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        removeEventListener: () => {},
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "document", {
      value: {
        get cookie() {
          return mockCookies;
        },
        set cookie(val: string) {
          const parts = val.split(";")[0].trim();
          const [cookieName, ...cookieValParts] = parts.split("=");
          const cookieVal = cookieValParts.join("=");
          const existing = mockCookies ? mockCookies.split("; ").filter((c) => !c.startsWith(`${cookieName}=`)) : [];
          existing.push(`${cookieName}=${cookieVal}`);
          mockCookies = existing.join("; ");
        },
        visibilityState: "visible",
        addEventListener: (event: string, cb: () => void) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        removeEventListener: () => {},
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "navigator", {
      value: {
        sendBeacon: (url: string, data: string | Blob) => {
          beaconCalls.push({ url, data });
          return true;
        },
      },
      configurable: true,
      writable: true,
    });

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), options: init || {} });
      return new Response(JSON.stringify({ ok: true, accepted: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
  });

  afterEach(() => {
    _resetTrackingForTesting();
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_ENABLE_ANALYTICS;
    }
  });

  describe("Anonymous Device Identification (Cookie & Storage)", () => {
    it("generates a valid UUID and sets dramashort_anon_id cookie when not present", () => {
      const id = getAnonId();
      assert.ok(id, "Must return an anon ID");
      assert.match(
        id,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "Must be a valid UUID v4"
      );
      assert.ok(
        mockCookies.includes(`dramashort_anon_id=${id}`),
        "Must write to document.cookie"
      );
    });

    it("reuses existing anon_id from cookie if already set", () => {
      const existingUuid = "11111111-2222-4333-8444-555555555555";
      document.cookie = `dramashort_anon_id=${existingUuid}`;
      _resetTrackingForTesting();

      const resolved = getAnonId();
      assert.equal(resolved, existingUuid);
    });
  });

  describe("Watch Session Identification", () => {
    it("generates and persists session ID in sessionStorage", () => {
      const sessionId = getSessionId();
      assert.ok(sessionId, "Must return session ID");
      assert.match(
        sessionId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      assert.equal(mockSessionStorage["dramashort_session_id"], sessionId);

      // Subsequent call reuses session ID
      const secondCall = getSessionId();
      assert.equal(secondCall, sessionId);
    });
  });

  describe("UTM Attribution & Campaign Capture", () => {
    it("extracts UTM parameters from URL search query and stores in sessionStorage", () => {
      const utm = getUtmParameters();
      assert.equal(utm.source, "twitter");
      assert.equal(utm.medium, "cpc");
      assert.equal(utm.campaign, "launch2026");
      assert.ok(mockSessionStorage["dramashort_utm"]);
    });

    it("extracts Telegram start parameter if present without standard UTM", () => {
      _resetTrackingForTesting();
      window.location.search = "?tgWebAppStartParam=tg_channel_promo";
      mockSessionStorage = {};

      const utm = getUtmParameters();
      assert.equal(utm.source, "telegram");
      assert.equal(utm.campaign, "tg_channel_promo");
    });
  });

  describe("Platform Detection", () => {
    it("detects standard 'web' platform by default", () => {
      assert.equal(getPlatform(), "web");
    });

    it("detects 'pwa' when display-mode is standalone", () => {
      window.matchMedia = (query: string) =>
        ({
          matches: query.includes("display-mode: standalone"),
        } as MediaQueryList);
      assert.equal(getPlatform(), "pwa");
    });

    it("detects 'tma' when Telegram WebApp object is present", () => {
      (window as unknown as { Telegram?: unknown }).Telegram = {
        WebApp: { initData: "user_query_123" },
      };
      assert.equal(getPlatform(), "tma");
      delete (window as unknown as { Telegram?: unknown }).Telegram;
    });
  });

  describe("Consent & Privacy Controls", () => {
    it("reports consent true by default", () => {
      assert.equal(hasAnalyticsConsent(), true);
    });

    it("respects explicit consent decline via setAnalyticsConsent(false)", () => {
      setAnalyticsConsent(false);
      assert.equal(hasAnalyticsConsent(), false);
      assert.equal(mockStorage["dramashort_analytics_consent"], "false");
      assert.ok(mockCookies.includes("dramashort_consent=declined"));

      // Tracking should be a strict no-op
      trackPlaybackStart({ titleSlug: "secret-drama", episodeNumber: 1 });
      assert.equal(_getEventQueue().length, 0, "No events should be queued when consent declined");
    });

    it("respects NEXT_PUBLIC_ENABLE_ANALYTICS=false environment kill-switch", () => {
      process.env.NEXT_PUBLIC_ENABLE_ANALYTICS = "false";
      assert.equal(hasAnalyticsConsent(), false);

      trackPlaybackStart({ titleSlug: "secret-drama", episodeNumber: 1 });
      assert.equal(_getEventQueue().length, 0);
    });

    it("clears queued events immediately upon consent revocation", () => {
      trackPlaybackStart({ titleSlug: "drama-1", episodeNumber: 1 });
      assert.equal(_getEventQueue().length, 1);

      setAnalyticsConsent(false);
      assert.equal(_getEventQueue().length, 0, "Queue must be purged upon consent revocation");
    });
  });

  describe("Event Queuing & Periodic Flush", () => {
    it("queues playback events with complete metadata", () => {
      trackPlaybackStart({ titleSlug: "ceo-revenge", episodeNumber: 1, durationSeconds: 120 });
      const queue = _getEventQueue();
      assert.equal(queue.length, 1);

      const event = queue[0];
      assert.equal(event.titleSlug, "ceo-revenge");
      assert.equal(event.episodeNumber, 1);
      assert.equal(event.eventType, "episode_start");
      assert.equal(event.positionSeconds, 0);
      assert.equal(event.durationSeconds, 120);
      assert.ok(event.anonId);
      assert.ok(event.sessionId);
      assert.ok(event.occurredAt);
      assert.equal(event.utm?.source, "twitter");
    });

    it("flushes queued events to /api/events via POST fetch", async () => {
      trackPlaybackStart({ titleSlug: "ceo-revenge", episodeNumber: 1 });
      trackPlaybackProgress({
        titleSlug: "ceo-revenge",
        episodeNumber: 1,
        milestone: 25,
        positionSeconds: 30,
        durationSeconds: 120,
      });

      assert.equal(_getEventQueue().length, 2);

      const flushedCount = await flushEvents();
      assert.equal(flushedCount, 2);
      assert.equal(_getEventQueue().length, 0, "Queue must be empty after flush");

      assert.equal(fetchCalls.length, 1);
      assert.equal(fetchCalls[0].url, "/api/events");
      assert.equal(fetchCalls[0].options.method, "POST");

      const body = JSON.parse(fetchCalls[0].options.body as string);
      assert.equal(body.events.length, 2);
      assert.equal(body.events[0].eventType, "episode_start");
      assert.equal(body.events[1].eventType, "episode_progress_25");
    });

    it("uses navigator.sendBeacon during sync flush (visibility change / exit)", async () => {
      trackPlaybackComplete({ titleSlug: "ceo-revenge", episodeNumber: 1, durationSeconds: 120 });

      const flushedCount = await flushEvents({ sync: true });
      assert.equal(flushedCount, 1);
      assert.equal(_getEventQueue().length, 0);

      assert.equal(beaconCalls.length, 1);
      assert.equal(beaconCalls[0].url, "/api/events");
    });

    it("restores failed batch to the front of queue on network failure", async () => {
      trackPlaybackStart({ titleSlug: "ceo-revenge", episodeNumber: 1 });

      // Mock network failure
      globalThis.fetch = async () => {
        throw new Error("Network offline");
      };

      const flushed = await flushEvents();
      assert.equal(flushed, 0);
      assert.equal(_getEventQueue().length, 1, "Failed event must be restored to queue");
    });
  });

  describe("Semantic Action Helpers", () => {
    it("tracks share and favorite actions", () => {
      trackShare({
        titleSlug: "ceo-revenge",
        episodeNumber: 3,
        shareMethod: "native",
      });
      trackFavorite({ titleSlug: "ceo-revenge", episodeNumber: 3 });

      const queue = _getEventQueue();
      assert.equal(queue.length, 2);
      assert.equal(queue[0].eventType, "share");
      assert.equal(queue[0].payload?.method, "native");
      assert.equal(queue[1].eventType, "favorite_add");
    });

    it("tracks episode skip and guest prompt interactions", () => {
      trackPlaybackSkip({
        titleSlug: "ceo-revenge",
        episodeNumber: 1,
        positionSeconds: 45,
        durationSeconds: 120,
      });

      trackGuestPrompt({
        action: "shown",
        trigger: "episode_3",
        titleSlug: "ceo-revenge",
        episodeNumber: 3,
      });

      const queue = _getEventQueue();
      assert.equal(queue.length, 2);
      assert.equal(queue[0].eventType, "episode_skip");
      assert.equal(queue[0].positionSeconds, 45);
      assert.equal(queue[1].eventType, "guest_prompt_shown");
      assert.equal(queue[1].payload?.trigger, "episode_3");
    });
  });

  describe("Queue Limits & Batch Slicing", () => {
    it("slices flush batches to a maximum of 50 events per request", async () => {
      // Enqueue 65 events
      for (let i = 1; i <= 65; i++) {
        trackEvent({
          titleSlug: "epic-drama",
          episodeNumber: i,
          eventType: "episode_start",
        });
      }

      assert.equal(_getEventQueue().length, 65);

      // Flush should send exactly 50 events and leave 15 in the queue
      const flushedCount = await flushEvents();
      assert.equal(flushedCount, 50);
      assert.equal(_getEventQueue().length, 15);

      assert.equal(fetchCalls.length, 1);
      const reqBody = JSON.parse(fetchCalls[0].options.body as string);
      assert.equal(reqBody.events.length, 50);

      // Subsequent flush sends remaining 15
      const secondFlushCount = await flushEvents();
      assert.equal(secondFlushCount, 15);
      assert.equal(_getEventQueue().length, 0);
    });

    it("respects maximum queue buffer cap (150 items) to prevent memory leaks", () => {
      for (let i = 1; i <= 200; i++) {
        trackEvent({
          titleSlug: "huge-binge",
          episodeNumber: i,
          eventType: "episode_start",
        });
      }

      assert.equal(_getEventQueue().length, 150, "Queue must not exceed 150 items");
    });
  });

  describe("Player Hook Integration Contracts", () => {
    it("verifies useProgressReporter exports tracking support", async () => {
      const reporterModule = await import("@/components/player/useProgressReporter");
      assert.ok(reporterModule.useProgressReporter, "Must export useProgressReporter");
      assert.equal(typeof reporterModule.useProgressReporter, "function");
    });
  });
});

