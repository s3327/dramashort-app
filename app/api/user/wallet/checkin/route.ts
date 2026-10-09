import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import {
  getDailyCheckInStatusServer,
  claimDailyCheckinServer,
} from "@/lib/server/wallet";

export async function GET() {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const result = await getDailyCheckInStatusServer(user.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: "CHECKIN_STATUS_ERROR", message: result.error },
        { status: 500 }
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

export async function POST() {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const result = await claimDailyCheckinServer(user.id);
    if (!result.ok) {
      if (result.error.includes("ALREADY_CHECKED_IN_TODAY")) {
        return NextResponse.json(
          {
            error: "ALREADY_CHECKED_IN_TODAY",
            message: "You have already claimed today's check-in bonus.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "CHECKIN_FAILED", message: result.error },
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
