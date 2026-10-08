import "server-only";
import { getContentAdminClient } from "@/lib/supabase/content";
import { type Result, ok, err } from "@/lib/common/result";
import {
  type ImportSourceFormat,
  type ImportDramaManifest,
  type ImportEpisodeManifest,
  type ImportValidationSummary,
  type ImportJobItem,
  type ExecuteImportResult,
} from "@/types/import";
import {
  parseImportManifest,
  validateImportDramas,
} from "@/lib/validation/import";
import { generateUniqueDramaSlug } from "@/lib/slug";
import { recordAuditLog } from "./audit";
import { revalidateTag } from "next/cache";

/**
 * Validates an import manifest and compares against live database to compute
 * accurate counts of new, existing, and unchanged entities.
 */
export async function validateImportManifestServer(
  rawContent: string,
  format: ImportSourceFormat,
  client?: any
): Promise<Result<ImportValidationSummary, string>> {
  try {
    const parseRes = parseImportManifest(rawContent, format);
    if (!parseRes.ok) {
      return err(parseRes.error);
    }

    const summary = validateImportDramas(parseRes.value);
    if (!summary.valid) {
      return ok(summary);
    }

    const dbClient = client || getContentAdminClient();
    const manifestExtIds = summary.dramas.map((d) => d.externalId);

    // 1. Query existing dramas with matching external IDs
    const { data: existingDramas, error: dramaErr } = await dbClient
      .from("titles")
      .select("id, external_id, title, synopsis, poster_url, total_episodes")
      .eq("external_source", format)
      .in("external_id", manifestExtIds);

    if (dramaErr) {
      console.error("[validateImportManifestServer] Drama query error:", dramaErr);
    }

    const existingMap = new Map<string, any>();
    if (existingDramas) {
      for (const d of existingDramas) {
        if (d.external_id) existingMap.set(d.external_id, d);
      }
    }

    summary.existingDramasCount = existingMap.size;
    summary.newDramasCount = Math.max(0, summary.totalDramas - summary.existingDramasCount);

    // 2. Query existing episodes
    let existingEpisodesCount = 0;
    let unchangedDramasCount = 0;

    for (const drama of summary.dramas) {
      const existing = existingMap.get(drama.externalId);
      if (existing) {
        // Compare basic drama properties
        const isDramaIdentical =
          existing.title === drama.title &&
          (existing.synopsis || "") === (drama.synopsis || "");

        if (isDramaIdentical && (!drama.episodes || drama.episodes.length === 0)) {
          unchangedDramasCount++;
        }

        if (drama.episodes && drama.episodes.length > 0) {
          const epExtIds = drama.episodes.map((e) => e.externalId);
          const { data: existingEps } = await dbClient
            .from("episodes")
            .select("id, external_id, episode_number, title")
            .eq("title_id", existing.id);

          if (existingEps && Array.isArray(existingEps)) {
            const existingEpNumbers = new Set(existingEps.map((e) => e.episode_number));
            const existingEpExtIds = new Set(existingEps.map((e) => e.external_id).filter(Boolean));

            let matchedEps = 0;
            for (const ep of drama.episodes) {
              if (existingEpExtIds.has(ep.externalId) || existingEpNumbers.has(ep.episodeNumber)) {
                matchedEps++;
              }
            }
            existingEpisodesCount += matchedEps;

            if (isDramaIdentical && matchedEps === drama.episodes.length) {
              unchangedDramasCount++;
            }
          }
        }
      }
    }

    summary.existingEpisodesCount = existingEpisodesCount;
    summary.newEpisodesCount = Math.max(0, summary.totalEpisodes - existingEpisodesCount);
    summary.unchangedCount = unchangedDramasCount;

    return ok(summary);
  } catch (error: any) {
    console.error("[validateImportManifestServer] Unexpected error:", error);
    return err(error?.message || "Failed to validate import manifest.");
  }
}

/**
 * Idempotently executes an import manifest.
 * Creates new records, updates modified existing records, skips unchanged records.
 */
