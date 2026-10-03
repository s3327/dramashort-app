import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { getContentAdminClient } from "@/lib/supabase/content";
import { mapTitleRowToTitle } from "@/lib/services/content.service";
import { titles as mockTitles } from "@/data/titles.mock";
import type { Database } from "@/types/supabase-content";

type TitleUpdate = Database["public"]["Tables"]["titles"]["Update"];

export interface DramaUpdateBody {
  title?: string;
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
 * GET /api/admin/dramas/[id]
 * Fetch a single drama by ID (Supabase DB first, mock fallback).
 * Protected by requireAdmin.
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

  try {
    const adminClient = getContentAdminClient();
    const { data: row, error } = await adminClient
      .from("titles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!error && row) {
      return NextResponse.json({
        success: true,
        data: mapTitleRowToTitle(row),
      });
    }
  } catch (err) {
    console.warn("Failed to fetch drama via adminClient:", err);
  }

  // Fallback to mock titles if not in database
  const mock = mockTitles.find((t) => t.id === id || t.slug === id);
  if (mock) {
    return NextResponse.json({
      success: true,
      data: mock,
    });
  }

  return NextResponse.json(
    { success: false, error: "Drama not found" },
    { status: 404 }
  );
}

/**
 * PATCH /api/admin/dramas/[id]
 * Persists updates to a Drama row in Supabase Content Database.
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

  // 2. Parse payload
  let body: DramaUpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  // 3. Build update fields
  const updateData: TitleUpdate = {
    updated_at: new Date().toISOString(),
  };

  if (body.title !== undefined) {
    const trimmedTitle = body.title.trim();
    if (!trimmedTitle) {
      return NextResponse.json(
        { success: false, error: "Drama title cannot be empty" },
        { status: 400 }
      );
    }
    updateData.title = trimmedTitle;
  }

  if (body.synopsis !== undefined) {
    updateData.synopsis = body.synopsis.trim();
  }

  if (body.genre !== undefined) {
    updateData.genre = body.genre.trim();
  }

  if (body.status !== undefined) {
    updateData.status = body.status;
  }

  const totalEpisodes = body.totalEpisodes ?? body.total_episodes;
  if (totalEpisodes !== undefined) {
    updateData.total_episodes = Math.max(1, Number(totalEpisodes) || 1);
  }

  if (body.tags !== undefined) {
    if (Array.isArray(body.tags)) {
      updateData.tags = body.tags.map((t) => String(t).trim()).filter(Boolean);
    } else if (typeof body.tags === "string") {
      updateData.tags = body.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  const poster = body.poster_url || body.poster;
  if (poster !== undefined) {
    updateData.poster_url = poster;
  }

  // 4. Resolve Channel affiliation if channel is provided
  const channelName = body.channel_name || body.channel;
  if (channelName) {
    updateData.channel_name = channelName;

    try {
      const adminClient = getContentAdminClient();
      const { data: chan } = await adminClient
        .from("channels")
        .select("id, name, code")
        .ilike("name", channelName)
        .maybeSingle();

      if (chan) {
        updateData.channel_name = chan.name;
        updateData.channel_code = chan.code;
        updateData.channel_id = chan.id;
      }
    } catch (err) {
      console.warn("Channel lookup in PATCH drama:", err);
    }
  }

  // 5. Execute Supabase update
  try {
    const adminClient = getContentAdminClient();
    const { data: updatedRow, error: updateError } = await adminClient
      .from("titles")
      .update(updateData)
      .eq("id", id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("Supabase drama update error:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      );
    }

    if (updatedRow) {
      return NextResponse.json({
        success: true,
        data: mapTitleRowToTitle(updatedRow),
      });
    }

    // If row wasn't found in DB, check if it's a mock ID
    const mock = mockTitles.find((t) => t.id === id || t.slug === id);
    if (mock) {
      const updatedMock = {
        ...mock,
        title: (updateData.title as string) || mock.title,
        synopsis: (updateData.synopsis as string) || mock.synopsis,
        genre: (updateData.genre as string) || mock.genre,
        tags: (updateData.tags as string[]) || mock.tags,
        channel: (updateData.channel_name as string) || mock.channel,
        status: (updateData.status as any) || mock.status,
        totalEpisodes:
          (updateData.total_episodes as number) || mock.totalEpisodes,
      };
      return NextResponse.json({
        success: true,
        data: updatedMock,
      });
    }

    return NextResponse.json(
      { success: false, error: "Drama not found in database or mocks" },
      { status: 404 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to persist drama update";
    console.error("Fatal error during drama update:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
