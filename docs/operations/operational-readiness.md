# Operational Readiness Runbook & Platform Telemetry

**DramaShort Web & Admin Platform — Task 13.6**  
**Classification**: Operational Engineering & Production Readiness  
**Target Environments**: Staging, Preview & Production

---

## 1. Overview & System Topology

DramaShort is a vertical short-form drama streaming web application built on Next.js 15, React 19, TypeScript, and Supabase PostgreSQL. Following the architectural decisions in [ADR-0003](../adr/0003-database-topology.md), DramaShort operates on a consolidated Supabase project with dedicated PostgreSQL schemas (`content` for catalog and video media, `public` for authenticated user accounts, watch progress, and playlists).

This runbook defines operational readiness standards covering:
1. **Staging Environment Setup & Configuration**
2. **Database Backup Policy & Point-in-Time Recovery (PITR)**
3. **Rate Limiting Policies & Threshold Enforcement**
4. **Structured JSON Logging & End-to-End Request Tracing**
5. **Pluggable Error Reporting & Telemetry Sinks**
6. **Health Check Reachability (`/api/health`)**
7. **Incident Response Procedures & Severity Matrix**

---

## 2. Staging Environment Setup & Release Isolation

To guarantee that development and automated testing never touch or corrupt production data, all pre-production validations must execute against a dedicated staging environment.

### 2.1 Environment Configuration Matrix

| Environment Variable | Staging Standard | Production Standard | Purpose |
|---|---|---|---|
| `NODE_ENV` | `production` | `production` | Enables production optimizations and disables hot reloads |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://staging-project.supabase.co` | `https://prod-project.supabase.co` | Primary unified database gateway |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sbp_staging_anon_...` | `sbp_prod_anon_...` | Public client token for client-side reads |
| `SUPABASE_SERVICE_ROLE_KEY` | `sbp_staging_service_...` | `sbp_prod_service_...` | Server-only privileged key for CMS writes & token signing |
| `NEXT_PUBLIC_ENABLE_MOCK_FALLBACK` | `false` | `false` | Strictly disables mock data fallback (Task 12.4) |
| `TELEGRAM_BOT_TOKEN` | Staging bot token | Production ops bot token | Automated notification delivery |
| `TELEGRAM_OPS_CHAT_ID` | Staging test chat ID | Ops alert channel ID | Staff alerting channel |

### 2.2 Staging Database Provisioning Protocol
1. **Schema Synchronization**:
   ```bash
   # Push canonical schema migrations to staging database
   npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@[STAGING_HOST]:5432/postgres"
   ```
2. **Data Sanitization & Anonymization**:
   - Production user data (`auth.users`, `public.profiles`, `public.support_tickets`) must never be copied to staging without email and identifier hashing.
   - Seed staging catalog titles via `npm run db:seed:staging` containing synthetic test dramas and synthetic HLS manifests.
3. **Pre-flight Health Verification**:
   - Verify staging health check:
     ```bash
     curl -i https://staging.dramashort.app/api/health
     # Expect: HTTP 200 { "status": "ok", "checks": { "database": "healthy" } }
     ```

---

## 3. Database Backup Policy & Point-in-Time Recovery (PITR)

### 3.1 Backup Architecture
The consolidated database topology (ADR-0003) enables unified, atomic database backups:
- **Continuous Write-Ahead Log (WAL) Archiving**: WAL segments are continuously streamed to encrypted object storage.
- **Physical Daily Snapshots**: Full disk snapshots are automatically taken at 03:00 UTC daily.
- **Retention Period**:
  - **Pro Tier**: 7-day continuous PITR window.
  - **Enterprise Tier**: 30-day continuous PITR window.

### 3.2 Recovery Objectives
- **Recovery Point Objective (RPO)**: < 5 minutes (maximum acceptable data loss window during catastrophic failure).
- **Recovery Time Objective (RTO)**: < 30 minutes (maximum acceptable downtime to restore and point traffic).

### 3.3 Step-by-Step Point-in-Time Recovery (PITR) Drill
In the event of accidental catalog corruption, catastrophic malicious deletion, or unrecoverable schema migration failure:

1. **Establish Recovery Target Timestamp**:
   Identify the precise UTC timestamp immediately preceding the incident:
   ```
   INCIDENT_UTC="2026-10-08T14:32:00Z"
   TARGET_RESTORE_UTC="2026-10-08T14:31:00Z"
   ```
2. **Initiate PITR Clone in Supabase Management Console**:
   - Navigate to **Project Settings > Backups > Point in Time Recovery**.
   - Select **Restore to a New Project**.
   - Input `TARGET_RESTORE_UTC`.
   - Provision new clone instance: `dramashort-recovery-yyyy-mm-dd`.
