import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

import {
  logger,
  formatLogEntry,
  generateRequestId,
  subscribeToLogs,
  type StructuredLogEntry,
} from "@/lib/observability/logger";
import {
  reportError,
  formatErrorPayload,
  registerErrorProvider,
  clearErrorProviders,
  type ErrorPayload,
} from "@/lib/observability/error-reporter";
import {
  checkRateLimit,
  resetRateLimits,
  createRateLimitResponse,
  applyRateLimitHeaders,
  getClientIp,
  RATE_LIMIT_POLICIES,
  SlidingWindowRateLimiter,
} from "@/lib/security/rate-limiter";
import { checkSupportRateLimit, _resetSupportRateLimits } from "@/lib/support/rate-limiter";
import { GET as getHealth } from "@/app/api/health/route";
import { setHealthDatabasePingOverride, checkDatabaseConnectivity } from "@/lib/observability/health";
import { POST as postProgress } from "@/app/api/progress/route";
import { POST as postSupport } from "@/app/api/support/route";
import { GET as getPlayback } from "@/app/api/playback/[episodeId]/route";
import {
  setTestUserServerClientFactory,
  setTestUserServiceRoleClientFactory,
} from "@/lib/supabase/user-server";
import { middleware } from "@/middleware";

describe("Observability, Rate Limiting & Operational Readiness (Task 13.6)", () => {
  const rootDir = process.cwd();

  beforeEach(() => {
    resetRateLimits();
    clearErrorProviders();
    setHealthDatabasePingOverride(null);
    setTestUserServerClientFactory(null);
    setTestUserServiceRoleClientFactory(null);
  });

  afterEach(() => {
    resetRateLimits();
    clearErrorProviders();
    setHealthDatabasePingOverride(null);
    setTestUserServerClientFactory(null);
    setTestUserServiceRoleClientFactory(null);
  });

  /* -------------------------------------------------------------------------- */
  /* R1: Structured Logging & Request Tracing                                   */
  /* -------------------------------------------------------------------------- */
  describe("R1: Structured Logging & Request Tracing", () => {
    it("formatLogEntry outputs all 10 standardized keys conforming to the schema", () => {
      const entry = formatLogEntry("info", "Test log message", {
        requestId: "req-12345",
        route: "/api/test",
        method: "GET",
        userId: "user-999",
        durationMs: 14.5,
        statusCode: 200,
        details: { foo: "bar" },
      });

      const requiredKeys = [
        "requestId",
        "timestamp",
        "level",
        "route",
        "method",
        "userId",
        "durationMs",
        "statusCode",
        "message",
        "details",
      ];

      for (const key of requiredKeys) {
        assert.ok(key in entry, `Log entry must contain key "${key}"`);
      }

      assert.equal(entry.level, "info");
      assert.equal(entry.message, "Test log message");
      assert.equal(entry.requestId, "req-12345");
      assert.equal(entry.route, "/api/test");
      assert.equal(entry.method, "GET");
      assert.equal(entry.userId, "user-999");
      assert.equal(entry.durationMs, 14.5);
      assert.equal(entry.statusCode, 200);
      assert.deepEqual(entry.details, { foo: "bar" });
      assert.ok(!Number.isNaN(Date.parse(entry.timestamp)), "timestamp must be valid ISO-8601");
    });

    it("logger.info, warn, error emit parseable structured JSON via subscriber", () => {
      const captured: StructuredLogEntry[] = [];
      const unsubscribe = subscribeToLogs((entry, json) => {
        // Assert json string parses cleanly into entry
        const parsed = JSON.parse(json);
        assert.deepEqual(parsed, entry);
        captured.push(entry);
      });

      try {
        logger.info("Informational message", { route: "/home" });
        logger.warn("Warning message", { statusCode: 429 });
        logger.error("Error message", { statusCode: 500 });

        assert.equal(captured.length, 3);
        assert.equal(captured[0].level, "info");
        assert.equal(captured[0].message, "Informational message");
        assert.equal(captured[0].route, "/home");

        assert.equal(captured[1].level, "warn");
        assert.equal(captured[1].statusCode, 429);

        assert.equal(captured[2].level, "error");
        assert.equal(captured[2].statusCode, 500);
      } finally {
        unsubscribe();
      }
    });

    it("logger.child binds contextual fields into child logger entries", () => {
      const captured: StructuredLogEntry[] = [];
      const unsubscribe = subscribeToLogs((entry) => captured.push(entry));

      try {
        const childLogger = logger.child({
          requestId: "req-child-777",
          route: "/api/progress",
          method: "POST",
        });

        childLogger.info("Progress updated", { statusCode: 200 });

        assert.equal(captured.length, 1);
        assert.equal(captured[0].requestId, "req-child-777");
        assert.equal(captured[0].route, "/api/progress");
        assert.equal(captured[0].method, "POST");
        assert.equal(captured[0].statusCode, 200);
      } finally {
        unsubscribe();
      }
    });

    it("generateRequestId generates standard UUID v4 format", () => {
      const uuid = generateRequestId();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.ok(uuidRegex.test(uuid), `Generated ID "${uuid}" must be a valid UUID v4`);
    });

    it("middleware propagates x-request-id and replays it onto outgoing responses", async () => {
      const customRequestId = "test-custom-request-id-42";
      const req = new NextRequest("http://localhost:3000/home", {
        headers: { "x-request-id": customRequestId },
      });

      const res = await middleware(req);
      assert.ok(res, "Middleware must return a NextResponse");
      assert.equal(
        res.headers.get("x-request-id"),
        customRequestId,
        "Outgoing response must carry incoming x-request-id"
      );
    });

    it("formatLogEntry preserves extra context fields within details without dropping them", () => {
      const entry = formatLogEntry("info", "User action", {
        userId: "u-123",
        customFlag: true,
        tenantId: "tenant-99",
      });

      assert.equal(entry.userId, "u-123");
      assert.deepEqual(entry.details, {
        customFlag: true,
        tenantId: "tenant-99",
      });
    });

    it("logger.child merges nested details without discarding parent details", () => {
      const captured: StructuredLogEntry[] = [];
      const unsubscribe = subscribeToLogs((entry) => captured.push(entry));

      try {
        const parentLogger = logger.child({
          requestId: "req-parent",
          details: { service: "auth", region: "us-east" },
        });
        const childLogger = parentLogger.child({
          details: { action: "login", attempts: 1 },
        });

        childLogger.info("Login attempt");
        assert.equal(captured.length, 1);
        assert.deepEqual(captured[0].details, {
          service: "auth",
          region: "us-east",
          action: "login",
          attempts: 1,
        });
      } finally {
        unsubscribe();
      }
    });

    it("middleware auto-generates x-request-id if not supplied by caller", async () => {
      const req = new NextRequest("http://localhost:3000/home");
      const res = await middleware(req);

      const generatedHeader = res.headers.get("x-request-id");
      assert.ok(generatedHeader, "Middleware must assign x-request-id if absent");
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.ok(uuidRegex.test(generatedHeader), "Generated header must be a UUID v4");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* R2: Pluggable Error Reporting & Boundary Integration                       */
  /* -------------------------------------------------------------------------- */
  describe("R2: Pluggable Error Reporting & Boundary Integration", () => {
    it("formatErrorPayload extracts name, message, stack, digest from standard Error", () => {
      const error = new Error("Database query timed out");
      error.name = "TimeoutError";
      (error as any).digest = "digest-abc-123";

      const payload = formatErrorPayload(error, {
        requestId: "req-err-1",
        userId: "usr-42",
        route: "/api/playback/ep-1",
        tags: { service: "catalog" },
      });

      assert.equal(payload.name, "TimeoutError");
      assert.equal(payload.message, "Database query timed out");
      assert.equal(payload.digest, "digest-abc-123");
      assert.equal(payload.requestId, "req-err-1");
      assert.equal(payload.userId, "usr-42");
      assert.equal(payload.route, "/api/playback/ep-1");
      assert.deepEqual(payload.tags, { service: "catalog" });
      assert.ok(payload.stack && payload.stack.includes("TimeoutError"));
    });

    it("formatErrorPayload handles non-Error objects and strings safely", () => {
      const stringPayload = formatErrorPayload("Plain string failure");
      assert.equal(stringPayload.name, "Error");
      assert.equal(stringPayload.message, "Plain string failure");

      const objPayload = formatErrorPayload({ code: "ERR_NETWORK", detail: "DNS failed" });
      assert.equal(objPayload.name, "Object");
      assert.ok(objPayload.message.includes("ERR_NETWORK"));
    });

    it("reportError dispatches to registered providers and supports unregistration", () => {
      const received: ErrorPayload[] = [];
      const unregister = registerErrorProvider({
        name: "test-sink",
        report: (payload) => {
          received.push(payload);
        },
      });

      const testError = new Error("Simulated critical failure");
      reportError(testError, { route: "/search" });

      assert.equal(received.length, 1);
      assert.equal(received[0].message, "Simulated critical failure");
      assert.equal(received[0].route, "/search");

      unregister();
      reportError(new Error("Second error after unregister"));
      assert.equal(received.length, 1, "Should not dispatch after unregistration");
    });

    it("reportError safely catches synchronous and asynchronous provider exceptions without crashing", async () => {
      registerErrorProvider({
        name: "faulty-sync-sink",
        report: () => {
          throw new Error("Sync crash in telemetry provider");
        },
      });

      registerErrorProvider({
        name: "faulty-async-sink",
        report: async () => {
          throw new Error("Async network failure in telemetry sink");
        },
      });

      // Must not throw
      assert.doesNotThrow(() => {
        const payload = reportError(new Error("Boundary caught error"));
        assert.equal(payload.message, "Boundary caught error");
      });
    });

    it("formatErrorPayload and reportError safely handle circular reference objects without throwing", () => {
      const circularObj: any = { message: "Circular error detail" };
      circularObj.self = circularObj;

      const payload = formatErrorPayload(circularObj);
      assert.equal(payload.message, "Circular error detail");

      assert.doesNotThrow(() => {
        reportError(circularObj);
      });
    });

    it("formatErrorPayload safely handles objects with throwing property getters", () => {
      const explosiveObj = {
        get message(): string {
          throw new Error("Getter explosion");
        },
      };

      assert.doesNotThrow(() => {
        const payload = formatErrorPayload(explosiveObj);
        assert.ok(payload);
      });
    });

    it("verifies all 5 application error boundaries import and invoke reportError", () => {
      const boundaryPaths = [
        "app/error.tsx",
        "app/global-error.tsx",
        "app/drama/[slug]/error.tsx",
        "app/watch/[slug]/error.tsx",
        "app/search/error.tsx",
      ];

      for (const relPath of boundaryPaths) {
        const fullPath = path.resolve(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `Error boundary file must exist: ${relPath}`);
        const content = fs.readFileSync(fullPath, "utf8");

        assert.ok(
          content.includes('import { reportError } from "@/lib/observability/error-reporter"'),
          `${relPath} must import reportError from @/lib/observability/error-reporter`
        );
        assert.ok(
          content.includes("reportError(error"),
          `${relPath} must invoke reportError(error, ...)`
        );
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /* R3: Shared Scalable Rate Limiter                                           */
  /* -------------------------------------------------------------------------- */
  describe("R3: Shared Scalable Rate Limiter", () => {
    it("pre-configures required policy profiles with accurate thresholds", () => {
      assert.deepEqual(RATE_LIMIT_POLICIES.support, { maxRequests: 5, windowMs: 60 * 60 * 1000 });
      assert.deepEqual(RATE_LIMIT_POLICIES.progress, { maxRequests: 60, windowMs: 60 * 1000 });
      assert.deepEqual(RATE_LIMIT_POLICIES.playback, { maxRequests: 30, windowMs: 60 * 1000 });
      assert.deepEqual(RATE_LIMIT_POLICIES.auth, { maxRequests: 10, windowMs: 60 * 1000 });
      assert.deepEqual(RATE_LIMIT_POLICIES.generalApi, { maxRequests: 120, windowMs: 60 * 1000 });
    });

    it("enforces sliding window limits: permits threshold requests and blocks subsequent requests", () => {
      const testKey = "test-client-ip-1";

      // 5 allowed requests for support profile
      for (let i = 1; i <= 5; i++) {
        const res = checkRateLimit(testKey, "support");
        assert.equal(res.allowed, true, `Request ${i} should be allowed`);
        assert.equal(res.limit, 5);
        assert.equal(res.remaining, 5 - i);
        assert.equal(res.retryAfterSeconds, 0);
      }

      // 6th request must be blocked
      const blocked = checkRateLimit(testKey, "support");
      assert.equal(blocked.allowed, false, "6th request must be rate limited");
      assert.equal(blocked.limit, 5);
      assert.equal(blocked.remaining, 0);
      assert.ok(blocked.retryAfterSeconds > 0, "retryAfterSeconds must be > 0");
    });

    it("resets capacity after sliding window elapses", () => {
      const customLimiter = new SlidingWindowRateLimiter();
      const baseTime = 1000000;
      const policy = { maxRequests: 2, windowMs: 1000 };

      // 2 requests at baseTime
      assert.equal(customLimiter.check("user-1", policy, baseTime).allowed, true);
      assert.equal(customLimiter.check("user-1", policy, baseTime + 100).allowed, true);
      assert.equal(customLimiter.check("user-1", policy, baseTime + 200).allowed, false);

      // Advance clock past 1000ms window
      const afterWindow = baseTime + 1100;
      const res = customLimiter.check("user-1", policy, afterWindow);
      assert.equal(res.allowed, true, "Request after window expiration must be allowed");
    });

    it("maintains independent isolation between distinct keys and profiles", () => {
      const ip1 = "10.0.0.1";
      const ip2 = "10.0.0.2";

      for (let i = 0; i < 5; i++) {
        checkRateLimit(ip1, "support");
      }
      assert.equal(checkRateLimit(ip1, "support").allowed, false);

      // Different IP is untouched
      assert.equal(checkRateLimit(ip2, "support").allowed, true);

      // Same IP on different profile is untouched
      assert.equal(checkRateLimit(ip1, "generalApi").allowed, true);
    });

    it("createRateLimitResponse produces HTTP 429 with standard headers", async () => {
      const rateLimitResult = {
        allowed: false,
        limit: 60,
        remaining: 0,
        resetAt: Date.now() + 30000,
        resetSeconds: Math.ceil((Date.now() + 30000) / 1000),
        retryAfterSeconds: 30,
      };

      const response = createRateLimitResponse(rateLimitResult);
      assert.equal(response.status, 429);
      assert.equal(response.headers.get("X-RateLimit-Limit"), "60");
      assert.equal(response.headers.get("X-RateLimit-Remaining"), "0");
      assert.equal(response.headers.get("X-RateLimit-Reset"), String(rateLimitResult.resetSeconds));
      assert.equal(response.headers.get("Retry-After"), "30");

      const body = await response.json();
      assert.equal(body.success, false);
      assert.equal(body.error.code, "RATE_LIMITED");
      assert.equal(body.error.details.retryAfter, 30);
    });

    it("checkRateLimit with maxRequests: 0 rejects immediately with valid numerical headers and no NaN", () => {
      const res = checkRateLimit("locked-key", { maxRequests: 0, windowMs: 60000 });
      assert.equal(res.allowed, false);
      assert.equal(res.remaining, 0);
      assert.ok(Number.isFinite(res.resetSeconds), "resetSeconds must be a finite number");
      assert.ok(Number.isFinite(res.retryAfterSeconds), "retryAfterSeconds must be a finite number");
      assert.ok(res.retryAfterSeconds > 0);
    });

    it("resetKey isolates exact keys and does not collide on partial suffixes", () => {
      const limiter = new SlidingWindowRateLimiter();
      const policy = { maxRequests: 5, windowMs: 60000 };

      limiter.check("foo:bar", policy);
      limiter.check("bar", policy);

      // Reset "bar"
      limiter.resetKey("bar");

      // "bar" should be reset (remaining = 4 on next check)
      const resBar = limiter.check("bar", policy);
      assert.equal(resBar.remaining, 4);

      // "foo:bar" should still have previous entry preserved (remaining = 3)
      const resFooBar = limiter.check("foo:bar", policy);
      assert.equal(resFooBar.remaining, 3);
    });

    it("refactored lib/support/rate-limiter.ts cleanly delegates to shared limiter", () => {
      _resetSupportRateLimits();

      for (let i = 1; i <= 5; i++) {
        const res = checkSupportRateLimit("ip:192.168.1.50");
        assert.equal(res.allowed, true);
      }

      const blocked = checkSupportRateLimit("ip:192.168.1.50");
      assert.equal(blocked.allowed, false);
      assert.ok(blocked.retryAfterSeconds > 0);

      _resetSupportRateLimits();
      assert.equal(checkSupportRateLimit("ip:192.168.1.50").allowed, true);
    });

    it("POST /api/progress returns 429 with Retry-After when rate limit is exceeded", async () => {
      const testIp = "172.16.0.99";

      // Exhaust 60 requests
      for (let i = 0; i < 60; i++) {
        checkRateLimit(`ip:${testIp}`, "progress");
      }

      const req = new NextRequest("http://localhost:3000/api/progress", {
        method: "POST",
        headers: { "x-forwarded-for": testIp },
        body: JSON.stringify({ titleSlug: "test-drama", episodeNumber: 1 }),
      });

      const res = await postProgress(req);
      assert.equal(res.status, 429);
      assert.ok(res.headers.get("Retry-After"));
      assert.equal(res.headers.get("X-RateLimit-Limit"), "60");
      const json = await res.json();
      assert.equal(json.error.code, "RATE_LIMITED");
    });

    it("POST /api/support returns 429 with Retry-After when rate limit is exceeded", async () => {
      const testIp = "172.16.0.88";

      // Exhaust 5 support requests
      for (let i = 0; i < 5; i++) {
        checkRateLimit(`ip:${testIp}`, "support");
      }

      const req = new NextRequest("http://localhost:3000/api/support", {
        method: "POST",
        headers: { "x-forwarded-for": testIp, "content-type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          category: "general",
          subject: "Support ticket request",
          message: "Detailed body message with sufficient length.",
        }),
      });

      const res = await postSupport(req);
      assert.equal(res.status, 429);
      assert.ok(res.headers.get("Retry-After"));
      assert.equal(res.headers.get("X-RateLimit-Limit"), "5");
      const json = await res.json();
      assert.equal(json.error.code, "TOO_MANY_REQUESTS");
    });

    it("GET /api/playback/[episodeId] returns 429 with Retry-After when rate limit is exceeded", async () => {
      const testIp = "172.16.0.77";

      // Exhaust 30 playback requests
      for (let i = 0; i < 30; i++) {
        checkRateLimit(`ip:${testIp}`, "playback");
      }

      const req = new NextRequest("http://localhost:3000/api/playback/a0000000-0000-0000-0000-000000000001", {
        headers: { "x-forwarded-for": testIp },
      });

      const res = await getPlayback(req, {
        params: Promise.resolve({ episodeId: "a0000000-0000-0000-0000-000000000001" }),
      });

      assert.equal(res.status, 429);
      assert.ok(res.headers.get("Retry-After"));
      assert.equal(res.headers.get("X-RateLimit-Limit"), "30");
      const json = await res.json();
      assert.equal(json.error.code, "RATE_LIMITED");
    });

    it("POST /api/progress returns standard rate limit headers on successful request", async () => {
      setTestUserServerClientFactory(() => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }));

      const testIp = "10.10.10.10";
      const req = new NextRequest("http://localhost:3000/api/progress", {
        method: "POST",
        headers: { "x-forwarded-for": testIp },
        body: JSON.stringify({ titleSlug: "test-drama", episodeNumber: 1 }),
      });

      const res = await postProgress(req);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("X-RateLimit-Limit"), "60");
      assert.ok(res.headers.get("X-RateLimit-Remaining") !== null);
      assert.ok(res.headers.get("X-RateLimit-Reset") !== null);
    });

    it("POST /api/support returns standard rate limit headers on successful ticket submission", async () => {
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
                data: { id: "mock-support-id", created_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
        }),
      }));

      const testIp = "10.10.10.20";
      const req = new NextRequest("http://localhost:3000/api/support", {
        method: "POST",
        headers: { "x-forwarded-for": testIp, "content-type": "application/json" },
        body: JSON.stringify({
          email: "support-user@example.com",
          category: "general",
          subject: "Legitimate question",
          message: "Here is a sufficiently detailed message for support.",
        }),
      });

      const res = await postSupport(req);
      assert.equal(res.status, 201);
      assert.equal(res.headers.get("X-RateLimit-Limit"), "5");
      assert.ok(res.headers.get("X-RateLimit-Remaining") !== null);
      assert.ok(res.headers.get("X-RateLimit-Reset") !== null);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* R4: Health Check & Reachability Endpoint (/api/health)                     */
  /* -------------------------------------------------------------------------- */
  describe("R4: Health Check Endpoint (/api/health)", () => {
    it("returns HTTP 200 with database: healthy when database connectivity succeeds", async () => {
      setHealthDatabasePingOverride(async () => true);

      const res = await getHealth();
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate");

      const body = await res.json();
      assert.equal(body.status, "ok");
      assert.equal(body.checks.database, "healthy");
      assert.ok(typeof body.latencyMs === "number");
      assert.ok(typeof body.uptime === "number");
      assert.ok(body.timestamp);
      assert.ok(body.environment);
    });

    it("returns HTTP 503 with database: unhealthy when database check fails", async () => {
      setHealthDatabasePingOverride(async () => false);

      const res = await getHealth();
      assert.equal(res.status, 503);
      assert.equal(res.headers.get("Cache-Control"), "no-store, no-cache, must-revalidate");

      const body = await res.json();
      assert.equal(body.status, "unhealthy");
      assert.equal(body.checks.database, "unhealthy");
      assert.ok(body.error);
    });

    it("returns HTTP 503 when database ping throws an exception", async () => {
      setHealthDatabasePingOverride(async () => {
        throw new Error("Connection refused (ECONNREFUSED)");
      });

      const res = await getHealth();
      assert.equal(res.status, 503);

      const body = await res.json();
      assert.equal(body.status, "unhealthy");
      assert.equal(body.checks.database, "unhealthy");
      assert.ok(body.error.includes("Connection refused"));
    });

    it("enforces timeout boundary and returns unhealthy when database ping hangs", async () => {
      // Hang indefinitely
      setHealthDatabasePingOverride(() => new Promise(() => {}));

      const outcome = await checkDatabaseConnectivity(50);
      assert.equal(outcome.healthy, false);
      assert.ok(outcome.error?.includes("timed out after 50ms"));
    });
  });

  /* -------------------------------------------------------------------------- */
  /* R5: Operational Readiness Runbook Completeness                             */
  /* -------------------------------------------------------------------------- */
  describe("R5: Operational Readiness Runbook Completeness", () => {
    const runbookPath = path.resolve(rootDir, "docs/operations/operational-readiness.md");
    const rootReadmePath = path.resolve(rootDir, "README.md");
    const adr3Path = path.resolve(rootDir, "docs/adr/0003-database-topology.md");

    it("docs/operations/operational-readiness.md exists and covers all required areas", () => {
      assert.ok(fs.existsSync(runbookPath), "Operational readiness runbook must exist");
      const content = fs.readFileSync(runbookPath, "utf8");

      assert.ok(content.length > 2500, "Runbook must be thorough (>2.5KB)");

      const requiredTopics = [
        "Staging Environment Setup",
        "Database Backup Policy",
        "Point-in-Time Recovery",
        "PITR",
        "Rate Limiting",
        "Structured JSON Logging",
        "x-request-id",
        "reportError",
        "/api/health",
        "Incident Response",
        "Severity",
      ];

      for (const topic of requiredTopics) {
        assert.ok(content.includes(topic), `Runbook must cover topic "${topic}"`);
      }
    });

    it("verifies README.md and ADR-0003 cross-link to the operational readiness runbook", () => {
      const readme = fs.readFileSync(rootReadmePath, "utf8");
      assert.ok(
        readme.includes("docs/operations/operational-readiness.md"),
        "README.md must link to docs/operations/operational-readiness.md"
      );

      const adr3 = fs.readFileSync(adr3Path, "utf8");
      assert.ok(
        adr3.includes("../operations/operational-readiness.md"),
        "ADR-0003 must link to ../operations/operational-readiness.md"
      );
    });
  });
});
