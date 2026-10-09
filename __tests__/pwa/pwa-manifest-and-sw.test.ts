import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import manifestGenerator from "@/app/manifest";
import { PWA_DISMISSED_STORAGE_KEY } from "@/components/pwa/InstallPromptBanner";

describe("Task 9.1: Progressive Web App (PWA) Manifest & Service Worker", () => {
  describe("1. Web App Manifest Verification", () => {
    it("generates valid Next.js typed manifest with standalone display and portrait lock", () => {
      const manifest = manifestGenerator();

      assert.equal(manifest.name, "DramaShort — Vertical dramas, daily");
      assert.equal(manifest.short_name, "DramaShort");
      assert.equal(manifest.display, "standalone");
      assert.equal(manifest.orientation, "portrait");
      assert.equal(manifest.start_url, "/");
      assert.equal(manifest.theme_color, "#0a0a0c");
      assert.equal(manifest.background_color, "#0a0a0c");

      // Verify icons
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2);
      const hasAnyPurpose = manifest.icons.some((i) => i.purpose === "any");
      const hasMaskablePurpose = manifest.icons.some((i) => i.purpose === "maskable");
      assert.equal(hasAnyPurpose, true, "Manifest must include 'any' purpose icons");
      assert.equal(hasMaskablePurpose, true, "Manifest must include 'maskable' purpose icons");
    });

    it("verifies public/manifest.json matches manifest specifications", () => {
      const manifestJsonPath = path.join(process.cwd(), "public/manifest.json");
      assert.ok(fs.existsSync(manifestJsonPath), "public/manifest.json must exist");

      const raw = fs.readFileSync(manifestJsonPath, "utf-8");
      const parsed = JSON.parse(raw);

      assert.equal(parsed.name, "DramaShort — Vertical dramas, daily");
      assert.equal(parsed.short_name, "DramaShort");
      assert.equal(parsed.display, "standalone");
      assert.equal(parsed.orientation, "portrait");
      assert.equal(parsed.theme_color, "#0a0a0c");
      assert.equal(parsed.background_color, "#0a0a0c");
    });

    it("verifies brand icons referenced in manifest exist on disk", () => {
      const manifest = manifestGenerator();
      for (const icon of manifest.icons || []) {
        const filePath = path.join(process.cwd(), "public", icon.src.replace(/^\//, ""));
        assert.ok(
          fs.existsSync(filePath),
          `Referenced icon must exist on disk: ${icon.src} -> ${filePath}`
        );
      }
    });
  });

  describe("2. Service Worker Architecture & Exclusion Rules (public/sw.js)", () => {
    const swPath = path.join(process.cwd(), "public/sw.js");

    it("verifies public/sw.js exists and configures core lifecycle events", () => {
      assert.ok(fs.existsSync(swPath), "public/sw.js must exist");
      const content = fs.readFileSync(swPath, "utf-8");

      assert.ok(content.includes('self.addEventListener("install"'), "Must handle install event");
      assert.ok(content.includes('self.addEventListener("activate"'), "Must handle activate event");
      assert.ok(content.includes('self.addEventListener("fetch"'), "Must handle fetch event");
      assert.ok(content.includes("skipWaiting"), "Must call skipWaiting for seamless updates");
      assert.ok(content.includes("clients.claim"), "Must call clients.claim for active tabs");
    });

    it("strictly excludes streaming video chunks and manifests from caching", () => {
      const content = fs.readFileSync(swPath, "utf-8");

      // Must explicitly check video streaming extensions
      assert.ok(
        content.includes(".m3u8"),
        "Must exclude HLS master and media playlists (.m3u8)"
      );
      assert.ok(
        content.includes(".ts"),
        "Must exclude HLS transport stream video segments (.ts)"
      );
      assert.ok(
        content.includes(".mp4"),
        "Must exclude MP4 media files (.mp4)"
      );
      assert.ok(
        content.includes("/api/playback/"),
        "Must exclude signed playback API endpoints"
      );
    });

    it("strictly excludes authenticated user, admin, payments, and auth endpoints", () => {
      const content = fs.readFileSync(swPath, "utf-8");

      assert.ok(
        content.includes("/api/user/"),
        "Must exclude /api/user/* from service worker disk cache"
      );
      assert.ok(
        content.includes("/api/admin/"),
        "Must exclude /api/admin/* from service worker disk cache"
      );
      assert.ok(
        content.includes("/api/payments/"),
        "Must exclude /api/payments/* from service worker disk cache"
      );
      assert.ok(
        content.includes("/auth/"),
        "Must exclude auth callbacks and confirmation routes"
      );
    });

    it("employs cache-first strategy for static assets and network-first for navigation", () => {
      const content = fs.readFileSync(swPath, "utf-8");

      assert.ok(
        content.includes("/_next/static/"),
        "Must cache-first Next.js immutable static assets"
      );
      assert.ok(
        content.includes("request.mode === \"navigate\""),
        "Must handle page navigation with network-first and cache fallback"
      );
    });
  });

  describe("3. In-App Install Prompt Banner & Lifecycle Contracts", () => {
    it("exports constant storage key for 14-day dismissal window", () => {
      assert.equal(PWA_DISMISSED_STORAGE_KEY, "dramashort_pwa_dismissed_until");
    });

    it("verifies InstallPromptBanner component structure and dismissal logic", () => {
      const bannerPath = path.join(
        process.cwd(),
        "components/pwa/InstallPromptBanner.tsx"
      );
      assert.ok(fs.existsSync(bannerPath), "InstallPromptBanner.tsx must exist");
      const content = fs.readFileSync(bannerPath, "utf-8");

      assert.ok(content.includes("beforeinstallprompt"), "Must listen to beforeinstallprompt");
      assert.ok(content.includes("display-mode: standalone"), "Must detect standalone display mode");
      assert.ok(
        content.includes("PWA_DISMISSED_STORAGE_KEY"),
        "Must read and write dismissal key in localStorage"
      );
      assert.ok(content.includes("prompt()"), "Must call prompt() on user action");
    });

    it("verifies PwaRegister component safely guards service worker registration", () => {
      const pwaRegisterPath = path.join(
        process.cwd(),
        "components/pwa/PwaRegister.tsx"
      );
      assert.ok(fs.existsSync(pwaRegisterPath), "PwaRegister.tsx must exist");
      const content = fs.readFileSync(pwaRegisterPath, "utf-8");

      assert.ok(
        content.includes('"serviceWorker" in navigator') || content.includes("'serviceWorker' in navigator"),
        "Must check browser support for serviceWorker"
      );
      assert.ok(
        content.includes('.register("/sw.js")') || content.includes(".register('/sw.js')"),
        "Must register /sw.js"
      );
    });
  });

  describe("4. Layout Integration & Architectural Boundaries", () => {
    it("ensures zero server-only imports in PWA client components", () => {
      const pwaFiles = [
        path.join(process.cwd(), "components/pwa/InstallPromptBanner.tsx"),
        path.join(process.cwd(), "components/pwa/PwaRegister.tsx"),
      ];

      for (const filePath of pwaFiles) {
        assert.ok(fs.existsSync(filePath), `File exists: ${filePath}`);
        const content = fs.readFileSync(filePath, "utf-8");

        assert.ok(
          !content.includes("@/lib/server/"),
          `Forbidden server import in ${path.basename(filePath)}`
        );
        assert.ok(
          !content.includes("from \"../server/"),
          `Forbidden relative server import in ${path.basename(filePath)}`
        );
      }
    });

    it("verifies app/layout.tsx configures manifest and renders PWA components", () => {
      const layoutPath = path.join(process.cwd(), "app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");

      assert.ok(
        content.includes("manifest: \"/manifest.json\"") ||
          content.includes("manifest:"),
        "app/layout.tsx must configure manifest in metadata"
      );
      assert.ok(
        content.includes("appleWebApp:"),
        "app/layout.tsx must configure appleWebApp in metadata"
      );
      assert.ok(
        content.includes("<InstallPromptBanner"),
        "app/layout.tsx must render InstallPromptBanner"
      );
      assert.ok(
        content.includes("<PwaRegister"),
        "app/layout.tsx must render PwaRegister"
      );
    });
  });
});
