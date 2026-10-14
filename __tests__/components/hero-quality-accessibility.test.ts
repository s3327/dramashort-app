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

test("Task 14.6: Database migration defines banner_url, hero_tagline, and featured_rank", () => {
  const migrationPath = path.join(
    ROOT,
    "supabase",
    "migrations",
    "20261008160000_hero_banner_curation.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration file 20261008160000_hero_banner_curation.sql must exist");

  const sql = fs.readFileSync(migrationPath, "utf-8");
  assert.match(sql, /banner_url\s+TEXT/i, "Must add banner_url column");
  assert.match(sql, /hero_tagline\s+TEXT/i, "Must add hero_tagline column");
  assert.match(sql, /featured_rank\s+INT/i, "Must add featured_rank column");
  assert.match(sql, /idx_titles_featured_rank/i, "Must create partial index on featured_rank");
  assert.match(sql, /GRANT\s+SELECT\s+\(banner_url,\s*hero_tagline,\s*featured_rank\)/i, "Must grant public select on new columns");
});

test("Task 14.6: Domain types define banner and hero curation fields", () => {
  const typesPath = path.join(ROOT, "types", "content.ts");
  const content = fs.readFileSync(typesPath, "utf-8");

  assert.ok(content.includes("bannerUrl?: string | null"), "Drama must include bannerUrl");
  assert.ok(content.includes("heroTagline?: string | null"), "Drama must include heroTagline");
  assert.ok(content.includes("featuredRank?: number | null"), "Drama must include featuredRank");
  assert.ok(content.includes("posterUrl?: string"), "HeroSlide must include posterUrl");
});

test("Task 14.6: Service layer queries curated featured titles with fallback", () => {
  const servicePath = path.join(ROOT, "lib", "services", "content.service.ts");
  const catalogPath = path.join(ROOT, "lib", "server", "catalog.ts");
  const serviceContent = fs.readFileSync(servicePath, "utf-8");
  const catalogContent = fs.readFileSync(catalogPath, "utf-8");

  // Content service
  assert.ok(serviceContent.includes("featured_rank"), "content.service.ts must query or sort by featured_rank");
  assert.ok(serviceContent.includes("bannerUrl: t.bannerUrl || null"), "content.service.ts must map bannerUrl to slide");
  assert.ok(serviceContent.includes("posterUrl: t.poster"), "content.service.ts must map posterUrl to slide");

  // Server catalog
  assert.ok(catalogContent.includes("featured_rank"), "catalog.ts must query or sort by featured_rank");
  assert.ok(catalogContent.includes("bannerUrl: d.bannerUrl || null"), "catalog.ts must map bannerUrl to slide");
  assert.ok(catalogContent.includes("posterUrl: d.poster"), "catalog.ts must map posterUrl to slide");
});

test("Task 14.6: Hero component enforces single <h1> and slide <h2> heading hierarchy", () => {
  const heroPath = path.join(ROOT, "components", "Hero.tsx");
  const content = fs.readFileSync(heroPath, "utf-8");

  // Canonical page/section heading is single sr-only h1
  assert.ok(
    content.includes('<h1 className="sr-only">Featured Dramas</h1>'),
    "Hero must provide single canonical <h1 className='sr-only'> for WCAG 2.1 AA compliance"
  );

  // Individual slides must be h2 elements
  assert.ok(
    content.includes("<h2 className=") &&
    content.includes("{slide.title}") &&
    content.includes("</h2>"),
    "Slide titles must be <h2> headings to avoid multiple h1s in the document"
  );
  assert.ok(
    !content.includes("<h1 className=") ||
    content.indexOf("<h1 className=") === content.lastIndexOf("<h1 className="),
    "There must only be exactly one h1 declaration in Hero.tsx"
  );
});

test("Task 14.6: Hero component implements comprehensive carousel ARIA semantics & live regions", () => {
  const heroPath = path.join(ROOT, "components", "Hero.tsx");
  const content = fs.readFileSync(heroPath, "utf-8");

  // Carousel region
  assert.ok(content.includes('role="region"'), "Hero section must declare role='region'");
  assert.ok(
    content.includes('aria-roledescription="carousel"'),
    "Hero section must declare aria-roledescription='carousel'"
  );
  assert.ok(
    content.includes('aria-label="Featured Dramas"'),
    "Hero section must declare aria-label='Featured Dramas'"
  );

  // Slide items
  assert.ok(content.includes('role="group"'), "Each slide item must declare role='group'");
  assert.ok(
    content.includes('aria-roledescription="slide"'),
    "Each slide item must declare aria-roledescription='slide'"
  );
  assert.ok(
    content.includes("Slide ${index + 1} of ${total}:"),
    "Each slide item must declare dynamic aria-label containing slide number and total"
  );

  // Polite live region
  assert.ok(
    content.includes('aria-live="polite"') && content.includes('aria-atomic="true"'),
    "Hero must include polite live region for screen-reader announcements"
  );

  // Accessible navigation controls
  assert.ok(
    content.includes('aria-label="Previous slide"'),
    "Hero must provide accessible Previous slide control"
  );
  assert.ok(
    content.includes('aria-label="Next slide"'),
    "Hero must provide accessible Next slide control"
  );
});

test("Task 14.6: Hero component supports hover/focus pause, prefers-reduced-motion, and manual pause", () => {
  const heroPath = path.join(ROOT, "components", "Hero.tsx");
  const content = fs.readFileSync(heroPath, "utf-8");

  // Hover and focus listeners
  assert.ok(content.includes("onMouseEnter"), "Hero section must attach onMouseEnter");
  assert.ok(content.includes("onMouseLeave"), "Hero section must attach onMouseLeave");
  assert.ok(content.includes("onFocus"), "Hero section must attach onFocus");
  assert.ok(content.includes("onBlur"), "Hero section must attach onBlur");

  // Reduced motion support
  assert.ok(
    content.includes("(prefers-reduced-motion: reduce)"),
    "Hero must query and subscribe to prefers-reduced-motion"
  );

  // Manual rotation pause button for WCAG 2.2.2 (Pause, Stop, Hide)
  assert.ok(
    content.includes("Pause slide rotation") && content.includes("Resume slide rotation"),
    "Hero must provide manual pause/resume rotation button"
  );

  // Keyboard navigation
  assert.ok(content.includes('ArrowLeft') && content.includes('ArrowRight'), "Hero must support ArrowLeft/ArrowRight keyboard navigation");
});

test("Task 14.6: Hero component renders dual presentation (sharp banner vs. ambient blur + desktop card)", () => {
  const heroPath = path.join(ROOT, "components", "Hero.tsx");
  const content = fs.readFileSync(heroPath, "utf-8");

  // Checks banner presence
  assert.ok(content.includes("hasBanner = Boolean(slide.bannerUrl)"), "Hero must check slide.bannerUrl presence");

  // Blurred atmospheric backdrop for portrait fallback
  assert.ok(
    content.includes("blur-2xl") && content.includes("brightness-40"),
    "Hero must apply cinematic background blur for portrait fallbacks"
  );

  // Sharp desktop card beside text when banner is absent
  assert.ok(
    content.includes("hidden md:block") && content.includes("aspect-[2/3]"),
    "Hero must render sharp 2:3 desktop card beside text when widescreen banner is absent"
  );
});
