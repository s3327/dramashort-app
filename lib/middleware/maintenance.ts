import type { NextRequest } from "next/server";

let cachedMaintenance: { active: boolean; expiresAt: number } | null = null;
let testMaintenanceMode: boolean | null = null;

const CACHE_TTL_MS = 15_000; // 15 seconds

/**
 * Test hook allowing automated unit and integration tests to control maintenance mode state.
 */
export function setTestMaintenanceMode(mode: boolean | null): void {
  testMaintenanceMode = mode;
  cachedMaintenance = null;
}

/**
 * Checks whether maintenance mode is currently active.
 * Compatible with Edge runtime and Node.js runtime.
 */
export async function isMaintenanceModeActive(request?: NextRequest): Promise<boolean> {
  if (testMaintenanceMode !== null) {
    return testMaintenanceMode;
  }

  // 1. Fast Cookie Check (if set by admin action)
  if (request) {
    const cookieVal = request.cookies.get("ds_maint")?.value;
    if (cookieVal === "1") return true;
    if (cookieVal === "0") return false;
  }

  const now = Date.now();
  if (cachedMaintenance && cachedMaintenance.expiresAt > now) {
    return cachedMaintenance.active;
  }

  // 2. Fast PostgREST REST query to Content DB
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "dev-anon-key";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${url}/rest/v1/app_settings?key=eq.general&select=value`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const isActive = data?.[0]?.value?.maintenanceMode === true;
      cachedMaintenance = { active: isActive, expiresAt: now + CACHE_TTL_MS };
      return isActive;
    }
  } catch {
    // Fail-open: default to false if database is unreachable during startup or test runs
  }

  cachedMaintenance = { active: false, expiresAt: now + CACHE_TTL_MS };
  return false;
}
