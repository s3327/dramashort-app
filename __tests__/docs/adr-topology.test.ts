import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("ADR-0003 Database Topology & Index Registry Contracts (Task 13.1)", () => {
  const rootDir = process.cwd();
  const adr3Path = path.resolve(rootDir, "docs/adr/0003-database-topology.md");
  const adrIndexPath = path.resolve(rootDir, "docs/adr/README.md");
  const adr1Path = path.resolve(
    rootDir,
    "docs/adr/0001-account-deletion-and-data-retention.md"
  );
  const adr2Path = path.resolve(
    rootDir,
    "docs/adr/0002-notifications-system-architecture.md"
  );
  const roadmapPath = path.resolve(rootDir, "ROADMAP.md");
  const rootReadmePath = path.resolve(rootDir, "README.md");
  const futurePlanPath = path.resolve(rootDir, "FUTURE_PLAN.md");
  const servicesReadmePath = path.resolve(rootDir, "lib/services/README.md");
  const playbackServerPath = path.resolve(rootDir, "lib/server/playback.ts");

  describe("ADR-0003 Document Existence and Section Structure", () => {
    it("verifies 0003-database-topology.md exists and is non-empty", () => {
      assert.ok(fs.existsSync(adr3Path), "ADR-0003 file must exist");
      const stat = fs.statSync(adr3Path);
      assert.ok(stat.size > 2000, "ADR-0003 must be a comprehensive document (>2KB)");
    });

    it("conforms to standard ADR section headings", () => {
      const content = fs.readFileSync(adr3Path, "utf8");

      const requiredSections = [
        "# ADR-0003: Database Topology Decision",
        "## Status",
        "## Date",
        "## Context",
        "## Problem Statement",
        "## Options Considered",
        "## Comparative Trade-Off Matrix",
        "## Decision Criteria",
        "## Recommendation",
        "## Implementation Roadmap",
        "## Consequences",
      ];

      for (const section of requiredSections) {
        assert.ok(
          content.includes(section),
          `ADR-0003 must contain required section: "${section}"`
        );
      }

      assert.match(
        content,
        /## Status\s+Accepted/,
        "ADR-0003 status must be Accepted"
      );
    });

    it("identifies both current Supabase projects in Context", () => {
      const content = fs.readFileSync(adr3Path, "utf8");
      assert.ok(
        content.includes("czkkzoiuyqybafacpgsp"),
        "Must specify Content DB project ID"
      );
      assert.ok(
        content.includes("bpidsbcrvpkavvdvtpgh"),
        "Must specify User DB project ID"
      );
    });
  });

  describe("Options Considered Technical Evaluation", () => {
    it("evaluates Option A (Merge) with content and public schemas and native foreign keys", () => {
      const content = fs.readFileSync(adr3Path, "utf8");

      assert.ok(
        content.includes("Option A"),
        "Must document Option A"
      );
      assert.ok(
        content.includes("`content` schema"),
        "Option A must define content schema"
      );
      assert.ok(
        content.includes("`public` schema"),
        "Option A must define public schema"
      );
      assert.ok(
        content.includes("ON DELETE CASCADE"),
        "Option A must specify database-enforced ON DELETE CASCADE foreign keys"
      );
      assert.ok(
        content.includes("Row Level Security") || content.includes("RLS"),
        "Option A must specify native RLS entitlement policies"
      );
      assert.ok(
        content.includes("user_unlocked_episodes"),
        "Option A must specify user_unlocked_episodes relation for Phase 8"
      );
      assert.ok(
        content.includes("content.episodes") && content.includes("is_free = true"),
        "Option A RLS policy must inspect content.episodes for is_free"
      );
      assert.ok(
        content.includes("TO authenticated, anon"),
        "Option A RLS policy must permit guest and authenticated access"
      );
      assert.ok(
        content.includes("GRANT SELECT ON TABLE content.episode_media"),
        "Option A must document PostgreSQL grants prerequisite for episode_media RLS"
      );
    });

    it("evaluates Option B (Keep Split) with title_id UUID and application orchestration", () => {
      const content = fs.readFileSync(adr3Path, "utf8");

      assert.ok(
        content.includes("Option B"),
        "Must document Option B"
      );
      assert.ok(
        content.includes("title_id UUID"),
        "Option B must specify replacing slug with title_id UUID"
      );
      assert.ok(
        content.includes("lib/server/*"),
        "Option B must document server-layer orchestration"
      );
      assert.ok(
        content.includes("orphan") || content.includes("Orphan"),
        "Option B must document orphan cleanup routines / cron"
      );
      assert.ok(
        content.includes("service_role"),
        "Option B must document multi-project service-role proxying"
      );
    });
  });

  describe("Comparative Trade-Off Matrix Requirements", () => {
    it("includes all 6 required comparative evaluation dimensions", () => {
      const content = fs.readFileSync(adr3Path, "utf8");

      const requiredDimensions = [
        "Data Integrity & Referential Constraints",
        "Query Performance & Aggregations",
        "Phase 8 Monetization",
        "Operational Overhead & Financial Cost",
        "Migration Effort & Rollback Risk",
        "Multi-Tenant",
      ];

      for (const dim of requiredDimensions) {
        assert.ok(
          content.includes(dim),
          `Comparative matrix must evaluate dimension: "${dim}"`
        );
      }
    });

    it("quantifies financial costs for single vs dual Supabase Pro tiers", () => {
      const content = fs.readFileSync(adr3Path, "utf8");
      assert.ok(
        content.includes("$25"),
        "Matrix must mention single project Pro tier cost ($25/mo)"
      );
      assert.ok(
        content.includes("$50"),
        "Matrix must mention dual project Pro tier cost ($50/mo)"
      );
    });
  });

  describe("Decision Criteria & Definitive Recommendation", () => {
    it("evaluates decision criteria including headless reusability and Phase 8 velocity", () => {
      const content = fs.readFileSync(adr3Path, "utf8");
      assert.ok(
        content.includes("Business Reality") || content.includes("Headless"),
        "Decision criteria must assess real-world external consumer demand"
      );
      assert.ok(
        content.includes("Phase 8"),
        "Decision criteria must assess Phase 8 monetization gate"
      );
    });

    it("recommends and adopts Option A (Merge)", () => {
      const content = fs.readFileSync(adr3Path, "utf8");
      assert.match(
        content,
        /Recommendation[\s\S]*Option A/i,
        "Recommendation section must explicitly select Option A"
      );
    });

    it("resolves Task 10.6 video delivery provider and signed token strategy", () => {
      const content = fs.readFileSync(adr3Path, "utf8");
      assert.ok(
        content.includes("Bunny Stream") || content.includes("Cloudflare Stream"),
        "ADR-0003 must evaluate and record video provider choice (Bunny Stream / Cloudflare Stream)"
      );
      assert.ok(
        content.includes("HMAC-SHA256") || content.includes("signed playback tokens") || content.includes("token signing"),
        "ADR-0003 must document signed playback token strategy with short TTL"
      );
    });

    it("resolves Task 15.1 analytics architecture with hybrid in-database model", () => {
      const content = fs.readFileSync(adr3Path, "utf8");
      assert.ok(
        content.includes("analytics_events"),
        "ADR-0003 must specify in-database analytics_events table"
      );
      assert.ok(
        content.includes("hybrid") || content.includes("Hybrid"),
        "ADR-0003 must specify hybrid analytics architecture"
      );
      assert.ok(
        content.includes("PostHog") || content.includes("Plausible"),
        "ADR-0003 must evaluate external product analytics SaaS vs in-database storage"
      );
    });

    it("details the 6-step Implementation Roadmap for Task 13.2", () => {
      const content = fs.readFileSync(adr3Path, "utf8");
      assert.ok(
        content.includes("Task 13.2"),
        "Implementation roadmap must explicitly target Task 13.2 execution"
      );
      assert.ok(
        content.includes("pg_dump"),
        "Roadmap must describe pg_dump catalog transfer"
      );
      assert.ok(
        content.includes("title_id UUID") || content.includes("drama_id UUID"),
        "Roadmap must describe UUID foreign key migration"
      );
      assert.ok(
        content.includes("supabase/user/supabase/migrations/"),
        "Roadmap must accurately target User DB migration directory"
      );
      assert.ok(
        content.includes("types/supabase.ts"),
        "Roadmap must describe consolidated TypeScript generation"
      );
      assert.ok(
        content.includes("FUTURE_PLAN.md"),
        "Roadmap must address updating FUTURE_PLAN.md topology references"
      );
      assert.ok(
        content.includes("CREATE INDEX idx_favorites_title_id"),
        "Roadmap must specify index on favorites foreign key"
      );
      assert.ok(
        content.includes("CREATE INDEX idx_watch_history_title_id"),
        "Roadmap must specify index on watch_history foreign key"
      );
      assert.ok(
        content.includes("GRANT USAGE ON SCHEMA content"),
        "Roadmap must specify granting schema usage on content schema"
      );
      assert.ok(
        content.includes("DELETE FROM public.favorites WHERE title_id IS NULL"),
        "Roadmap must specify pre-constraint orphan cleanup"
      );
      assert.ok(
        content.includes("DROP CONSTRAINT IF EXISTS favorites_user_id_title_slug_key"),
        "Roadmap must specify dropping legacy slug unique constraints"
      );
      assert.ok(
        content.includes("DROP TRIGGER IF EXISTS trg_enforce_title_slug_immutability"),
        "Roadmap must specify retiring emergency slug immutability trigger once foreign keys exist"
      );
    });
  });

  describe("ADR Registry & Indexing (docs/adr/README.md)", () => {
    it("verifies README.md exists and is non-empty", () => {
      assert.ok(fs.existsSync(adrIndexPath), "docs/adr/README.md must exist");
      const stat = fs.statSync(adrIndexPath);
      assert.ok(stat.size > 500, "ADR README must contain substantial documentation");
    });

    it("indexes ADR-0001, ADR-0002, and ADR-0003 with status and file links", () => {
      const content = fs.readFileSync(adrIndexPath, "utf8");

      assert.ok(content.includes("ADR-0001"), "Registry must index ADR-0001");
      assert.ok(content.includes("ADR-0002"), "Registry must index ADR-0002");
      assert.ok(content.includes("ADR-0003"), "Registry must index ADR-0003");

      assert.ok(
        content.includes("0001-account-deletion-and-data-retention.md"),
        "Registry must link to ADR-0001 file"
      );
      assert.ok(
        content.includes("0002-notifications-system-architecture.md"),
        "Registry must link to ADR-0002 file"
      );
      assert.ok(
        content.includes("0003-database-topology.md"),
        "Registry must link to ADR-0003 file"
      );

      // Verify that all linked target files exist on disk
      assert.ok(fs.existsSync(adr1Path), "Target file for ADR-0001 must exist");
      assert.ok(fs.existsSync(adr2Path), "Target file for ADR-0002 must exist");
      assert.ok(fs.existsSync(adr3Path), "Target file for ADR-0003 must exist");
    });

    it("verifies zero broken markdown file links in ADR documentation", () => {
      const adrDocs = [adrIndexPath, adr1Path, adr2Path, adr3Path];
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

      for (const docPath of adrDocs) {
        const text = fs.readFileSync(docPath, "utf8");
        let match: RegExpExecArray | null;
        while ((match = linkRegex.exec(text)) !== null) {
          const target = match[2].trim();
          // Skip external URLs or pure anchors
          if (target.startsWith("http://") || target.startsWith("https://") || target.startsWith("#")) {
            continue;
          }
          const cleanTarget = target.split("#")[0];
          if (!cleanTarget) continue;
          const resolved = path.resolve(path.dirname(docPath), cleanTarget);
          assert.ok(
            fs.existsSync(resolved),
            `Broken link in ${path.basename(docPath)}: "${target}" -> "${resolved}" does not exist`
          );
        }
      }
    });

    it("outlines governance, format standards, and decision gate relationships", () => {
      const content = fs.readFileSync(adrIndexPath, "utf8");
      assert.ok(
        content.includes("Decision Gates") || content.includes("Decision Gate"),
        "Registry must document decision gates"
      );
      assert.ok(
        content.includes("Governance") || content.includes("Lifecycle"),
        "Registry must document ADR lifecycle and standards"
      );
    });
  });

  describe("ROADMAP.md Alignment & Non-Regression", () => {
    it("verifies ROADMAP.md records Task 13.1 as completed referencing ADR-0003", () => {
      const content = fs.readFileSync(roadmapPath, "utf8");

      assert.ok(
        content.includes("### Task 13.1: ADR-0003"),
        "Task 13.1 heading must reference ADR-0003"
      );
      assert.ok(
        content.includes("docs/adr/0003-database-topology.md"),
        "Task 13.1 must reference docs/adr/0003-database-topology.md"
      );
      assert.ok(
        content.includes("docs/adr/README.md"),
        "Task 13.1 must reference docs/adr/README.md"
      );
      assert.match(
        content,
        /Task 13\.1[\s\S]*?\* \*\*Status\*\*: ✅ Completed/,
        "Task 13.1 status must be marked completed"
      );
    });

    it("verifies Task 13.2 planned specifications target Option A execution path", () => {
      const content = fs.readFileSync(roadmapPath, "utf8");
      assert.match(
        content,
        /### Task 13\.2: Execute the Topology Decision[\s\S]*?Option A Execution Path/,
        "Task 13.2 specifications must target Option A per ADR-0003"
      );
      assert.ok(
        content.includes("supabase/user/supabase/migrations/"),
        "Task 13.2 must reference User DB migration path"
      );
    });

    it("verifies Task 15.1 planned specifications cite ADR-0003 hybrid analytics decision", () => {
      const content = fs.readFileSync(roadmapPath, "utf8");
      assert.ok(
        content.includes("Hybrid analytics architecture (decided in ADR-0003)"),
        "Task 15.1 must cite ADR-0003 hybrid analytics decision"
      );
    });

    it("verifies Phase 8 prerequisites reference ADR-0003 decision gate", () => {
      const content = fs.readFileSync(roadmapPath, "utf8");
      assert.ok(
        content.includes("ADR-0003 accepted (Task 13.1)"),
        "Phase 8 prerequisites must cite ADR-0003 as accepted decision gate"
      );
    });
  });

  describe("Cross-Document Architectural Alignment", () => {
    it("verifies root README.md links to ADR registry", () => {
      const content = fs.readFileSync(rootReadmePath, "utf8");
      assert.ok(
        content.includes("docs/adr/README.md"),
        "Root README.md must reference docs/adr/README.md"
      );
    });

    it("verifies FUTURE_PLAN.md §5.2 cites ADR-0003 consolidation decision", () => {
      const content = fs.readFileSync(futurePlanPath, "utf8");
      assert.ok(
        content.includes("ADR-0003"),
        "FUTURE_PLAN.md §5.2 must cite ADR-0003"
      );
      assert.ok(
        content.includes("Option A"),
        "FUTURE_PLAN.md §5.2 must cite Option A consolidation"
      );
    });

    it("verifies lib/services/README.md cites ADR-0003 consolidation decision", () => {
      const content = fs.readFileSync(servicesReadmePath, "utf8");
      assert.ok(
        content.includes("ADR-0003"),
        "lib/services/README.md must cite ADR-0003"
      );
      assert.ok(
        content.includes("content") && content.includes("public"),
        "lib/services/README.md must cite content and public schemas"
      );
    });

    it("verifies Task 8.1 schema in ROADMAP.md references content schema foreign keys", () => {
      const content = fs.readFileSync(roadmapPath, "utf8");
      assert.ok(
        content.includes("REFERENCES content.titles(id) ON DELETE CASCADE"),
        "Task 8.1 user_unlocked_episodes must reference content.titles"
      );
      assert.ok(
        content.includes("REFERENCES content.episodes(id) ON DELETE CASCADE"),
        "Task 8.1 user_unlocked_episodes must reference content.episodes"
      );
    });

    it("verifies lib/server/playback.ts cites ADR-0003 and does not cite obsolete ADR-0001", () => {
      const content = fs.readFileSync(playbackServerPath, "utf8");
      assert.ok(
        content.includes("ADR-0003"),
        "lib/server/playback.ts must cite ADR-0003 for signed delivery"
      );
      assert.ok(
        !content.includes("Architecture Note (ADR-0001):"),
        "lib/server/playback.ts must not contain obsolete ADR-0001 architecture note"
      );
    });

    it("verifies FUTURE_PLAN.md checklist and diagram reflect ADR-0003 consolidation", () => {
      const content = fs.readFileSync(futurePlanPath, "utf8");
      assert.ok(
        content.includes("ADR-0003 Option A") || content.includes("per ADR-0003"),
        "FUTURE_PLAN.md checklist and diagrams must cite ADR-0003 consolidation"
      );
    });

    it("verifies ROADMAP.md Section 22 aligns with ADR-0003 schema consolidation", () => {
      const content = fs.readFileSync(roadmapPath, "utf8");
      assert.ok(
        content.includes("ADR-0003 Alignment"),
        "ROADMAP.md section 22 must cite ADR-0003 alignment"
      );
    });
  });
});
