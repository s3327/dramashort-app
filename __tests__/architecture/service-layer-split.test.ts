import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  ok,
  err,
  isOk,
  isErr,
  unwrap,
  unwrapOr,
  map,
  mapErr,
  fromPromise,
  toLegacyResult,
  fromLegacyResult,
  type Result,
} from "@/lib/common/result";
import type { Drama, Title, DramaStatus, TitleStatus } from "@/types/content";
import * as contentFacade from "@/lib/services/content.service";
import * as userFacade from "@/lib/services/user.service";
import * as clientUser from "@/lib/client/user";
import * as clientCatalog from "@/lib/client/catalog";
import * as serverCatalog from "@/lib/server/catalog";
import * as serverAdmin from "@/lib/server/admin";
import * as serverUser from "@/lib/server/user";
import * as serverPlayback from "@/lib/server/playback";
import { getDramaBySlugOrFallback, getTitleBySlugOrFallback } from "@/data/titles.mock";

describe("Task 13.4: Service Layer Split Architecture Tests", () => {
  describe("R1. Server-Only Enforcement (lib/server/)", () => {
    const serverDir = path.resolve(process.cwd(), "lib/server");
    const serverFiles = [
      "catalog.ts",
      "admin.ts",
      "playback.ts",
      "user.ts",
      "index.ts",
    ];

    test("all lib/server/*.ts modules declare import 'server-only'", () => {
      for (const file of serverFiles) {
        const filePath = path.join(serverDir, file);
        assert.ok(fs.existsSync(filePath), `lib/server/${file} must exist`);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(
          content.includes('import "server-only";') || content.includes("import 'server-only';"),
          `lib/server/${file} must strictly declare import "server-only"`
        );
      }
    });

    test("runtime verification: importing server-only throws in Client Component / non-RSC context", () => {
      assert.throws(
        () => {
          process.env.__CLIENT_COMPONENT__ = "true";
          try {
            delete require.cache[require.resolve("server-only")];
            require("server-only");
          } finally {
            delete process.env.__CLIENT_COMPONENT__;
            delete require.cache[require.resolve("server-only")];
          }
        },
        /This module cannot be imported from a Client Component/,
        "server-only package must throw when evaluated in client component environment"
      );
    });

    test("direct database admin mutations in lib/server/admin.ts do not call adminFetch", () => {
      const adminPath = path.join(serverDir, "admin.ts");
      const content = fs.readFileSync(adminPath, "utf-8");
      assert.ok(
        !content.includes("adminFetch"),
        "lib/server/admin.ts must not loop back through internal HTTP endpoints via adminFetch"
      );
      assert.ok(
        content.includes("getContentAdminClient()"),
        "lib/server/admin.ts must use getContentAdminClient() directly"
      );
      assert.ok(content.includes("export async function createDrama"), "admin.ts must export createDrama");
      assert.ok(content.includes("export async function updateDrama"), "admin.ts must export updateDrama");
      assert.ok(content.includes("export async function deleteDrama"), "admin.ts must export deleteDrama");
      assert.ok(content.includes("export async function getAdminDramaById"), "admin.ts must export getAdminDramaById");
      assert.ok(content.includes("export async function getAdminDramas"), "admin.ts must export getAdminDramas");
    });
  });

  describe("R2. Client-Only Service Layer Boundaries (lib/client/)", () => {
    const clientDir = path.resolve(process.cwd(), "lib/client");

    test("lib/client/user.ts and lib/client/catalog.ts exist", () => {
      assert.ok(fs.existsSync(path.join(clientDir, "user.ts")), "lib/client/user.ts must exist");
      assert.ok(fs.existsSync(path.join(clientDir, "catalog.ts")), "lib/client/catalog.ts must exist");
      assert.ok(fs.existsSync(path.join(clientDir, "index.ts")), "lib/client/index.ts must exist");
    });

    test("zero leakage: lib/client/* never imports from lib/server/*", () => {
      const clientFiles = fs.readdirSync(clientDir).filter((f) => f.endsWith(".ts"));
      for (const file of clientFiles) {
        const filePath = path.join(clientDir, file);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(
          !content.includes('from "@/lib/server') && !content.includes("from '@/lib/server"),
          `lib/client/${file} must have zero imports from lib/server`
        );
        assert.ok(
          !content.includes('import "server-only"') && !content.includes("import 'server-only'"),
          `lib/client/${file} must not import server-only`
        );
      }
    });

    test("zero leakage: no client components ('use client') import from lib/server/*", () => {
      const appDir = path.resolve(process.cwd(), "app");
      const componentsDir = path.resolve(process.cwd(), "components");

      function checkDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            checkDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))) {
            const content = fs.readFileSync(fullPath, "utf-8");
            const isClientComponent = content.includes('"use client"') || content.includes("'use client'");
            if (isClientComponent) {
              assert.ok(
                !content.includes('from "@/lib/server') && !content.includes("from '@/lib/server"),
                `Client component ${path.relative(process.cwd(), fullPath)} must not import from lib/server/*`
              );
            }
          }
        }
      }

      checkDir(appDir);
      checkDir(componentsDir);
    });

    test("lib/client/user.ts exports all client-side browser operations", () => {
      assert.equal(typeof clientUser.getUserProfile, "function");
      assert.equal(typeof clientUser.updateUserProfile, "function");
      assert.equal(typeof clientUser.getUserFavorites, "function");
      assert.equal(typeof clientUser.addUserFavorite, "function");
      assert.equal(typeof clientUser.addUserFavorites, "function");
      assert.equal(typeof clientUser.removeUserFavorite, "function");
      assert.equal(typeof clientUser.getUserCustomLists, "function");
      assert.equal(typeof clientUser.createCustomList, "function");
      assert.equal(typeof clientUser.addItemToCustomList, "function");
      assert.equal(typeof clientUser.addItemsToCustomList, "function");
      assert.equal(typeof clientUser.renameCustomList, "function");
      assert.equal(typeof clientUser.deleteCustomList, "function");
      assert.equal(typeof clientUser.removeItemFromCustomList, "function");
      assert.equal(typeof clientUser.getUserWatchHistory, "function");
      assert.equal(typeof clientUser.upsertWatchProgress, "function");
      assert.equal(typeof clientUser.getWatchProgress, "function");
      assert.equal(typeof clientUser.clearUserWatchHistory, "function");
      assert.equal(typeof clientUser.deleteWatchHistoryItem, "function");
      assert.equal(typeof clientUser.getGuestWatchHistory, "function");
      assert.equal(typeof clientUser.saveGuestWatchProgress, "function");
      assert.equal(typeof clientUser.getGuestWatchProgress, "function");
      assert.equal(typeof clientUser.deleteGuestWatchHistoryItem, "function");
      assert.equal(typeof clientUser.clearGuestWatchHistory, "function");
      assert.equal(typeof clientUser.syncGuestWatchHistory, "function");
      assert.equal(typeof clientUser.reportWatchProgressBeacon, "function");
    });

    test("lib/client/catalog.ts exports client fetch helpers", () => {
      assert.equal(typeof clientCatalog.fetchPublishedDramas, "function");
      assert.equal(typeof clientCatalog.fetchPublishedTitles, "function");
      assert.equal(typeof clientCatalog.fetchEpisodePlayback, "function");
      assert.equal(typeof clientCatalog.fetchAdminDramas, "function");
      assert.equal(typeof clientCatalog.fetchDramaById, "function");
      assert.equal(typeof clientCatalog.fetchTitleById, "function");
      assert.equal(typeof clientCatalog.fetchCreateDrama, "function");
      assert.equal(typeof clientCatalog.fetchCreateTitle, "function");
      assert.equal(typeof clientCatalog.fetchUpdateDrama, "function");
      assert.equal(typeof clientCatalog.fetchUpdateTitle, "function");
    });
  });

  describe("R3. Standardized Result<T, E> Pattern", () => {
    test("ok() constructs a type-safe discriminated union with ok: true and value", () => {
      const res = ok({ id: "123", name: "Test Drama" });
      assert.equal(res.ok, true);
      assert.deepEqual(res.value, { id: "123", name: "Test Drama" });
      assert.equal(isOk(res), true);
      assert.equal(isErr(res), false);
    });

    test("err() constructs a type-safe discriminated union with ok: false and error", () => {
      const res = err("Drama not found");
      assert.equal(res.ok, false);
      assert.equal(res.error, "Drama not found");
      assert.equal(isOk(res), false);
      assert.equal(isErr(res), true);
    });

    test("unwrap() returns the value of an ok Result or throws the error", () => {
      const success = ok(42);
      assert.equal(unwrap(success), 42);

      const failure = err(new Error("Database disconnected"));
      assert.throws(() => unwrap(failure), /Database disconnected/);

      const failureString = err("String error");
      assert.throws(() => unwrap(failureString), /String error/);
    });

    test("unwrapOr() returns the value or fallback", () => {
      assert.equal(unwrapOr(ok("alpha"), "beta"), "alpha");
      assert.equal(unwrapOr(err("some error"), "beta"), "beta");
    });

    test("map() and mapErr() transform values and errors conditionally", () => {
      const success = ok(10);
      const mapped = map(success, (x) => x * 2);
      assert.equal(mapped.ok, true);
      if (mapped.ok) assert.equal(mapped.value, 20);

      const failure = err("short error");
      const mappedErr = mapErr(failure, (msg) => msg.toUpperCase());
      assert.equal(mappedErr.ok, false);
      if (!mappedErr.ok) assert.equal(mappedErr.error, "SHORT ERROR");
    });

    test("fromPromise() converts Promise to Result", async () => {
      const success = await fromPromise(Promise.resolve("hello"));
      assert.equal(success.ok, true);
      if (success.ok) assert.equal(success.value, "hello");

      const failure = await fromPromise(Promise.reject(new Error("Failed async")));
      assert.equal(failure.ok, false);
      if (!failure.ok) assert.equal(failure.error.message, "Failed async");
    });

    test("toLegacyResult() and fromLegacyResult() convert between shapes seamlessly", () => {
      const modernOk = ok({ id: "d1" });
      const legacyOk = toLegacyResult(modernOk);
      assert.equal(legacyOk.success, true);
      assert.deepEqual(legacyOk.data, { id: "d1" });
      assert.equal(legacyOk.error, null);

      const modernErr = err("Out of memory");
      const legacyErr = toLegacyResult(modernErr);
      assert.equal(legacyErr.success, false);
      assert.equal(legacyErr.data, null);
      assert.equal(legacyErr.error, "Out of memory");

      const roundTripOk = fromLegacyResult(legacyOk);
      assert.equal(roundTripOk.ok, true);
      if (roundTripOk.ok) assert.deepEqual(roundTripOk.value, { id: "d1" });

      const roundTripErr = fromLegacyResult(legacyErr);
      assert.equal(roundTripErr.ok, false);
      if (!roundTripErr.ok) assert.equal(roundTripErr.error, "Out of memory");

      // Edge case: success with null or falsy data must remain ok()
      const nullLegacy = { success: true, data: null, error: null };
      const nullRes = fromLegacyResult<string | null>(nullLegacy);
      assert.equal(nullRes.ok, true);
      if (nullRes.ok) assert.equal(nullRes.value, null);

      const falseLegacy = { success: true, data: false, error: null };
      const falseRes = fromLegacyResult<boolean>(falseLegacy);
      assert.equal(falseRes.ok, true);
      if (falseRes.ok) assert.equal(falseRes.value, false);
    });

    test("ok() supports void return without requiring explicit argument", () => {
      const voidResult: Result<void> = ok();
      assert.equal(voidResult.ok, true);
      assert.equal(isOk(voidResult), true);
      if (voidResult.ok) assert.equal(voidResult.value, undefined);
    });

    test("Result combinators defend against null, undefined, and non-object inputs", () => {
      // isOk and isErr should never throw on null/undefined
      assert.equal(isOk(null as any), false);
      assert.equal(isOk(undefined as any), false);
      assert.equal(isOk("not a result" as any), false);
      assert.equal(isErr(null as any), false);
      assert.equal(isErr(undefined as any), false);
      assert.equal(isErr(123 as any), false);

      // unwrap throws explicit Error on invalid inputs
      assert.throws(() => unwrap(null as any), /Cannot unwrap invalid Result object/);

      // unwrap unpacks error objects with message property instead of [object Object]
      assert.throws(
        () => unwrap(err({ message: "Network timeout", code: "ETIMEDOUT" })),
        /Network timeout/
      );

      // unwrapOr safely returns fallback on null/undefined
      assert.equal(unwrapOr(null as any, "default_val"), "default_val");
      assert.equal(unwrapOr(undefined as any, "default_val"), "default_val");

      // map and mapErr safely return error Result on null/undefined
      const mappedNull = map(null as any, (x) => x);
      assert.equal(mappedNull.ok, false);
      const mappedErrNull = mapErr(null as any, (e) => e);
      assert.equal(mappedErrNull.ok, false);

      // toLegacyResult and fromLegacyResult safely handle null/undefined
      const legacyNull = toLegacyResult(null as any);
      assert.equal(legacyNull.success, false);
      const fromNull = fromLegacyResult(null as any);
      assert.equal(fromNull.ok, false);
    });
  });

  describe("R4. Domain Entity Unification (Title -> Drama)", () => {
    test("Drama is the primary domain entity; Title is backward-compatible alias", () => {
      const drama: Drama = {
        id: "d-1",
        slug: "test-drama",
        title: "Test Drama",
        poster: "https://example.com/poster.jpg",
        synopsis: "Synopsis",
        channel: "DramaShort Originals",
        genre: "Romance",
        tags: ["Romance"],
        totalEpisodes: 30,
        views: 100,
        createdAt: "2026-01-01",
        status: "Published",
        year: 2026,
      };

      // Title must be assignable to Drama and vice-versa with 0 type errors
      const title: Title = drama;
      const roundTripDrama: Drama = title;
      assert.equal(roundTripDrama.id, "d-1");
      assert.equal(roundTripDrama.title, "Test Drama");

      const status: DramaStatus = "Published";
      const legacyStatus: TitleStatus = status;
      assert.equal(legacyStatus, "Published");
    });

    test("getTitleBySlugOrFallback forwards to getDramaBySlugOrFallback", () => {
      const byDrama = getDramaBySlugOrFallback("unknown-slug-test");
      const byTitle = getTitleBySlugOrFallback("unknown-slug-test");
      assert.deepEqual(byTitle, byDrama);
      assert.equal(byTitle.slug, "unknown-slug-test");
      assert.equal(byTitle.channel, "DramaShort Originals");
    });

    test("createTitle is clearly marked deprecated and forwards to createDrama", () => {
      assert.equal(contentFacade.createTitle, contentFacade.createDrama);
    });

    test("dramas dataset export in data/titles.mock matches titles exactly", async () => {
      const mockModule = await import("@/data/titles.mock");
      assert.ok(Array.isArray(mockModule.dramas), "mock module must export canonical dramas array");
      assert.equal(mockModule.dramas, mockModule.titles, "dramas must be identical reference to titles");
    });
  });

  describe("R5. Backward-Compatible Facade Integrity (lib/services/)", () => {
    test("lib/services/content.service.ts exports all legacy and modern catalog functions", () => {
      assert.equal(typeof contentFacade.searchPublishedTitles, "function");
      assert.equal(typeof contentFacade.searchDramas, "function");
      assert.equal(typeof contentFacade.getPublishedTitles, "function");
      assert.equal(typeof contentFacade.getPublishedDramas, "function");
      assert.equal(typeof contentFacade.getTitleBySlug, "function");
      assert.equal(typeof contentFacade.getDramaBySlug, "function");
      assert.equal(typeof contentFacade.getTitlesBySlugs, "function");
      assert.equal(typeof contentFacade.getDramasBySlugs, "function");
      assert.equal(typeof contentFacade.getEpisodesByTitleId, "function");
      assert.equal(typeof contentFacade.getEpisodesByDramaId, "function");
      assert.equal(typeof contentFacade.getTopTrendingTitles, "function");
      assert.equal(typeof contentFacade.getTopTrendingDramas, "function");
      assert.equal(typeof contentFacade.getNewReleaseTitles, "function");
      assert.equal(typeof contentFacade.getNewReleaseDramas, "function");
      assert.equal(typeof contentFacade.getChannels, "function");
      assert.equal(typeof contentFacade.getChannelBySlug, "function");
      assert.equal(typeof contentFacade.getHeroSlides, "function");
      assert.equal(typeof contentFacade.getDistinctGenres, "function");
      assert.equal(typeof contentFacade.getPopularTags, "function");
      assert.equal(typeof contentFacade.getDramaById, "function");
      assert.equal(typeof contentFacade.getTitleById, "function");
      assert.equal(typeof contentFacade.getAdminDramas, "function");
      assert.equal(typeof contentFacade.updateDrama, "function");
      assert.equal(typeof contentFacade.updateTitle, "function");
      assert.equal(typeof contentFacade.createDrama, "function");
      assert.equal(typeof contentFacade.createTitle, "function");
      assert.equal(typeof contentFacade.deleteDrama, "function");
      assert.equal(typeof contentFacade.deleteTitle, "function");
      assert.equal(typeof contentFacade.mapDramaRowToDrama, "function");
      assert.equal(typeof contentFacade.mapTitleRowToTitle, "function");
      assert.equal(typeof contentFacade.getEpisodePlayback, "function");
    });

    test("lib/services/user.service.ts re-exports all user operations cleanly", () => {
      assert.equal(typeof userFacade.getUserProfile, "function");
      assert.equal(typeof userFacade.updateUserProfile, "function");
      assert.equal(typeof userFacade.getUserFavorites, "function");
      assert.equal(typeof userFacade.addUserFavorite, "function");
      assert.equal(typeof userFacade.addUserFavorites, "function");
      assert.equal(typeof userFacade.removeUserFavorite, "function");
      assert.equal(typeof userFacade.getUserCustomLists, "function");
      assert.equal(typeof userFacade.createCustomList, "function");
      assert.equal(typeof userFacade.addItemToCustomList, "function");
      assert.equal(typeof userFacade.addItemsToCustomList, "function");
      assert.equal(typeof userFacade.renameCustomList, "function");
      assert.equal(typeof userFacade.deleteCustomList, "function");
      assert.equal(typeof userFacade.removeItemFromCustomList, "function");
      assert.equal(typeof userFacade.getUserWatchHistory, "function");
      assert.equal(typeof userFacade.upsertWatchProgress, "function");
      assert.equal(typeof userFacade.getWatchProgress, "function");
      assert.equal(typeof userFacade.clearUserWatchHistory, "function");
      assert.equal(typeof userFacade.deleteWatchHistoryItem, "function");
      assert.equal(typeof userFacade.getGuestWatchHistory, "function");
      assert.equal(typeof userFacade.saveGuestWatchProgress, "function");
      assert.equal(typeof userFacade.getGuestWatchProgress, "function");
      assert.equal(typeof userFacade.deleteGuestWatchHistoryItem, "function");
      assert.equal(typeof userFacade.clearGuestWatchHistory, "function");
      assert.equal(typeof userFacade.syncGuestWatchHistory, "function");
    });

    test("client and server services adopt standardized Result<T> pattern", () => {
      // Server catalog & admin
      assert.equal(typeof serverCatalog.searchDramasResult, "function");
      assert.equal(typeof serverCatalog.getDramaBySlugResult, "function");
      assert.equal(typeof serverCatalog.getChannelBySlugResult, "function");
      assert.equal(typeof serverAdmin.getAdminDramaByIdResult, "function");
      assert.equal(typeof serverAdmin.getAdminDramasResult, "function");
      assert.equal(typeof serverPlayback.getEpisodePlaybackResult, "function");

      // Server user
      assert.equal(typeof serverUser.getServerUserProfileResult, "function");
      assert.equal(typeof serverUser.getServerWatchHistoryResult, "function");
      assert.equal(typeof serverUser.getServerWatchProgressResult, "function");
      assert.equal(typeof serverUser.getServerFavoritesResult, "function");
      assert.equal(typeof serverUser.getServerCustomListsResult, "function");
      assert.equal(typeof serverUser.upsertServerWatchProgress, "function");

      // Client catalog
      assert.equal(typeof clientCatalog.fetchDeleteDrama, "function");
      assert.equal(typeof clientCatalog.fetchDeleteTitle, "function");

      // Client user optimistic favorites & Result helpers
      assert.equal(typeof clientUser.computeOptimisticFavoriteToggle, "function");
      const toggleOn = clientUser.computeOptimisticFavoriteToggle([], "drama-1");
      assert.equal(toggleOn.isFavorited, true);
      assert.deepEqual(toggleOn.nextSlugs, ["drama-1"]);

      const toggleOff = clientUser.computeOptimisticFavoriteToggle(["drama-1"], "drama-1");
      assert.equal(toggleOff.isFavorited, false);
      assert.deepEqual(toggleOff.nextSlugs, []);

      const nullToggle = clientUser.computeOptimisticFavoriteToggle(null, "drama-2");
      assert.equal(nullToggle.isFavorited, true);
      assert.deepEqual(nullToggle.nextSlugs, ["drama-2"]);

      const emptySlugToggle = clientUser.computeOptimisticFavoriteToggle(["drama-1"], "");
      assert.equal(emptySlugToggle.isFavorited, false);
      assert.deepEqual(emptySlugToggle.nextSlugs, ["drama-1"]);

      assert.equal(typeof clientUser.updateUserProfileResult, "function");
      assert.equal(typeof clientUser.addUserFavoriteResult, "function");
      assert.equal(typeof clientUser.removeUserFavoriteResult, "function");
      assert.equal(typeof clientUser.createCustomListResult, "function");
      assert.equal(typeof clientUser.upsertWatchProgressResult, "function");
      assert.equal(typeof clientUser.getWatchProgressResult, "function");
    });

    test("public /api/dramas and /api/titles route handlers exist and export GET", async () => {
      const dramasRoute = await import("@/app/api/dramas/route");
      assert.equal(typeof dramasRoute.GET, "function", "/api/dramas must export GET");
      const titlesRoute = await import("@/app/api/titles/route");
      assert.equal(typeof titlesRoute.GET, "function", "/api/titles must export GET");
    });
  });
});


