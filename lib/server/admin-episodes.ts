import "server-only";
import { getContentAdminClient } from "@/lib/supabase/content";
import type {
  AdminEpisode,
  AdminEpisodeMedia,
  EpisodeMediaStatus,
  CreateEpisodeInput,
  BulkCreateEpisodesInput,
  BulkAssignMediaItem,
  UpdateEpisodeInput,
} from "@/types/content";
import { type Result, ok, err } from "@/lib/common/result";
import { recordAuditLog } from "./audit";

function computeMediaStatus(
  mediaRow: any,
  legacyVideoUrl?: string | null
): EpisodeMediaStatus {
  if (mediaRow) {
    if (mediaRow.status === "ready") return "ready";
    if (mediaRow.status === "processing") return "processing";
    if (mediaRow.status === "error") return "error";
    if (mediaRow.hls_url || mediaRow.mp4_url || mediaRow.asset_ref) return "ready";
  }
  if (legacyVideoUrl && legacyVideoUrl.trim() !== "") {
    return "ready";
  }
  return "missing";
}

function mapToAdminEpisode(epRow: any, mediaRow: any): AdminEpisode {
  const mediaStatus = computeMediaStatus(mediaRow, epRow.video_url);

  let media: AdminEpisodeMedia | null = null;
  if (mediaRow) {
    media = {
      id: mediaRow.id,
      provider: mediaRow.provider || "custom",
      assetRef: mediaRow.asset_ref || null,
      hlsUrl: mediaRow.hls_url || null,
      mp4Url: mediaRow.mp4_url || null,
      durationSeconds: mediaRow.duration_seconds ?? epRow.duration_seconds ?? 0,
      aspectRatio: mediaRow.aspect_ratio || "9:16",
      status: (mediaRow.status as EpisodeMediaStatus) || mediaStatus,
    };
  } else if (epRow.video_url) {
    const isHls = epRow.video_url.includes(".m3u8");
    media = {
      provider: "custom",
      assetRef: null,
      hlsUrl: isHls ? epRow.video_url : null,
      mp4Url: !isHls ? epRow.video_url : null,
      durationSeconds: epRow.duration_seconds ?? 0,
      aspectRatio: "9:16",
      status: "ready",
    };
  }

  return {
    id: epRow.id,
    titleId: epRow.title_id,
    episodeNumber: epRow.episode_number,
    title: epRow.title || `Episode ${epRow.episode_number}`,
    thumbnailUrl: epRow.thumbnail_url || null,
    durationSeconds: epRow.duration_seconds ?? (media?.durationSeconds ?? 0),
    isFree: epRow.is_free ?? true,
    releaseAt: epRow.release_at || null,
    createdAt: epRow.created_at || new Date().toISOString(),
    mediaStatus,
    media,
  };
}

/**
 * Lists all episodes for a drama ordered by episode_number ASC with joined media info.
 */
export async function getAdminEpisodesServer(
  titleId: string
): Promise<Result<AdminEpisode[], string>> {
  try {
    const adminClient = getContentAdminClient();

    // Query episodes for the title
    const { data: episodes, error: epError } = await adminClient
      .from("episodes")
      .select("*")
      .eq("title_id", titleId)
      .order("episode_number", { ascending: true });

    if (epError) {
      console.error("[getAdminEpisodesServer] Episodes error:", epError);
      return err("Failed to load episodes from database.");
    }

    if (!episodes || episodes.length === 0) {
      return ok([]);
    }

    // Query episode_media for these episodes
    const episodeIds = (episodes as Array<{ id: string }>).map((e) => e.id);
    const { data: mediaRows, error: mediaError } = await adminClient
      .from("episode_media")
      .select("*")
      .in("episode_id", episodeIds);

    if (mediaError) {
      console.error("[getAdminEpisodesServer] Media error:", mediaError);
    }

    const mediaMap = new Map<string, any>();
    if (mediaRows) {
      for (const m of mediaRows) {
        mediaMap.set(m.episode_id, m);
      }
    }

    const result = (episodes as any[]).map((ep) => mapToAdminEpisode(ep, mediaMap.get(ep.id)));
    return ok(result);
  } catch (error: any) {
    console.error("[getAdminEpisodesServer] Unexpected error:", error);
    return err(error?.message || "Unexpected error loading episodes.");
  }
}

