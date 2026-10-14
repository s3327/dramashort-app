import { createUserClient } from "@/lib/supabase/user-client";
import type { Database } from "@/types/supabase";
import type { ListDef } from "@/contexts/FavoritesContext";
import { type Result, ok, err } from "@/lib/common/result";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type WatchHistoryRow = Database["public"]["Tables"]["watch_history"]["Row"];

export async function getUserProfile(userId: string): Promise<ProfileRow | null> {
  try {
    const supabase = createUserClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return null;
  }
}

export async function getUserProfileResult(
  userId: string
): Promise<Result<ProfileRow, string>> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    return err("User profile not found");
  }
  return ok(profile);
}

export async function updateUserProfile(
  userId: string,
  updates: { display_name?: string; avatar_url?: string }
): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", userId);

    return !error;
  } catch (err) {
    console.error("Error updating user profile:", err);
    return false;
  }
}

/**
 * Favorites Operations (Browser / Client-Side)
 */
export async function getUserFavorites(userId: string): Promise<string[]> {
  try {
    const supabase = createUserClient();
    const { data, error } = await supabase
      .from("favorites")
      .select("title_slug")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => row.title_slug);
  } catch (err) {
    console.error("Error fetching favorites:", err);
    return [];
  }
}

export async function getUserFavoritesResult(
  userId: string
): Promise<Result<string[], string>> {
  try {
    const favs = await getUserFavorites(userId);
    return ok(favs);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error fetching favorites");
  }
}

export async function addUserFavorite(userId: string, titleSlug: string): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase
      .from("favorites")
      .upsert({ user_id: userId, title_slug: titleSlug }, { onConflict: "user_id,title_slug" });

    return !error;
  } catch (err) {
    console.error("Error adding favorite:", err);
    return false;
  }
}

export async function addUserFavorites(userId: string, titleSlugs: string[]): Promise<boolean> {
  if (titleSlugs.length === 0) return true;
  try {
    const supabase = createUserClient();
    const rows = titleSlugs.map((slug) => ({ user_id: userId, title_slug: slug }));
    const { error } = await supabase
      .from("favorites")
      .upsert(rows, { onConflict: "user_id,title_slug" });

    return !error;
  } catch (err) {
    console.error("Error bulk adding favorites:", err);
    return false;
  }
}

export async function removeUserFavorite(userId: string, titleSlug: string): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("title_slug", titleSlug);

    return !error;
  } catch (err) {
    console.error("Error removing favorite:", err);
    return false;
  }
}

/**
 * Custom Lists Operations (Browser / Client-Side)
 */
export async function getUserCustomLists(userId: string): Promise<ListDef[]> {
  try {
    const supabase = createUserClient();
    const { data: lists, error: listErr } = await supabase
      .from("custom_lists")
      .select("id, title")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (listErr || !lists) return [];

    const listIds = lists.map((l) => l.id);
    if (listIds.length === 0) return [];

    const { data: items } = await supabase
      .from("custom_list_items")
      .select("list_id, title_slug")
      .in("list_id", listIds);

    const itemsMap = new Map<string, string[]>();
    items?.forEach((it) => {
      const existing = itemsMap.get(it.list_id) || [];
      existing.push(it.title_slug);
      itemsMap.set(it.list_id, existing);
    });

    return lists.map((l) => ({
      id: l.id,
      title: l.title,
      itemSlugs: itemsMap.get(l.id) || [],
    }));
  } catch (err) {
    console.error("Error fetching custom lists:", err);
    return [];
  }
}

export async function createCustomList(userId: string, title: string): Promise<string | null> {
  try {
    const supabase = createUserClient();
    const { data, error } = await supabase
      .from("custom_lists")
      .insert({ user_id: userId, title })
      .select("id")
      .single();

    if (error || !data) return null;
    return data.id;
  } catch (err) {
    console.error("Error creating custom list:", err);
    return null;
  }
}

export async function addItemToCustomList(listId: string, titleSlug: string): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase
      .from("custom_list_items")
      .upsert({ list_id: listId, title_slug: titleSlug }, { onConflict: "list_id,title_slug" });

    return !error;
  } catch (err) {
    console.error("Error adding item to list:", err);
    return false;
  }
}

export async function addItemsToCustomList(
  listId: string,
  titleSlugs: string[]
): Promise<boolean> {
  if (titleSlugs.length === 0) return true;
  try {
    const supabase = createUserClient();
    const rows = titleSlugs.map((slug) => ({
      list_id: listId,
      title_slug: slug,
    }));
    const { error } = await supabase
      .from("custom_list_items")
      .upsert(rows, { onConflict: "list_id,title_slug" });

    return !error;
  } catch (err) {
    console.error("Error bulk adding items to custom list:", err);
    return false;
  }
}

