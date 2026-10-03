import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getGuestWatchHistory,
  saveGuestWatchProgress,
  deleteGuestWatchHistoryItem,
  clearGuestWatchHistory,
  GUEST_HISTORY_KEY,
} from "@/lib/services/user.service";

// Mock minimal window and localStorage environment for Node runner
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
};

// Polyfill window & localStorage in Node testing environment
if (typeof globalThis.window === "undefined") {
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: mockLocalStorage,
  };
}
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockLocalStorage;
}

describe("User Service: Guest Watch History Operations", () => {
  beforeEach(() => {
    storage.clear();
  });

  test("getGuestWatchHistory returns empty array when no storage exists", () => {
    const history = getGuestWatchHistory();
    assert.deepEqual(history, []);
  });

  test("saveGuestWatchProgress records item and clamps progress ratio between 0 and 1", () => {
    // 1. Progress exceeding 1.0 is clamped to 1.0
    const list = saveGuestWatchProgress("alpha-drama", 2, 1.45);
    assert.equal(list.length, 1);
    assert.equal(list[0].title_slug, "alpha-drama");
    assert.equal(list[0].episode_number, 2);
    assert.equal(list[0].progress, 1.0);

    // 2. Negative progress is clamped to 0.0
    const list2 = saveGuestWatchProgress("beta-drama", 1, -0.2);
    assert.equal(list2.length, 2);
    const beta = list2.find((r) => r.title_slug === "beta-drama");
    assert.ok(beta);
    assert.equal(beta.progress, 0.0);
  });

  test("saveGuestWatchProgress updates existing drama progress rather than duplicating", () => {
    saveGuestWatchProgress("test-drama", 1, 0.5);
    const updated = saveGuestWatchProgress("test-drama", 2, 0.8);

    assert.equal(updated.length, 1);
    assert.equal(updated[0].episode_number, 2);
    assert.equal(updated[0].progress, 0.8);
  });

  test("deleteGuestWatchHistoryItem removes specific entry", () => {
    saveGuestWatchProgress("drama-1", 1, 0.5);
    saveGuestWatchProgress("drama-2", 3, 0.2);

    const remaining = deleteGuestWatchHistoryItem("drama-1");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].title_slug, "drama-2");
  });

  test("clearGuestWatchHistory wipes all entries", () => {
    saveGuestWatchProgress("drama-1", 1, 0.5);
    saveGuestWatchProgress("drama-2", 3, 0.2);

    clearGuestWatchHistory();
    const history = getGuestWatchHistory();
    assert.deepEqual(history, []);
  });
});
