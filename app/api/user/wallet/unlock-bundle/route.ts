import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { unlockRemainingEpisodesServer } from "@/lib/server/wallet";

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

    const { dramaId, dramaSlug } = body;
    if (!dramaId || !dramaSlug) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "dramaId and dramaSlug are required.",
        },
        { status: 400 }
      );
    }

    const result = await unlockRemainingEpisodesServer(user.id, {
      dramaId: String(dramaId),
      dramaSlug: String(dramaSlug),
    });

    if (!result.ok) {
      if (result.error.includes("INSUFFICIENT_COINS")) {
        return NextResponse.json(
          {
            error: "INSUFFICIENT_COINS",
            message: "You need more coins to unlock the remaining episodes.",
          },
          { status: 402 }
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