/**
 * Creates a single episode for a drama.
 */
export async function createAdminEpisodeServer(
  titleId: string,
  input: CreateEpisodeInput,
  actor?: { id?: string | null; email?: string | null; ip?: string | null }
): Promise<Result<AdminEpisode, string>> {
  try {
    const adminClient = getContentAdminClient();

    // 1. Verify title exists and get free_episodes_count
    const { data: titleRow, error: titleErr } = await adminClient
      .from("titles")
      .select("id, free_episodes_count")
      .eq("id", titleId)
      .maybeSingle();

    if (titleErr || !titleRow) {
      return err("Parent drama not found.");
    }

    const freeCount = (titleRow as any).free_episodes_count ?? 5;

    // 2. Determine episode number
    let episodeNumber = input.episodeNumber;
    if (!episodeNumber) {
      const { data: maxRow } = await adminClient
        .from("episodes")
        .select("episode_number")
        .eq("title_id", titleId)
        .order("episode_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      episodeNumber = (maxRow?.episode_number ?? 0) + 1;
    }

    // Check if episode_number already exists
    const { data: existing } = await adminClient
      .from("episodes")
      .select("id")
      .eq("title_id", titleId)
      .eq("episode_number", episodeNumber)
      .maybeSingle();

    if (existing) {
      return err(`Episode number ${episodeNumber} already exists for this drama.`);
    }

    const finalEpNum: number = episodeNumber!;
    const isFree =
      input.isFree !== undefined ? input.isFree : finalEpNum <= freeCount;
    const title = input.title || `Episode ${finalEpNum}`;

    // 3. Insert episode
    const { data: newEp, error: insertErr } = await adminClient
      .from("episodes")
      .insert({
        title_id: titleId,
        episode_number: finalEpNum,
        title,
        duration_seconds: input.durationSeconds ?? 0,
        is_free: isFree,
        thumbnail_url: input.thumbnailUrl ?? null,
        release_at: input.releaseAt ?? null,
      })
      .select("*")
      .single();

    if (insertErr || !newEp) {
      console.error("[createAdminEpisodeServer] Insert error:", insertErr);
      return err(insertErr?.message || "Failed to create episode.");
    }

    // 4. If media info provided, insert into episode_media
    let mediaRow: any = null;
    const hlsUrl = input.hlsUrl || (input.videoUrl?.includes(".m3u8") ? input.videoUrl : null);
    const mp4Url = input.mp4Url || (!input.videoUrl?.includes(".m3u8") ? input.videoUrl : null);
    const assetRef = input.assetRef || null;
    const provider = input.provider || "custom";

    if (hlsUrl || mp4Url || assetRef) {
      const { data: createdMedia, error: mediaInsertErr } = await adminClient
        .from("episode_media")
        .insert({
          episode_id: newEp.id,
          provider,
          asset_ref: assetRef,
          hls_url: hlsUrl,
          mp4_url: mp4Url,
          duration_seconds: input.durationSeconds ?? 0,
          aspect_ratio: "9:16",
          status: "ready",
        })
        .select("*")
        .single();

      if (mediaInsertErr) {
        console.error("[createAdminEpisodeServer] Media insert error:", mediaInsertErr);
      } else {
        mediaRow = createdMedia;
      }
    }

    // 5. Update titles.total_episodes
    const { count } = await adminClient
      .from("episodes")
      .select("id", { count: "exact", head: true })
      .eq("title_id", titleId);

    if (count !== null) {
      await adminClient
        .from("titles")
        .update({ total_episodes: count })
        .eq("id", titleId);
    }

    const mapped = mapToAdminEpisode(newEp, mediaRow);

    await recordAuditLog({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: "episode.create",
      entityType: "episode",
      entityId: newEp.id,
      before: null,
      after: mapped as any,
      ip: actor?.ip,
    });

    return ok(mapped);
  } catch (error: any) {
    console.error("[createAdminEpisodeServer] Unexpected error:", error);
    return err(error?.message || "Failed to create episode.");
  }
}

/**
 * Bulk-creates a range of episodes (e.g. 1 to 80).
 */
export async function bulkCreateAdminEpisodesServer(
  titleId: string,
  input: BulkCreateEpisodesInput,
  actor?: { id?: string | null; email?: string | null; ip?: string | null }
): Promise<Result<{ createdCount: number }, string>> {
  try {
    const adminClient = getContentAdminClient();

    // 1. Verify title
    const { data: titleRow, error: titleErr } = await adminClient
      .from("titles")
      .select("id, free_episodes_count")
      .eq("id", titleId)
      .maybeSingle();

    if (titleErr || !titleRow) {
      return err("Parent drama not found.");
    }

    const freeCount = (titleRow as any).free_episodes_count ?? 5;

    // 2. Check for conflicts with existing episode numbers
    const { data: existingEpisodes } = await adminClient
      .from("episodes")
      .select("episode_number")
      .eq("title_id", titleId)
      .gte("episode_number", input.startNumber)
      .lte("episode_number", input.endNumber);

    if (existingEpisodes && existingEpisodes.length > 0) {
      const conflicting = (existingEpisodes as Array<{ episode_number: number }>).map((e) => e.episode_number).join(", ");
      return err(`Episodes already exist in this range: ${conflicting}`);
    }

    // 3. Build rows to insert
    const rowsToInsert = [];
    for (let n = input.startNumber; n <= input.endNumber; n++) {
      const isFree = input.autoFree !== false ? n <= freeCount : false;
      const title = input.titleTemplate
        ? input.titleTemplate.replace("{n}", String(n))
        : `Episode ${n}`;

      rowsToInsert.push({
        title_id: titleId,
        episode_number: n,
        title,
        duration_seconds: 0,
        is_free: isFree,
      });
    }

    // 4. Batch insert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { error: batchErr } = await adminClient.from("episodes").insert(chunk);
      if (batchErr) {
        console.error("[bulkCreateAdminEpisodesServer] Batch insert error:", batchErr);
        return err(batchErr.message || "Failed to insert episode batch.");
      }
    }

    // 5. Update titles.total_episodes
    const { count } = await adminClient
      .from("episodes")
      .select("id", { count: "exact", head: true })
      .eq("title_id", titleId);

    if (count !== null) {
      await adminClient
        .from("titles")
        .update({ total_episodes: count })
        .eq("id", titleId);
    }

    await recordAuditLog({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: "episode.bulk_create",
      entityType: "episode",
      entityId: titleId,
      before: null,
      after: {
        createdCount: rowsToInsert.length,
        startNumber: input.startNumber,
        endNumber: input.endNumber,
      },
      ip: actor?.ip,
    });

    return ok({ createdCount: rowsToInsert.length });
  } catch (error: any) {
    console.error("[bulkCreateAdminEpisodesServer] Unexpected error:", error);
    return err(error?.message || "Failed to bulk create episodes.");
  }
}

