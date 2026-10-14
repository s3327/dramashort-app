import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/events/route";
import {
  PLAYBACK_EVENT_TYPES,
  PLAYBACK_PLATFORMS,
  type PlaybackEventPayload,
} from "@/types/analytics";
import {
  RATE_LIMIT_POLICIES,
  sharedRateLimiter,
  resetRateLimits,
} from "@/lib/security/rate-limiter";
import {
  setTestUserServiceRoleClientFactory,
  setTestUserServerClientFactory,
} from "@/lib/supabase/user-server";

const ROOT = process.cwd();

test("Task 15.1: Database migration defines playback_events with strict RLS and indexes", () => {
  const migrationPath = path.join(
    ROOT,
    "supabase",
    "migrations",
    "20261012100500_playback_events.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration 20261008170000_playback_events.sql must exist");

  const sql = fs.readFileSync(migrationPath, "utf-8");

  // Table & columns
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.playback_events/i);
  assert.match(sql, /id\s+BIGSERIAL\s+PRIMARY\s+KEY/i);
  assert.match(sql, /occurred_at\s+TIMESTAMPTZ/i);
  assert.match(sql, /user_id\s+UUID\s+REFERENCES\s+auth\.users/i);
  assert.match(sql, /anon_id\s+UUID\s+NOT\s+NULL/i);
  assert.match(sql, /session_id\s+UUID\s+NOT\s+NULL/i);
  assert.match(sql, /title_slug\s+TEXT\s+NOT\s+NULL/i);
  assert.match(sql, /episode_number\s+INT\s+NOT\s+NULL/i);
  assert.match(sql, /event_type\s+TEXT\s+NOT\s+NULL/i);
  assert.match(sql, /platform\s+TEXT/i);
  assert.match(sql, /CHECK\s*\(platform\s+IN\s*\('web',\s*'pwa',\s*'tma'\)\)/i);
  assert.match(sql, /position_seconds\s+NUMERIC/i);
  assert.match(sql, /duration_seconds\s+NUMERIC/i);
  assert.match(sql, /utm\s+JSONB/i);
  assert.match(sql, /payload\s+JSONB/i);

  // Performance indexes
  assert.match(sql, /idx_playback_events_occurred_at/i);
  assert.match(sql, /idx_playback_events_title_ep/i);
  assert.match(sql, /idx_playback_events_user_id/i);
  assert.match(sql, /idx_playback_events_anon_id/i);
  assert.match(sql, /idx_playback_events_type_occurred/i);

  // Strict RLS & Grants
  assert.match(sql, /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i);
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+public\.playback_events\s+FROM\s+anon/i);
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+public\.playback_events\s+FROM\s+authenticated/i);
  assert.match(sql, /GRANT\s+ALL\s+ON\s+public\.playback_events\s+TO\s+service_role/i);
});

test("Task 15.1: Domain types declare playback events, platforms, and rate limit profile", () => {
  assert.ok(PLAYBACK_EVENT_TYPES.includes("episode_start"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("episode_progress_25"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("episode_progress_50"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("episode_progress_75"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("episode_complete"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("episode_skip"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("share"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("favorite_add"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("guest_prompt_shown"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("guest_prompt_cta"));
  assert.ok(PLAYBACK_EVENT_TYPES.includes("guest_prompt_dismiss"));

  assert.deepEqual(Array.from(PLAYBACK_PLATFORMS), ["web", "pwa", "tma"]);

  // Rate limit policy profile
  assert.ok(RATE_LIMIT_POLICIES.events, "Rate limiter must define events profile");
  assert.equal(RATE_LIMIT_POLICIES.events.maxRequests, 120, "Events rate limit must be 120 req/min");
  assert.equal(RATE_LIMIT_POLICIES.events.windowMs, 60000, "Events window must be 60s");
});

test("Task 15.1: POST /api/events validates payload structure, bounds, and event types", async () => {
  resetRateLimits();

  // 1. Invalid JSON
  const invalidJsonReq = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "not-json{",
  });
  const res1 = await POST(invalidJsonReq);
  assert.equal(res1.status, 400);
  const data1 = await res1.json();
  assert.equal(data1.error.code, "INVALID_JSON");

  // 2. Empty payload
  const emptyReq = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: [] }),
  });
  const res2 = await POST(emptyReq);
  assert.equal(res2.status, 400);
  const data2 = await res2.json();
  assert.equal(data2.error.code, "EMPTY_PAYLOAD");

  // 3. Batch too large (> 50 events)
  const tooManyEvents = Array.from({ length: 51 }, (_, i) => ({
    eventType: "episode_start",
    titleSlug: "test-drama",
    episodeNumber: 1,
  }));
  const largeBatchReq = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ events: tooManyEvents }),
  });
  const res3 = await POST(largeBatchReq);
  assert.equal(res3.status, 400);
  const data3 = await res3.json();
  assert.equal(data3.error.code, "BATCH_TOO_LARGE");

  // 4. Invalid eventType
  const invalidTypeReq = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: {
        eventType: "invalid_unsupported_event",
        titleSlug: "test-drama",
        episodeNumber: 1,
      },
    }),
  });
  const res4 = await POST(invalidTypeReq);
  assert.equal(res4.status, 400);
  const data4 = await res4.json();
  assert.equal(data4.error.code, "VALIDATION_ERROR");
  assert.ok(data4.error.message.includes("invalid eventType"));

  // 5. Invalid episodeNumber (< 1 or non-integer)
  const invalidEpReq = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: {
        eventType: "episode_start",
        titleSlug: "test-drama",
        episodeNumber: 0,
      },
    }),
  });
  const res5 = await POST(invalidEpReq);
  assert.equal(res5.status, 400);
  const data5 = await res5.json();
  assert.equal(data5.error.code, "VALIDATION_ERROR");
});

