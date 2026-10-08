/**
 * Database Health Check & Reachability Endpoint (Task 13.6)
 *
 * GET /api/health
 * Evaluates system health, uptime, environment, and Supabase database reachability
 * within a strict 3000ms timeout boundary.
 *
 * - HTTP 200: { status: "ok", checks: { database: "healthy" }, latencyMs, timestamp, uptime, environment }
 * - HTTP 503: { status: "unhealthy", checks: { database: "unhealthy" }, latencyMs, timestamp, uptime, environment, error }
 */

import { NextResponse } from "next/server";
import { logger } from "@/lib/observability/logger";
import { checkDatabaseConnectivity } from "@/lib/observability/health";
import { reportError } from "@/lib/observability/error-reporter";

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = typeof process.uptime === "function" ? process.uptime() : 0;
  const environment = process.env.NODE_ENV || "development";

  try {
    const dbStatus = await checkDatabaseConnectivity(3000);

    if (dbStatus.healthy) {
      return NextResponse.json(
        {
          status: "ok",
          uptime,
          environment,
          checks: {
            database: "healthy",
          },
          latencyMs: dbStatus.latencyMs,
          timestamp,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    logger.warn("[HealthCheck] Database unreachable or degraded", {
      route: "/api/health",
      method: "GET",
      details: {
        latencyMs: dbStatus.latencyMs,
        error: dbStatus.error,
      },
    });

    return NextResponse.json(
      {
        status: "unhealthy",
        uptime,
        environment,
        checks: {
          database: "unhealthy",
        },
        latencyMs: dbStatus.latencyMs,
        timestamp,
        error: dbStatus.error || "Database connectivity check failed",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: any) {
    reportError(err, {
      route: "/api/health",
      method: "GET",
      tags: { boundary: "health-check" },
    });

    return NextResponse.json(
      {
        status: "unhealthy",
        uptime,
        environment,
        checks: {
          database: "unhealthy",
        },
        latencyMs: 0,
        timestamp,
        error: err?.message || String(err),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }
}