/**
 * Bulk-assigns media URLs or asset IDs to episodes.
 */
export async function bulkAssignMediaServer(
  titleId: string,
  items: BulkAssignMediaItem[]
): Promise<Result<{ updatedCount: number }, string>> {
  try {
    const adminClient = getContentAdminClient();

    // 1. Fetch all episodes for title
    const { data: episodes, error: epErr } = await adminClient
      .from("episodes")
      .select("id, episode_number")
      .eq("title_id", titleId);

    if (epErr || !episodes) {
      return err("Failed to load drama episodes.");
    }

    const epMap = new Map<number, string>();
    for (const ep of episodes) {
      epMap.set(ep.episode_number, ep.id);
    }

    let updatedCount = 0;

    for (const item of items) {
      const episodeId = epMap.get(item.episodeNumber);
      if (!episodeId) continue;

      const provider = item.provider || "custom";
      const val = item.urlOrAssetId.trim();
      const isHls = val.includes(".m3u8");
      const isMp4 = val.includes(".mp4");
      const isUrl = val.startsWith("http://") || val.startsWith("https://");

      const hlsUrl = isHls ? val : !isMp4 && isUrl ? val : null;
      const mp4Url = isMp4 ? val : null;
      const assetRef = !isUrl ? val : null;

      // Upsert episode_media
      const { error: upsertErr } = await adminClient
        .from("episode_media")
        .upsert(
          {
            episode_id: episodeId,
            provider,
            asset_ref: assetRef,
            hls_url: hlsUrl,
            mp4_url: mp4Url,
            duration_seconds: item.durationSeconds ?? 0,
            aspect_ratio: "9:16",
            status: "ready",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "episode_id, provider" }
        );

      if (upsertErr) {
        console.error(`[bulkAssignMediaServer] Upsert error for Ep ${item.episodeNumber}:`, upsertErr);
      } else {
        updatedCount++;
        // If duration provided, sync with episodes table
        if (item.durationSeconds !== undefined && item.durationSeconds > 0) {
          await adminClient
            .from("episodes")
            .update({ duration_seconds: item.durationSeconds })
            .eq("id", episodeId);
        }
      }
    }

    return ok({ updatedCount });
  } catch (error: any) {
    console.error("[bulkAssignMediaServer] Unexpected error:", error);
    return err(error?.message || "Failed to bulk assign media.");
  }
}

