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
import { recordAuditLog } from "@/lib/server/audit";
import { revalidatePath, revalidateTag } from "next/cache";

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

export interface DeleteDramaOptions {
  hardDelete?: boolean;
  actor?: { id?: string | null; email?: string | null; ip?: string | null };
}

/**
 * Direct server-side database mutation: deletes or archives a Drama by primary ID.
 * - If hardDelete is true: allowed ONLY for never-published drafts (has_been_published !== true and status === 'Draft').
 * - Otherwise defaults to soft delete (status = 'Archived').
 */
export async function deleteDrama(
  id: string,
  options?: DeleteDramaOptions
): Promise<Result<boolean, string>> {
  if (!id) return err("Drama ID is required");
  if (!isUuid(id)) return err("Drama id must be a valid UUID");

  try {
    const adminClient = getContentAdminClient();
    const { data: drama, error: fetchErr } = await adminClient
      .from("titles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return err(fetchErr.message || "Failed to load drama");
    }
    if (!drama) {
      return err("Drama not found");
    }

    const isHard = options?.hardDelete === true;

    if (isHard) {
      if (drama.has_been_published || drama.status === "Published") {
        return err("Published dramas cannot be permanently deleted. Please archive them instead.");
      }

      const { error: delErr } = await adminClient.from("titles").delete().eq("id", id);
      if (delErr) {
        return err(delErr.message || "Failed to delete drama");
      }

      await recordAuditLog({
        actorId: options?.actor?.id,
        actorEmail: options?.actor?.email,
        action: "drama.hard_delete",
        entityType: "drama",
        entityId: id,
        before: drama,
        after: null,
        ip: options?.actor?.ip,
      });

      try {
        revalidateTag("titles");
        revalidateTag("dramas");
        revalidatePath("/");
        revalidatePath("/browse");
      } catch {
        // Safe inside test contexts
      }

      return ok(true);
    }

    // Default: Soft delete (Archive)
    const { error: archiveErr } = await adminClient
      .from("titles")
      .update({
        status: "Archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (archiveErr) {
      return err(archiveErr.message || "Failed to archive drama");
    }

    await recordAuditLog({
      actorId: options?.actor?.id,
      actorEmail: options?.actor?.email,
      action: "drama.archive",
      entityType: "drama",
      entityId: id,
      before: drama,
      after: { ...drama, status: "Archived" },
      ip: options?.actor?.ip,
    });

    try {
      revalidateTag("titles");
      revalidateTag("dramas");
      revalidatePath("/");
      revalidatePath("/browse");
    } catch {
      // Safe inside test contexts
    }

    return ok(true);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error deleting drama");
  }
}

/** Backward-compatible alias for deleteDrama */
export const deleteTitle = deleteDrama;

/**
 * Duplicates an existing drama (metadata only).
 * Sets status to 'Draft', episodes_available to 0, has_been_published to false, publish_at to null.
 * Generates a collision-safe deterministic unique slug.
 */
export async function duplicateDramaServer(
  id: string,
  actor?: { id?: string | null; email?: string | null; ip?: string | null }
): Promise<Result<Drama, string>> {
  if (!id) return err("Drama ID is required");
  if (!isUuid(id)) return err("Drama id must be a valid UUID");

  try {
    const adminClient = getContentAdminClient();
    const { data: original, error: fetchErr } = await adminClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) {
      return err(fetchErr.message || "Failed to load original drama");
    }
    if (!original) {
      return err("Drama not found");
    }

    const duplicateTitle = `${original.title} (Copy)`;
    const channelCode = original.channel_code || "DS";
    const newSlug = await generateUniqueDramaSlug(adminClient, duplicateTitle, channelCode);

    const insertPayload: TitleInsert = {
      title: duplicateTitle,
      slug: newSlug,
      synopsis: original.synopsis || "",
      genre: original.genre || "Romance",
      tags: original.tags || [],
      channel_id: original.channel_id,
      channel_name: original.channel_name,
      channel_code: original.channel_code,
      total_episodes: original.total_episodes || 1,
      episodes_available: 0,
      poster_url: original.poster_url || DEFAULT_POSTER_URL,
      banner_url: original.banner_url || null,
      status: "Draft",
      has_been_published: false,
      publish_at: null,
      views_count: 0,
      rating: 0,
      release_year: new Date().getFullYear(),
    };

    const { data: inserted, error: insertErr } = await adminClient
      .from("titles")
      .insert(insertPayload)
      .select("*, channels(name, slug, code)")
      .single();

    if (insertErr || !inserted) {
      return err(insertErr?.message || "Failed to create duplicated drama");
    }

    await recordAuditLog({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: "drama.duplicate",
      entityType: "drama",
      entityId: inserted.id,
      before: { source_id: id, original_title: original.title },
      after: inserted,
      ip: actor?.ip,
    });

    try {
      revalidateTag("titles");
      revalidateTag("dramas");
      revalidatePath("/");
      revalidatePath("/browse");
    } catch {
      // Safe inside test contexts
    }

    return ok(mapDramaRowToDrama(inserted));
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error duplicating drama");
  }
}

export type BulkDramaAction = "publish" | "unpublish" | "archive" | "move_channel";

export interface BulkDramaActionPayload {
  action: BulkDramaAction;
  ids: string[];
  channelName?: string;
  actor?: { id?: string | null; email?: string | null; ip?: string | null };
}

export interface BulkDramaActionResult {
  action: BulkDramaAction;
  total: number;
  affected: number;
  skipped: number;
  errors: Array<{ id: string; title?: string; error: string }>;
}

/**
 * Performs bulk lifecycle actions across selected dramas.
 */