export async function renameCustomList(
  listId: string,
  newTitle: string
): Promise<boolean> {
  try {
    const trimmed = newTitle.trim();
    if (!trimmed) return false;
    const supabase = createUserClient();
    const { error } = await supabase
      .from("custom_lists")
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq("id", listId);

    return !error;
  } catch (err) {
    console.error("Error renaming custom list:", err);
    return false;
  }
}

export async function deleteCustomList(listId: string): Promise<boolean> {
  try {
    const supabase = createUserClient();
    await supabase.from("custom_list_items").delete().eq("list_id", listId);
    const { error } = await supabase.from("custom_lists").delete().eq("id", listId);

    return !error;
  } catch (err) {
    console.error("Error deleting custom list:", err);
    return false;
  }
}

export async function removeItemFromCustomList(
  listId: string,
  titleSlug: string
): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase
      .from("custom_list_items")
      .delete()
      .eq("list_id", listId)
      .eq("title_slug", titleSlug);

    return !error;
  } catch (err) {
    console.error("Error removing item from custom list:", err);
    return false;
  }
}

/**
 * Watch History Operations (Browser / Client-Side)
 */
export async function getUserWatchHistory(userId: string): Promise<WatchHistoryRow[]> {
  try {
    const supabase = createUserClient();
    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data;
  } catch (err) {
    console.error("Error fetching watch history:", err);
    return [];
  }
}

export async function getUserWatchHistoryResult(
  userId: string
): Promise<Result<WatchHistoryRow[], string>> {
  try {
    const history = await getUserWatchHistory(userId);
    return ok(history);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error fetching watch history");
  }
}

export async function upsertWatchProgress(
  userId: string,
  titleSlug: string,
  episodeNumber: number,
  progress: number,
  positionSeconds = 0,
  durationSeconds = 0
): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const derivedProgress =
      durationSeconds > 0
        ? Math.min(1.0, Math.max(0.0, positionSeconds / durationSeconds))
        : Math.min(1.0, Math.max(0.0, progress));

    const { error } = await supabase.from("watch_history").upsert(
      {
        user_id: userId,
        title_slug: titleSlug,
        episode_number: episodeNumber,
        progress: derivedProgress,
        position_seconds: Math.max(0, Math.floor(positionSeconds)),
        duration_seconds: Math.max(0, Math.floor(durationSeconds)),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,title_slug" }
    );

    return !error;
  } catch (err) {
    console.error("Error updating watch history:", err);
    return false;
  }
}

/**
 * Single-row watch progress lookup for a specific drama (Task 12.3).
 */
export async function getWatchProgress(
  userId: string,
  titleSlug: string
): Promise<WatchHistoryRow | null> {
  try {
    const supabase = createUserClient();
    const { data, error } = await supabase
      .from("watch_history")
      .select("*")
      .eq("user_id", userId)
      .eq("title_slug", titleSlug)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  } catch (err) {
    console.error("Error fetching single watch progress:", err);
    return null;
  }
}

export async function clearUserWatchHistory(userId: string): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase
      .from("watch_history")
      .delete()
      .eq("user_id", userId);

    return !error;
  } catch (err) {
    console.error("Error clearing watch history:", err);
    return false;
  }
}

export async function deleteWatchHistoryItem(
  userId: string,
  titleSlug: string
): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase
      .from("watch_history")
      .delete()
      .eq("user_id", userId)
      .eq("title_slug", titleSlug);

    return !error;
  } catch (err) {
    console.error("Error deleting watch history item:", err);
    return false;
  }
}

/**
 * Guest Watch History Management (localStorage)
 */
export const GUEST_HISTORY_KEY = "dramashort_watch_history";

