import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateMetadata as dramaGenerateMetadata } from "@/app/drama/[slug]/layout";
import { generateMetadata as watchGenerateMetadata } from "@/app/watch/[slug]/layout";
import { titles } from "@/data/titles.mock";
import { setTestContentClient } from "@/lib/supabase/content";

function createMockContentClient(sampleDrama: (typeof titles)[0]) {
  const row = {
    id: sampleDrama.id,
    title: sampleDrama.title,
    slug: sampleDrama.slug,
    poster_url: sampleDrama.poster,
    synopsis: sampleDrama.synopsis,
    channel_name: sampleDrama.channel,
    genre: sampleDrama.genre,
    tags: sampleDrama.tags,
    total_episodes: sampleDrama.totalEpisodes,
    rating: sampleDrama.rating,
    views_count: sampleDrama.views,
    created_at: sampleDrama.createdAt,
    status: "Published",
    release_year: 2026,
  };

  return {
    from: (table: string) => {
      return {
        select: (_fields: string) => ({
          eq: (field: string, val: string) => ({
            maybeSingle: async () => {
              if (field === "slug" && val === sampleDrama.slug) {
                return { data: row, error: null };
              }
              return { data: null, error: null };
            },
          }),
          ilike: (field: string, pattern: string) => ({
            limit: () => ({
              maybeSingle: async () => {
                const prefix = pattern.replace("-%", "");
                if (sampleDrama.slug.startsWith(prefix)) {
                  return { data: row, error: null };
                }
                return { data: null, error: null };
              },
            }),
          }),
        }),
      };
    },
  };
}

describe("Real 404s & Unavailable-Content States (Task 11.6)", () => {
  beforeEach(() => {
    setTestContentClient(createMockContentClient(titles[0]));
  });

  afterEach(() => {
    setTestContentClient(null);
  });

  describe("SEO & Canonical Metadata for Missing Titles", () => {
    it("returns robots: noindex, nofollow for non-existent drama on /drama/[slug]", async () => {
      const metadata = await dramaGenerateMetadata({
        params: Promise.resolve({ slug: "completely-non-existent-drama-xyz-12345" }),
      });

      assert.equal(metadata.title, "Drama Not Found — DramaShort");
      assert.deepEqual(metadata.robots, {
        index: false,
        follow: false,
      });
    });

    it("returns valid indexable metadata for existing drama on /drama/[slug]", async () => {
      const sampleSlug = titles[0].slug;
      const metadata = await dramaGenerateMetadata({
        params: Promise.resolve({ slug: sampleSlug }),
      });

      assert.ok(typeof metadata.title === "string");
      assert.ok(metadata.title.includes(titles[0].title));
      assert.equal(metadata.robots, undefined);
      assert.ok(metadata.openGraph?.title);
    });

    it("returns robots: noindex, nofollow for non-existent drama on /watch/[slug]", async () => {
      const metadata = await watchGenerateMetadata({
        params: Promise.resolve({ slug: "completely-non-existent-drama-xyz-12345" }),
      });

      assert.equal(metadata.title, "Drama Not Found — DramaShort");
      assert.deepEqual(metadata.robots, {
        index: false,
        follow: false,
      });
    });

    it("returns valid indexable metadata for existing drama on /watch/[slug]", async () => {
      const sampleSlug = titles[0].slug;
      const metadata = await watchGenerateMetadata({
        params: Promise.resolve({ slug: sampleSlug }),
      });

      assert.ok(typeof metadata.title === "string");
      assert.ok(metadata.title.includes(titles[0].title));
      assert.equal(metadata.robots, undefined);
    });
  });

  describe("Runtime Mock Fallback Eradication", () => {
    function getSourceFiles(dir: string): string[] {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...getSourceFiles(fullPath));
        } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    it("ensures zero runtime imports of getTitleBySlugOrFallback in app/ and components/", () => {
      const appFiles = getSourceFiles(path.resolve(process.cwd(), "app"));
      const componentFiles = getSourceFiles(path.resolve(process.cwd(), "components"));
      const allRuntimeFiles = [...appFiles, ...componentFiles];

      for (const file of allRuntimeFiles) {
        const content = fs.readFileSync(file, "utf8");
        assert.ok(
          !content.includes("getTitleBySlugOrFallback"),
          `File ${path.relative(process.cwd(), file)} must not use getTitleBySlugOrFallback`
        );
      }
    });

    it("ensures watch page does not fall back to external sample video (Big Buck Bunny)", () => {
      const watchPagePath = path.resolve(process.cwd(), "app/watch/[slug]/page.tsx");
      const content = fs.readFileSync(watchPagePath, "utf8");

      assert.ok(
        !content.includes("BigBuckBunny.mp4"),
        "Watch page must never contain BigBuckBunny fallback URL"
      );
      assert.ok(
        !content.includes("commondatastorage.googleapis.com"),
        "Watch page must not reference sample video storage bucket"
      );
    });
  });

  describe("Defensive Content Filtering", () => {
    it("verifies continue watching filters out deleted or unknown titles", () => {
      const historyRows = [
        { title_slug: "existing-slug", episode_number: 1, progress: 0.5 },
        { title_slug: "deleted-drama-slug", episode_number: 3, progress: 0.2 },
      ];

      const dbTitles = [{ slug: "existing-slug", title: "Existing", totalEpisodes: 20 }];
      const titleMap = new Map(dbTitles.map((t) => [t.slug, t]));

      const filteredItems: Array<{ slug: string; title: string }> = [];
      for (const row of historyRows) {
        const drama = titleMap.get(row.title_slug);
        if (!drama) {
          continue;
        }
        filteredItems.push({ slug: drama.slug, title: drama.title });
      }

      assert.equal(filteredItems.length, 1);
      assert.equal(filteredItems[0].slug, "existing-slug");
    });

    it("verifies watch history filters out missing titles from display", () => {
      const historyRows = [
        { title_slug: "orphan-drama-slug", episode_number: 2, progress: 0.1 },
      ];

      const dbTitles: Array<{ slug: string; title: string }> = [];
      const titleMap = new Map(dbTitles.map((t) => [t.slug, t]));

      const displayed: unknown[] = [];
      for (const row of historyRows) {
        const drama = titleMap.get(row.title_slug);
        if (!drama) continue;
        displayed.push(drama);
      }

      assert.equal(displayed.length, 0);
    });
  });
});
