import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/support/route";
import { _resetSupportRateLimits } from "@/lib/support/rate-limiter";
import {
  setTestUserServerClientFactory,
  setTestUserServiceRoleClientFactory,
} from "@/lib/supabase/user-server";

describe("Support Contact & Report Issue Pipeline (Task 11.4)", () => {
  beforeEach(() => {
    _resetSupportRateLimits();
    setTestUserServerClientFactory(null);
    setTestUserServiceRoleClientFactory(null);
  });

  afterEach(() => {
    _resetSupportRateLimits();
    setTestUserServerClientFactory(null);
    setTestUserServiceRoleClientFactory(null);
  });

  const makeSupportRequest = (
    body: unknown,
    headers: Record<string, string> = {}
  ) => {
    return new NextRequest("http://localhost:3000/api/support", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  describe("Database Migration (20261005160000_support_tickets.sql)", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "user",
      "supabase",
      "migrations",
      "20261005160000_support_tickets.sql"
    );

    it("migration file exists in User DB migrations directory", () => {
      assert.ok(fs.existsSync(migrationPath), "Migration file must exist");
    });

    it("defines support_tickets table with required columns and constraints", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.support_tickets/i);
      assert.match(sql, /id UUID PRIMARY KEY/i);
      assert.match(sql, /user_id UUID REFERENCES auth\.users\(id\) ON DELETE SET NULL/i);
      assert.match(sql, /email TEXT NOT NULL/i);
      assert.match(sql, /category TEXT NOT NULL CHECK/i);
      assert.match(sql, /'general',\s*'playback',\s*'billing',\s*'content',\s*'account'/i);
      assert.match(sql, /subject TEXT NOT NULL/i);
      assert.match(sql, /message TEXT NOT NULL/i);
      assert.match(sql, /context JSONB NOT NULL DEFAULT/i);
      assert.match(sql, /status TEXT NOT NULL DEFAULT 'open' CHECK/i);
      assert.match(sql, /'open',\s*'in_progress',\s*'resolved'/i);
      assert.match(sql, /created_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/i);
    });

    it("configures indexes and strict service-role access control", () => {
      const sql = fs.readFileSync(migrationPath, "utf-8");
      assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id/i);
      assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_support_tickets_status/i);
      assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_support_tickets_category/i);
      assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at/i);
      assert.match(sql, /ALTER TABLE public\.support_tickets ENABLE ROW LEVEL SECURITY/i);
      assert.match(sql, /REVOKE ALL ON TABLE public\.support_tickets FROM anon, authenticated/i);
      assert.match(sql, /GRANT ALL ON TABLE public\.support_tickets TO service_role/i);
    });
  });

  describe("POST /api/support Route Handler Validations", () => {
    it("returns 400 INVALID_JSON when request body is not valid JSON", async () => {
      const req = new NextRequest("http://localhost:3000/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json-content",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "INVALID_JSON");
    });

    it("returns 400 VALIDATION_ERROR when honeypot field is filled by bot", async () => {
      const req = makeSupportRequest({
        email: "bot@example.com",
        category: "general",
        subject: "Spam proposal",
        message: "Check out this promotional link http://spam.example",
        hp: "I am a spam bot",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "VALIDATION_ERROR");
      assert.match(json.error.message, /spam/i);
    });

    it("returns 400 VALIDATION_ERROR when email is missing or invalid", async () => {
      const req = makeSupportRequest({
        email: "not-an-email",
        category: "general",
        subject: "Need help",
        message: "This is a detailed message describing my issue.",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "VALIDATION_ERROR");
      assert.equal(json.error.details.field, "email");
    });

    it("returns 400 VALIDATION_ERROR when category is invalid", async () => {
      const req = makeSupportRequest({
        email: "user@example.com",
        category: "unauthorized_category",
        subject: "Need help",
        message: "This is a detailed message describing my issue.",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "VALIDATION_ERROR");
      assert.equal(json.error.details.field, "category");
    });

    it("returns 400 VALIDATION_ERROR when subject is too short", async () => {
      const req = makeSupportRequest({
        email: "user@example.com",
        category: "playback",
        subject: "Hi",
        message: "This is a detailed message describing my issue.",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "VALIDATION_ERROR");
      assert.equal(json.error.details.field, "subject");
    });

    it("returns 400 VALIDATION_ERROR when message is too short", async () => {
      const req = makeSupportRequest({
        email: "user@example.com",
        category: "playback",
        subject: "Video broken",
        message: "Too short",
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "VALIDATION_ERROR");
      assert.equal(json.error.details.field, "message");
    });
  });

  describe("POST /api/support Persistence & Authorization", () => {
    it("successfully creates support ticket for guest with user_id = null", async () => {
      let insertedRow: any = null;

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: null,
          }),
        },
      }));

      setTestUserServiceRoleClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "support_tickets");
          return {
            insert: (payload: any) => {
              insertedRow = payload;
              return {
                select: () => ({
                  single: async () => ({
                    data: { id: "ticket-guest-1234", created_at: new Date().toISOString() },
                    error: null,
                  }),
                }),
              };
            },
          };
        },
      }));

      const req = makeSupportRequest({
        email: "Guest@Example.com",
        category: "playback",
        subject: "Playback stalled on Episode 4",
        message: "Video pauses after 12 seconds with error buffer stall.",
        context: {
          title_slug: "destined-love",
          episode_number: 4,
          url: "http://localhost:3000/watch/destined-love?ep=4",
        },
      });

      const res = await POST(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.ticketId, "ticket-guest-1234");

      assert.ok(insertedRow);
      assert.equal(insertedRow.user_id, null);
      assert.equal(insertedRow.email, "guest@example.com");
      assert.equal(insertedRow.category, "playback");
      assert.equal(insertedRow.subject, "Playback stalled on Episode 4");
      assert.equal(insertedRow.context.title_slug, "destined-love");
      assert.equal(insertedRow.context.episode_number, 4);
      assert.equal(insertedRow.status, "open");
    });

    it("successfully creates support ticket for authenticated user linking user_id", async () => {
      let insertedRow: any = null;

      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: {
              user: {
                id: "auth-user-guid-9999",
                email: "member@example.com",
              },
            },
            error: null,
          }),
        },
      }));

      setTestUserServiceRoleClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "support_tickets");
          return {
            insert: (payload: any) => {
              insertedRow = payload;
              return {
                select: () => ({
                  single: async () => ({
                    data: { id: "ticket-member-5678", created_at: new Date().toISOString() },
                    error: null,
                  }),
                }),
              };
            },
          };
        },
      }));

      const req = makeSupportRequest({
        email: "member@example.com",
        category: "billing",
        subject: "Coins not credited after purchase",
        message: "Purchased the 100 coin pack but balance is still 0 coins.",
      });

      const res = await POST(req);
      assert.equal(res.status, 201);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.ticketId, "ticket-member-5678");

      assert.ok(insertedRow);
      assert.equal(insertedRow.user_id, "auth-user-guid-9999");
      assert.equal(insertedRow.email, "member@example.com");
      assert.equal(insertedRow.category, "billing");
    });

    it("returns 500 DATABASE_ERROR when service-role insertion fails", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({
            data: { user: null },
            error: null,
          }),
        },
      }));

      setTestUserServiceRoleClientFactory(() => ({
        from: (table: string) => {
          assert.equal(table, "support_tickets");
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { message: "Internal DB connection timeout" },
                }),
              }),
            }),
          };
        },
      }));

      const req = makeSupportRequest({
        email: "user@example.com",
        category: "general",
        subject: "Cannot play video",
        message: "Playback fails consistently on all browsers.",
      });

      const res = await POST(req);
      assert.equal(res.status, 500);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, "DATABASE_ERROR");
    });
  });

  describe("Rate Limiting Enforcement", () => {
    it("enforces maximum 5 support requests per hour per IP", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      setTestUserServiceRoleClientFactory(() => ({
        from: () => ({
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "mock-id", created_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        }),
      }));

      const testIp = "192.168.10.45";

      // 1 to 5 requests should all succeed
      for (let i = 1; i <= 5; i++) {
        const req = makeSupportRequest(
          {
            email: "flood@example.com",
            category: "general",
            subject: `Ticket attempt number ${i}`,
            message: `This is a legitimate request test number ${i} with sufficient text.`,
          },
          { "x-forwarded-for": testIp }
        );

        const res = await POST(req);
        assert.equal(res.status, 201, `Request ${i} must succeed`);
      }

      // 6th request from same IP must be rejected with 429
      const blockedReq = makeSupportRequest(
        {
          email: "flood@example.com",
          category: "general",
          subject: "Ticket attempt number 6",
          message: "This 6th request should exceed the allowed rate limit threshold.",
        },
        { "x-forwarded-for": testIp }
      );

      const blockedRes = await POST(blockedReq);
      assert.equal(blockedRes.status, 429);
      assert.ok(blockedRes.headers.get("Retry-After"), "Must provide Retry-After header");
      const blockedJson = await blockedRes.json();
      assert.equal(blockedJson.success, false);
      assert.equal(blockedJson.error.code, "TOO_MANY_REQUESTS");

      // Request from a different IP still succeeds
      const differentIpReq = makeSupportRequest(
        {
          email: "different@example.com",
          category: "general",
          subject: "Ticket from another IP",
          message: "This request comes from a distinct IP and should be permitted.",
        },
        { "x-forwarded-for": "192.168.10.46" }
      );

      const differentIpRes = await POST(differentIpReq);
      assert.equal(differentIpRes.status, 201);
    });
  });

  describe("Watch Page Structured Context Wiring", () => {
    it("watch page links to /contact with structured category, title, ep and titleName", () => {
      const watchPagePath = path.join(
        process.cwd(),
        "app",
        "watch",
        "[slug]",
        "page.tsx"
      );
      const watchPageContent = fs.readFileSync(watchPagePath, "utf-8");

      assert.match(
        watchPageContent,
        /\/contact\?category=playback&title=\$\{encodeURIComponent\(\s*drama\.slug\s*\)\}&ep=\$\{currentEpisode\}&titleName=\$\{encodeURIComponent\(\s*drama\.title\s*\)\}/
      );
      assert.doesNotMatch(watchPageContent, /buildReportMessage/);
    });
  });
});
