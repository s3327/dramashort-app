import "server-only";
import { getContentAdminClient } from "@/lib/supabase/content";
import type { Database } from "@/types/supabase-content";
import type { Drama, Title, TitleStatus } from "@/types/content";
import { mapDramaRowToDrama } from "@/lib/server/catalog";
import {
  validateDramaPayload,
  isUuid,
  escapeLikePattern,
  DRAMA_STATUSES,
  type DramaStatus,
} from "@/lib/validation/drama";
import { resolveChannelByName } from "@/lib/admin/resolve-channel";
import { generateUniqueDramaSlug, getChannelCode } from "@/lib/slug";
import { type Result, ok, err } from "@/lib/common/result";

export type TitleInsert = Database["public"]["Tables"]["titles"]["Insert"];
export type TitleUpdate = Database["public"]["Tables"]["titles"]["Update"];

const DEFAULT_CHANNEL_NAME = "DramaShort Originals";
const DEFAULT_POSTER_URL =
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80";

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

/**
 * Direct server-side database mutation: creates a new Drama in the catalog.
 * Uses getContentAdminClient() (service role) directly without internal HTTP round-trips.
 */
export async function createDrama(
  payload: CreateDramaPayload
): Promise<Result<Drama, string>> {
  try {
    const validation = validateDramaPayload(payload, "create");
    if (!validation.ok) {
      const msg = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      return err(msg || "Validation failed");
    }

    const input = validation.value;
    const adminClient = getContentAdminClient();

    const requestedChannel =
      input.channelName ||
      payload.channel_name ||
      payload.channel ||
      DEFAULT_CHANNEL_NAME;

    const channel = await resolveChannelByName(adminClient, requestedChannel);
    const channelCode = channel?.code ?? getChannelCode(requestedChannel);

    let slug = input.slug || payload.slug;
    if (!slug) {
      slug = await generateUniqueDramaSlug(adminClient, input.title!, channelCode);
    }

    const newRow: TitleInsert = {
      title: input.title!,
      slug,
      synopsis: input.synopsis || "No synopsis available.",
      genre: input.genre ?? "Romance",
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
      channel_name: channel?.name ?? requestedChannel,
      channel_code: channelCode,
      channel_id: channel?.id ?? null,
      poster_url: input.posterUrl || payload.poster || DEFAULT_POSTER_URL,
      status: input.status ?? "Draft",
      total_episodes: input.totalEpisodes ?? 40,
      release_year: new Date().getFullYear(),
    };

    const { data, error } = await adminClient
      .from("titles")
      .insert(newRow)
      .select("*, channels(name, slug, code)")
      .single();

    if (error || !data) {
      return err(error?.message || "Failed to create drama in database");
    }

    return ok(mapDramaRowToDrama(data));
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error creating drama");
  }
}

/**
 * @deprecated Use createDrama instead. Forwarded for 100% backward compatibility.
 */
export const createTitle = createDrama;

/**
 * Direct server-side database mutation: updates an existing Drama.
 * Uses getContentAdminClient() (service role) directly without internal HTTP round-trips.
 */
export async function updateDrama(
  id: string,
  payload: UpdateDramaPayload
): Promise<Result<Drama, string>> {
  if (!id) return err("Drama ID is required");
  if (!isUuid(id)) return err("Drama id must be a valid UUID");

  try {
    const validation = validateDramaPayload(payload, "update");
    if (!validation.ok) {
      const msg = validation.errors.map((e) => `${e.field}: ${e.message}`).join(", ");
      return err(msg || "Validation failed");
    }

    const input = validation.value;
    const adminClient = getContentAdminClient();

    const updateData: TitleUpdate = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.synopsis !== undefined) updateData.synopsis = input.synopsis;
    if (input.genre !== undefined) updateData.genre = input.genre;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.totalEpisodes !== undefined) updateData.total_episodes = input.totalEpisodes;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.posterUrl !== undefined) updateData.poster_url = input.posterUrl;

    const requestedSlug = input.slug || payload.slug;
    if (requestedSlug !== undefined) {
      const { data: currentDrama, error: fetchErr } = await adminClient
        .from("titles")
        .select("slug, status")
        .eq("id", id)
        .maybeSingle();

      if (fetchErr) return err(fetchErr.message);
      if (!currentDrama) return err("Drama not found");

      if (requestedSlug !== currentDrama.slug) {
        if (currentDrama.status === "Published") {
          return err("Slug cannot be modified once a drama has been published.");
        }
        updateData.slug = requestedSlug;
      }
    }

    const requestedChannel =
      input.channelName ||
      payload.channel_name ||
      payload.channel;

    if (requestedChannel !== undefined) {
      const channel = await resolveChannelByName(adminClient, requestedChannel);
      updateData.channel_name = channel?.name ?? requestedChannel;
      if (channel) {
        updateData.channel_code = channel.code;
        updateData.channel_id = channel.id;
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await adminClient
      .from("titles")
      .update(updateData)
      .eq("id", id)
      .select("*, channels(name, slug, code)")
      .maybeSingle();

    if (error) {
      return err(error.message || "Failed to update drama in database");
    }
    if (!data) {
      return err("Drama not found");
    }

    return ok(mapDramaRowToDrama(data));
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error updating drama");
  }
}

