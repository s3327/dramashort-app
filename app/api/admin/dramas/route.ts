import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { mapTitleRowToTitle } from "@/lib/services/content.service";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { validateDramaPayload } from "@/lib/validation/drama";
import { resolveChannelByName } from "@/lib/admin/resolve-channel";
import type { Database } from "@/types/supabase-content";

type TitleInsert = Database["public"]["Tables"]["titles"]["Insert"];

const DEFAULT_CHANNEL_NAME = "DramaShort Originals";
const DEFAULT_CHANNEL_CODE = "DSO";
const DEFAULT_POSTER_URL =
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80";

/**
 * Helper to slugify a drama title.
 */
function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base || "drama"}-${suffix}`;
}

/**
 * GET /api/admin/dramas
 * Lists every drama (all statuses) from the Content DB. Admin only.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const adminClient = getContentAdminClient();
    const { data: rows, error } = await adminClient
      .from("titles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/admin/dramas] Supabase error:", error);
      return apiError("DATABASE_ERROR", "Failed to load dramas.", 500);
    }

    return apiSuccess((rows ?? []).map(mapTitleRowToTitle));
  } catch (err) {
    console.error("[GET /api/admin/dramas] Unexpected error:", err);
    return apiError("DATABASE_ERROR", "Failed to load dramas.", 500);
  }
}

/**
 * POST /api/admin/dramas
 * Creates a new drama in the Content DB. Admin only.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Request body must be valid JSON.", 400);
  }

  const validation = validateDramaPayload(body, "create");
  if (!validation.ok) {
    return apiError("VALIDATION_ERROR", "Invalid drama payload.", 400, validation.errors);
  }
  const input = validation.value;

  try {
    const adminClient = getContentAdminClient();

    const requestedChannel = input.channelName ?? DEFAULT_CHANNEL_NAME;
    const channel = await resolveChannelByName(adminClient, requestedChannel);

    const newRow: TitleInsert = {
      title: input.title!,
      slug: slugifyTitle(input.title!),
      synopsis: input.synopsis || "No synopsis available.",
      genre: input.genre ?? "Romance",
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
      channel_name: channel?.name ?? requestedChannel,
      channel_code: channel?.code ?? DEFAULT_CHANNEL_CODE,
      channel_id: channel?.id ?? null,
      poster_url: input.posterUrl ?? DEFAULT_POSTER_URL,
      status: input.status ?? "Draft",
      total_episodes: input.totalEpisodes ?? 40,
      release_year: new Date().getFullYear(),
    };

    const { data: insertedRow, error: insertError } = await adminClient
      .from("titles")
      .insert(newRow)
      .select()
      .single();

    if (insertError || !insertedRow) {
      console.error("[POST /api/admin/dramas] Supabase insert error:", insertError);
      return apiError("DATABASE_ERROR", "Failed to create drama.", 500);
    }

    return apiSuccess(mapTitleRowToTitle(insertedRow), 201);
  } catch (err) {
    console.error("[POST /api/admin/dramas] Unexpected error:", err);
    return apiError("DATABASE_ERROR", "Failed to create drama.", 500);
  }
}
