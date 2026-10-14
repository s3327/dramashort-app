import "server-only";
import { createUserServerClient } from "@/lib/supabase/user-server";
import type { Database } from "@/types/supabase";
import type { ListDef } from "@/contexts/FavoritesContext";
import { type Result, ok, err } from "@/lib/common/result";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type WatchHistoryRow = Database["public"]["Tables"]["watch_history"]["Row"];

/**
 * Resolves target user ID from explicit argument or server session cookies.
 */
async function resolveServerUserId(explicitId?: string): Promise<string | null> {
  if (explicitId) return explicitId;
  try {
    const supabase = await createUserServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Server-side profile retrieval using server Supabase client with cookie support.
 */
export async function getServerUserProfile(userId?: string): Promise<ProfileRow | null> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) return null;

  try {
    const supabase = await createUserServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", targetId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (error) {
    console.error("Error in getServerUserProfile:", error);
    return null;
  }
}

/**
 * Result-wrapped server profile retrieval.
 */
export async function getServerUserProfileResult(
  userId?: string
): Promise<Result<ProfileRow, string>> {
  const profile = await getServerUserProfile(userId);
  if (!profile) {
    return err("User profile not found or unauthenticated");
  }
  return ok(profile);
}

/**
 * Server-side watch history retrieval using server Supabase client with cookie support.
 */
export async function getServerWatchHistory(
  userId?: string
): Promise<WatchHistoryRow[]> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) return [];

  try {
    const supabase = await createUserServerClient();
    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", targetId)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data;
  } catch (error) {
    console.error("Error in getServerWatchHistory:", error);
    return [];
  }
}

/**
 * Result-wrapped server watch history retrieval.
 */
export async function getServerWatchHistoryResult(
  userId?: string
): Promise<Result<WatchHistoryRow[], string>> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) {
    return err("User is not authenticated");
  }
  const history = await getServerWatchHistory(targetId);
  return ok(history);
}

/**
 * Server-side single-drama watch progress lookup.
 */
export async function getServerWatchProgress(
  titleSlug: string,
  userId?: string
): Promise<WatchHistoryRow | null> {
  if (!titleSlug) return null;
  const targetId = await resolveServerUserId(userId);
  if (!targetId) return null;

  try {
    const supabase = await createUserServerClient();
    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", targetId)
      .eq("title_slug", titleSlug)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (error) {
    console.error("Error in getServerWatchProgress:", error);
    return null;
  }
}

/**
 * Server-side user favorites retrieval using server Supabase client with cookie support.
 */
export async function getServerFavorites(userId?: string): Promise<string[]> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) return [];

  try {
    const supabase = await createUserServerClient();
    const { data, error } = await supabase
      .from("favorites")
      .select("title_slug")
      .eq("user_id", targetId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return (data as Array<{ title_slug: string }>).map((r) => r.title_slug);
  } catch (error) {
    console.error("Error in getServerFavorites:", error);
    return [];
  }
}

/**
 * Result-wrapped server favorites retrieval.
 */
export async function getServerFavoritesResult(
  userId?: string
): Promise<Result<string[], string>> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) {
    return err("User is not authenticated");
  }
  const favorites = await getServerFavorites(targetId);
  return ok(favorites);
}

/**
 * Server-side user custom lists retrieval with cookie session support.
 */
export async function getServerCustomLists(userId?: string): Promise<ListDef[]> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) return [];

  try {
    const supabase = await createUserServerClient();
    const { data: lists, error: listErr } = await supabase
      .from("custom_lists")
      .select("id, title")
      .eq("user_id", targetId)
      .order("created_at", { ascending: true });

    if (listErr || !lists || lists.length === 0) return [];

    const typedLists = lists as Array<{ id: string; title: string }>;
    const listIds = typedLists.map((l) => l.id);
    const { data: items } = await supabase
      .from("custom_list_items")
      .select("list_id, title_slug")
      .in("list_id", listIds);

    const itemsMap = new Map<string, string[]>();
    const typedItems = (items || []) as Array<{ list_id: string; title_slug: string }>;
    typedItems.forEach((it) => {
      const existing = itemsMap.get(it.list_id) || [];
      existing.push(it.title_slug);
      itemsMap.set(it.list_id, existing);
    });

    return typedLists.map((l) => ({
      id: l.id,
      title: l.title,
      itemSlugs: itemsMap.get(l.id) || [],
    }));
  } catch (error) {
    console.error("Error in getServerCustomLists:", error);
    return [];
  }
}

/**
 * Result-wrapped server user custom lists retrieval.
 */
export async function getServerCustomListsResult(
  userId?: string
): Promise<Result<ListDef[], string>> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) {
    return err("User is not authenticated");
  }
  const lists = await getServerCustomLists(targetId);
  return ok(lists);
}

/**
 * Result-wrapped server single-drama watch progress lookup.
 */
export async function getServerWatchProgressResult(
  titleSlug: string,
  userId?: string
): Promise<Result<WatchHistoryRow, string>> {
  const targetId = await resolveServerUserId(userId);
  if (!targetId) {
    return err("User is not authenticated");
  }
  const progress = await getServerWatchProgress(titleSlug, targetId);
  if (!progress) {
    return err(`Watch progress not found for drama: ${titleSlug}`);
  }
  return ok(progress);
}

/**
 * Server-side watch progress upsert with cookie-supported session or explicit user ID.
 */
export async function upsertServerWatchProgress(
  titleSlug: string,
  episodeNumber: number,
  progress: number,
  positionSeconds = 0,
  durationSeconds = 0,
  userId?: string
): Promise<Result<boolean, string>> {
  if (!titleSlug) return err("titleSlug is required");
  const targetId = await resolveServerUserId(userId);
  if (!targetId) return err("User is not authenticated");

  try {
    const derivedProgress =
      durationSeconds > 0
        ? Math.min(1.0, Math.max(0.0, positionSeconds / durationSeconds))
        : Math.min(1.0, Math.max(0.0, progress));

    const supabase = await createUserServerClient();
    const { error } = await supabase.from("watch_history").upsert(
      {
        user_id: targetId,
        title_slug: titleSlug,
        episode_number: episodeNumber,
        progress: derivedProgress,
        position_seconds: Math.max(0, Math.floor(positionSeconds)),
        duration_seconds: Math.max(0, Math.floor(durationSeconds)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,title_slug" }
    );

    if (error) {
      return err(error.message || "Failed to persist watch progress");
    }
    return ok(true);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error updating watch history");
  }
}