3. **Verify Restored Database Integrity**:
   Run verification queries on the cloned instance:
   ```sql
   -- Check foreign key integrity between public and content schemas
   SELECT count(*) FROM public.watch_history wh
   LEFT JOIN content.titles t ON wh.title_id = t.id
   WHERE wh.title_id IS NOT NULL AND t.id IS NULL;
   -- Expected count: 0 (zero orphaned relations)
   ```
4. **Traffic Cutover**:
   - Update deployment environment variables `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the restored instance.
   - Trigger immediate zero-downtime redeployment via Vercel / CI.
   - Run `/api/health` to confirm reachability.

---

## 4. Rate Limiting Policies & Threshold Enforcement

DramaShort enforces a sliding-window in-memory rate limiter implemented in `lib/security/rate-limiter.ts`.

### 4.1 Configured Rate Limit Profiles

| Profile | Limit | Window | Key Scope | Target Endpoints | Behavior upon Limit |
|---|---|---|---|---|---|
| `support` | 5 requests | 1 hour (3600s) | IP | `POST /api/support` | HTTP 429 (`TOO_MANY_REQUESTS`), `Retry-After: 3600` |
| `progress` | 60 requests | 1 minute (60s) | IP & User ID | `POST /api/progress` | HTTP 429 (`RATE_LIMITED`), `Retry-After: N` |
| `playback` | 30 requests | 1 minute (60s) | IP & User ID | `GET /api/playback/[id]` | HTTP 429 (`RATE_LIMITED`), `Retry-After: N` |
| `auth` | 10 requests | 1 minute (60s) | IP | Auth login / signup forms | HTTP 429 (`RATE_LIMITED`), `Retry-After: N` |
| `generalApi`| 120 requests | 1 minute (60s) | IP | General public APIs | HTTP 429 (`RATE_LIMITED`), `Retry-After: N` |

### 4.2 Standard HTTP Headers Emitted
All rate-limited endpoints emit RFC-standard headers:
- `X-RateLimit-Limit`: Maximum requests permitted within window (e.g. `60`).
- `X-RateLimit-Remaining`: Remaining request quota in the current window (e.g. `59` down to `0`).
- `X-RateLimit-Reset`: Unix epoch timestamp (seconds) when the oldest request rolls out of the window.
- `Retry-After`: Integer seconds the client must wait before making another request (emitted on HTTP 429).

### 4.3 Standard 429 Error Envelope
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later.",
    "details": {
      "retryAfter": 42
    }
  }
}
```

### 4.4 Distributed Architecture Scaling Path
When scaling beyond a single serverless/container instance, the in-memory `SlidingWindowRateLimiter` will be backed by a distributed Upstash Redis or Dragonfly cache instance without changing the public `checkRateLimit()` signature.

---

## 5. Structured JSON Logging & Request Tracing

All edge middleware and backend routes output standardized, single-line JSON logs conforming to the operational schema defined in `lib/observability/logger.ts`.

### 5.1 Standardized Schema Specification
Every log record guarantees the following top-level keys:

```json
{
  "requestId": "a6dfb271-92b4-4e2b-bb2a-e2759e9bf8c1",
  "timestamp": "2026-10-08T15:20:00.123Z",
  "level": "info",
  "route": "/api/progress",
  "method": "POST",
  "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "durationMs": 42,
  "statusCode": 200,
  "message": "Request processed by middleware",
  "details": {
    "titleSlug": "revenge-of-the-heiress",
    "episodeNumber": 4
  }
}
```

### 5.2 Standard Keys Definition
1. `requestId` *(string | null)*: Unique request correlation ID propagated via `x-request-id`.
2. `timestamp` *(string)*: ISO-8601 UTC timestamp of log generation.
3. `level` *("info" | "warn" | "error")*: Log level indicator.
4. `route` *(string | null)*: Effective route path or API endpoint.
5. `method` *(string | null)*: HTTP method (`GET`, `POST`, `PUT`, `DELETE`).
6. `userId` *(string | null)*: Authenticated Supabase User UUID (or null for guests).
7. `durationMs` *(number | null)*: Request execution duration in milliseconds.
8. `statusCode` *(number | null)*: HTTP response status code.
9. `message` *(string)*: Human-readable log narrative.
10. `details` *(unknown)*: Structured auxiliary context or sanitised metadata.

