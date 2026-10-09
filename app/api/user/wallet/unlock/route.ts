import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { unlockEpisodeServer } from "@/lib/server/wallet";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to unlock episodes." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Request body must be valid JSON." },
        { status: 400 }
      );
    }

    const { dramaId, dramaSlug, episodeId, episodeNumber, cost } = body;
    if (!dramaId || !dramaSlug || !episodeId || typeof episodeNumber !== "number") {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "dramaId, dramaSlug, episodeId, and episodeNumber are required.",
        },
        { status: 400 }
      );
    }

    const result = await unlockEpisodeServer(user.id, {
      dramaId: String(dramaId),
      dramaSlug: String(dramaSlug),
      episodeId: String(episodeId),
      episodeNumber: Number(episodeNumber),
      cost: typeof cost === "number" ? cost : undefined,
    });

    if (!result.ok) {
      if (result.error.includes("INSUFFICIENT_COINS")) {
        return NextResponse.json(
          {
            error: "INSUFFICIENT_COINS",
            message: "You need more coins to unlock this episode.",
          },
          { status: 402 } // 402 Payment Required
        );
      }
      return NextResponse.json(
        { error: "UNLOCK_FAILED", message: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.value,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
