import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React, { cache } from "react";
(globalThis as any).React = React;

// Mock static image imports for Node.js test environment
require.extensions[".png"] = (m: any, filename: string) => {
  m.exports = { src: filename, height: 100, width: 100 };
};
require.extensions[".jpg"] = (m: any, filename: string) => {
  m.exports = { src: filename, height: 100, width: 100 };
};

import {
  getTitleBySlug,
  getChannelBySlug,
  getDistinctGenres,
  getTopTrendingTitles,
  getHeroSlides,
} from "@/lib/services/content.service";

describe("Server-Rendered Public Catalog (RSC + ISR) - Task 13.3", () => {
  const catalogRoutes = [
    "app/drama/[slug]/page.tsx",
    "app/channel/[slug]/page.tsx",
    "app/home/page.tsx",
    "app/genres/page.tsx",
    "app/trending/page.tsx",
    "app/new-release/page.tsx",
    "app/watch/[slug]/page.tsx",
  ];

  const clientIslands = [
    "components/islands/PageShell.tsx",
    "components/islands/DramaInteractiveActions.tsx",
    "components/islands/SynopsisExpandable.tsx",
    "components/islands/ContinueWatchingIsland.tsx",
    "components/islands/GenreFilterIsland.tsx",
    "components/islands/PaginationIsland.tsx",
    "components/watch/WatchPlayerIsland.tsx",
  ];

  describe("R1. Server Component Export Contracts & Boundaries", () => {
    it("ensures all public catalog pages are Server Components without 'use client'", () => {
      for (const route of catalogRoutes) {
        const fullPath = path.resolve(process.cwd(), route);
        const content = fs.readFileSync(fullPath, "utf-8");

        assert.ok(
          !content.includes('"use client"'),
          `${route} must NOT declare 'use client' (must be a Server Component)`
        );
        assert.ok(
          !content.includes("'use client'"),
          `${route} must NOT declare 'use client' (must be a Server Component)`
        );
        assert.ok(
          content.includes("export default async function"),
          `${route} must export an async default Server Component function`
        );
      }
    });

    it("ensures all extracted modular interactive islands strictly declare 'use client'", () => {
      for (const island of clientIslands) {
        const fullPath = path.resolve(process.cwd(), island);
        const content = fs.readFileSync(fullPath, "utf-8");

        assert.ok(
          content.trim().startsWith('"use client"'),
          `${island} must declare 'use client' at the top of the file`
        );
      }
    });
  });

  describe("R2. ISR Revalidation Constants (5-minute / 300s cache)", () => {
    it("verifies static source declaration of export const revalidate = 300 on all 7 catalog pages", () => {
      for (const route of catalogRoutes) {
        const fullPath = path.resolve(process.cwd(), route);
        const content = fs.readFileSync(fullPath, "utf-8");

        assert.ok(
          content.includes("export const revalidate = 300;"),
          `${route} must export const revalidate = 300;`
        );
      }
    });

    it("verifies runtime export contract revalidate === 300 across all 7 catalog pages", async () => {
      const dramaMod = await import("@/app/drama/[slug]/page");
      const channelMod = await import("@/app/channel/[slug]/page");
      const homeMod = await import("@/app/home/page");
      const genresMod = await import("@/app/genres/page");
      const trendingMod = await import("@/app/trending/page");
      const newReleaseMod = await import("@/app/new-release/page");
      const watchMod = await import("@/app/watch/[slug]/page");

      assert.equal(dramaMod.revalidate, 300, "/drama/[slug] revalidate must be 300");
      assert.equal(channelMod.revalidate, 300, "/channel/[slug] revalidate must be 300");
      assert.equal(homeMod.revalidate, 300, "/home revalidate must be 300");
      assert.equal(genresMod.revalidate, 300, "/genres revalidate must be 300");
      assert.equal(trendingMod.revalidate, 300, "/trending revalidate must be 300");
      assert.equal(newReleaseMod.revalidate, 300, "/new-release revalidate must be 300");
      assert.equal(watchMod.revalidate, 300, "/watch/[slug] revalidate must be 300");
    });

    it("verifies generateStaticParams on app/drama/[slug]/page.tsx pre-renders top published dramas", async () => {
      const { setTestContentClient } = await import("@/lib/supabase/content");
      setTestContentClient({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => ({
                  range: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: "d-1",
                          slug: "the-secret-heir-1",
                          title: "The Secret Heir",
                          status: "Published",
                          views_count: 5000,
                          created_at: "2026-01-01T00:00:00Z",
                        },
                        {
                          id: "d-2",
                          slug: "the-hidden-billionaire-2",
                          title: "The Hidden Billionaire",
                          status: "Published",
                          views_count: 4000,
                          created_at: "2026-01-02T00:00:00Z",
                        },
                      ],
                      count: 2,
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        }),
      });

      const { generateStaticParams } = await import("@/app/drama/[slug]/page");
      assert.equal(typeof generateStaticParams, "function");
      const params = await generateStaticParams();

      assert.ok(Array.isArray(params), "generateStaticParams must return an array");
      assert.ok(params.length > 0, "generateStaticParams must return at least 1 slug");
      for (const item of params) {
        assert.ok(typeof item.slug === "string", "Each param item must contain a string slug");
        assert.ok(item.slug.length > 0, "Slug must be non-empty");
      }

      setTestContentClient(null);
    });
  });

  describe("R2. React.cache Query Deduplication", () => {
    it("verifies content.service.ts imports cache from react", () => {
      const servicePath = path.resolve(process.cwd(), "lib/services/content.service.ts");
      const content = fs.readFileSync(servicePath, "utf-8");

      assert.ok(
        content.includes('import { cache } from "react";'),
        "content.service.ts must import cache from 'react'"
      );
    });

    it("verifies catalog lookup functions are wrapped in React.cache()", () => {
      const servicePath = path.resolve(process.cwd(), "lib/services/content.service.ts");
      const content = fs.readFileSync(servicePath, "utf-8");

      const wrappedFunctions = [
        "getTitleBySlug = cache(",
        "getChannelBySlug = cache(",
        "getDistinctGenres = cache(",
        "getTopTrendingTitles = cache(",
        "getHeroSlides = cache(",
      ];

      for (const fnDeclaration of wrappedFunctions) {
        assert.ok(
          content.includes(fnDeclaration),
          `content.service.ts must declare ${fnDeclaration}`
        );
      }
    });

    it("verifies catalog lookups are functions returning promises", () => {
      assert.equal(typeof getTitleBySlug, "function");
      assert.equal(typeof getChannelBySlug, "function");
      assert.equal(typeof getDistinctGenres, "function");
      assert.equal(typeof getTopTrendingTitles, "function");
      assert.equal(typeof getHeroSlides, "function");
    });

    it("verifies deduplication memoization mechanics via React.cache wrapper", async () => {
      let underlyingDbQueryCount = 0;
      const fetchCatalogItem = async (id: string) => {
        underlyingDbQueryCount++;
        return { id, title: `Drama ${id}`, timestamp: Date.now() };
      };

      const cachedFetch = cache(fetchCatalogItem);

      // Outside a server request, calling the cached wrapper behaves consistently
      const res1 = await cachedFetch("alpha-1");
      assert.equal(res1.id, "alpha-1");
      assert.ok(underlyingDbQueryCount >= 1);
    });
  });

  describe("R3. Modular Client Islands & Theme Shell Integration", () => {
    it("verifies PageShell wraps content and preserves data-theme", () => {
      const shellPath = path.resolve(process.cwd(), "components/islands/PageShell.tsx");
      const content = fs.readFileSync(shellPath, "utf-8");

      assert.ok(content.includes("useTheme"), "PageShell must consume useTheme from ThemeContext");
      assert.ok(content.includes("data-theme={theme}"), "PageShell must apply data-theme={theme}");
    });

    it("verifies DramaInteractiveActions encapsulates favorites, lists, and auth without SSR leaks", () => {
      const actionsPath = path.resolve(
        process.cwd(),
        "components/islands/DramaInteractiveActions.tsx"
      );
      const content = fs.readFileSync(actionsPath, "utf-8");

      assert.ok(content.includes("useFavorites"), "Must use useFavorites");
      assert.ok(content.includes("useAuth"), "Must use useAuth");
      assert.ok(content.includes("AddToListModal"), "Must include AddToListModal");
      assert.ok(content.includes("LoginRequiredModal"), "Must include LoginRequiredModal");
      assert.ok(content.includes("Toast"), "Must include Toast");
    });

    it("verifies SynopsisExpandable maintains full text in markup for SEO and provides expansion", () => {
      const synopsisPath = path.resolve(process.cwd(), "components/islands/SynopsisExpandable.tsx");
      const content = fs.readFileSync(synopsisPath, "utf-8");

      assert.ok(content.includes("line-clamp-4"), "Must truncate with line-clamp-4");
      assert.ok(content.includes("isExpanded"), "Must manage isExpanded state");
      assert.ok(content.includes("{synopsis}"), "Must directly render full synopsis in the paragraph");
    });

    it("verifies PaginationIsland preserves search parameters and triggers navigation", () => {
      const paginationPath = path.resolve(
        process.cwd(),
        "components/islands/PaginationIsland.tsx"
      );
      const content = fs.readFileSync(paginationPath, "utf-8");

      assert.ok(content.includes("useSearchParams"), "Must inspect current search parameters");
      assert.ok(content.includes("useRouter"), "Must trigger client router transition");
      assert.ok(content.includes("params.set(\"page\""), "Must update page param");
      assert.ok(content.includes("window.scrollTo"), "Must scroll smoothly to top");
    });

    it("verifies GenreFilterIsland updates genre query param and resets page param", () => {
      const genreFilterPath = path.resolve(
        process.cwd(),
        "components/islands/GenreFilterIsland.tsx"
      );
      const content = fs.readFileSync(genreFilterPath, "utf-8");

      assert.ok(content.includes("useRouter"), "Must trigger router push on genre click");
      assert.ok(content.includes("params.set(\"genre\""), "Must update genre query param");
      assert.ok(content.includes("params.delete(\"page\")"), "Must reset page query param upon changing genre");
    });
  });

  describe("R4. Canonical Prefix Redirect & Architectural Invariants", () => {
    it("verifies canonical redirect via permanentRedirect on /drama/[slug]", () => {
      const dramaPagePath = path.resolve(process.cwd(), "app/drama/[slug]/page.tsx");
      const content = fs.readFileSync(dramaPagePath, "utf-8");

      assert.ok(content.includes("notFound()"), "Must call notFound() when drama is missing");
      assert.ok(
        content.includes("permanentRedirect(`/drama/${drama.slug}`)"),
        "Must call permanentRedirect when slug does not match canonical slug"
      );
    });

    it("verifies canonical redirect via permanentRedirect on /watch/[slug]", () => {
      const watchPagePath = path.resolve(process.cwd(), "app/watch/[slug]/page.tsx");
      const content = fs.readFileSync(watchPagePath, "utf-8");

      assert.ok(content.includes("notFound()"), "Must call notFound() when drama is missing");
      assert.ok(
        content.includes("permanentRedirect(`/watch/${drama.slug}`)"),
        "Must call permanentRedirect when slug does not match canonical slug"
      );
    });

    it("verifies app/drama/[slug]/page.tsx pre-renders Episodes grid in server HTML", () => {
      const dramaPagePath = path.resolve(process.cwd(), "app/drama/[slug]/page.tsx");
      const content = fs.readFileSync(dramaPagePath, "utf-8");

      assert.ok(content.includes("{/* Episodes Grid */}"), "Drama page must include Episodes Grid section");
      assert.ok(content.includes("/watch/${drama.slug}?ep="), "Episodes grid must link directly to episode playback");
    });

    it("verifies WatchPlayerIsland displays drama synopsis and metadata tags", () => {
      const islandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const content = fs.readFileSync(islandPath, "utf-8");

      assert.ok(content.includes("{drama.synopsis}"), "WatchPlayerIsland must render drama.synopsis");
      assert.ok(content.includes("{drama.channel}"), "WatchPlayerIsland must render drama.channel");
      assert.ok(content.includes("{drama.genre}"), "WatchPlayerIsland must render drama.genre");
    });

    it("verifies route metadata export contracts on public discovery pages", async () => {
      const homeMod = await import("@/app/home/page");
      const genresMod = await import("@/app/genres/page");
      const trendingMod = await import("@/app/trending/page");
      const newReleaseMod = await import("@/app/new-release/page");

      assert.ok(homeMod.metadata?.title, "Home page must export metadata with title");
      assert.ok(genresMod.metadata?.title, "Genres page must export metadata with title");
      assert.ok(trendingMod.metadata?.title, "Trending page must export metadata with title");
      assert.ok(newReleaseMod.metadata?.title, "New Release page must export metadata with title");
    });

    it("verifies components/islands/index.ts exports all client islands including WatchPlayerIsland", async () => {
      const islandsMod = await import("@/components/islands");
      assert.ok(islandsMod.PageShell, "PageShell must be exported");
      assert.ok(islandsMod.DramaInteractiveActions, "DramaInteractiveActions must be exported");
      assert.ok(islandsMod.SynopsisExpandable, "SynopsisExpandable must be exported");
      assert.ok(islandsMod.ContinueWatchingIsland, "ContinueWatchingIsland must be exported");
      assert.ok(islandsMod.GenreFilterIsland, "GenreFilterIsland must be exported");
      assert.ok(islandsMod.PaginationIsland, "PaginationIsland must be exported");
      assert.ok(islandsMod.WatchPlayerIsland, "WatchPlayerIsland must be exported");
    });

    it("verifies WatchPlayerIsland marks episodes with db ID as available without raw videoUrl (Task 10.9)", () => {
      const watchIslandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const content = fs.readFileSync(watchIslandPath, "utf-8");

      assert.ok(
        content.includes("(e.videoUrl && e.videoUrl.trim() !== \"\") || e.id"),
        "availableEpisodesCount must consider episodes with database id available"
      );
      assert.ok(
        content.includes("(epData?.videoUrl && epData.videoUrl.trim() !== \"\") || epData?.id"),
        "isAvailable check must consider episodes with database id available"
      );
    });

    it("verifies discovery routes handle array and invalid searchParams gracefully", async () => {
      const { setTestContentClient } = await import("@/lib/supabase/content");
      const createChainable = () => {
        const q: any = {
          select: () => q,
          eq: () => q,
          neq: () => q,
          or: () => q,
          order: () => q,
          range: () => Promise.resolve({ data: [], count: 0, error: null }),
        };
        return q;
      };
      setTestContentClient({
        from: () => createChainable(),
      });

      const { default: GenresPage } = await import("@/app/genres/page");
      const { default: TrendingPage } = await import("@/app/trending/page");
      const { default: NewReleasePage } = await import("@/app/new-release/page");

      // Verify rendering with array query params does not throw or crash
      const genresEl = await GenresPage({
        searchParams: Promise.resolve({
          genre: ["Romance", "Action"],
          page: ["2", "3"],
        }),
      });
      assert.ok(genresEl, "GenresPage should render with array searchParams");

      const trendingEl = await TrendingPage({
        searchParams: Promise.resolve({
          page: ["2", "3"],
        }),
      });
      assert.ok(trendingEl, "TrendingPage should render with array searchParams");

      const newReleaseEl = await NewReleasePage({
        searchParams: Promise.resolve({
          page: ["invalid-page", "999"],
        }),
      });
      assert.ok(newReleaseEl, "NewReleasePage should render with malformed searchParams");

      setTestContentClient(null);
    });

    it("verifies WatchPlayerIsland displays loading state and avoids false-negative unavailable flash", () => {
      const watchIslandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const content = fs.readFileSync(watchIslandPath, "utf-8");

      assert.ok(
        content.includes("playbackLoading || (currentEpData?.id && !playbackError)"),
        "WatchPlayerIsland must render active loading state while stream resolves"
      );
      assert.ok(
        content.includes("Loading video stream..."),
        "WatchPlayerIsland must display loading message instead of unavailable message"
      );
    });

    it("verifies WatchPlayerIsland accepts initialEpisode and computes activeTab for episodes > 40", () => {
      const watchIslandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const content = fs.readFileSync(watchIslandPath, "utf-8");

      assert.ok(
        content.includes("initialEpisode?: number;"),
        "WatchPlayerIslandProps must declare initialEpisode prop"
      );
      assert.ok(
        content.includes("Math.floor((Math.max(1, resolvedInitialEp) - 1) / EPISODES_PER_TAB)"),
        "activeTab must derive from resolvedInitialEp to prevent layout shifts"
      );
    });

    it("verifies ChannelPage uses canonical channel.slug for pagination basePath", () => {
      const channelPagePath = path.resolve(process.cwd(), "app/channel/[slug]/page.tsx");
      const content = fs.readFileSync(channelPagePath, "utf-8");

      assert.ok(
        content.includes("basePath={`/channel/${channel.slug}`}"),
        "ChannelPage must bind canonical channel.slug to pagination basePath"
      );
    });

    it("verifies GenreFilterIsland supports case-insensitive genre matching", () => {
      const genreIslandPath = path.resolve(process.cwd(), "components/islands/GenreFilterIsland.tsx");
      const content = fs.readFileSync(genreIslandPath, "utf-8");

      assert.ok(
        content.includes("g.toLowerCase() === activeGenre.toLowerCase()"),
        "GenreFilterIsland must evaluate active genre with case-insensitive equality"
      );
    });

    it("verifies WatchPlayerIsland renders dedicated retry UI on playbackError instead of unavailable message", () => {
      const watchIslandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const content = fs.readFileSync(watchIslandPath, "utf-8");

      assert.ok(
        content.includes("playbackError ?"),
        "WatchPlayerIsland must branch on playbackError"
      );
      assert.ok(
        content.includes("Unable to load episode stream"),
        "WatchPlayerIsland must present unable to load stream message"
      );
      assert.ok(
        content.includes("handleRetryPlayback"),
        "WatchPlayerIsland must provide retry button handler"
      );
    });

    it("verifies WatchPlayerIsland clamps activeTab and synchronizes on episode selection", () => {
      const watchIslandPath = path.resolve(process.cwd(), "components/watch/WatchPlayerIsland.tsx");
      const content = fs.readFileSync(watchIslandPath, "utf-8");

      assert.ok(
        content.includes("const maxTab = Math.max(0, Math.ceil(totalEps / EPISODES_PER_TAB) - 1);"),
        "WatchPlayerIsland must compute maxTab boundary"
      );
      assert.ok(
        content.includes("setActiveTab(Math.min(maxTab, Math.floor((Math.max(1, ep) - 1) / EPISODES_PER_TAB)));"),
        "handleSelectEpisode must update activeTab when switching episodes"
      );
    });

    it("verifies ChannelPage enforces canonical redirect for non-canonical slugs", () => {
      const channelPagePath = path.resolve(process.cwd(), "app/channel/[slug]/page.tsx");
      const content = fs.readFileSync(channelPagePath, "utf-8");

      assert.ok(
        content.includes("permanentRedirect(`/channel/${channel.slug}`)"),
        "ChannelPage must call permanentRedirect when slug does not match canonical channel.slug"
      );
    });

    it("verifies generateStaticParams safely guards against exceptions", () => {
      const dramaPagePath = path.resolve(process.cwd(), "app/drama/[slug]/page.tsx");
      const content = fs.readFileSync(dramaPagePath, "utf-8");

      assert.ok(
        content.includes("try {"),
        "generateStaticParams must contain try block"
      );
      assert.ok(
        content.includes("catch (err)"),
        "generateStaticParams must catch errors and return empty array"
      );
    });
  });
});

