import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { mapTitleRowToTitle } from "@/lib/services/content.service";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";
import { isUuid, validateDramaPayload } from "@/lib/validation/drama";
import { resolveChannelByName } from "@/lib/admin/resolve-channel";
import { deleteDrama as deleteDramaDirect } from "@/lib/server/admin";
import type { Database } from "@/types/supabase-content";

type TitleUpdate = Database["public"]["Tables"]["titles"]["Update"];

/**
 * GET /api/admin/dramas/[id]
 * Fetches one drama (any status) by UUID from the Content DB. Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("INVALID_ID", "Drama id must be a UUID.", 400);
  }

  try {
    const adminClient = getContentAdminClient();
    const { data: row, error } = await adminClient
      .from("titles")
      .select("*, channels(name, slug, code)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/admin/dramas/:id] Supabase error:", error);
      return apiError("DATABASE_ERROR", "Failed to load drama.", 500);
    }
    if (!row) {
      return apiError("NOT_FOUND", "Drama not found.", 404);
    }

    return apiSuccess(mapTitleRowToTitle(row));
  } catch (err) {
    console.error("[GET /api/admin/dramas/:id] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/dramas/${id}`,
      method: "GET",
      requestId: _request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to load drama.", 500);
  }
}

/**
 * PATCH /api/admin/dramas/[id]
 * Applies a partial update to one drama in the Content DB. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("INVALID_ID", "Drama id must be a UUID.", 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const validation = validateDramaPayload(body, "update");
  if (!validation.ok) {
    return apiError("VALIDATION_ERROR", "Invalid drama payload.", 400, validation.errors);
  }
  const input = validation.value;

  const updateData: TitleUpdate = {};
  if (input.title !== undefined) updateData.title = input.title;
  if (input.synopsis !== undefined) updateData.synopsis = input.synopsis;
  if (input.genre !== undefined) updateData.genre = input.genre;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.totalEpisodes !== undefined) updateData.total_episodes = input.totalEpisodes;
  if (input.tags !== undefined) updateData.tags = input.tags;
  if (input.posterUrl !== undefined) updateData.poster_url = input.posterUrl;
  if (input.bannerUrl !== undefined) updateData.banner_url = input.bannerUrl;
  if (input.freeEpisodesCount !== undefined) updateData.free_episodes_count = input.freeEpisodesCount;
  if (input.publishAt !== undefined) updateData.publish_at = input.publishAt;

  if (
    input.channelName === undefined &&
    input.slug === undefined &&
    Object.keys(updateData).length === 0
  ) {
    return apiError("VALIDATION_ERROR", "No updatable fields provided.", 400);
  }

  try {
    const adminClient = getContentAdminClient();

    if (input.status === "Scheduled") {
      let effectivePublishAt = input.publishAt;
      if (effectivePublishAt === undefined) {
        const { data: existingRow } = await adminClient
          .from("titles")
          .select("publish_at")
          .eq("id", id)
          .maybeSingle();
        effectivePublishAt = existingRow?.publish_at;
      }
      if (!effectivePublishAt) {
        return apiError(
          "VALIDATION_ERROR",
          "A scheduled publish date and time (publishAt) is required when status is Scheduled.",
          400,
          [{ field: "publishAt", message: "publishAt is required when status is Scheduled." }]
        );
      }
    }

    if (input.status === "Published") {
      // Task 16.1: Block publishing a drama if it has zero ready episodes
      const { data: episodes, error: epErr } = await adminClient
        .from("episodes")
        .select("id, video_url")
        .eq("title_id", id);

      if (epErr) {
        console.error("[PATCH /api/admin/dramas/:id] Episodes check error:", epErr);
        return apiError("DATABASE_ERROR", "Failed to verify drama episodes before publishing.", 500);
      }

      if (!episodes || episodes.length === 0) {
        return apiError(
          "VALIDATION_ERROR",
          "Cannot publish drama with zero ready episodes.",
          400,
          [{ field: "status", message: "A drama must have at least one episode with ready media before being published." }]
        );
      }

      const epIds = (episodes as Array<{ id: string; video_url?: string | null }>).map((e) => e.id);
      const { data: mediaRows, error: mediaErr } = await adminClient
        .from("episode_media")
        .select("id, status, hls_url, mp4_url, asset_ref")
        .in("episode_id", epIds);

      if (mediaErr) {
        console.error("[PATCH /api/admin/dramas/:id] Media check error:", mediaErr);
        return apiError("DATABASE_ERROR", "Failed to verify episode media before publishing.", 500);
      }

      const hasReadyMedia =
        (mediaRows &&
          (mediaRows as any[]).some(
            (m) =>
              m.status === "ready" &&
              Boolean(m.hls_url || m.mp4_url || m.asset_ref)
          )) ||
        (episodes as any[]).some((e) => Boolean(e.video_url && e.video_url.trim() !== ""));

      if (!hasReadyMedia) {
        return apiError(
          "VALIDATION_ERROR",
          "Cannot publish drama with zero ready episodes.",
          400,
          [{ field: "status", message: "A drama must have at least one episode with ready media before being published." }]
        );
      }
    }

    if (input.slug !== undefined) {
      const { data: currentDrama, error: fetchError } = await adminClient
        .from("titles")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError) {
        console.error("[PATCH /api/admin/dramas/:id] Supabase error:", fetchError);
        return apiError("DATABASE_ERROR", "Failed to load drama.", 500);
      }
      if (!currentDrama) {
        return apiError("NOT_FOUND", "Drama not found.", 404);
      }

      if (input.slug !== currentDrama.slug) {
        if (currentDrama.status === "Published") {
          return apiError(
            "VALIDATION_ERROR",
            "Slug cannot be modified once a drama has been published.",
            400,
            [{ field: "slug", message: "Slug is immutable once a drama has been published." }]
          );
        }
        updateData.slug = input.slug;
      }
    }

    if (input.channelName !== undefined) {
      const channel = await resolveChannelByName(adminClient, input.channelName);
      updateData.channel_name = channel?.name ?? input.channelName;
      if (channel) {
        updateData.channel_code = channel.code;
        updateData.channel_id = channel.id;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return apiError("VALIDATION_ERROR", "No updatable fields provided.", 400);
    }
    updateData.updated_at = new Date().toISOString();

    const { data: updatedRow, error: updateError } = await adminClient
      .from("titles")
      .update(updateData)
      .eq("id", id)
      .select("*, channels(name, slug, code)")
      .maybeSingle();

    if (updateError) {
      console.error("[PATCH /api/admin/dramas/:id] Supabase update error:", updateError);
      if (
        updateError.message?.includes("Slug cannot be modified once a drama has been published") ||
        (updateError as any).code === "P0001"
      ) {
        return apiError(
          "VALIDATION_ERROR",
          "Slug cannot be modified once a drama has been published.",
          400,
          [{ field: "slug", message: "Slug is immutable once a drama has been published." }]
        );
      }
      if (
        (updateError as any).code === "23505" ||
        updateError.message?.includes("titles_slug_key") ||
        updateError.message?.includes("duplicate key")
      ) {
        return apiError(
          "VALIDATION_ERROR",
          "A drama with this slug already exists.",
          400,
          [{ field: "slug", message: "Slug must be unique across all dramas." }]
        );
      }
      return apiError("DATABASE_ERROR", "Failed to save drama changes.", 500);
    }
    if (!updatedRow) {
      return apiError("NOT_FOUND", "Drama not found.", 404);
    }

    return apiSuccess(mapTitleRowToTitle(updatedRow));
  } catch (err) {
    console.error("[PATCH /api/admin/dramas/:id] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/dramas/${id}`,
      method: "PATCH",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to save drama changes.", 500);
  }
}

/**
 * DELETE /api/admin/dramas/[id]
 * Deletes or archives one drama by UUID from the Content DB. Admin only.
 * Defaults to soft delete (Archived). Accepts ?hard=true for permanent deletion of never-published drafts.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return apiError("INVALID_ID", "Drama id must be a UUID.", 400);
  }

  const hard = request.nextUrl.searchParams.get("hard") === "true";

  try {
    const res = await deleteDramaDirect(id, {
      hardDelete: hard,
      actor: {
        id: auth.user.id,
        email: auth.user.email,
        ip: request.headers.get("x-forwarded-for") || undefined,
      },
    });

    if (!res.ok) {
      if (res.error === "Drama not found") {
        return apiError("NOT_FOUND", "Drama not found.", 404);
      }
      if (res.error.includes("Published dramas cannot be permanently deleted")) {
        return apiError("VALIDATION_ERROR", res.error, 400);
      }
      return apiError("DATABASE_ERROR", res.error, 500);
    }

    return apiSuccess({ deleted: true, hard });
  } catch (err) {
    console.error("[DELETE /api/admin/dramas/:id] Unexpected error:", err);
    reportError(err, {
      route: `/api/admin/dramas/${id}`,
      method: "DELETE",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to delete drama.", 500);
  }
}