/**
 * Updates a single episode metadata and its media record.
 */
export async function updateAdminEpisodeServer(
  episodeId: string,
  input: UpdateEpisodeInput,
  actor?: { id?: string | null; email?: string | null; ip?: string | null }
): Promise<Result<AdminEpisode, string>> {
  try {
    const adminClient = getContentAdminClient();

    // 1. Fetch current episode
    const { data: currentEp, error: fetchErr } = await adminClient
      .from("episodes")
      .select("*")
      .eq("id", episodeId)
      .maybeSingle();

    if (fetchErr || !currentEp) {
      return err("Episode not found.");
    }

    // 2. Prepare updates for episodes table
    const epUpdate: any = {};
    if (input.title !== undefined) epUpdate.title = input.title;
    if (input.durationSeconds !== undefined) epUpdate.duration_seconds = input.durationSeconds;
    if (input.isFree !== undefined) epUpdate.is_free = input.isFree;
    if (input.thumbnailUrl !== undefined) epUpdate.thumbnail_url = input.thumbnailUrl;
    if (input.releaseAt !== undefined) epUpdate.release_at = input.releaseAt;

    let updatedEp = currentEp;
    if (Object.keys(epUpdate).length > 0) {
      const { data: updated, error: updateErr } = await adminClient
        .from("episodes")
        .update(epUpdate)
        .eq("id", episodeId)
        .select("*")
        .single();

      if (updateErr || !updated) {
        console.error("[updateAdminEpisodeServer] Update error:", updateErr);
        return err(updateErr?.message || "Failed to update episode.");
      }
      updatedEp = updated;
    }

    // 3. Handle media updates if provided
    const hasMediaUpdates =
      input.hlsUrl !== undefined ||
      input.mp4Url !== undefined ||
      input.assetRef !== undefined ||
      input.status !== undefined ||
      input.durationSeconds !== undefined;

    let mediaRow: any = null;
    if (hasMediaUpdates) {
      const provider = input.provider || "custom";

      // Fetch existing media row
      const { data: existingMedia } = await adminClient
        .from("episode_media")
        .select("*")
        .eq("episode_id", episodeId)
        .eq("provider", provider)
        .maybeSingle();

      const mediaData: any = {
        episode_id: episodeId,
        provider,
        aspect_ratio: "9:16",
        updated_at: new Date().toISOString(),
      };

      if (input.hlsUrl !== undefined) mediaData.hls_url = input.hlsUrl;
      else if (existingMedia) mediaData.hls_url = existingMedia.hls_url;

      if (input.mp4Url !== undefined) mediaData.mp4_url = input.mp4Url;
      else if (existingMedia) mediaData.mp4_url = existingMedia.mp4_url;

      if (input.assetRef !== undefined) mediaData.asset_ref = input.assetRef;
      else if (existingMedia) mediaData.asset_ref = existingMedia.asset_ref;

      if (input.durationSeconds !== undefined) mediaData.duration_seconds = input.durationSeconds;
      else if (existingMedia) mediaData.duration_seconds = existingMedia.duration_seconds;

      if (input.status !== undefined) {
        mediaData.status = input.status;
      } else {
        const hasAsset = mediaData.hls_url || mediaData.mp4_url || mediaData.asset_ref;
        mediaData.status = hasAsset ? "ready" : "processing";
      }

      const { data: upsertedMedia, error: mediaErr } = await adminClient
        .from("episode_media")
        .upsert(mediaData, { onConflict: "episode_id, provider" })
        .select("*")
        .single();

      if (mediaErr) {
        console.error("[updateAdminEpisodeServer] Media upsert error:", mediaErr);
      } else {
        mediaRow = upsertedMedia;
      }
    } else {
      const { data: existingMedia } = await adminClient
        .from("episode_media")
        .select("*")
        .eq("episode_id", episodeId)
        .maybeSingle();
      mediaRow = existingMedia;
    }

    const mapped = mapToAdminEpisode(updatedEp, mediaRow);

    await recordAuditLog({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: "episode.update",
      entityType: "episode",
      entityId: episodeId,
      before: currentEp,
      after: mapped as any,
      ip: actor?.ip,
    });

    return ok(mapped);
  } catch (error: any) {
    console.error("[updateAdminEpisodeServer] Unexpected error:", error);
    return err(error?.message || "Failed to update episode.");
  }
}

