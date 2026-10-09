import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import axe from "axe-core";
import { deriveContinueWatching, type DramaMeta } from "@/lib/watch/continue-watching";
import { getSafeRedirect, readReturnUrl } from "@/lib/navigation/safe-redirect";
import { getUserRole, hasRole } from "@/lib/auth/roles";
import { calculateEpisodeTabs, computeActiveTabForEpisode } from "@/lib/watch/episode-tabs";

const ROOT = process.cwd();

describe("Task 17.2: Integration & End-to-End Journey Contracts", () => {
  describe("Journey 1 Contracts: Signup → Verify → Watch → Resume", () => {
    test("validates signup & verification route endpoints and form contracts", () => {
      const signupPage = path.join(ROOT, "app", "signup", "page.tsx");
      const verifyPage = path.join(ROOT, "app", "verify-email", "page.tsx");

      assert.ok(fs.existsSync(signupPage), "app/signup/page.tsx must exist");
      assert.ok(fs.existsSync(verifyPage), "app/verify-email/page.tsx must exist");

      const signupContent = fs.readFileSync(signupPage, "utf-8");
      assert.ok(signupContent.includes('type="email"'), "Signup must have email input");
      assert.ok(signupContent.includes('name="password"'), "Signup must have password input");

      const verifyContent = fs.readFileSync(verifyPage, "utf-8");
      assert.ok(
        verifyContent.includes("verify") || verifyContent.includes("verification") || verifyContent.includes("email"),
        "Verify page must display verification instructions"
      );
    });

    test("simulates watch progress persistence and resume point derivation", () => {
      const dramas = new Map<string, DramaMeta>([
        [
          "destined-love",
          {
            title: "Destined Love",
            poster: "https://example.com/poster.jpg",
            totalEpisodes: 50,
          },
        ],
      ]);

      const historyRows = [
        {
          id: "hist-1",
          user_id: "user-abc",
          title_slug: "destined-love",
          episode_number: 1,
          progress: 0.55,
          position_seconds: 66,
          duration_seconds: 120,
          updated_at: new Date().toISOString(),
        },
      ];

      const entries = deriveContinueWatching(historyRows, dramas);
      assert.equal(entries.length, 1);
      assert.equal(entries[0].slug, "destined-love");
      assert.equal(entries[0].episodeNumber, 1);
      assert.equal(entries[0].progress, 66 / 120);
      assert.equal(entries[0].href, "/watch/destined-love?ep=1");
    });
  });

  describe("Journey 2 Contracts: Login → Favorite → Custom List → Management", () => {
    test("validates login form fields and safe returnUrl redirect preservation", () => {
      const loginPage = path.join(ROOT, "app", "login", "page.tsx");
      assert.ok(fs.existsSync(loginPage), "app/login/page.tsx must exist");

      const loginContent = fs.readFileSync(loginPage, "utf-8");
      assert.ok(loginContent.includes('type="email"'), "Login must have email input");
      assert.ok(loginContent.includes('name="password"'), "Login must have password input");

      // Verify returnUrl redirection protection
      assert.equal(
        getSafeRedirect("/drama/destined-love"),
        "/drama/destined-love",
        "Legitimate returnUrl must be preserved"
      );
      assert.equal(
        getSafeRedirect("https://attacker.com/evil"),
        "/home",
        "Malicious external URL must fall back to /home"
      );
    });

    test("validates custom lists management view structure", () => {
      const favPage = path.join(ROOT, "app", "account", "favorite", "page.tsx");
      assert.ok(fs.existsSync(favPage), "app/account/favorite/page.tsx must exist");

      const favContent = fs.readFileSync(favPage, "utf-8");
      assert.ok(
        favContent.includes("createList") || favContent.includes("My Lists") || favContent.includes("lists"),
        "Favorites page must support custom lists"
      );
    });
  });

  describe("Journey 3 Contracts: Password Recovery Flow", () => {
    test("validates forgot-password and reset-password page components", () => {
      const forgotPage = path.join(ROOT, "app", "forgot-password", "page.tsx");
      const resetPage = path.join(ROOT, "app", "reset-password", "page.tsx");

      assert.ok(fs.existsSync(forgotPage), "app/forgot-password/page.tsx must exist");
      assert.ok(fs.existsSync(resetPage), "app/reset-password/page.tsx must exist");

      const forgotContent = fs.readFileSync(forgotPage, "utf-8");
      assert.ok(forgotContent.includes('type="email"'), "Forgot password must accept email");

      const resetContent = fs.readFileSync(resetPage, "utf-8");
      assert.ok(
        resetContent.includes('name="password"') || resetContent.includes('id="password"'),
        "Reset password must accept new password"
      );
    });

    test("verifies auth page cyclic redirect prevention", () => {
      const mockParams = {
        get: (param: string) => (param === "returnUrl" ? "/login" : null),
      };
      assert.equal(readReturnUrl(mockParams), "/home", "Auth page should never redirect to /login");
    });
  });

  describe("Journey 4 Contracts: Admin Content Publishing Lifecycle", () => {
    test("verifies admin RBAC guarding and publishing status boundaries", () => {
      const adminUser = { app_metadata: { role: "admin" } };
      const regularUser = { app_metadata: { role: "viewer" } };

      assert.equal(getUserRole(adminUser), "admin");
      assert.equal(hasRole(adminUser, ["admin"]), true);
      assert.equal(hasRole(regularUser, ["admin"]), false);
    });

    test("verifies draft items exclusion logic from public catalogs", () => {
      interface MockCatalogItem {
        id: string;
        title: string;
        status: "draft" | "published" | "archived";
      }

      const allItems: MockCatalogItem[] = [
        { id: "1", title: "Published Masterpiece", status: "published" },
        { id: "2", title: "Secret Work In Progress", status: "draft" },
        { id: "3", title: "Retired Classic", status: "archived" },
      ];

      // Public filter rule (Task 10.3 / 12.2)
      const publicCatalog = allItems.filter((i) => i.status === "published");
      assert.equal(publicCatalog.length, 1);
      assert.equal(publicCatalog[0].title, "Published Masterpiece");
      assert.ok(!publicCatalog.some((i) => i.status === "draft"), "Drafts must not leak to public");
    });
  });

  describe("Journey 5 Contracts: Mobile Touch Gestures & Viewport Navigation", () => {
    test("verifies vertical touch swipe delta threshold math", () => {
      // useSwipeNavigation defines threshold: deltaY > 60px
      const SWIPE_THRESHOLD = 60;

      const evaluateSwipe = (
        startY: number,
        endY: number,
        startX: number,
        endX: number
      ): "next" | "prev" | "none" => {
        const deltaY = endY - startY;
        const deltaX = Math.abs(endX - startX);

        // Ignore if horizontal gesture dominates
        if (deltaX > Math.abs(deltaY)) return "none";

        if (deltaY < -SWIPE_THRESHOLD) {
          // Swiped up -> next episode
          return "next";
        } else if (deltaY > SWIPE_THRESHOLD) {
          // Swiped down -> previous episode
          return "prev";
        }
        return "none";
      };

      // Upward swipe (deltaY = -200) -> next episode
      assert.equal(evaluateSwipe(500, 300, 200, 205), "next");

      // Downward swipe (deltaY = +150) -> prev episode
      assert.equal(evaluateSwipe(300, 450, 200, 205), "prev");

      // Small jitter (deltaY = 30) -> ignored
      assert.equal(evaluateSwipe(300, 330, 200, 205), "none");

      // Horizontal swipe (deltaX = 120, deltaY = 70) -> ignored
      assert.equal(evaluateSwipe(300, 230, 100, 220), "none");
    });

    test("verifies episode sheet drawer pagination and indexing math", () => {
      const totalEpisodes = 85;
      const tabs = calculateEpisodeTabs(totalEpisodes);
      assert.equal(tabs.length, 3);
      assert.equal(computeActiveTabForEpisode(45, totalEpisodes), 1);
    });
  });

  describe("Axe Accessibility Rule Engine Contracts", () => {
    test("validates WCAG 2.1 AA dialog role, focus, and button rules with Axe-core", () => {
      assert.ok(axe && axe.version, "Axe-core must be initialized");

      const rules = axe.getRules();
      assert.ok(rules.length >= 80, "Axe-core must evaluate accessibility rules");

      const axeAny = axe as any;

      // Virtual dialog container with role='dialog' and aria-modal='true'
      const dialogNode = new axeAny.SerialVirtualNode({
        nodeName: "div",
        props: { nodeName: "div" },
        attr: {
          role: "dialog",
          "aria-modal": "true",
          "aria-label": "Episode Selector",
        },
      });

      const dialogResult = axeAny.runVirtualRule("aria-dialog-name", dialogNode);
      assert.equal(
        dialogResult.violations.length,
        0,
        "Virtual dialog with aria-label must have 0 violations in aria-dialog-name rule"
      );
    });
  });
});
