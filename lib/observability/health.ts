/**
 * Database Health & Reachability Check Core (Task 13.6)
 *
 * Encapsulates Supabase connectivity pings and timeout handling.
 * Kept separate from app/api/health/route.ts to adhere to Next.js route export restrictions.
 */

import { contentClient } from "@/lib/supabase/content";

export type DatabasePingFn = () => Promise<boolean>;
let pingOverride: DatabasePingFn | null = null;

/**
 * Test hook allowing unit and synthetic tests to inject mock database ping behavior.
 */
export function setHealthDatabasePingOverride(override: DatabasePingFn | null): void {
  pingOverride = override;
}

/**
 * Pings database connectivity across Supabase instances with timeout handling.
 */
export async function checkDatabaseConnectivity(timeoutMs = 3000): Promise<{
  healthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const startTime = Date.now();
  const effectiveTimeout = Math.max(1, typeof timeoutMs === "number" && Number.isFinite(timeoutMs) ? timeoutMs : 3000);

  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<{ healthy: false; error: string }>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve({ healthy: false, error: `Database ping timed out after ${effectiveTimeout}ms` });
    }, effectiveTimeout);
    timeoutHandle?.unref?.();
  });

  const workerPromise = (async (): Promise<{ healthy: boolean; error?: string }> => {
    if (pingOverride) {
      try {
        const healthy = await pingOverride();
        return {
          healthy,
          error: healthy ? undefined : "Database health ping returned false",
        };
      } catch (err: any) {
        return { healthy: false, error: err?.message || String(err) };
      }
    }

    try {
      // Lightweight single-row lookup
      const { data, error } = await contentClient.from("titles").select("id").limit(1);
      if (error) {
        return { healthy: false, error: error.message };
      }
      return { healthy: true };
    } catch (err: any) {
      return { healthy: false, error: err?.message || String(err) };
    }
  })();

  try {
    const outcome = await Promise.race([workerPromise, timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);

    const latencyMs = Date.now() - startTime;
    return {
      healthy: outcome.healthy,
      latencyMs,
      error: outcome.error,
    };
  } catch (err: any) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return {
      healthy: false,
      latencyMs: Date.now() - startTime,
      error: err?.message || String(err),
    };
  }
}