export async function bulkUpdateDramasServer(
  payload: BulkDramaActionPayload
): Promise<Result<BulkDramaActionResult, string>> {
  const { action, ids, channelName, actor } = payload;
  if (!Array.isArray(ids) || ids.length === 0) {
    return err("ids must be a non-empty array of drama UUIDs");
  }
  for (const id of ids) {
    if (!isUuid(id)) {
      return err(`Invalid drama UUID: ${id}`);
    }
  }

  const validActions: BulkDramaAction[] = ["publish", "unpublish", "archive", "move_channel"];
  if (!validActions.includes(action)) {
    return err(`Invalid bulk action: ${action}. Must be one of ${validActions.join(", ")}`);
  }

  try {
    const adminClient = getContentAdminClient();
    const { data: dramas, error: fetchErr } = await adminClient
      .from("titles")
      .select("*")
      .in("id", ids);

    if (fetchErr) {
      return err(fetchErr.message || "Failed to fetch dramas for bulk operation");
    }
    if (!dramas || dramas.length === 0) {
      return err("No matching dramas found for the specified IDs");
    }

    const result: BulkDramaActionResult = {
      action,
      total: ids.length,
      affected: 0,
      skipped: 0,
      errors: [],
    };

    if (action === "publish") {
      const eligibleIds: string[] = [];

      for (const drama of dramas) {
        const { data: episodes, error: epErr } = await adminClient
          .from("episodes")
          .select("id, video_url")
          .eq("title_id", drama.id);

        if (epErr || !episodes || episodes.length === 0) {
          result.skipped++;
          result.errors.push({
            id: drama.id,
            title: drama.title,
            error: "Cannot publish drama with 0 ready episodes",
          });
          continue;
        }

        const epIds = (episodes as Array<{ id: string; video_url?: string | null }>).map((e) => e.id);
        const { data: mediaRows } = await adminClient
          .from("episode_media")
          .select("id, status, hls_url, mp4_url, asset_ref")
          .in("episode_id", epIds);

        const hasReadyMedia =
          (mediaRows &&
            mediaRows.some(
              (m: any) =>
                m.status === "ready" &&
                Boolean(m.hls_url || m.mp4_url || m.asset_ref)
            )) ||
          episodes.some((e: any) => Boolean(e.video_url && e.video_url.trim() !== ""));

        if (!hasReadyMedia) {
          result.skipped++;
          result.errors.push({
            id: drama.id,
            title: drama.title,
            error: "Cannot publish drama with 0 ready episodes",
          });
          continue;
        }

        eligibleIds.push(drama.id);
      }

      if (eligibleIds.length > 0) {
        const { error: updateErr } = await adminClient
          .from("titles")
          .update({
            status: "Published",
            has_been_published: true,
            updated_at: new Date().toISOString(),
          })
          .in("id", eligibleIds);

        if (updateErr) {
          return err(updateErr.message || "Failed to publish dramas");
        }

        result.affected = eligibleIds.length;

        for (const id of eligibleIds) {
          const drama = (dramas as any[]).find((d) => d.id === id);
          await recordAuditLog({
            actorId: actor?.id,
            actorEmail: actor?.email,
            action: "drama.bulk_publish",
            entityType: "drama",
            entityId: id,
            before: drama,
            after: { ...drama, status: "Published", has_been_published: true },
            ip: actor?.ip,
          });
        }
      }
    } else if (action === "unpublish") {
      const { error: updateErr } = await adminClient
        .from("titles")
        .update({
          status: "Draft",
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (updateErr) {
        return err(updateErr.message || "Failed to unpublish dramas");
      }

      result.affected = dramas.length;

      for (const drama of dramas) {
        await recordAuditLog({
          actorId: actor?.id,
          actorEmail: actor?.email,
          action: "drama.bulk_unpublish",
          entityType: "drama",
          entityId: drama.id,
          before: drama,
          after: { ...drama, status: "Draft" },
          ip: actor?.ip,
        });
      }
    } else if (action === "archive") {
      const { error: updateErr } = await adminClient
        .from("titles")
        .update({
          status: "Archived",
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (updateErr) {
        return err(updateErr.message || "Failed to archive dramas");
      }

      result.affected = dramas.length;

      for (const drama of dramas) {
        await recordAuditLog({
          actorId: actor?.id,
          actorEmail: actor?.email,
          action: "drama.bulk_archive",
          entityType: "drama",
          entityId: drama.id,
          before: drama,
          after: { ...drama, status: "Archived" },
          ip: actor?.ip,
        });
      }
    } else if (action === "move_channel") {
      if (!channelName || !channelName.trim()) {
        return err("channelName is required when moving dramas to another channel");
      }

      const targetChannel = await resolveChannelByName(adminClient, channelName.trim());
      if (!targetChannel) {
        return err(`Target channel not found: ${channelName}`);
      }

      const { error: updateErr } = await adminClient
        .from("titles")
        .update({
          channel_id: targetChannel.id,
          channel_name: targetChannel.name,
          channel_code: targetChannel.code,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (updateErr) {
        return err(updateErr.message || "Failed to update drama channels");
      }

      result.affected = dramas.length;

      for (const drama of dramas) {
        await recordAuditLog({
          actorId: actor?.id,
          actorEmail: actor?.email,
          action: "drama.bulk_move_channel",
          entityType: "drama",
          entityId: drama.id,
          before: { channel_name: drama.channel_name, channel_code: drama.channel_code },
          after: { channel_name: targetChannel.name, channel_code: targetChannel.code },
          ip: actor?.ip,
        });
      }
    }

    try {
      revalidateTag("titles");
      revalidateTag("dramas");
      revalidatePath("/");
      revalidatePath("/browse");
    } catch {
      // Safe inside test contexts
    }

    return ok(result);
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error performing bulk drama update");
  }
}

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