export function getGuestWatchHistory(): WatchHistoryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(GUEST_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestWatchProgress(
  titleSlug: string,
  episodeNumber: number,
  progress: number,
  positionSeconds = 0,
  durationSeconds = 0
): WatchHistoryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getGuestWatchHistory();
    const derivedProgress =
      durationSeconds > 0
        ? Math.min(1.0, Math.max(0.0, positionSeconds / durationSeconds))
        : Math.min(1.0, Math.max(0.0, progress));

    const newEntry: WatchHistoryRow = {
      id: `guest-${titleSlug}`,
      user_id: "guest",
      title_slug: titleSlug,
      episode_number: episodeNumber,
      progress: derivedProgress,
      position_seconds: Math.max(0, Math.floor(positionSeconds)),
      duration_seconds: Math.max(0, Math.floor(durationSeconds)),
      updated_at: new Date().toISOString(),
    };
    const filtered = current.filter((it) => it.title_slug !== titleSlug);
    const updated = [newEntry, ...filtered].slice(0, 50);
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function getGuestWatchProgress(titleSlug: string): WatchHistoryRow | null {
  if (typeof window === "undefined") return null;
  const items = getGuestWatchHistory();
  return items.find((it) => it.title_slug === titleSlug) ?? null;
}

export function deleteGuestWatchHistoryItem(titleSlug: string): WatchHistoryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getGuestWatchHistory();
    const updated = current.filter((it) => it.title_slug !== titleSlug);
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearGuestWatchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_HISTORY_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function syncGuestWatchHistory(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const guestItems = getGuestWatchHistory();
    if (guestItems.length === 0) return;

    const supabase = createUserClient();
    const rows = guestItems.map((item) => ({
      user_id: userId,
      title_slug: item.title_slug,
      episode_number: item.episode_number,
      progress: Math.min(1.0, Math.max(0.0, item.progress)),
      position_seconds: Math.max(0, Math.floor(item.position_seconds || 0)),
      duration_seconds: Math.max(0, Math.floor(item.duration_seconds || 0)),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("watch_history")
      .upsert(rows, { onConflict: "user_id,title_slug" });

    if (!error) {
      clearGuestWatchHistory();
    }
  } catch (err) {
    console.error("Error syncing guest watch history:", err);
  }
}

/**
 * Client Progress Reporting Beacon (Task 12.3 / 13.4).
 * Uses fetch with keepalive: true or navigator.sendBeacon to reliably persist progress on unmount / pagehide.
 */
export function reportWatchProgressBeacon(payload: {
  titleSlug: string;
  episodeNumber: number;
  progress: number;
  positionSeconds: number;
  durationSeconds: number;
}): boolean {
  if (typeof window === "undefined") return false;
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/progress", blob)) {
          return true;
        }
      } catch {
        // Fall back to keepalive fetch if sendBeacon fails or throws
      }
    }
    if (typeof fetch !== "undefined") {
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Optimistic favorite computation for client-side toggling (Task 13.4 / R2).
 * Computes next list of favorited slugs and boolean status.
 */
export function computeOptimisticFavoriteToggle(
  currentSlugs: Iterable<string> | null | undefined,
  slug: string
): { nextSlugs: string[]; isFavorited: boolean } {
  const safeIterable = currentSlugs && typeof (currentSlugs as any)[Symbol.iterator] === "function"
    ? currentSlugs
    : [];
  const set = new Set(safeIterable);
  if (!slug || typeof slug !== "string") {
    return { nextSlugs: Array.from(set), isFavorited: false };
  }
  const isFavorited = !set.has(slug);
  if (isFavorited) {
    set.add(slug);
  } else {
    set.delete(slug);
  }
  return { nextSlugs: Array.from(set), isFavorited };
}


/**
 * Result-wrapped user profile update.
 */
export async function updateUserProfileResult(
  userId: string,
  updates: { display_name?: string; avatar_url?: string }
): Promise<Result<boolean, string>> {
  const okResult = await updateUserProfile(userId, updates);
  return okResult ? ok(true) : err("Failed to update user profile");
}

/**
 * Result-wrapped favorite addition.
 */
export async function addUserFavoriteResult(
  userId: string,
  titleSlug: string
): Promise<Result<boolean, string>> {
  const okResult = await addUserFavorite(userId, titleSlug);
  return okResult ? ok(true) : err("Failed to add favorite");
}

/**
 * Result-wrapped favorite removal.
 */
export async function removeUserFavoriteResult(
  userId: string,
  titleSlug: string
): Promise<Result<boolean, string>> {
  const okResult = await removeUserFavorite(userId, titleSlug);
  return okResult ? ok(true) : err("Failed to remove favorite");
}

/**
 * Result-wrapped custom list creation.
 */
export async function createCustomListResult(
  userId: string,
  title: string
): Promise<Result<string, string>> {
  const listId = await createCustomList(userId, title);
  return listId ? ok(listId) : err("Failed to create custom list");
}

/**
 * Result-wrapped watch progress update.
 */
export async function upsertWatchProgressResult(
  userId: string,
  titleSlug: string,
  episodeNumber: number,
  progress: number,
  positionSeconds = 0,
  durationSeconds = 0
): Promise<Result<boolean, string>> {
  const okResult = await upsertWatchProgress(
    userId,
    titleSlug,
    episodeNumber,
    progress,
    positionSeconds,
    durationSeconds
  );
  return okResult ? ok(true) : err("Failed to update watch progress");
}

/**
 * Result-wrapped single watch progress lookup.
 */
export async function getWatchProgressResult(
  userId: string,
  titleSlug: string
): Promise<Result<WatchHistoryRow, string>> {
  const item = await getWatchProgress(userId, titleSlug);
  return item ? ok(item) : err("Watch progress not found");
}

