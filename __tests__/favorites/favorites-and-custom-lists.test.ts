import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  addUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  getUserFavorites,
  createCustomList,
  getUserCustomLists,
  addItemsToCustomList,
  addItemToCustomList,
  renameCustomList,
  deleteCustomList,
  removeItemFromCustomList,
  syncGuestWatchHistory,
  saveGuestWatchProgress,
  getGuestWatchHistory,
  GUEST_HISTORY_KEY,
} from "@/lib/services/user.service";
import { setTestUserClient } from "@/lib/supabase/user-client";

// In-memory mock database tables for testing user.service.ts
let favoritesDb: Array<{ user_id: string; title_slug: string }> = [];
let customListsDb: Array<{ id: string; user_id: string; title: string }> = [];
let customListItemsDb: Array<{ list_id: string; title_slug: string }> = [];
let watchHistoryDb: Array<{
  user_id: string;
  title_slug: string;
  episode_number: number;
  progress: number;
  position_seconds: number;
  duration_seconds: number;
}> = [];

// localStorage polyfill for Node runner
const localStore = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => localStore.get(key) ?? null,
  setItem: (key: string, value: string) => localStore.set(key, String(value)),
  removeItem: (key: string) => localStore.delete(key),
  clear: () => localStore.clear(),
};

if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = { localStorage: mockLocalStorage };
}
if (typeof globalThis.localStorage === "undefined") {
  (globalThis as any).localStorage = mockLocalStorage;
}

