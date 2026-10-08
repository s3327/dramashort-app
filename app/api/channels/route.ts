import { NextResponse } from "next/server";
import { getChannels } from "@/lib/server/catalog";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import { channels as mockChannels } from "@/data/channels.mock";

export const revalidate = 300;

/**
 * GET /api/channels
 * Public cached endpoint returning the active channels list from the database.
 */
export async function GET() {
  try {
    let channels = await getChannels();

    if ((!channels || channels.length === 0) && ENABLE_MOCK_FALLBACK) {
      channels = mockChannels;
    }

    const response = NextResponse.json({ channels }, { status: 200 });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (err) {
    console.error("[GET /api/channels] Error:", err);
    if (ENABLE_MOCK_FALLBACK) {
      return NextResponse.json({ channels: mockChannels }, { status: 200 });
    }
    return NextResponse.json({ channels: [] }, { status: 500 });
  }
}