/**
 * Deletes an episode and renumbers remaining episodes safely under UNIQUE(title_id, episode_number).
 */
export async function deleteAdminEpisodeServer(
  episodeId: string,
  actor?: { id?: string | null; email?: string | null; ip?: string | null }
): Promise<Result<{ success: boolean }, string>> {
  try {
    const adminClient = getContentAdminClient();

    // 1. Fetch target episode
    const { data: targetEp, error: fetchErr } = await adminClient
      .from("episodes")
      .select("id, title_id, episode_number, title")
      .eq("id", episodeId)
      .maybeSingle();

    if (fetchErr || !targetEp) {
      return err("Episode not found.");
    }

    const titleId = targetEp.title_id;

    // 2. Delete the episode (CASCADE deletes episode_media)
    const { error: delErr } = await adminClient
      .from("episodes")
      .delete()
      .eq("id", episodeId);

    if (delErr) {
      console.error("[deleteAdminEpisodeServer] Delete error:", delErr);
      return err("Failed to delete episode.");
    }

    // 3. Fetch remaining episodes ordered by episode_number ASC
    const { data: remaining, error: remErr } = await adminClient
      .from("episodes")
      .select("id, episode_number")
      .eq("title_id", titleId)
      .order("episode_number", { ascending: true });

    if (!remErr && remaining && remaining.length > 0) {
      // Safe two-phase renumbering:
      // Phase 1: Set temporary negative episode numbers to avoid UNIQUE collisions
      for (let i = 0; i < remaining.length; i++) {
        const ep = remaining[i];
        const tempNum = -(i + 1);
        await adminClient
          .from("episodes")
          .update({ episode_number: tempNum })
          .eq("id", ep.id);
      }

      // Phase 2: Set final positive sequential episode numbers 1, 2, 3...
      for (let i = 0; i < remaining.length; i++) {
        const ep = remaining[i];
        const finalNum = i + 1;
        await adminClient
          .from("episodes")
          .update({ episode_number: finalNum })
          .eq("id", ep.id);
      }
    }

    // 4. Update titles.total_episodes
    const remainingCount = remaining ? remaining.length : 0;
    await adminClient
      .from("titles")
      .update({ total_episodes: remainingCount })
      .eq("id", titleId);

    await recordAuditLog({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: "episode.delete",
      entityType: "episode",
      entityId: episodeId,
      before: targetEp,
      after: null,
      ip: actor?.ip,
    });

    return ok({ success: true });
  } catch (error: any) {
    console.error("[deleteAdminEpisodeServer] Unexpected error:", error);
    return err(error?.message || "Failed to delete episode.");
  }
}

