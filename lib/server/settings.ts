import "server-only";

import { revalidateTag } from "next/cache";
import { getContentAdminClient } from "@/lib/supabase/content";
import { recordAuditLog } from "@/lib/server/audit";
import {
  type AdsSettings,
  type FeaturesSettings,
  type GeneralSettings,
  type PlatformSettings,
  type SettingsSection,
  type SiteSettings,
  type UserSettings,
  DEFAULT_ADS_SETTINGS,
  DEFAULT_FEATURES_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_USER_SETTINGS,
} from "@/types/settings";

export {
  DEFAULT_ADS_SETTINGS,
  DEFAULT_FEATURES_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_USER_SETTINGS,
};

// Fast In-Memory Cache with 30s TTL
interface CacheContainer {
  data: PlatformSettings;
  expiresAt: number;
}

let memoryCache: CacheContainer | null = null;
const CACHE_TTL_MS = 30_000;

export function clearPlatformSettingsCache(): void {
  memoryCache = null;
}

interface ActorContext {
  id: string;
  email?: string | null;
  ip?: string | null;
}

/**
 * Retrieves all platform settings with safe defaults and in-memory caching.
 */
export async function getPlatformSettingsServer(): Promise<PlatformSettings> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.data;
  }

  const client = getContentAdminClient();
  let latestUpdatedAt: string | undefined;

  const result: PlatformSettings = {
    general: { ...DEFAULT_GENERAL_SETTINGS },
    site: { ...DEFAULT_SITE_SETTINGS },
    users: { ...DEFAULT_USER_SETTINGS },
    ads: { ...DEFAULT_ADS_SETTINGS },
    features: { ...DEFAULT_FEATURES_SETTINGS },
  };

  try {
    const { data, error } = await client
      .from("app_settings")
      .select("key, value, updated_at, updated_by");

    if (error) {
      console.warn("[getPlatformSettingsServer] DB warning, using default settings:", error.message);
    } else if (Array.isArray(data)) {
      for (const row of data) {
        if (!latestUpdatedAt || (row.updated_at && row.updated_at > latestUpdatedAt)) {
          latestUpdatedAt = row.updated_at;
          result.updatedBy = row.updated_by;
        }

        const val = typeof row.value === "object" && row.value !== null ? row.value : {};

        if (row.key === "general") {
          result.general = { ...DEFAULT_GENERAL_SETTINGS, ...val };
        } else if (row.key === "site") {
          result.site = { ...DEFAULT_SITE_SETTINGS, ...val };
        } else if (row.key === "users") {
          result.users = { ...DEFAULT_USER_SETTINGS, ...val };
        } else if (row.key === "ads") {
          result.ads = { ...DEFAULT_ADS_SETTINGS, ...val };
        } else if (row.key === "features") {
          result.features = { ...DEFAULT_FEATURES_SETTINGS, ...val };
        }
      }
    }
  } catch (err) {
    console.warn("[getPlatformSettingsServer] Unexpected error, returning defaults:", err);
  }

  result.updatedAt = latestUpdatedAt;

  memoryCache = {
    data: result,
    expiresAt: now + CACHE_TTL_MS,
  };

  return result;
}

/**
 * Retrieves a specific section of platform settings.
 */
export async function getPlatformSettingSectionServer<T>(section: SettingsSection): Promise<T> {
  const all = await getPlatformSettingsServer();
  return (all[section] || {}) as T;
}

/**
 * Checks whether maintenance mode is currently active.
 */
export async function isMaintenanceModeActiveServer(): Promise<boolean> {
  try {
    const general = await getPlatformSettingSectionServer<GeneralSettings>("general");
    return general?.maintenanceMode === true;
  } catch {
    return false;
  }
}

/**
 * Updates a platform settings section, invalidates cache, and records structured audit logs.
 */
export async function updatePlatformSettingSectionServer<T extends Record<string, unknown>>(
  section: SettingsSection,
  newValues: Partial<T>,
  actor: ActorContext
): Promise<T> {
  const client = getContentAdminClient();
  const currentAll = await getPlatformSettingsServer();
  const currentSection = (currentAll[section] || {}) as Record<string, unknown>;

  const merged = { ...currentSection, ...newValues };
  const updatedAt = new Date().toISOString();

  // 1. Upsert to public.app_settings
  const { error: upsertError } = await client.from("app_settings").upsert({
    key: section,
    value: merged as any,
    updated_by: actor.id,
    updated_at: updatedAt,
  });

  if (upsertError) {
    console.error(`[updatePlatformSettingSectionServer] Upsert failed for "${section}":`, upsertError);
    throw new Error(`Failed to update ${section} settings: ${upsertError.message}`);
  }

  // 2. Audit log
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "settings.update",
    entityType: "settings",
    entityId: section,
    before: currentSection,
    after: merged,
    ip: actor.ip,
  });

  // 3. Invalidate cache
  clearPlatformSettingsCache();
  try {
    revalidateTag("platform_settings");
  } catch {
    // revalidateTag may throw in unit tests without Next.js context
  }

  return merged as T;
}
