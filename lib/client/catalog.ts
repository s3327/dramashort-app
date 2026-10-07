import { adminFetch } from "@/lib/api/admin-fetch";
import { getApiErrorMessage, readJsonSafely } from "@/lib/api/error-message";
import type {
  Drama,
  Title,
  TitleStatus,
  PlaybackSource,
} from "@/types/content";
import { type Result, ok, err } from "@/lib/common/result";

export interface DramaQueryOptions {
  query?: string;
  search?: string;
  genre?: string;
  channelId?: string;
  channelName?: string;
  channelSlug?: string;
  tags?: string[];
  sort?: "trending" | "newest" | "rating";
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
}

export type TitleQueryOptions = DramaQueryOptions;

export interface PaginatedDramasResult {
  items: Drama[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string | null;
}

export type PaginatedTitlesResult = PaginatedDramasResult;

export interface AdminDramaQueryOptions {
  q?: string;
  channel?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

export interface AdminDramasResult {
  items: Drama[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateDramaPayload {
  title: string;
  slug?: string;
  synopsis?: string;
  genre?: string;
  tags?: string[] | string;
  channel?: string;
  channel_name?: string;
  totalEpisodes?: number;
  total_episodes?: number;
  episodesAvailable?: number;
  episodes_available?: number;
  poster?: string;
  poster_url?: string;
  banner?: string;
  banner_url?: string;
  status?: TitleStatus;
}

export type CreateTitlePayload = CreateDramaPayload;

export interface UpdateDramaPayload {
  title?: string;
  slug?: string;
  synopsis?: string;
  genre?: string;
  tags?: string[] | string;
  channel?: string;
  channel_name?: string;
  channel_code?: string;
  channel_id?: string | null;
  status?: TitleStatus;
  totalEpisodes?: number;
  total_episodes?: number;
  episodesAvailable?: number;
  episodes_available?: number;
  poster?: string;
  poster_url?: string;
  banner?: string;
  banner_url?: string;
}

export type UpdateTitlePayload = UpdateDramaPayload;

/**
 * Client-side fetch helper: retrieves published dramas through client-side query or API route.
 * Suitable for dynamic search and filter requests executed from browser islands.
 */
export async function fetchPublishedDramas(
  options?: DramaQueryOptions
): Promise<Result<PaginatedDramasResult, string>> {
  try {
    const params = new URLSearchParams();
    if (options?.query || options?.search) {
      params.set("q", (options.query || options.search || "").trim());
    }
    if (options?.genre && options.genre !== "All" && options.genre !== "All Genres") {
      params.set("genre", options.genre);
    }
    if (options?.channelId) params.set("channelId", options.channelId);
    if (options?.channelSlug) params.set("channelSlug", options.channelSlug);
    if (options?.sort) params.set("sort", options.sort);
    if (options?.page) params.set("page", String(options.page));
    if (options?.pageSize) params.set("pageSize", String(options.pageSize));

    const res = await fetch(`/api/dramas?${params.toString()}`);
    if (!res.ok) {
      return err(`Failed to fetch dramas (HTTP ${res.status})`);
    }
    const data = (await readJsonSafely(res)) as { success?: boolean; data?: PaginatedDramasResult } | null;
    if (data?.data) {
      return ok(data.data);
    }
    return err("Invalid response format");
  } catch (error) {
    return err(error instanceof Error ? error.message : "Network error fetching dramas");
  }
}

/** Backward-compatible alias for fetchPublishedDramas */
export const fetchPublishedTitles = fetchPublishedDramas;

/**
 * Client-side fetch helper: gets secure signed playback session for an episode (Task 10.6).
 */
export async function fetchEpisodePlayback(
  episodeId: string
): Promise<Result<PlaybackSource, string>> {
  try {
    const res = await fetch(`/api/playback/${encodeURIComponent(episodeId)}`);
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: PlaybackSource;
      error?: { code: string; message: string };
    } | null;

    if (!res.ok || !json?.success || !json.data) {
      return err(getApiErrorMessage(json, `Failed to load playback (HTTP ${res.status})`));
    }

    return ok(json.data);
  } catch (error) {
    return err(
      error instanceof Error ? error.message : "Network error loading video playback"
    );
  }
}

/**
 * Client-side fetch helper: loads admin dramas list using adminFetch.
 */
export async function fetchAdminDramas(
  options?: AdminDramaQueryOptions
): Promise<Result<AdminDramasResult, string>> {
  const page = Math.max(1, options?.page || 1);
  const pageSize = Math.min(250, Math.max(1, options?.pageSize || 20));

  const params = new URLSearchParams();
  if (options?.q) params.set("q", options.q);
  if (options?.channel && options.channel !== "All Channels" && options.channel !== "All") {
    params.set("channel", options.channel);
  }
  if (options?.status && options.status !== "all" && options.status !== "All Statuses" && options.status !== "All") {
    params.set("status", options.status);
  }
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (options?.sort) params.set("sort", options.sort);

  try {
    const res = await adminFetch(`/api/admin/dramas?${params.toString()}`);
    if (!res.ok) {
      return err(`Admin API failed with HTTP ${res.status}`);
    }
    const json = (await readJsonSafely(res)) as {
      success?: boolean;
      data?: AdminDramasResult | Drama[];
    } | null;

    if (json?.success && json.data) {
      if ("items" in json.data && Array.isArray(json.data.items)) {
        return ok(json.data as AdminDramasResult);
      }
      if (Array.isArray(json.data)) {
        return ok({
          items: json.data,
          total: json.data.length,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(json.data.length / pageSize)),
        });
      }
    }
    return err("Invalid admin dramas response");
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error fetching admin dramas");
  }
}

/**
 * Client-side fetch helper: retrieves a single drama by ID for admin editing.
 */
export async function fetchDramaById(id: string): Promise<Result<Drama, string>> {
  if (!id) return err("Drama ID is required");

  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}`);
    if (!res.ok) {
      return err(`Admin API lookup failed with HTTP ${res.status}`);
    }
    const body = (await readJsonSafely(res)) as { success?: boolean; data?: Drama } | null;
    if (body?.success && body.data) {
      return ok(body.data);
    }
    return err("Drama not found");
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error loading drama details");
  }
}

/** Backward-compatible alias for fetchDramaById */
export const fetchTitleById = fetchDramaById;

/**
 * Client-side fetch helper: creates a new drama via admin API.
 */
export async function fetchCreateDrama(
  payload: CreateDramaPayload
): Promise<Result<Drama, string>> {
  try {
    const res = await adminFetch("/api/admin/dramas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await readJsonSafely(res)) as { success?: boolean; data?: Drama } | null;
    if (!res.ok || !data?.success || !data.data) {
      return err(getApiErrorMessage(data, `Creation failed with HTTP ${res.status}`));
    }

    return ok(data.data);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Network error creating drama");
  }
}

/** Backward-compatible alias for fetchCreateDrama */
export const fetchCreateTitle = fetchCreateDrama;

/**
 * Client-side fetch helper: updates an existing drama via admin API.
 */
export async function fetchUpdateDrama(
  id: string,
  payload: UpdateDramaPayload
): Promise<Result<Drama, string>> {
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await readJsonSafely(res)) as { success?: boolean; data?: Drama } | null;
    if (!res.ok || !data?.success || !data.data) {
      return err(getApiErrorMessage(data, `Update failed with HTTP ${res.status}`));
    }

    return ok(data.data);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Network error updating drama");
  }
}

/** Backward-compatible alias for fetchUpdateDrama */
export const fetchUpdateTitle = fetchUpdateDrama;

/**
 * Client-side fetch helper: deletes an existing drama via admin API.
 */
export async function fetchDeleteDrama(
  id: string
): Promise<Result<boolean, string>> {
  if (!id) return err("Drama ID is required");
  try {
    const res = await adminFetch(`/api/admin/dramas/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      return err(`Admin API delete failed with HTTP ${res.status}`);
    }
    return ok(true);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Network error deleting drama");
  }
}

/** Backward-compatible alias for fetchDeleteDrama */
export const fetchDeleteTitle = fetchDeleteDrama;