/** Backward-compatible alias for updateDrama */
export const updateTitle = updateDrama;

/**
 * Direct server-side database mutation: deletes a Drama by primary ID.
 * Uses getContentAdminClient() (service role) directly without internal HTTP round-trips.
 */
export async function deleteDrama(id: string): Promise<Result<boolean, string>> {
  if (!id) return err("Drama ID is required");
  if (!isUuid(id)) return err("Drama id must be a valid UUID");

  try {
    const adminClient = getContentAdminClient();
    const { error } = await adminClient.from("titles").delete().eq("id", id);
    if (error) {
      return err(error.message || "Failed to delete drama");
    }
    return ok(true);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error deleting drama");
  }
}

/** Backward-compatible alias for deleteDrama */
export const deleteTitle = deleteDrama;

/**
 * Fetches a single drama by ID for administrative editing directly from Content DB.
 */
export async function getAdminDramaById(id: string): Promise<Drama | null> {
  if (!id) return null;
  try {
    const adminClient = getContentAdminClient();
    const { data, error } = await adminClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .eq("id", id)
      .maybeSingle();

    if (!error && data) {
      return mapDramaRowToDrama(data);
    }
  } catch (err) {
    console.warn("getAdminDramaById lookup failed:", err);
  }
  return null;
}

/** Backward-compatible alias for getAdminDramaById */
export const getTitleById = getAdminDramaById;
export const getDramaById = getAdminDramaById;

/**
 * Result-wrapped administrative drama lookup by ID.
 */
export async function getAdminDramaByIdResult(
  id: string
): Promise<Result<Drama, string>> {
  const drama = await getAdminDramaById(id);
  if (!drama) {
    return err(`Drama not found with id: ${id}`);
  }
  return ok(drama);
}

export const getTitleByIdResult = getAdminDramaByIdResult;
export const getDramaByIdResult = getAdminDramaByIdResult;

/**
 * Fetches dramas for the administrative catalog directly from Content DB.
 */
export async function getAdminDramas(
  options?: AdminDramaQueryOptions
): Promise<AdminDramasResult> {
  const page = Math.max(1, options?.page || 1);
  const pageSize = Math.min(250, Math.max(1, options?.pageSize || 20));

  try {
    const adminClient = getContentAdminClient();
    let query = adminClient
      .from("titles")
      .select("*, channels(name, slug, code)", { count: "exact" });

    if (options?.q?.trim()) {
      query = query.ilike("title", `%${escapeLikePattern(options.q.trim())}%`);
    }
    if (options?.channel && options.channel !== "All Channels" && options.channel !== "All") {
      query = query.eq("channel_name", options.channel);
    }
    if (
      options?.status &&
      options.status !== "all" &&
      options.status !== "All Statuses" &&
      options.status !== "All" &&
      DRAMA_STATUSES.includes(options.status as DramaStatus)
    ) {
      query = query.eq("status", options.status);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to);

    const { data, count, error } = await query;
    if (!error && data) {
      const items = data.map(mapDramaRowToDrama);
      const total = count !== null && count !== undefined ? count : items.length;
      return {
        items,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }
  } catch (err) {
    console.warn("getAdminDramas direct lookup failed:", err);
  }

  return {
    items: [],
    total: 0,
    page,
    pageSize,
    totalPages: 1,
  };
}

/**
 * Result-wrapped administrative catalog query.
 */
export async function getAdminDramasResult(
  options?: AdminDramaQueryOptions
): Promise<Result<AdminDramasResult, string>> {
  try {
    const result = await getAdminDramas(options);
    return ok(result);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error querying admin dramas");
  }
}