test("Task 15.1: POST /api/events ingests batch, sets anon_id cookie, and supports text/plain sendBeacon", async () => {
  resetRateLimits();

  let insertedRows: any[] = [];
  setTestUserServiceRoleClientFactory(() => ({
    from: (table: string) => {
      assert.equal(table, "playback_events");
      return {
        insert: (rows: any[]) => {
          insertedRows = rows;
          return Promise.resolve({ error: null });
        },
      };
    },
  }));

  setTestUserServerClientFactory(() => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  }));

  const testAnonId = "550e8400-e29b-41d4-a716-446655440000";
  const testSessionId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

  // Ingestion with sendBeacon text/plain Content-Type
  const beaconPayload = JSON.stringify({
    events: [
      {
        eventType: "episode_start",
        titleSlug: "arranged-marriage",
        episodeNumber: 1,
        anonId: testAnonId,
        sessionId: testSessionId,
        platform: "web",
        positionSeconds: 0,
        durationSeconds: 120,
        utm: { source: "telegram", campaign: "launch" },
      },
      {
        eventType: "episode_progress_50",
        titleSlug: "arranged-marriage",
        episodeNumber: 1,
        anonId: testAnonId,
        sessionId: testSessionId,
        platform: "web",
        positionSeconds: 60,
        durationSeconds: 120,
      },
    ],
  });

  const req = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "x-forwarded-for": "192.168.1.100",
    },
    body: beaconPayload,
  });

  const res = await POST(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.accepted, 2);
  assert.equal(data.data.anonId, testAnonId);

  // Rate limit headers present
  assert.ok(res.headers.get("X-RateLimit-Limit"), "Response must include X-RateLimit-Limit");
  assert.ok(res.headers.get("X-RateLimit-Remaining"), "Response must include X-RateLimit-Remaining");

  // Verify DB inserted rows
  assert.equal(insertedRows.length, 2);
  assert.equal(insertedRows[0].title_slug, "arranged-marriage");
  assert.equal(insertedRows[0].episode_number, 1);
  assert.equal(insertedRows[0].event_type, "episode_start");
  assert.equal(insertedRows[0].anon_id, testAnonId);
  assert.equal(insertedRows[0].session_id, testSessionId);
  assert.equal(insertedRows[0].user_id, null);
  assert.equal(insertedRows[0].platform, "web");
  assert.equal(insertedRows[0].utm.source, "telegram");

  // Privacy invariant: raw IP address is NEVER written to the database record
  assert.equal((insertedRows[0] as any).ip, undefined);
  assert.equal((insertedRows[0] as any).client_ip, undefined);
  assert.equal((insertedRows[0] as any).remote_ip, undefined);

  // Clean up test factories
  setTestUserServiceRoleClientFactory(null);
  setTestUserServerClientFactory(null);
});

test("Task 15.1: POST /api/events associates authenticated user ID when session exists", async () => {
  resetRateLimits();

  let insertedRows: any[] = [];
  setTestUserServiceRoleClientFactory(() => ({
    from: () => ({
      insert: (rows: any[]) => {
        insertedRows = rows;
        return Promise.resolve({ error: null });
      },
    }),
  }));

  const mockUserId = "11111111-2222-3333-4444-555555555555";
  setTestUserServerClientFactory(() => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: mockUserId } }, error: null }),
    },
  }));

  const req = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "favorite_add",
      titleSlug: "the-abandoned-rabbit",
      episodeNumber: 1,
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.accepted, 1);

  assert.equal(insertedRows.length, 1);
  assert.equal(insertedRows[0].user_id, mockUserId);
  assert.equal(insertedRows[0].event_type, "favorite_add");

  setTestUserServiceRoleClientFactory(null);
  setTestUserServerClientFactory(null);
});

test("Task 15.1: POST /api/events enforces sliding-window rate limit threshold", async () => {
  resetRateLimits();

  setTestUserServiceRoleClientFactory(() => ({
    from: () => ({
      insert: () => Promise.resolve({ error: null }),
    }),
  }));

  setTestUserServerClientFactory(() => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    },
  }));

  const testIp = "10.0.0.99";

  // Exhaust all 120 requests in the window
  for (let i = 0; i < 120; i++) {
    sharedRateLimiter.check(`ip:${testIp}`, "events");
  }

  // 121st request must trigger 429 RATE_LIMITED
  const req = new NextRequest("http://localhost:3000/api/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": testIp,
    },
    body: JSON.stringify({
      eventType: "episode_start",
      titleSlug: "rate-limited-test",
      episodeNumber: 1,
    }),
  });

  const res = await POST(req);
  assert.equal(res.status, 429);

  const data = await res.json();
  assert.equal(data.error.code, "RATE_LIMITED");
  assert.ok(res.headers.get("Retry-After"));

  setTestUserServiceRoleClientFactory(null);
  setTestUserServerClientFactory(null);
  resetRateLimits();
});
