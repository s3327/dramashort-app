import { NextRequest, NextResponse } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { getUserWalletServer, getCoinTransactionsServer } from "@/lib/server/wallet";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to view wallet." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

    const [walletRes, txRes] = await Promise.all([
      getUserWalletServer(user.id),
      getCoinTransactionsServer(user.id, { page, pageSize }),
    ]);

    if (!walletRes.ok) {
      return NextResponse.json(
        { error: "WALLET_ERROR", message: walletRes.error },
        { status: 500 }
      );
    }

    const dramaId = searchParams.get("dramaId");
    let unlockedEpisodeNumbers: number[] = [];
    if (dramaId) {
      const { data: unlockedRows } = await supabase
        .from("user_unlocked_episodes")
        .select("episode_number")
        .eq("user_id", user.id)
        .eq("drama_id", dramaId);

      if (Array.isArray(unlockedRows)) {
        unlockedEpisodeNumbers = unlockedRows.map((r: any) => Number(r.episode_number));
      }
    }

    return NextResponse.json({
      success: true,
      wallet: walletRes.value,
      transactions: txRes.ok ? txRes.value : { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 },
      unlockedEpisodes: unlockedEpisodeNumbers,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err?.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
