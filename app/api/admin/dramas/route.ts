import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { getContentAdminClient } from "@/lib/supabase/content";
import { mapTitleRowToTitle } from "@/lib/services/content.service";
import { titles as mockTitles } from "@/data/titles.mock";
import type { Database } from "@/types/supabase-content";

type TitleInsert = Database["public"]["Tables"]["titles"]["Insert"];

export interface CreateDramaBody {
  title: string;
  synopsis?: string;
  genre?: string;
  tags?: string[] | string;
  channel?: string;
  channel_name?: string;
  channel_code?: string;
  channel_id?: string | null;
  status?: string;
  totalEpisodes?: number;
  total_episodes?: number;
  poster?: string;
  poster_url?: string;
}

import { requireAdmin } from "@/lib/auth/require-admin";

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
 * Fetch all dramas from Supabase Content DB (protected by requireAdmin).
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

    if (!error && rows && rows.length > 0) {
      return NextResponse.json({
        success: true,
        data: rows.map(mapTitleRowToTitle),
      });
    }
  } catch (err) {
    console.warn("Failed to fetch dramas via adminClient:", err);
  }

  return NextResponse.json({
    success: true,
    data: mockTitles,
  });
}

/**
 * POST /api/admin/dramas
 * Creates a new Drama in Supabase Content DB.
 */
export async function POST(request: NextRequest) {
  // 1. Verify admin authorization via authoritative app_metadata
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  // 2. Parse request payload
  let body: CreateDramaBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const trimmedTitle = body.title?.trim();
  if (!trimmedTitle) {
    return NextResponse.json(
      { success: false, error: "Drama title is required" },
      { status: 400 }
    );
  }

  // 3. Resolve channel affiliation
  let channelName = body.channel_name || body.channel || "DramaShort Originals";
  let channelCode = body.channel_code || "DSO";
  let channelId: string | null = body.channel_id || null;

  try {
    const adminClient = getContentAdminClient();
    const { data: chan } = await adminClient
      .from("channels")
      .select("id, name, code")
      .ilike("name", channelName)
      .maybeSingle();

    if (chan) {
      channelName = chan.name;
      channelCode = chan.code;
      channelId = chan.id;
    }
  } catch (err) {
    console.warn("Channel lookup in POST drama:", err);
  }

  // 4. Normalize tags
  let tags: string[] = [];
  if (Array.isArray(body.tags)) {
    tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
  } else if (typeof body.tags === "string") {
    tags = body.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const slug = slugifyTitle(trimmedTitle);
  const posterUrl =
    body.poster_url ||
    body.poster ||
    "https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800&auto=format&fit=crop&q=80";

  const totalEpisodes = Math.max(
    1,
    Number(body.totalEpisodes ?? body.total_episodes) || 40
  );

  const newRow: TitleInsert = {
    title: trimmedTitle,
    slug,
    synopsis: body.synopsis?.trim() || "No synopsis available.",
    genre: body.genre?.trim() || "Romance",
    tags: tags.length > 0 ? tags : null,
    channel_name: channelName,
    channel_code: channelCode,
    channel_id: channelId,
    poster_url: posterUrl,
    status: body.status || "Draft",
    total_episodes: totalEpisodes,
    release_year: new Date().getFullYear(),
  };

  // 5. Insert into Supabase
  try {
    const adminClient = getContentAdminClient();
    const { data: insertedRow, error: insertError } = await adminClient
      .from("titles")
      .insert(newRow)
      .select()
      .single();

    if (insertError || !insertedRow) {
      console.error("Supabase insert title error:", insertError);
      return NextResponse.json(
        {
          success: false,
          error: insertError?.message || "Failed to create drama record",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: mapTitleRowToTitle(insertedRow),
    });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Unexpected database error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
