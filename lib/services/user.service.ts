import { createUserClient } from "@/lib/supabase/user-client";
import type { Database } from "@/types/supabase-user";
import type { ListDef } from "@/contexts/FavoritesContext";

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
 * Favorites Operations
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
 * Custom Lists Operations
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

/**
 * Watch History Operations
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

export async function upsertWatchProgress(
  userId: string,
  titleSlug: string,
  episodeNumber: number,
  progress: number
): Promise<boolean> {
  try {
    const supabase = createUserClient();
    const { error } = await supabase.from("watch_history").upsert(
      {
        user_id: userId,
        title_slug: titleSlug,
        episode_number: episodeNumber,
        progress: Math.min(1.0, Math.max(0.0, progress)),
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
  progress: number
): WatchHistoryRow[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getGuestWatchHistory();
    const newEntry: WatchHistoryRow = {
      id: `guest-${titleSlug}`,
      user_id: "guest",
      title_slug: titleSlug,
      episode_number: episodeNumber,
      progress: Math.min(1.0, Math.max(0.0, progress)),
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
    for (const item of guestItems) {
      await upsertWatchProgress(userId, item.title_slug, item.episode_number, item.progress);
    }
    localStorage.removeItem(GUEST_HISTORY_KEY);
  } catch (err) {
    console.error("Error syncing guest watch history:", err);
  }
}
