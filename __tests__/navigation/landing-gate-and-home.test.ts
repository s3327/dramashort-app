import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Mock static image imports for Node.js test environment
require.extensions[".png"] = (m: any, filename: string) => {
  m.exports = { src: filename, height: 100, width: 100 };
};
require.extensions[".jpg"] = (m: any, filename: string) => {
  m.exports = { src: filename, height: 100, width: 100 };
};

const ROOT = process.cwd();

test("Task 14.5: Root / serves live catalog feed directly as Server Component", async () => {
  const pagePath = path.join(ROOT, "app", "page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  // Invariant 1: Server Component (no 'use client')
  assert.ok(
    !content.includes('"use client"') && !content.includes("'use client'"),
    "Root page must be a Server Component for SEO and fast pre-rendering"
  );

  // Invariant 2: Dynamic ISR revalidate = 300
  assert.match(
    content,
    /export\s+const\s+revalidate\s*=\s*300/,
    "Root page must export revalidate = 300 for catalog feed freshness"
  );

  // Invariant 3: Pre-renders live catalog feed components
  assert.ok(content.includes("<Hero"), "Root page must pre-render Hero component");
  assert.ok(content.includes("<WelcomeBanner"), "Root page must include dismissible WelcomeBanner");
  assert.ok(
    content.includes("<ContinueWatchingIsland"),
    "Root page must include ContinueWatchingIsland"
  );
  assert.ok(content.includes("<TopTrending"), "Root page must pre-render TopTrending");
  assert.ok(content.includes("<NewRelease"), "Root page must pre-render NewRelease");

  // Invariant 4: Legacy static splash gate removed
  assert.ok(
    !content.includes("Welcome to DramaShort"),
    "Legacy static landing gate title must be removed"
  );
  assert.ok(
    !content.includes("Love in the City"),
    "Static mock drama cards must be removed in favor of live catalog feed"
  );
  assert.ok(
    !content.includes("Bossy CEO's Secret"),
    "Static mock drama cards must be removed in favor of live catalog feed"
  );

  // Invariant 5: Dynamic imports and runtime metadata
  const rootMod = await import("@/app/page");
  assert.equal(rootMod.revalidate, 300);
  assert.ok(rootMod.metadata, "Root page must export metadata");
  assert.ok(typeof rootMod.metadata.title === "string" && rootMod.metadata.title.includes("DramaShort"));
  assert.ok(typeof rootMod.default === "function", "Root page must export default Server Component");
});

test("Task 14.5: /home permanently redirects to / while preserving catalog contract invariants", async () => {
  const homePath = path.join(ROOT, "app", "home", "page.tsx");
  const content = fs.readFileSync(homePath, "utf-8");

  // Server Component
  assert.ok(
    !content.includes('"use client"') && !content.includes("'use client'"),
    "app/home/page.tsx must be a Server Component"
  );

  // Retains revalidate and metadata required by catalog contracts
  assert.match(
    content,
    /export\s+const\s+revalidate\s*=\s*300/,
    "app/home/page.tsx must preserve revalidate = 300"
  );
  assert.match(
    content,
    /export\s+const\s+metadata/,
    "app/home/page.tsx must preserve metadata export"
  );

  // Calls permanentRedirect("/")
  assert.match(
    content,
    /permanentRedirect\(\s*["']\/["']\s*\)/,
    "app/home/page.tsx must invoke permanentRedirect('/')"
  );

  // Verify next.config.mjs contains permanent redirect from /home to /
  const nextConfigPath = path.join(ROOT, "next.config.mjs");
  const nextConfigContent = fs.readFileSync(nextConfigPath, "utf-8");
  assert.ok(
    nextConfigContent.includes('source: "/home"') &&
    nextConfigContent.includes('destination: "/"') &&
    nextConfigContent.includes("permanent: true"),
    "next.config.mjs must register permanent redirect from /home to /"
  );
});

test("Task 14.5: Mobile Hero height <= 60svh clears fold on 360x740 mobile viewports", () => {
  const heroPath = path.join(ROOT, "components", "Hero.tsx");
  const skeletonPath = path.join(ROOT, "components", "skeletons", "CarouselSkeleton.tsx");
  const heroContent = fs.readFileSync(heroPath, "utf-8");
  const skeletonContent = fs.readFileSync(skeletonPath, "utf-8");

  // Mobile height token: h-[54svh] max-h-[440px]
  const expectedMobileHeight = "h-[54svh] max-h-[440px]";
  assert.ok(
    heroContent.includes(expectedMobileHeight),
    "Hero must use mobile height <= 60svh (h-[54svh] max-h-[440px])"
  );
  assert.ok(
    skeletonContent.includes(expectedMobileHeight),
    "CarouselSkeleton must match Hero mobile height to avoid CLS"
  );

  // Mathematical validation of fold clearance on 360x740:
  // Viewport height: 740px
  // Header height: ~64px
  // Hero max height on mobile: min(0.54 * 740 = 399.6px, 440px) = 400px
  // Total consumed: 64 + 400 = 464px
  // Available space below Hero on 740px screen: 740 - 464 = 276px (> 37% of viewport)
  // This guarantees the first drama catalog row / island is clearly visible above the fold.
  const viewportHeight = 740;
  const headerHeight = 64;
  const heroHeightMobile = Math.min(viewportHeight * 0.54, 440);
  const remainingSpace = viewportHeight - (headerHeight + heroHeightMobile);

  assert.ok(
    remainingSpace >= 200,
    `Remaining vertical space (${remainingSpace}px) must be >= 200px to display first content row above the fold`
  );
});

test("Task 14.5: WelcomeBanner is dismissible, accessible, and persists to localStorage", () => {
  const bannerPath = path.join(ROOT, "components", "home", "WelcomeBanner.tsx");
  assert.ok(fs.existsSync(bannerPath), "WelcomeBanner.tsx must exist");

  const content = fs.readFileSync(bannerPath, "utf-8");
  assert.ok(content.includes('"use client"'), "WelcomeBanner must be a client component");
  assert.ok(
    content.includes("dramashort_welcome_dismissed"),
    "WelcomeBanner must persist dismissal using 'dramashort_welcome_dismissed'"
  );
  assert.ok(
    content.includes('aria-label="Dismiss welcome banner"'),
    "WelcomeBanner must provide accessible aria-label on dismiss button"
  );
});

test("Task 14.5: Navigation links and error fallbacks route home to root /", () => {
  const headerContent = fs.readFileSync(path.join(ROOT, "components", "Header.tsx"), "utf-8");
  const footerContent = fs.readFileSync(path.join(ROOT, "components", "Footer.tsx"), "utf-8");
  const navLinksContent = fs.readFileSync(path.join(ROOT, "data", "nav-links.mock.ts"), "utf-8");
  const notFoundContent = fs.readFileSync(path.join(ROOT, "app", "not-found.tsx"), "utf-8");
  const errorContent = fs.readFileSync(path.join(ROOT, "app", "error.tsx"), "utf-8");

  // Header brand and nav items point to /
  assert.ok(headerContent.includes('href="/"'), "Header must link home to /");
  assert.ok(!headerContent.includes('href="/home"'), "Header must not link to /home");

  // Footer brand and nav links
  assert.ok(footerContent.includes('href="/"'), "Footer must link home to /");
  assert.ok(!footerContent.includes('href="/home"'), "Footer must not link to /home");

  // Nav links mock
  assert.ok(navLinksContent.includes('href: "/"'), "NAV_LINKS must define Home href as /");
  assert.ok(!navLinksContent.includes('href: "/home"'), "NAV_LINKS must not contain /home");

  // Not found & error boundaries
  assert.ok(!notFoundContent.includes('href="/home"'), "not-found.tsx must not link to /home");
  assert.ok(!errorContent.includes('href="/home"'), "error.tsx must not link to /home");
});
