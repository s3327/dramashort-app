import {
  type ImportSourceFormat,
  type ImportDramaManifest,
  type ImportEpisodeManifest,
  type ImportValidationError,
  type ImportValidationSummary,
} from "@/types/import";
import { type Result, ok, err } from "@/lib/common/result";
import { isAllowedImageUrl } from "./drama";

/**
 * Robust RFC 4180 compliant CSV line parser.
 */
export function parseCsvRows(csvText: string): Record<string, string>[] {
  const lines: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if (char === "\n") {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      lines.push(currentRow);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map((h) => h.toLowerCase().trim().replace(/^["']|["']$/g, ""));
  const records: Record<string, string>[] = [];

  for (let r = 1; r < lines.length; r++) {
    const row = lines[r];
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = row[c] !== undefined ? row[c] : "";
    }
    records.push(record);
  }

  return records;
}

/**
 * Parses raw import manifest text based on selected source format.
 */
export function parseImportManifest(
  rawContent: string,
  format: ImportSourceFormat
): Result<ImportDramaManifest[], string> {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return err("Import manifest content cannot be empty.");
  }

  if (format === "custom_csv") {
    try {
      const rows = parseCsvRows(trimmed);
      if (rows.length === 0) {
        return err("CSV file contains no data rows or invalid headers.");
      }

      // Group rows by drama external ID or title
      const dramaMap = new Map<string, ImportDramaManifest>();

      for (const row of rows) {
        const extId =
          row.drama_external_id ||
          row.external_id ||
          row.drama_id ||
          row.id ||
          `csv-${row.drama_title || row.title || "untitled"}`;
        const title = row.drama_title || row.title || "Untitled Drama";

        if (!dramaMap.has(extId)) {
          const tagsStr = row.tags || row.drama_tags || "";
          const tags = tagsStr
            ? tagsStr.split(/[;,]/).map((t) => t.trim()).filter(Boolean)
            : [];

          dramaMap.set(extId, {
            externalId: extId,
            title,
            synopsis: row.synopsis || row.drama_synopsis || row.description || "",
            channelCode: row.channel_code || row.channel || "ds",
            genre: row.genre || row.category || "Romance",
            tags,
            posterUrl: row.poster_url || row.poster || row.cover_url || "",
            bannerUrl: row.banner_url || row.banner || "",
            totalEpisodes: parseInt(row.total_episodes || "0", 10) || undefined,
            status: (row.status as any) || "Draft",
            episodes: [],
          });
        }

        const drama = dramaMap.get(extId)!;

        // Extract episode data if row represents an episode
        const epNumStr = row.episode_number || row.episode || row.ep;
        if (epNumStr) {
          const epNum = parseInt(epNumStr, 10);
          if (Number.isFinite(epNum) && epNum > 0) {
            const epExtId =
              row.episode_external_id ||
              row.ep_id ||
              `${extId}-ep-${epNum}`;

            drama.episodes!.push({
              externalId: epExtId,
              episodeNumber: epNum,
              title: row.episode_title || `Episode ${epNum}`,
              videoUrl: row.video_url || row.stream_url || "",
              hlsUrl: row.hls_url || "",
              durationSeconds: parseInt(row.duration_seconds || row.duration || "0", 10) || 60,
              isFree: row.is_free === "true" || row.is_free === "1",
            });
          }
        }
      }

      return ok(Array.from(dramaMap.values()));
    } catch (e: any) {
      return err(`CSV parsing error: ${e.message}`);
    }
  }

  // JSON formats (dramaboss or custom_json)
  let parsedJson: any;
  try {
    parsedJson = JSON.parse(trimmed);
  } catch (e: any) {
    return err(`JSON syntax error: ${e.message}`);
  }

  const rawDramas: any[] = Array.isArray(parsedJson)
    ? parsedJson
    : Array.isArray(parsedJson.dramas)
    ? parsedJson.dramas
    : Array.isArray(parsedJson.titles)
    ? parsedJson.titles
    : Array.isArray(parsedJson.items)
    ? parsedJson.items
    : [parsedJson];

  if (!rawDramas || rawDramas.length === 0) {
    return err("JSON manifest contains no dramas or title records.");
  }

  const dramas: ImportDramaManifest[] = [];

  for (let idx = 0; idx < rawDramas.length; idx++) {
    const d = rawDramas[idx];
    if (!d || typeof d !== "object") continue;

    const externalId = String(
      d.external_id || d.externalId || d.id || d.drama_id || `item-${idx + 1}`
    ).trim();
    const title = String(d.title || d.name || "").trim();
    const synopsis = String(d.synopsis || d.description || "").trim();
    const channelCode = String(d.channel_code || d.channelCode || d.channel || "ds").trim();
    const genre = String(d.genre || d.category || "").trim();

    let tags: string[] = [];
    if (Array.isArray(d.tags)) {
      tags = d.tags.map((t: any) => String(t).trim()).filter(Boolean);
    } else if (typeof d.tags === "string") {
      tags = d.tags.split(/[;,]/).map((t: string) => t.trim()).filter(Boolean);
    }

    const posterUrl = String(
      d.poster_url || d.posterUrl || d.poster || d.cover_url || d.vertical_poster || ""
    ).trim();
    const bannerUrl = String(
      d.banner_url || d.bannerUrl || d.banner || d.horizontal_poster || ""
    ).trim();

    // Map episodes
    const rawEpisodes: any[] = Array.isArray(d.episodes)
      ? d.episodes
      : Array.isArray(d.episode_list)
      ? d.episode_list
      : [];

    const episodes: ImportEpisodeManifest[] = [];
    for (let epIdx = 0; epIdx < rawEpisodes.length; epIdx++) {
      const ep = rawEpisodes[epIdx];
      if (!ep || typeof ep !== "object") continue;

      const epNum = parseInt(
        String(ep.episode_number || ep.episodeNumber || ep.number || ep.order || epIdx + 1),
        10
      );
      const epExtId = String(
        ep.external_id || ep.externalId || ep.id || ep.episode_id || `${externalId}-ep-${epNum}`
      ).trim();

      episodes.push({
        externalId: epExtId,
        episodeNumber: epNum,
        title: ep.title ? String(ep.title).trim() : `Episode ${epNum}`,
        videoUrl: ep.video_url || ep.videoUrl || ep.stream_url || "",
        hlsUrl: ep.hls_url || ep.hlsUrl || "",
        durationSeconds:
          parseInt(String(ep.duration_seconds || ep.durationSeconds || ep.duration || 60), 10) || 60,
        isFree: ep.is_free === true || ep.is_free === "true" || ep.isFree === true,
        rawPayload: ep,
      });
    }

    dramas.push({
      externalId,
      title,
      synopsis,
      channelCode,
      genre: genre || "Romance",
      tags,
      posterUrl,
      bannerUrl,
      totalEpisodes:
        parseInt(String(d.total_episodes || d.totalEpisodes || episodes.length), 10) ||
        episodes.length ||
        undefined,
      status: d.status || "Draft",
      episodes,
      rawPayload: d,
    });
  }

  return ok(dramas);
}

/**
 * Validates parsed drama manifests and produces a structured validation report.
 */
export function validateImportDramas(
  dramas: ImportDramaManifest[]
): ImportValidationSummary {
  const errors: ImportValidationError[] = [];
  const warnings: ImportValidationError[] = [];

  const seenDramaExternalIds = new Set<string>();
  let totalEpisodesCount = 0;

  for (let i = 0; i < dramas.length; i++) {
    const drama = dramas[i];
    const rowNum = i + 1;

    // 1. External ID check
    if (!drama.externalId) {
      errors.push({
        row: rowNum,
        entity: "drama",
        field: "externalId",
        message: "Drama missing required externalId identifier.",
        severity: "error",
      });
    } else if (seenDramaExternalIds.has(drama.externalId)) {
      errors.push({
        row: rowNum,
        entity: "drama",
        externalId: drama.externalId,
        field: "externalId",
        message: `Duplicate externalId '${drama.externalId}' found within manifest.`,
        severity: "error",
      });
    } else {
      seenDramaExternalIds.add(drama.externalId);
    }

    // 2. Title check
    if (!drama.title || drama.title.trim().length === 0) {
      errors.push({
        row: rowNum,
        entity: "drama",
        externalId: drama.externalId,
        field: "title",
        message: "Drama title cannot be empty.",
        severity: "error",
      });
    } else if (drama.title.length > 200) {
      errors.push({
        row: rowNum,
        entity: "drama",
        externalId: drama.externalId,
        field: "title",
        message: "Drama title exceeds maximum 200 characters limit.",
        severity: "error",
      });
    }

    // 3. Image URL checks (warnings if host is unconfigured)
    if (drama.posterUrl && !isAllowedImageUrl(drama.posterUrl)) {
      warnings.push({
        row: rowNum,
        entity: "drama",
        externalId: drama.externalId,
        field: "posterUrl",
        message: `Poster URL '${drama.posterUrl.slice(0, 45)}...' hostname is not in the next.config allow-list.`,
        severity: "warning",
      });
    }

    if (drama.bannerUrl && !isAllowedImageUrl(drama.bannerUrl)) {
      warnings.push({
        row: rowNum,
        entity: "drama",
        externalId: drama.externalId,
        field: "bannerUrl",
        message: `Banner URL '${drama.bannerUrl.slice(0, 45)}...' hostname is not in the next.config allow-list.`,
        severity: "warning",
      });
    }

    // 4. Episodes validation
    const episodes = drama.episodes || [];
    totalEpisodesCount += episodes.length;

    const seenEpNumbers = new Set<number>();
    const seenEpExtIds = new Set<string>();

    for (let j = 0; j < episodes.length; j++) {
      const ep = episodes[j];
      const epRow = j + 1;

      if (!ep.externalId) {
        errors.push({
          row: rowNum,
          entity: "episode",
          externalId: drama.externalId,
          field: "episode.externalId",
          message: `Episode #${ep.episodeNumber || epRow} missing required externalId.`,
          severity: "error",
        });
      } else if (seenEpExtIds.has(ep.externalId)) {
        errors.push({
          row: rowNum,
          entity: "episode",
          externalId: ep.externalId,
          field: "episode.externalId",
          message: `Duplicate episode externalId '${ep.externalId}' within drama '${drama.title}'.`,
          severity: "error",
        });
      } else {
        seenEpExtIds.add(ep.externalId);
      }

      if (!Number.isFinite(ep.episodeNumber) || ep.episodeNumber <= 0) {
        errors.push({
          row: rowNum,
          entity: "episode",
          externalId: ep.externalId,
          field: "episodeNumber",
          message: `Invalid episodeNumber '${ep.episodeNumber}'. Must be a positive integer.`,
          severity: "error",
        });
      } else if (seenEpNumbers.has(ep.episodeNumber)) {
        errors.push({
          row: rowNum,
          entity: "episode",
          externalId: ep.externalId,
          field: "episodeNumber",
          message: `Duplicate episodeNumber ${ep.episodeNumber} within drama '${drama.title}'.`,
          severity: "error",
        });
      } else {
        seenEpNumbers.add(ep.episodeNumber);
      }
    }
  }

  return {
    valid: errors.length === 0,
    totalDramas: dramas.length,
    totalEpisodes: totalEpisodesCount,
    newDramasCount: dramas.length, // Initial assumption until DB check
    existingDramasCount: 0,
    newEpisodesCount: totalEpisodesCount,
    existingEpisodesCount: 0,
    unchangedCount: 0,
    errors,
    warnings,
    dramas,
  };
}