### 5.3 Trace Correlation via `x-request-id`
1. Next.js edge middleware (`middleware.ts`) checks incoming requests for `x-request-id`.
2. If missing, middleware generates a cryptographically random UUID v4 (`crypto.randomUUID()`).
3. The `x-request-id` header is attached to downstream request headers and replayed onto all client responses.
4. Client and server errors logged to error reporting sinks reference the exact `x-request-id` for end-to-end trace correlation.

---

## 6. Pluggable Error Reporting & Boundary Integration

The error reporting engine (`lib/observability/error-reporter.ts`) captures exceptions from client and server boundaries without disrupting user workflows.

### 6.1 Wired Boundaries
The following error boundaries invoke `reportError(error, context)`:
- `app/error.tsx`: Root layout boundary
- `app/global-error.tsx`: Global HTML boundary
- `app/drama/[slug]/error.tsx`: Drama detail segment boundary
- `app/watch/[slug]/error.tsx`: Video player segment boundary
- `app/search/error.tsx`: Catalog search boundary
- Route handlers: `POST /api/progress`, `POST /api/support`, `GET /api/playback/[episodeId]`

### 6.2 External Sinks Integration Pattern
```typescript
import { registerErrorProvider, type ErrorPayload } from "@/lib/observability/error-reporter";

// Example: Registering Sentry / Datadog external sink
registerErrorProvider({
  name: "sentry-sink",
  report: async (payload: ErrorPayload) => {
    // Forward payload to external telemetry aggregator
    // Includes: name, message, stack, digest, requestId, userId, route, tags
  },
});
```
If an external provider fails or times out, the local logger captures the failure safely without causing unhandled promise rejections.

---

## 7. Health Check Reachability (`/api/health`)

DramaShort provides an automated uptime reachability route at `GET /api/health`.

### 7.1 Contract Specifications
- **Healthy Response (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "uptime": 14250.32,
    "environment": "production",
    "checks": {
      "database": "healthy"
    },
    "latencyMs": 18,
    "timestamp": "2026-10-08T15:25:00.000Z"
  }
  ```
- **Degraded / Outage Response (HTTP 503)**:
  ```json
  {
    "status": "unhealthy",
    "uptime": 14250.32,
    "environment": "production",
    "checks": {
      "database": "unhealthy"
    },
    "latencyMs": 3000,
    "timestamp": "2026-10-08T15:25:03.000Z",
    "error": "Database ping timed out after 3000ms"
  }
  ```

### 7.2 Synthetic Monitoring Configuration
- Monitor URL: `https://dramashort.app/api/health`
- Check Interval: Every 60 seconds
- Expected Status Code: `200 OK`
- Timeout: 4000ms
- Alert Escalation Threshold: 2 consecutive failures triggers P1 incident alert.

---

## 8. Incident Response Procedures & Severity Matrix

### 8.1 Incident Severity Levels

| Severity | Definition | Notification Channel | Target MTTR |
|---|---|---|---|
| **P0 (Critical Outage)** | Entire platform down, playback completely failing, or database completely unreachable | Telegram Ops Bot & Phone Call | < 15 minutes |
| **P1 (High Degradation)** | Playback intermittent, rate limits causing widespread 429s, or database latency > 1500ms | Telegram Ops Channel (`/sendMessage`) | < 30 minutes |
| **P2 (Medium Impact)** | Non-critical routes degraded (`/contact`, `/search`), admin console slow | Slack / Telegram Ops | < 2 hours |
| **P3 (Low Impact)** | Minor styling anomaly, isolated client JS error caught by boundary | GitHub Issue / Backlog | Next sprint |

### 8.2 Triage Runbook: Database Unreachable (503 Alert)
1. **Verify `/api/health`**:
   ```bash
   curl -i https://dramashort.app/api/health
   ```
2. **Inspect Supabase Status & Connection Pool**:
   - Check Supabase Dashboard for connection pool exhaustion (Supavisor pool connections > 90%).
   - If pooler exhausted, verify client connection leaks and restart Supavisor pooler.
3. **Check Cloudflare / CDN Route**:
   - Verify origin server response headers and latency.
4. **Trigger Database Failover / PITR**:
   - If unrecoverable database corruption, follow Section 3.3 for Point-in-Time Recovery.

---

## 9. Operational Verification Checklist

- [x] Structured JSON logs include all 10 standardized keys.
- [x] Middleware sets and propagates `x-request-id` header across responses.
- [x] All 5 error boundaries invoke `reportError()` with route tags and digests.
- [x] Write endpoints (`/api/progress`, `/api/support`) enforce rate limits and return 429 with `Retry-After`.
- [x] `/api/health` reports system uptime, latency, and database reachability.
- [x] PITR drills documented with step-by-step restoration verification queries.
