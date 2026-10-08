import { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getContentAdminClient } from "@/lib/supabase/content";
import { apiError, apiSuccess } from "@/lib/api/responses";
import { reportError } from "@/lib/observability/error-reporter";

export const dynamic = "force-dynamic";

/**
 * Checks authorization: either an authenticated Admin or a valid Cron Secret.
 */
async function checkSchedulerAuth(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const xCronHeader = request.headers.get("x-cron-secret");

  if (
    cronSecret &&
    ((authHeader && authHeader === `Bearer ${cronSecret}`) ||
      (xCronHeader && xCronHeader === cronSecret))
  ) {
    return { authorized: true as const, isAdmin: false };
  }

  const adminAuth = await requireAdmin();
  if (adminAuth.authorized) {
    return { authorized: true as const, isAdmin: true };
  }

  return { authorized: false as const, response: adminAuth.response };
}

/**
 * GET /api/admin/dramas/publish-scheduled
 * Previews upcoming scheduled dramas and counts pending publication.
 */
export async function GET(request: NextRequest) {
  const auth = await checkSchedulerAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const adminClient = getContentAdminClient();
    const now = new Date().toISOString();

    const { data: scheduledDramas, error } = await adminClient
      .from("titles")
      .select("id, title, slug, channel_name, publish_at, created_at")
      .eq("status", "Scheduled")
      .order("publish_at", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("[GET /api/admin/dramas/publish-scheduled] Error:", error);
      return apiError("DATABASE_ERROR", "Failed to retrieve scheduled dramas.", 500);
    }

    const items = (scheduledDramas || []) as Array<{
      id: string;
      title: string;
      slug: string;
      channel_name: string;
      publish_at: string | null;
      created_at: string | null;
    }>;
    const dueNow = items.filter((d) => d.publish_at && d.publish_at <= now);
    const upcoming = items.filter((d) => !d.publish_at || d.publish_at > now);
    const nextPublishAt = upcoming.length > 0 ? upcoming[0].publish_at : null;

    return apiSuccess({
      totalScheduled: items.length,
      dueNowCount: dueNow.length,
      upcomingCount: upcoming.length,
      nextPublishAt,
      dueDramas: dueNow,
      upcomingDramas: upcoming.slice(0, 10),
    });
  } catch (err: unknown) {
    console.error("[GET /api/admin/dramas/publish-scheduled] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/dramas/publish-scheduled",
      method: "GET",
    });
    return apiError("INTERNAL_ERROR", "Failed to process preview of scheduled content.", 500);
  }
}

/**
 * POST /api/admin/dramas/publish-scheduled
 * Executes promotion of scheduled dramas whose publish_at <= NOW().
 * Verifies each candidate has ready episodes before flipping status to 'Published'.
 */
export async function POST(request: NextRequest) {
  const auth = await checkSchedulerAuth(request);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const adminClient = getContentAdminClient();
    const now = new Date().toISOString();

    // 1. Fetch candidate dramas with status = 'Scheduled' and publish_at <= NOW()
    const { data: candidates, error: fetchErr } = await adminClient
      .from("titles")
      .select("id, title, slug, publish_at")
      .eq("status", "Scheduled")
      .lte("publish_at", now);

    if (fetchErr) {
      console.error("[POST /api/admin/dramas/publish-scheduled] Candidates query error:", fetchErr);
      return apiError("DATABASE_ERROR", "Failed to query scheduled candidates.", 500);
    }

    const candidateList = candidates || [];
    if (candidateList.length === 0) {
      return apiSuccess({
        message: "No scheduled dramas due for publication.",
        publishedCount: 0,
        skippedCount: 0,
        publishedDramas: [],
        skippedDramas: [],
      });
    }

    const publishedDramas: Array<{ id: string; title: string; slug: string }> = [];
    const skippedDramas: Array<{ id: string; title: string; reason: string }> = [];

    // 2. Validate and promote each candidate
    for (const drama of candidateList) {
      // Fetch episodes for drama
      const { data: episodes, error: epErr } = await adminClient
        .from("episodes")
        .select("id, video_url")
        .eq("title_id", drama.id);

      if (epErr || !episodes || episodes.length === 0) {
        skippedDramas.push({
          id: drama.id,
          title: drama.title,
          reason: "Zero episodes exist for this drama.",
        });
        continue;
      }

      // Check media readiness
      const epIds = episodes.map((e: { id: string }) => e.id);
      const { data: mediaRows } = await adminClient
        .from("episode_media")
        .select("status, hls_url, mp4_url, asset_ref")
        .in("episode_id", epIds);

      const hasReadyMedia =
        (mediaRows &&
          mediaRows.some(
            (m: any) => m.status === "ready" && Boolean(m.hls_url || m.mp4_url || m.asset_ref)
          )) ||
        episodes.some((e: any) => Boolean(e.video_url && e.video_url.trim() !== ""));

      if (!hasReadyMedia) {
        skippedDramas.push({
          id: drama.id,
          title: drama.title,
          reason: "No episodes have ready streaming media.",
        });
        continue;
      }

      // Flip status to 'Published'
      const { error: updateErr } = await adminClient
        .from("titles")
        .update({ status: "Published" })
        .eq("id", drama.id);

      if (updateErr) {
        console.error(`[POST /api/admin/dramas/publish-scheduled] Update error for ${drama.id}:`, updateErr);
        skippedDramas.push({
          id: drama.id,
          title: drama.title,
          reason: "Database error during status update.",
        });
        continue;
      }

      publishedDramas.push({
        id: drama.id,
        title: drama.title,
        slug: drama.slug,
      });
    }

    // 3. Revalidate Next.js cache tags if any dramas were published
    if (publishedDramas.length > 0) {
      try {
        revalidateTag("titles");
        revalidateTag("dramas");
        revalidatePath("/");
        revalidatePath("/browse");
        revalidatePath("/trending");
        revalidatePath("/new-release");
      } catch (cacheErr) {
        // Safe fallback in test environments
        console.warn("[POST /api/admin/dramas/publish-scheduled] Cache revalidation note:", cacheErr);
      }
    }

    return apiSuccess({
      message: `Successfully processed scheduled content. ${publishedDramas.length} published, ${skippedDramas.length} skipped.`,
      publishedCount: publishedDramas.length,
      skippedCount: skippedDramas.length,
      publishedDramas,
      skippedDramas,
    });
  } catch (err: unknown) {
    console.error("[POST /api/admin/dramas/publish-scheduled] Unexpected error:", err);
    reportError(err, {
      route: "/api/admin/dramas/publish-scheduled",
      method: "POST",
    });
    return apiError("INTERNAL_ERROR", "Failed to execute scheduled publishing.", 500);
  }
}
