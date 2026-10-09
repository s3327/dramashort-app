import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { SHORTCUT_CATEGORIES } from "@/components/player/KeyboardShortcutsModal";

const PROJECT_ROOT = process.cwd();

test("Task 17.4: Documentation Integrity & Alignment", async (t) => {
  await t.test("R1. README.md Platform Architecture & Route Alignment", () => {
    const readmePath = path.join(PROJECT_ROOT, "README.md");
    assert.ok(fs.existsSync(readmePath), "README.md must exist at project root");
    const content = fs.readFileSync(readmePath, "utf-8");

    // No longer claims mock file is single source of truth in production
    assert.ok(
      !content.includes("Single source of truth in [`data/titles.mock.ts`]"),
      "README.md must NOT claim mock files are the single source of truth for production"
    );

    // Confirms Supabase PostgreSQL is documented as primary source of truth
    assert.ok(
      content.includes("Supabase PostgreSQL"),
      "README.md must specify Supabase PostgreSQL as primary database"
    );

    // Strict no-mock production standard documented
    assert.ok(
      content.includes("No-Mock Production Standard") || content.includes("no-mock rule"),
      "README.md must document the strict no-mock production standard"
    );

    // Standardized admin nomenclature and routes
    assert.ok(
      content.includes("/admin/dramas"),
      "README.md must document /admin/dramas route"
    );
    assert.ok(
      content.includes("/admin/support"),
      "README.md must document /admin/support customer support inbox"
    );
    assert.ok(
      content.includes("/admin/audit"),
      "README.md must document /admin/audit administrative log"
    );
    assert.ok(
      content.includes("/admin/import"),
      "README.md must document /admin/import bulk pipeline"
    );
    assert.ok(
      content.includes("/account/wallet"),
      "README.md must document /account/wallet coin economy"
    );

    // Known Stubs & Future Roadmap documented
    assert.ok(
      content.includes("Known Stubs & Future Roadmap") || content.includes("Known Stubs"),
      "README.md must contain a Known Stubs section"
    );
    assert.ok(
      content.includes("FUTURE_PLAN.md"),
      "README.md must reference FUTURE_PLAN.md for Telegram ecosystem features"
    );
  });

  await t.test("R2. Service Layer Documentation & No-Mock Policy", () => {
    const serviceReadmePath = path.join(PROJECT_ROOT, "lib/services/README.md");
    assert.ok(fs.existsSync(serviceReadmePath), "lib/services/README.md must exist");
    const content = fs.readFileSync(serviceReadmePath, "utf-8");

    // Must document Task 12.4 No-Mock Rule
    assert.ok(
      content.includes("No-Mock Production Rule") || content.includes("No Mock Data in Production"),
      "lib/services/README.md must explicitly document Task 12.4 no-mock rule"
    );
    assert.ok(
      content.includes("NODE_ENV === \"production\""),
      "lib/services/README.md must specify NODE_ENV production check"
    );

    // Must document Service Layer Split (Task 13.4)
    assert.ok(
      content.includes("lib/server/"),
      "lib/services/README.md must document lib/server/"
    );
    assert.ok(
      content.includes("lib/client/"),
      "lib/services/README.md must document lib/client/"
    );
    assert.ok(
      content.includes("lib/services/"),
      "lib/services/README.md must document lib/services/"
    );
    assert.ok(
      content.includes("Result<T") || content.includes("Result"),
      "lib/services/README.md must reference standardized Result pattern"
    );
    assert.ok(
      content.includes("import 'server-only'") || content.includes("server-only"),
      "lib/services/README.md must highlight server-only enforcement"
    );
  });

  await t.test("R3. Elimination of Non-Existent Component References", () => {
    // components/WatchVideo.tsx must not exist
    const nonExistentComponent = path.join(PROJECT_ROOT, "components/WatchVideo.tsx");
    assert.strictEqual(
      fs.existsSync(nonExistentComponent),
      false,
      "components/WatchVideo.tsx must not exist on disk"
    );

    // True player components must exist
    const playerComponent = path.join(PROJECT_ROOT, "components/VideoPlayer.tsx");
    assert.ok(fs.existsSync(playerComponent), "components/VideoPlayer.tsx must exist");

    const watchIslandComponent = path.join(PROJECT_ROOT, "components/watch/WatchPlayerIsland.tsx");
    assert.ok(fs.existsSync(watchIslandComponent), "components/watch/WatchPlayerIsland.tsx must exist");

    const hudComponent = path.join(PROJECT_ROOT, "components/player/PlayerHud.tsx");
    assert.ok(fs.existsSync(hudComponent), "components/player/PlayerHud.tsx must exist");

    const shortcutsModalComponent = path.join(PROJECT_ROOT, "components/player/KeyboardShortcutsModal.tsx");
    assert.ok(fs.existsSync(shortcutsModalComponent), "components/player/KeyboardShortcutsModal.tsx must exist");
  });

  await t.test("R4. ADR Registry Index & File Existence", () => {
    const adrReadmePath = path.join(PROJECT_ROOT, "docs/adr/README.md");
    assert.ok(fs.existsSync(adrReadmePath), "docs/adr/README.md must exist");
    const content = fs.readFileSync(adrReadmePath, "utf-8");

    // All 3 ADRs must be indexed
    assert.ok(content.includes("ADR-0001"), "ADR registry must index ADR-0001");
    assert.ok(content.includes("ADR-0002"), "ADR registry must index ADR-0002");
    assert.ok(content.includes("ADR-0003"), "ADR registry must index ADR-0003");

    // All referenced ADR files must exist on disk
    const adrFiles = [
      "0001-account-deletion-and-data-retention.md",
      "0002-notifications-system-architecture.md",
      "0003-database-topology.md",
    ];

    for (const file of adrFiles) {
      const fullPath = path.join(PROJECT_ROOT, "docs/adr", file);
      assert.ok(
        fs.existsSync(fullPath),
        `Referenced ADR file ${file} must exist on disk`
      );
      assert.ok(
        content.includes(file),
        `ADR index must contain link to ${file}`
      );
    }
  });

  await t.test("R5. Keyboard Shortcuts Contract Alignment", () => {
    // Confirm SHORTCUT_CATEGORIES exports valid desktop shortcuts
    assert.ok(Array.isArray(SHORTCUT_CATEGORIES), "SHORTCUT_CATEGORIES must be an array");
    assert.ok(SHORTCUT_CATEGORIES.length >= 3, "Must have at least 3 categories");

    const allShortcuts = SHORTCUT_CATEGORIES.flatMap((c) => c.shortcuts);
    const keyPairs = allShortcuts.map((s) => s.keys.join("+"));

    // Verify critical short-drama hotkeys are defined
    assert.ok(keyPairs.some((k) => k.includes("Space")), "Must support Space play/pause");
    assert.ok(keyPairs.some((k) => k.includes("↓") || k.includes("N")), "Must support Down/N next episode");
    assert.ok(keyPairs.some((k) => k.includes("↑") || k.includes("P")), "Must support Up/P prev episode");
    assert.ok(keyPairs.some((k) => k.includes("Shift+↑")), "Must support Shift+Up volume up");
    assert.ok(keyPairs.some((k) => k.includes("Shift+↓")), "Must support Shift+Down volume down");
    assert.ok(keyPairs.some((k) => k.includes("M")), "Must support M audio mute");
    assert.ok(keyPairs.some((k) => k.includes("F")), "Must support F fullscreen");
    assert.ok(keyPairs.some((k) => k.includes("C")), "Must support C subtitles");
    assert.ok(keyPairs.some((k) => k.includes("?")), "Must support ? help cheat-sheet");
  });
});