export async function executeImportJobServer(
  rawContent: string,
  format: ImportSourceFormat,
  actor?: { id?: string | null; email?: string | null; ip?: string | null },
  fileName?: string,
  client?: any
): Promise<Result<ExecuteImportResult, string>> {
  const dbClient = client || getContentAdminClient();

  try {
    // 1. Dry-run validation
    const valRes = await validateImportManifestServer(rawContent, format, dbClient);
    if (!valRes.ok) {
      return err(valRes.error);
    }
    const summary = valRes.value;
    if (!summary.valid) {
      return err(`Manifest validation failed with ${summary.errors.length} error(s).`);
    }

    // 2. Insert import_jobs tracking row
    const { data: jobRow, error: jobErr } = await dbClient
      .from("import_jobs")
      .insert({
        actor_id: actor?.id || null,
        actor_email: actor?.email || null,
        source_name: format,
        file_name: fileName || "manifest",
        status: "processing",
        total_dramas: summary.totalDramas,
        total_episodes: summary.totalEpisodes,
        validation_report: summary,
      })
      .select("id")
      .single();

    const jobId = jobRow?.id || "temp-job";

    // 3. Resolve default channel
    const { data: defaultChannel } = await dbClient
      .from("channels")
      .select("id, name, code")
      .limit(1)
      .maybeSingle();

    const defaultChannelId = defaultChannel?.id || null;
    const defaultChannelName = defaultChannel?.name || "DramaShort Originals";
    const defaultChannelCode = defaultChannel?.code || "ds";

    let createdDramas = 0;
    let updatedDramas = 0;
    let createdEpisodes = 0;
    let updatedEpisodes = 0;
    let unchangedRecords = 0;
    let failedRecords = 0;
    const errors: any[] = [];

    // 4. Process dramas
    for (const drama of summary.dramas) {
      try {
        // Check if drama already exists
        const { data: existingDrama } = await dbClient
          .from("titles")
          .select("id, title, slug, synopsis, poster_url, total_episodes")
          .eq("external_source", format)
          .eq("external_id", drama.externalId)
          .maybeSingle();

        let dramaId: string;
        let isNewDrama = false;

        if (existingDrama) {
          dramaId = existingDrama.id;

          // Check if drama fields changed
          const hasChanged =
            existingDrama.title !== drama.title ||
            (existingDrama.synopsis || "") !== (drama.synopsis || "") ||
            (existingDrama.poster_url || "") !== (drama.posterUrl || "");

          if (hasChanged) {
            await dbClient
              .from("titles")
              .update({
                title: drama.title,
                synopsis: drama.synopsis || null,
                genre: drama.genre || "Romance",
                tags: drama.tags || [],
                poster_url: drama.posterUrl || existingDrama.poster_url,
                banner_url: drama.bannerUrl || null,
                total_episodes: drama.totalEpisodes || drama.episodes?.length || existingDrama.total_episodes,
              })
              .eq("id", dramaId);
            updatedDramas++;
          } else {
            unchangedRecords++;
          }
        } else {
          isNewDrama = true;
          // Generate unique slug
          const uniqueSlug = await generateUniqueDramaSlug(
            dbClient,
            drama.title,
            drama.channelCode || defaultChannelCode
          );

          const { data: newDrama, error: insertErr } = await dbClient
            .from("titles")
            .insert({
              external_source: format,
              external_id: drama.externalId,
              title: drama.title,
              slug: uniqueSlug,
              synopsis: drama.synopsis || null,
              channel_id: defaultChannelId,
              channel_name: defaultChannelName,
              channel_code: defaultChannelCode,
              genre: drama.genre || "Romance",
              tags: drama.tags || [],
              poster_url: drama.posterUrl || null,
              banner_url: drama.bannerUrl || null,
              status: drama.status || "Draft",
              total_episodes: drama.totalEpisodes || drama.episodes?.length || 0,
            })
            .select("id")
            .single();

          if (insertErr || !newDrama) {
            throw new Error(`Failed to insert drama '${drama.title}': ${insertErr?.message}`);
          }

          dramaId = newDrama.id;
          createdDramas++;
        }

        // Process episodes
        if (drama.episodes && drama.episodes.length > 0) {
          for (const ep of drama.episodes) {
            try {
              // Check if episode exists by episode_number within this drama
              const { data: existingEp } = await dbClient
                .from("episodes")
                .select("id, episode_number, title")
                .eq("title_id", dramaId)
                .eq("episode_number", ep.episodeNumber)
                .maybeSingle();

              let epId: string;

              if (existingEp) {
                epId = existingEp.id;
                // Update episode metadata
                await dbClient
                  .from("episodes")
                  .update({
                    external_source: format,
                    external_id: ep.externalId,
                    title: ep.title || existingEp.title,
                    is_free: ep.isFree ?? false,
                  })
                  .eq("id", epId);

                // Update media row if videoUrl exists
                if (ep.videoUrl || ep.hlsUrl) {
                  await dbClient
                    .from("episode_media")
                    .upsert({
                      episode_id: epId,
                      mp4_url: ep.videoUrl || null,
                      hls_url: ep.hlsUrl || null,
                      duration_seconds: ep.durationSeconds || 60,
                      status: "ready",
                    }, { onConflict: "episode_id" });
                }

                updatedEpisodes++;
              } else {
                // Insert new episode
                const { data: newEp, error: epInsertErr } = await dbClient
                  .from("episodes")
                  .insert({
                    title_id: dramaId,
                    episode_number: ep.episodeNumber,
                    title: ep.title || `Episode ${ep.episodeNumber}`,
                    is_free: ep.isFree ?? false,
                    external_source: format,
                    external_id: ep.externalId,
                  })
                  .select("id")
                  .single();

                if (epInsertErr || !newEp) {
                  throw new Error(`Failed to insert episode ${ep.episodeNumber}: ${epInsertErr?.message}`);
                }

                epId = newEp.id;

                if (ep.videoUrl || ep.hlsUrl) {
                  await dbClient
                    .from("episode_media")
                    .insert({
                      episode_id: epId,
                      mp4_url: ep.videoUrl || null,
                      hls_url: ep.hlsUrl || null,
                      duration_seconds: ep.durationSeconds || 60,
                      status: "ready",
                    });
                }

                createdEpisodes++;
              }
            } catch (epError: any) {
              failedRecords++;
              errors.push({
                entity: "episode",
                externalId: ep.externalId,
                message: epError.message,
              });
            }
          }

          // Update titles episode counts
          const epCount = drama.episodes.length;
          await dbClient
            .from("titles")
            .update({
              total_episodes: epCount,
              episodes_available: epCount,
            })
            .eq("id", dramaId);
        }
      } catch (dramaError: any) {
        failedRecords++;
        errors.push({
          entity: "drama",
          externalId: drama.externalId,
          message: dramaError.message,
        });
      }
    }

    // 5. Update import_jobs record with final results
    await dbClient
      .from("import_jobs")
      .update({
        status: failedRecords > 0 && createdDramas === 0 ? "failed" : "completed",
        created_dramas: createdDramas,
        updated_dramas: updatedDramas,
        created_episodes: createdEpisodes,
        updated_episodes: updatedEpisodes,
        unchanged_records: unchangedRecords,
        failed_records: failedRecords,
        errors,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    // 6. Record audit log
    await recordAuditLog(
      {
        actorId: actor?.id,
        actorEmail: actor?.email,
        action: "import.execute",
        entityType: "import_job",
        entityId: jobId,
        before: null,
        after: {
          format,
          createdDramas,
          updatedDramas,
          createdEpisodes,
          updatedEpisodes,
          unchangedRecords,
          failedRecords,
        },
        ip: actor?.ip,
      },
      client
    );

    // 7. Invalidate Next.js cache tags
    try {
      revalidateTag("titles");
      revalidateTag("dramas");
    } catch {
      // In isolated test runner environment, ignore Next.js tag cache errors
    }

    return ok({
      jobId,
      status: failedRecords > 0 && createdDramas === 0 ? "failed" : "completed",
      createdDramas,
      updatedDramas,
      createdEpisodes,
      updatedEpisodes,
      unchangedRecords,
      failedRecords,
      errors,
    });
  } catch (error: any) {
    console.error("[executeImportJobServer] Unexpected error:", error);
    return err(error?.message || "Failed to execute bulk import job.");
  }
}

/**
 * Retrieves past import jobs history.
 */
export async function getImportJobsServer(
  query: { page?: number; pageSize?: number } = {},
  client?: any
): Promise<Result<{ items: ImportJobItem[]; total: number; totalPages: number }, string>> {
  try {
    const dbClient = client || getContentAdminClient();
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(50, Math.max(1, query.pageSize || 10));

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await dbClient
      .from("import_jobs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("[getImportJobsServer] Database query error:", error);
      return err(error.message || "Failed to fetch import jobs.");
    }

    const total = count || data?.length || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const items: ImportJobItem[] = (data || []).map((row: any) => ({
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      sourceName: row.source_name,
      fileName: row.file_name,
      status: row.status,
      totalDramas: row.total_dramas || 0,
      totalEpisodes: row.total_episodes || 0,
      createdDramas: row.created_dramas || 0,
      updatedDramas: row.updated_dramas || 0,
      createdEpisodes: row.created_episodes || 0,
      updatedEpisodes: row.updated_episodes || 0,
      unchangedRecords: row.unchanged_records || 0,
      failedRecords: row.failed_records || 0,
      validationReport: row.validation_report || {},
      errors: row.errors || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    }));

    return ok({ items, total, totalPages });
  } catch (error: any) {
    console.error("[getImportJobsServer] Unexpected error:", error);
    return err(error?.message || "Failed to retrieve import jobs.");
  }
}
