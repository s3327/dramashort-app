import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { mapTitleRowToTitle } from "@/lib/services/content.service";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { isUuid, validateDramaPayload } from "@/lib/validation/drama";
import { resolveChannelByName } from "@/lib/admin/resolve-channel";
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
      .select("*")
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

  try {
    const adminClient = getContentAdminClient();

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
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("[PATCH /api/admin/dramas/:id] Supabase update error:", updateError);
      return apiError("DATABASE_ERROR", "Failed to save drama changes.", 500);
    }
    if (!updatedRow) {
      return apiError("NOT_FOUND", "Drama not found.", 404);
    }

    return apiSuccess(mapTitleRowToTitle(updatedRow));
  } catch (err) {
    console.error("[PATCH /api/admin/dramas/:id] Unexpected error:", err);
    return apiError("DATABASE_ERROR", "Failed to save drama changes.", 500);
  }
}
