import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isPlaceholderUrl,
  isPlaceholderKey,
  isValidHttpUrl,
  validateEnvironment,
} from "@/lib/config/env-validator.mjs";
import { ok, err, isOk, isErr } from "@/types/result";
import {
  searchPublishedTitles,
  searchPublishedTitlesResult,
  getDistinctGenres,
  getPopularTags,
  getHeroSlides,
} from "@/lib/services/content.service";
import { setTestContentClient } from "@/lib/supabase/content";

describe("Task 12.4: Remove Mock Data From Production Runtime", () => {
  describe("Environment Validation & Fail-Fast Protection", () => {
    test("detects placeholder and invalid Supabase URLs", () => {
      assert.equal(isPlaceholderUrl("https://placeholder.supabase.co"), true);
      assert.equal(isPlaceholderUrl("https://your-content-project.supabase.co"), true);
      assert.equal(isPlaceholderUrl("https://your-user-project.supabase.co"), true);
      assert.equal(isPlaceholderUrl(""), true);
      assert.equal(isPlaceholderUrl(undefined), true);
      assert.equal(isPlaceholderUrl("https://czkkzoiuyqybafacpgsp.supabase.co"), false);
      assert.equal(isPlaceholderUrl("https://bpidsbcrvpkavvdvtpgh.supabase.co"), false);
    });

    test("detects placeholder API keys", () => {
      assert.equal(isPlaceholderKey("placeholder-anon-key"), true);
      assert.equal(isPlaceholderKey("placeholder-service-role-key"), true);
      assert.equal(isPlaceholderKey("your-content-anon-key"), true);
      assert.equal(isPlaceholderKey(""), true);
      assert.equal(isPlaceholderKey(undefined), true);
      assert.equal(isPlaceholderKey("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."), false);
    });

    test("validates HTTP/HTTPS URL syntax", () => {
      assert.equal(isValidHttpUrl("https://example.supabase.co"), true);
      assert.equal(isValidHttpUrl("http://localhost:54321"), true);
      assert.equal(isValidHttpUrl("not-a-valid-url"), false);
      assert.equal(isValidHttpUrl("ftp://example.com"), false);
      assert.equal(isValidHttpUrl(""), false);
    });

    test("throws descriptive error when required variables are placeholders in production", () => {
      const mockEnv = {
        NODE_ENV: "production",
        NEXT_PUBLIC_CONTENT_SUPABASE_URL: "https://placeholder.supabase.co",
        NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY: "real-key-123",
        NEXT_PUBLIC_USER_SUPABASE_URL: "https://bpidsbcrvpkavvdvtpgh.supabase.co",
        NEXT_PUBLIC_USER_SUPABASE_ANON_KEY: "real-key-456",
      };

      assert.throws(
        () => validateEnvironment(mockEnv, { throws: true, isProduction: true }),
        (err: Error) => {
          assert.match(err.message, /Placeholder URL detected for NEXT_PUBLIC_CONTENT_SUPABASE_URL/);
          return true;
        }
      );
    });

    test("passes validation when all required production variables are genuine", () => {
      const mockEnv = {
        NODE_ENV: "production",
        NEXT_PUBLIC_CONTENT_SUPABASE_URL: "https://czkkzoiuyqybafacpgsp.supabase.co",
        NEXT_PUBLIC_CONTENT_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test1",
        NEXT_PUBLIC_USER_SUPABASE_URL: "https://bpidsbcrvpkavvdvtpgh.supabase.co",
        NEXT_PUBLIC_USER_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test2",
        PAYMENT_WEBHOOK_SECRET: "whsec_live_mock_secret_abcdef123456",
        CRON_SECRET: "cron_live_mock_secret_abcdef123456",
      };

      const res = validateEnvironment(mockEnv, { throws: true, isProduction: true });
      assert.equal(res.valid, true);
      assert.equal(res.errors.length, 0);
    });
  });

  describe("Typed Result<T> Operations", () => {
    test("constructs ok result with data and null error", () => {
      const successResult = ok({ items: [1, 2, 3] });
      assert.equal(successResult.success, true);
      assert.deepEqual(successResult.data, { items: [1, 2, 3] });
      assert.equal(successResult.error, null);
      assert.equal(isOk(successResult), true);
      assert.equal(isErr(successResult), false);
    });

    test("constructs err result with error and null data", () => {
      const failureResult = err("Connection timeout");
      assert.equal(failureResult.success, false);
      assert.equal(failureResult.data, null);
      assert.equal(failureResult.error, "Connection timeout");
      assert.equal(isOk(failureResult), false);
      assert.equal(isErr(failureResult), true);
    });
  });

  describe("Content Service Zero-Mock Runtime Contracts", () => {
    test("searchPublishedTitles returns empty items and error string on database failure without mock substitution", async () => {
      // Mock Content DB client that returns a database failure
      setTestContentClient({
        from: () => ({
          select: () => ({
            eq: function () {
              return this;
            },
            order: function () {
              return this;
            },
            range: function () {
              return Promise.resolve({
                data: null,
                count: null,
                error: { message: "Database connection failed" },
              });
            },
          }),
        }),
      });

      const res = await searchPublishedTitles();
      assert.deepEqual(res.items, []);
      assert.equal(res.total, 0);
      assert.equal(res.totalPages, 1);
      assert.equal(res.error, "Database connection failed");

      // Verify searchPublishedTitlesResult wraps in Result<T>
      const typedRes = await searchPublishedTitlesResult();
      assert.equal(typedRes.success, false);
      assert.equal(typedRes.data, null);
      assert.equal(typedRes.error, "Database connection failed");

      // Clean up test hook
      setTestContentClient(null);
    });

    test("getDistinctGenres and getPopularTags return empty arrays on database failure without mock tropes", async () => {
      setTestContentClient({
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: { message: "Query failed" } }),
          }),
        }),
      });

      const genres = await getDistinctGenres();
      assert.deepEqual(genres, []);

      const tags = await getPopularTags();
      assert.deepEqual(tags, []);

      setTestContentClient(null);
    });

    test("getHeroSlides returns empty array when trending titles are empty", async () => {
      setTestContentClient({
        from: () => ({
          select: () => ({
            eq: function () {
              return this;
            },
            order: function () {
              return this;
            },
            range: function () {
              return Promise.resolve({ data: [], count: 0, error: null });
            },
          }),
        }),
      });

      const slides = await getHeroSlides();
      assert.deepEqual(slides, []);

      setTestContentClient(null);
    });
  });

  describe("Client Bundle File Invariants (No Static Mock Imports)", () => {
    const rootDir = process.cwd();

    test("SearchDropdown.tsx does not statically import titles.mock", () => {
      const code = fs.readFileSync(path.join(rootDir, "components/SearchDropdown.tsx"), "utf8");
      assert.equal(
        code.includes('from "@/data/titles.mock"'),
        false,
        "SearchDropdown must not statically import titles.mock"
      );
    });

    test("Hero.tsx does not statically import hero-slides.mock", () => {
      const code = fs.readFileSync(path.join(rootDir, "components/Hero.tsx"), "utf8");
      assert.equal(
        code.includes('from "@/data/hero-slides.mock"'),
        false,
        "Hero must not statically import hero-slides.mock"
      );
    });

    test("TopTrending.tsx does not statically import top-trending.mock", () => {
      const code = fs.readFileSync(path.join(rootDir, "components/TopTrending.tsx"), "utf8");
      assert.equal(
        code.includes('from "@/data/top-trending.mock"'),
        false,
        "TopTrending must not statically import top-trending.mock"
      );
    });

    test("NewRelease.tsx does not statically import new-release.mock", () => {
      const code = fs.readFileSync(path.join(rootDir, "components/NewRelease.tsx"), "utf8");
      assert.equal(
        code.includes('from "@/data/new-release.mock"'),
        false,
        "NewRelease must not statically import new-release.mock"
      );
    });

    test("drama/[slug]/page.tsx does not statically import mock datasets or getRelatedTitles", () => {
      const code = fs.readFileSync(path.join(rootDir, "app/drama/[slug]/page.tsx"), "utf8");
      assert.equal(
        code.includes('from "@/data/titles.mock"'),
        false,
        "drama page must not statically import titles.mock"
      );
      assert.equal(
        code.includes('from "@/data/channels.mock"'),
        false,
        "drama page must not statically import channels.mock"
      );
      assert.equal(
        code.includes('from "@/lib/getRelatedTitles"'),
        false,
        "drama page must not statically import getRelatedTitles"
      );
    });

    test("watch/[slug]/page.tsx does not statically import titles.mock", () => {
      const code = fs.readFileSync(path.join(rootDir, "app/watch/[slug]/page.tsx"), "utf8");
      assert.equal(
        code.includes('from "@/data/titles.mock"'),
        false,
        "watch page must not statically import titles.mock"
      );
    });

    test("account pages do not statically import account-user.mock", () => {
      const favCode = fs.readFileSync(path.join(rootDir, "app/account/favorite/page.tsx"), "utf8");
      assert.equal(
        favCode.includes('from "@/data/account-user.mock"'),
        false,
        "favorite page must not statically import account-user.mock"
      );

      const accCode = fs.readFileSync(path.join(rootDir, "app/account/page.tsx"), "utf8");
      assert.equal(
        accCode.includes('from "@/data/account-user.mock"'),
        false,
        "account page must not statically import account-user.mock"
      );
    });
  });
});