/**
 * Reorders episodes safely under UNIQUE(title_id, episode_number).
 */
export async function reorderAdminEpisodesServer(
  titleId: string,
  orderedEpisodeIds: string[],
  actor?: { id?: string | null; email?: string | null; ip?: string | null }
): Promise<Result<{ success: boolean }, string>> {
  try {
    const adminClient = getContentAdminClient();

    // Verify all IDs belong to this drama
    const { data: episodes, error: fetchErr } = await adminClient
      .from("episodes")
      .select("id, episode_number")
      .eq("title_id", titleId);

    if (fetchErr || !episodes) {
      return err("Failed to load drama episodes.");
    }

    const validIds = new Set((episodes as Array<{ id: string }>).map((e) => e.id));
    for (const id of orderedEpisodeIds) {
      if (!validIds.has(id)) {
        return err(`Episode ${id} does not belong to this drama.`);
      }
    }

    // Safe two-phase renumbering
    // Phase 1: Set temporary negative numbers
    for (let i = 0; i < orderedEpisodeIds.length; i++) {
      const epId = orderedEpisodeIds[i];
      const tempNum = -(i + 1);
      const { error: p1Err } = await adminClient
        .from("episodes")
        .update({ episode_number: tempNum })
        .eq("id", epId);

      if (p1Err) {
        console.error("[reorderAdminEpisodesServer] Phase 1 error:", p1Err);
        return err("Failed during reorder phase 1.");
      }
    }

    // Phase 2: Set final positive sequential numbers
    for (let i = 0; i < orderedEpisodeIds.length; i++) {
      const epId = orderedEpisodeIds[i];
      const finalNum = i + 1;
      const { error: p2Err } = await adminClient
        .from("episodes")
        .update({ episode_number: finalNum })
        .eq("id", epId);

      if (p2Err) {
        console.error("[reorderAdminEpisodesServer] Phase 2 error:", p2Err);
        return err("Failed during reorder phase 2.");
      }
    }

    await recordAuditLog({
      actorId: actor?.id,
      actorEmail: actor?.email,
      action: "episode.reorder",
      entityType: "episode",
      entityId: titleId,
      before: { previousOrder: episodes },
      after: { newOrder: orderedEpisodeIds },
      ip: actor?.ip,
    });

    return ok({ success: true });
  } catch (error: any) {
    console.error("[reorderAdminEpisodesServer] Unexpected error:", error);
    return err(error?.message || "Failed to reorder episodes.");
  }
}

/**
 * Updates free_episodes_count for a drama and optionally syncs is_free flags.
 */
export async function updateFreeEpisodesCountServer(
  titleId: string,
  count: number,
  syncExistingEpisodes = true
): Promise<Result<{ freeEpisodesCount: number }, string>> {
  try {
    const adminClient = getContentAdminClient();

    // Update title
    const { error: titleErr } = await adminClient
      .from("titles")
      .update({ free_episodes_count: count })
      .eq("id", titleId);

    if (titleErr) {
      console.error("[updateFreeEpisodesCountServer] Error:", titleErr);
      return err("Failed to update free episodes count.");
    }

    if (syncExistingEpisodes) {
      // Mark episodes <= count as is_free = true
      await adminClient
        .from("episodes")
        .update({ is_free: true })
        .eq("title_id", titleId)
        .lte("episode_number", count);

      // Mark episodes > count as is_free = false
      await adminClient
        .from("episodes")
        .update({ is_free: false })
        .eq("title_id", titleId)
        .gt("episode_number", count);
    }

    return ok({ freeEpisodesCount: count });
  } catch (error: any) {
    console.error("[updateFreeEpisodesCountServer] Unexpected error:", error);
    return err(error?.message || "Failed to update free episodes count.");
  }
}
