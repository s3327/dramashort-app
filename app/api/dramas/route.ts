import { NextRequest } from "next/server";
import { searchDramas } from "@/lib/server/catalog";
import { apiSuccess, apiError } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";

export const dynamic = "force-dynamic";

/**
 * GET /api/dramas
 * Public catalog endpoint for client islands (Task 13.4).
 * Queries published dramas with search, filtering, and pagination deduplication.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") || url.searchParams.get("query") || url.searchParams.get("search") || "";
    const genre = url.searchParams.get("genre") || "";
    const channelId = url.searchParams.get("channelId") || "";
    const channelSlug = url.searchParams.get("channelSlug") || "";
    const sort = (url.searchParams.get("sort") || "trending") as "trending" | "newest" | "rating";
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "24", 10);

    const result = await searchDramas({
      query,
      genre,
      channelId,
      channelSlug,
      sort,
      page,
      pageSize,
    });

    if (result.error) {
      reportError(new Error(result.error), {
        route: "/api/dramas",
        method: "GET",
        requestId: request.headers.get("x-request-id") || undefined,
      });
      return apiError("DATABASE_ERROR", result.error, 500);
    }

    return apiSuccess(result);
  } catch (error) {
    reportError(error, {
      route: "/api/dramas",
      method: "GET",
      requestId: request.headers.get("x-request-id") || undefined,
    });
    return apiError(
      "DATABASE_ERROR",
      error instanceof Error ? error.message : "Error querying catalog",
      500
    );
  }
}
