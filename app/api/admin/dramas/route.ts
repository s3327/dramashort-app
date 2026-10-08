import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { mapTitleRowToTitle } from "@/lib/services/content.service";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";
import {
  validateDramaPayload,
  escapeLikePattern,
  DRAMA_STATUSES,
  type DramaStatus,
} from "@/lib/validation/drama";
import { resolveChannelByName } from "@/lib/admin/resolve-channel";
import { generateUniqueDramaSlug, getChannelCode } from "@/lib/slug";
import type { Database } from "@/types/supabase-content";

type TitleInsert = Database["public"]["Tables"]["titles"]["Insert"];

const DEFAULT_CHANNEL_NAME = "DramaShort Originals";
const DEFAULT_CHANNEL_CODE = "ds";
const DEFAULT_POSTER_URL =
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80";

/**
 * GET /api/admin/dramas
 * Lists every drama (all statuses) with server-side search, filtering, and pagination. Admin only.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const adminClient = getContentAdminClient();
    const url = request ? new URL(request.url) : new URL("http://localhost/api/admin/dramas");
    const q = url.searchParams.get("q")?.trim() || "";
    const channel = url.searchParams.get("channel")?.trim() || "";
    const statusParam = url.searchParams.get("status")?.trim() || "";
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSizeParam = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const sort = url.searchParams.get("sort")?.trim() || "newest";

    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam);
    const pageSize = Math.min(250, Math.max(1, isNaN(pageSizeParam) ? 20 : pageSizeParam));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = adminClient
      .from("titles")
      .select("*, channels(name, slug, code)", { count: "exact" });

    if (q) {
      query = query.ilike("title", `%${escapeLikePattern(q)}%`);
    }

    if (channel && channel !== "All Channels" && channel !== "All") {
      query = query.eq("channel_name", channel);
    }

    if (
      statusParam &&
      statusParam !== "all" &&
      statusParam !== "All" &&
      statusParam !== "All Statuses" &&
      DRAMA_STATUSES.includes(statusParam as DramaStatus)
    ) {
      query = query.eq("status", statusParam);
    }

    if (sort === "title_asc") {
      query = query.order("title", { ascending: true }).order("id", { ascending: true });
    } else if (sort === "views_desc") {
      query = query.order("views_count", { ascending: false, nullsFirst: false }).order("id", { ascending: true });
    } else if (sort === "oldest") {
      query = query.order("created_at", { ascending: true }).order("id", { ascending: true });
    } else {
      // Default: newest first
      query = query.order("created_at", { ascending: false }).order("id", { ascending: true });
    }

    query = query.range(from, to);

    const { data: rows, count, error } = await query;

    if (error) {
      console.error("[GET /api/admin/dramas] Supabase error:", error);
      return apiError("DATABASE_ERROR", "Failed to load dramas.", 500);
    }

    const items = (rows ?? []).map(mapTitleRowToTitle);
    const total = count !== null && count !== undefined ? count : items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return apiSuccess({
      items,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (err) {
    console.error("[GET /api/admin/dramas] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/dramas",
      method: "GET",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
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
    const channelCode = channel?.code ?? getChannelCode(requestedChannel);

    const slug = await generateUniqueDramaSlug(adminClient, input.title!, channelCode);

    const newRow: TitleInsert = {
      title: input.title!,
      slug,
      synopsis: input.synopsis || "No synopsis available.",
      genre: input.genre ?? "Romance",
      tags: input.tags && input.tags.length > 0 ? input.tags : null,
      channel_name: channel?.name ?? requestedChannel,
      channel_code: channelCode,
      channel_id: channel?.id ?? null,
      poster_url: input.posterUrl ?? DEFAULT_POSTER_URL,
      status: input.status ?? "Draft",
      total_episodes: input.totalEpisodes ?? 40,
      release_year: new Date().getFullYear(),
    };

    const { data: insertedRow, error: insertError } = await adminClient
      .from("titles")
      .insert(newRow)
      .select("*, channels(name, slug, code)")
      .single();

    if (insertError || !insertedRow) {
      console.error("[POST /api/admin/dramas] Supabase insert error:", insertError);
      return apiError("DATABASE_ERROR", "Failed to create drama.", 500);
    }

    return apiSuccess(mapTitleRowToTitle(insertedRow), 201);
  } catch (err) {
    console.error("[POST /api/admin/dramas] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/dramas",
      method: "POST",
      requestId: request?.headers?.get?.("x-request-id") || undefined,
    });
    return apiError("DATABASE_ERROR", "Failed to create drama.", 500);
  }
}