function createMockSupabaseUserClient(options?: { shouldFailQuery?: boolean }) {
  return {
    from: (table: string) => {
      if (options?.shouldFailQuery) {
        return {
          select: () => ({
            eq: () => ({ order: async () => ({ data: null, error: new Error("DB Error") }) }),
          }),
          insert: () => ({
            select: () => ({
              single: async () => ({ data: null, error: new Error("DB Error") }),
            }),
          }),
          upsert: async () => ({ data: null, error: new Error("DB Error") }),
          update: () => ({
            eq: async () => ({ data: null, error: new Error("DB Error") }),
          }),
          delete: () => ({
            eq: () => ({
              eq: async () => ({ data: null, error: new Error("DB Error") }),
            }),
          }),
        };
      }

      switch (table) {
        case "favorites":
          return {
            select: (_cols?: string) => ({
              eq: (_field: string, userId: string) => ({
                order: async () => ({
                  data: favoritesDb.filter((f) => f.user_id === userId),
                  error: null,
                }),
              }),
            }),
            upsert: async (rows: any) => {
              const rowArray = Array.isArray(rows) ? rows : [rows];
              for (const r of rowArray) {
                if (!favoritesDb.some((f) => f.user_id === r.user_id && f.title_slug === r.title_slug)) {
                  favoritesDb.push({ user_id: r.user_id, title_slug: r.title_slug });
                }
              }
              return { data: rowArray, error: null };
            },
            delete: () => ({
              eq: (_f1: string, userId: string) => ({
                eq: async (_f2: string, slug: string) => {
                  favoritesDb = favoritesDb.filter(
                    (f) => !(f.user_id === userId && f.title_slug === slug)
                  );
                  return { data: null, error: null };
                },
              }),
            }),
          };

        case "custom_lists":
          return {
            select: (_cols?: string) => ({
              eq: (_field: string, userId: string) => ({
                order: async () => ({
                  data: customListsDb.filter((l) => l.user_id === userId),
                  error: null,
                }),
              }),
            }),
            insert: (payload: any) => ({
              select: () => ({
                single: async () => {
                  const id = `uuid-list-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                  const created = { id, user_id: payload.user_id, title: payload.title };
                  customListsDb.push(created);
                  return { data: created, error: null };
                },
              }),
            }),
            update: (payload: any) => ({
              eq: async (_field: string, listId: string) => {
                const target = customListsDb.find((l) => l.id === listId);
                if (target && payload.title) {
                  target.title = payload.title;
                }
                return { data: target, error: null };
              },
            }),
            delete: () => ({
              eq: async (_field: string, listId: string) => {
                customListsDb = customListsDb.filter((l) => l.id !== listId);
                return { data: null, error: null };
              },
            }),
          };

        case "custom_list_items":
          return {
            select: (_cols?: string) => ({
              in: async (_field: string, listIds: string[]) => ({
                data: customListItemsDb.filter((it) => listIds.includes(it.list_id)),
                error: null,
              }),
            }),
            upsert: async (rows: any) => {
              const rowArray = Array.isArray(rows) ? rows : [rows];
              for (const r of rowArray) {
                if (!customListItemsDb.some((it) => it.list_id === r.list_id && it.title_slug === r.title_slug)) {
                  customListItemsDb.push({ list_id: r.list_id, title_slug: r.title_slug });
                }
              }
              return { data: rowArray, error: null };
            },
            delete: () => ({
              eq: (_f1: string, listId: string) => {
                const queryObj: any = {
                  eq: async (_f2: string, slug: string) => {
                    customListItemsDb = customListItemsDb.filter(
                      (it) => !(it.list_id === listId && it.title_slug === slug)
                    );
                    return { data: null, error: null };
                  },
                };
                // Can also be awaited directly when deleting all items for a list
                queryObj.then = (resolve: any) => {
                  customListItemsDb = customListItemsDb.filter((it) => it.list_id !== listId);
                  resolve({ data: null, error: null });
                };
                return queryObj;
              },
            }),
          };

        case "watch_history":
          return {
            upsert: async (rows: any) => {
              const rowArray = Array.isArray(rows) ? rows : [rows];
              for (const r of rowArray) {
                const idx = watchHistoryDb.findIndex(
                  (w) => w.user_id === r.user_id && w.title_slug === r.title_slug
                );
                if (idx >= 0) {
                  watchHistoryDb[idx] = r;
                } else {
                  watchHistoryDb.push(r);
                }
              }
              return { data: rowArray, error: null };
            },
          };

        default:
          return {};
      }
    },
  };
}

describe("Favorites & Custom Lists Consistency (Task 12.6)", () => {
  beforeEach(() => {
    favoritesDb = [];
    customListsDb = [];
    customListItemsDb = [];
    watchHistoryDb = [];
    localStore.clear();
    setTestUserClient(createMockSupabaseUserClient());
  });

  afterEach(() => {
    setTestUserClient(null);
  });

  describe("Custom Lists CRUD Operations (user.service.ts)", () => {
    it("createCustomList creates list and returns the real database ID", async () => {
      const dbId = await createCustomList("user-123", "Romance Weekend");
      assert.ok(dbId);
      assert.ok(dbId.startsWith("uuid-list-"));
      assert.equal(customListsDb.length, 1);
      assert.equal(customListsDb[0].title, "Romance Weekend");
    });

    it("addItemsToCustomList performs bulk insertion of items", async () => {
      const dbId = await createCustomList("user-123", "Binge List");
      assert.ok(dbId);

      const success = await addItemsToCustomList(dbId, ["drama-1", "drama-2", "drama-3"]);
      assert.equal(success, true);
      assert.equal(customListItemsDb.length, 3);
      assert.equal(customListItemsDb.filter((it) => it.list_id === dbId).length, 3);
    });

    it("getUserCustomLists loads lists with their associated drama slugs", async () => {
      const dbId = await createCustomList("user-123", "Favorites 2026");
      await addItemToCustomList(dbId!, "ceo-drama");
      await addItemToCustomList(dbId!, "billionaire-drama");

      const lists = await getUserCustomLists("user-123");
      assert.equal(lists.length, 1);
      assert.equal(lists[0].title, "Favorites 2026");
      assert.deepEqual(lists[0].itemSlugs, ["ceo-drama", "billionaire-drama"]);
    });

    it("renameCustomList updates the title in the database", async () => {
      const dbId = await createCustomList("user-123", "Old Title");
      assert.ok(dbId);

      const renamed = await renameCustomList(dbId, "New Updated Title");
      assert.equal(renamed, true);
      assert.equal(customListsDb.find((l) => l.id === dbId)?.title, "New Updated Title");
    });

    it("removeItemFromCustomList removes a single item from the list", async () => {
      const dbId = await createCustomList("user-123", "My List");
      await addItemsToCustomList(dbId!, ["drama-a", "drama-b"]);

      const removed = await removeItemFromCustomList(dbId!, "drama-a");
      assert.equal(removed, true);
      assert.equal(customListItemsDb.some((it) => it.title_slug === "drama-a"), false);
      assert.equal(customListItemsDb.some((it) => it.title_slug === "drama-b"), true);
    });

    it("deleteCustomList deletes both list items and the list row", async () => {
      const dbId = await createCustomList("user-123", "To Delete");
      await addItemsToCustomList(dbId!, ["drama-x", "drama-y"]);

      const deleted = await deleteCustomList(dbId!);
      assert.equal(deleted, true);
      assert.equal(customListsDb.some((l) => l.id === dbId), false);
      assert.equal(customListItemsDb.some((it) => it.list_id === dbId), false);
    });
  });

  describe("Favorites Operations & Bulk Persistence", () => {
    it("addUserFavorites bulk upserts all specified slugs", async () => {
      const success = await addUserFavorites("user-456", [
        "slug-1",
        "slug-2",
        "slug-3",
      ]);
      assert.equal(success, true);
      assert.equal(favoritesDb.length, 3);

      const userFavs = await getUserFavorites("user-456");
      assert.deepEqual(userFavs, ["slug-1", "slug-2", "slug-3"]);
    });

    it("removeUserFavorite deletes a single favorite slug", async () => {
      await addUserFavorites("user-456", ["keep-me", "delete-me"]);
      assert.equal(favoritesDb.length, 2);

      const removed = await removeUserFavorite("user-456", "delete-me");
      assert.equal(removed, true);
      const remaining = await getUserFavorites("user-456");
      assert.deepEqual(remaining, ["keep-me"]);
    });

    it("returns false gracefully when database query fails", async () => {
      setTestUserClient(createMockSupabaseUserClient({ shouldFailQuery: true }));
      const addOk = await addUserFavorite("user-456", "fail-slug");
      assert.equal(addOk, false);

      const removeOk = await removeUserFavorite("user-456", "fail-slug");
      assert.equal(removeOk, false);
    });
  });

  describe("Single Guest Watch-History Sync via Bulk Upsert", () => {
    it("syncGuestWatchHistory flushes all guest items in one bulk query and clears guest storage", async () => {
      saveGuestWatchProgress("drama-one", 1, 0.4, 40, 100);
      saveGuestWatchProgress("drama-two", 5, 0.9, 90, 100);

      const guestItems = getGuestWatchHistory();
      assert.equal(guestItems.length, 2);

      await syncGuestWatchHistory("user-synced-1");

      // Database now has both items
      assert.equal(watchHistoryDb.length, 2);
      assert.equal(watchHistoryDb.find((w) => w.title_slug === "drama-one")?.progress, 0.4);
      assert.equal(watchHistoryDb.find((w) => w.title_slug === "drama-two")?.episode_number, 5);

      // Guest storage is now wiped
      assert.equal(getGuestWatchHistory().length, 0);
    });
  });

  describe("Static Architectural & Code Invariants", () => {
    it("FavoritesContext.tsx exports async createList and new management methods", () => {
      const ctxFile = path.resolve(process.cwd(), "contexts/FavoritesContext.tsx");
      const content = fs.readFileSync(ctxFile, "utf-8");

      assert.ok(
        content.includes("createList: (title: string) => Promise<string | null>"),
        "createList must return Promise<string | null>"
      );
      assert.ok(
        content.includes("renameList: (listId: string, newTitle: string) => Promise<boolean>"),
        "FavoritesContext must export renameList"
      );
      assert.ok(
        content.includes("deleteList: (listId: string) => Promise<boolean>"),
        "FavoritesContext must export deleteList"
      );
      assert.ok(
        content.includes("removeFromList: (listId: string, slug: string) => Promise<boolean>"),
        "FavoritesContext must export removeFromList"
      );
      assert.ok(
        content.includes("toggleFavorite: (slug: string) => Promise<boolean>"),
        "toggleFavorite must return Promise<boolean> for rollback handling"
      );
    });

    it("AuthContext.tsx guards guest sync with ref and triggers only on SIGNED_IN", () => {
      const authFile = path.resolve(process.cwd(), "contexts/AuthContext.tsx");
      const content = fs.readFileSync(authFile, "utf-8");

      assert.ok(
        content.includes("hasSyncedGuestRef = useRef(false)"),
        "AuthContext must declare hasSyncedGuestRef"
      );
      assert.ok(
        content.includes('event === "SIGNED_IN" && !hasSyncedGuestRef.current'),
        "AuthContext must strictly trigger sync on SIGNED_IN"
      );
      assert.ok(
        !content.includes("getSession().then(({ data: { session } }) => {\n      setSession(session);\n      setUser(session?.user ?? null);\n      if (session?.user) {\n        fetchProfile(session.user.id);\n        syncGuestWatchHistory"),
        "getSession must not redundantly invoke syncGuestWatchHistory"
      );
    });

    it("app/watch/[slug]/page.tsx does not call syncGuestWatchHistory", () => {
      const watchPageFile = path.resolve(process.cwd(), "app/watch/[slug]/page.tsx");
      const content = fs.readFileSync(watchPageFile, "utf-8");

      assert.ok(
        !content.includes("syncGuestWatchHistory"),
        "Watch page must not duplicate guest sync calls"
      );
    });

    it("CreateListModal disables submit and displays loading state", () => {
      const modalFile = path.resolve(process.cwd(), "components/CreateListModal.tsx");
      const content = fs.readFileSync(modalFile, "utf-8");

      assert.ok(
        content.includes("isSubmitting"),
        "CreateListModal must track isSubmitting state"
      );
      assert.ok(
        content.includes("disabled={isSubmitting"),
        "CreateListModal must disable submit while in flight"
      );
    });

    it("app/account/favorite/page.tsx integrates rename, delete, and remove actions", () => {
      const favPageFile = path.resolve(process.cwd(), "app/account/favorite/page.tsx");
      const content = fs.readFileSync(favPageFile, "utf-8");

      assert.ok(
        content.includes("renameList"),
        "Favorite page must wire renameList"
      );
      assert.ok(
        content.includes("deleteList"),
        "Favorite page must wire deleteList"
      );
      assert.ok(
        content.includes("removeFromList"),
        "Favorite page must wire removeFromList"
      );
    });
  });
});
