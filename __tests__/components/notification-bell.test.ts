import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import NotificationBell, {
  isNotificationsFeatureEnabled,
} from "@/components/NotificationBell";
import HeaderActions from "@/components/header/HeaderActions";

describe("Notifications Feature Flag & Concealment (Task 11.7)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS;
    }
  });

  describe("Feature Flag Evaluation", () => {
    it("evaluates to false when NEXT_PUBLIC_FEATURE_NOTIFICATIONS is unset", () => {
      delete process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS;
      assert.equal(isNotificationsFeatureEnabled(), false);
    });

    it("evaluates to false when NEXT_PUBLIC_FEATURE_NOTIFICATIONS is 'false' or random string", () => {
      process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS = "false";
      assert.equal(isNotificationsFeatureEnabled(), false);

      process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS = "0";
      assert.equal(isNotificationsFeatureEnabled(), false);

      process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS = "off";
      assert.equal(isNotificationsFeatureEnabled(), false);
    });

    it("evaluates to true only when NEXT_PUBLIC_FEATURE_NOTIFICATIONS is strictly 'true'", () => {
      process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS = "true";
      assert.equal(isNotificationsFeatureEnabled(), true);
    });
  });

  describe("Component & Header Wiring Contracts", () => {
    it("verifies HeaderActions guards NotificationBell behind isNotificationsEnabled and isLoggedIn", () => {
      const headerPath = path.resolve(
        process.cwd(),
        "components/header/HeaderActions.tsx"
      );
      const content = fs.readFileSync(headerPath, "utf8");

      assert.ok(
        content.includes("isNotificationsFeatureEnabled"),
        "HeaderActions must import and check isNotificationsFeatureEnabled"
      );
      assert.ok(
        content.includes("isNotificationsEnabled && isLoggedIn && <NotificationBell"),
        "HeaderActions must conditionally render NotificationBell only when enabled and logged in"
      );
    });

    it("verifies NotificationBell exports feature flag checker and checks isEnabled before rendering", () => {
      const bellPath = path.resolve(
        process.cwd(),
        "components/NotificationBell.tsx"
      );
      const content = fs.readFileSync(bellPath, "utf8");

      assert.ok(
        content.includes("export function isNotificationsFeatureEnabled"),
        "NotificationBell must export isNotificationsFeatureEnabled"
      );
      assert.ok(
        content.includes("if (!isEnabled)"),
        "NotificationBell must check if (!isEnabled) and return null"
      );
    });
  });

  describe("Bundle Hygiene & Mock Data Decoupling", () => {
    it("ensures NotificationBell does NOT statically import mock data at top level", () => {
      const bellPath = path.resolve(
        process.cwd(),
        "components/NotificationBell.tsx"
      );
      const content = fs.readFileSync(bellPath, "utf8");

      // Verify no top-level static value import of notificationItems
      assert.ok(
        !content.includes('import { notificationItems'),
        "NotificationBell must not statically import notificationItems"
      );
      // Verify dynamic import is used instead
      assert.ok(
        content.includes('import("@/data/notifications.mock")'),
        "NotificationBell must dynamically import notifications.mock only when enabled"
      );
    });

    it("verifies ADR-0002 documents target schema and Telegram notification integration", () => {
      const adrPath = path.resolve(
        process.cwd(),
        "docs/adr/0002-notifications-system-architecture.md"
      );
      assert.ok(fs.existsSync(adrPath), "ADR-0002 must exist in docs/adr/");

      const content = fs.readFileSync(adrPath, "utf8");
      assert.ok(
        content.includes("CREATE TABLE public.notifications"),
        "ADR-0002 must document public.notifications table schema"
      );
      assert.ok(
        content.includes("new_episode"),
        "ADR-0002 must document new_episode notification type"
      );
      assert.ok(
        content.includes("Telegram Delivery Bridge"),
        "ADR-0002 must document Telegram bot delivery coordination"
      );
    });
  });
});
