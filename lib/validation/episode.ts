import { isUuid } from "./drama";

export const EPISODE_LIMITS = {
  titleMax: 200,
  urlMax: 2048,
  durationMax: 86400, // 24 hours
  bulkMaxRange: 500,
} as const;

export interface EpisodeFieldError {
  field: string;
  message: string;
}

export type EpisodeValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: EpisodeFieldError[] };

export interface SingleEpisodeInput {
  episodeNumber?: number;
  title?: string;
  durationSeconds?: number;
  isFree?: boolean;
  thumbnailUrl?: string | null;
  releaseAt?: string | null;
  hlsUrl?: string | null;
  mp4Url?: string | null;
  assetRef?: string | null;
  provider?: string;
  status?: "missing" | "processing" | "ready" | "error";
}

export interface BulkRangeInput {
  startNumber: number;
  endNumber: number;
  titleTemplate?: string;
  autoFree?: boolean;
}

export interface BulkMediaItemInput {
  episodeNumber: number;
  urlOrAssetId: string;
  provider?: string;
  durationSeconds?: number;
}

export interface ReorderEpisodesInput {
  orderedEpisodeIds: string[];
}

export function validateSingleEpisodePayload(
  input: unknown,
  mode: "create" | "update"
): EpisodeValidationResult<SingleEpisodeInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ field: "body", message: "Request body must be a JSON object." }],
    };
  }

  const body = input as Record<string, unknown>;
  const errors: EpisodeFieldError[] = [];
  const value: SingleEpisodeInput = {};

  if (body.episodeNumber !== undefined) {
    const num = Number(body.episodeNumber);
    if (!Number.isInteger(num) || num < 1) {
      errors.push({
        field: "episodeNumber",
        message: "episodeNumber must be a positive integer greater than or equal to 1.",
      });
    } else {
      value.episodeNumber = num;
    }
  }

  if (body.title !== undefined) {
    if (typeof body.title !== "string") {
      errors.push({ field: "title", message: "title must be a string." });
    } else {
      const t = body.title.trim();
      if (t.length > EPISODE_LIMITS.titleMax) {
        errors.push({
          field: "title",
          message: `title must be at most ${EPISODE_LIMITS.titleMax} characters.`,
        });
      } else {
        value.title = t;
      }
    }
  }

  if (body.durationSeconds !== undefined) {
    const dur = Number(body.durationSeconds);
    if (!Number.isInteger(dur) || dur < 0 || dur > EPISODE_LIMITS.durationMax) {
      errors.push({
        field: "durationSeconds",
        message: `durationSeconds must be an integer between 0 and ${EPISODE_LIMITS.durationMax}.`,
      });
    } else {
      value.durationSeconds = dur;
    }
  }

  if (body.isFree !== undefined) {
    value.isFree = Boolean(body.isFree);
  }

  if (body.thumbnailUrl !== undefined) {
    if (body.thumbnailUrl === null || body.thumbnailUrl === "") {
      value.thumbnailUrl = null;
    } else if (typeof body.thumbnailUrl === "string") {
      const u = body.thumbnailUrl.trim();
      if (u.length > EPISODE_LIMITS.urlMax) {
        errors.push({
          field: "thumbnailUrl",
          message: `thumbnailUrl must be at most ${EPISODE_LIMITS.urlMax} characters.`,
        });
      } else {
        value.thumbnailUrl = u;
      }
    } else {
      errors.push({ field: "thumbnailUrl", message: "thumbnailUrl must be a string or null." });
    }
  }

  if (body.releaseAt !== undefined) {
    if (body.releaseAt === null || body.releaseAt === "") {
      value.releaseAt = null;
    } else if (typeof body.releaseAt === "string") {
      const date = new Date(body.releaseAt);
      if (isNaN(date.getTime())) {
        errors.push({ field: "releaseAt", message: "releaseAt must be a valid ISO timestamp or null." });
      } else {
        value.releaseAt = date.toISOString();
      }
    } else {
      errors.push({ field: "releaseAt", message: "releaseAt must be a valid date string or null." });
    }
  }

  // Media fields
  if (body.hlsUrl !== undefined) {
    value.hlsUrl = typeof body.hlsUrl === "string" ? body.hlsUrl.trim() : null;
  }
  if (body.mp4Url !== undefined) {
    value.mp4Url = typeof body.mp4Url === "string" ? body.mp4Url.trim() : null;
  }
  if (body.assetRef !== undefined) {
    value.assetRef = typeof body.assetRef === "string" ? body.assetRef.trim() : null;
  }
  if (body.provider !== undefined) {
    value.provider = typeof body.provider === "string" ? body.provider.trim() : "custom";
  }
  if (body.status !== undefined) {
    if (["missing", "processing", "ready", "error"].includes(String(body.status))) {
      value.status = body.status as "missing" | "processing" | "ready" | "error";
    } else {
      errors.push({ field: "status", message: "status must be one of: missing, processing, ready, error." });
    }
  }

  if (mode === "update" && Object.keys(value).length === 0 && errors.length === 0) {
    errors.push({ field: "body", message: "No updatable fields provided." });
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function validateBulkRangePayload(
  input: unknown
): EpisodeValidationResult<BulkRangeInput> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      ok: false,
      errors: [{ field: "body", message: "Request body must be a JSON object." }],
    };
  }

  const body = input as Record<string, unknown>;
  const errors: EpisodeFieldError[] = [];

  const startNumber = Number(body.startNumber ?? body.start);
  const endNumber = Number(body.endNumber ?? body.end);

  if (!Number.isInteger(startNumber) || startNumber < 1) {
    errors.push({ field: "startNumber", message: "startNumber must be a positive integer >= 1." });
  }
  if (!Number.isInteger(endNumber) || endNumber < startNumber) {
    errors.push({ field: "endNumber", message: "endNumber must be an integer >= startNumber." });
  }
  if (endNumber - startNumber + 1 > EPISODE_LIMITS.bulkMaxRange) {
    errors.push({
      field: "range",
      message: `Cannot generate more than ${EPISODE_LIMITS.bulkMaxRange} episodes at once.`,
    });
  }

  const titleTemplate =
    typeof body.titleTemplate === "string" && body.titleTemplate.trim()
      ? body.titleTemplate.trim()
      : undefined;

  const autoFree = body.autoFree !== undefined ? Boolean(body.autoFree) : true;

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      startNumber,
      endNumber,
      titleTemplate,
      autoFree,
    },
  };
}

export function validateBulkMediaPayload(
  input: unknown
): EpisodeValidationResult<BulkMediaItemInput[]> {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      errors: [{ field: "body", message: "Request body must be a JSON object with an items array." }],
    };
  }

  const body = input as Record<string, unknown>;
  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return {
      ok: false,
      errors: [{ field: "items", message: "items must be a non-empty array of media objects." }],
    };
  }

  const errors: EpisodeFieldError[] = [];
  const normalized: BulkMediaItemInput[] = [];

  items.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      errors.push({ field: `items[${index}]`, message: "Item must be an object." });
      return;
    }
    const epNum = Number(item.episodeNumber ?? item.episode_number ?? item.episode);
    if (!Number.isInteger(epNum) || epNum < 1) {
      errors.push({
        field: `items[${index}].episodeNumber`,
        message: "episodeNumber must be an integer >= 1.",
      });
      return;
    }
    const rawVal = String(item.urlOrAssetId ?? item.url ?? item.assetRef ?? item.asset_id ?? "").trim();
    if (!rawVal) {
      errors.push({
        field: `items[${index}].urlOrAssetId`,
        message: "Video URL or asset ID cannot be empty.",
      });
      return;
    }
    const provider = typeof item.provider === "string" ? item.provider.trim() : "custom";
    const duration =
      item.durationSeconds !== undefined ? Math.max(0, Number(item.durationSeconds) || 0) : undefined;

    normalized.push({
      episodeNumber: epNum,
      urlOrAssetId: rawVal,
      provider,
      durationSeconds: duration,
    });
  });

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: normalized };
}

export function validateReorderPayload(
  input: unknown
): EpisodeValidationResult<ReorderEpisodesInput> {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      errors: [{ field: "body", message: "Request body must be a JSON object with orderedEpisodeIds." }],
    };
  }

  const body = input as Record<string, unknown>;
  const ids = body.orderedEpisodeIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return {
      ok: false,
      errors: [{ field: "orderedEpisodeIds", message: "orderedEpisodeIds must be a non-empty array of UUIDs." }],
    };
  }

  const errors: EpisodeFieldError[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (typeof id !== "string" || !isUuid(id)) {
      errors.push({ field: `orderedEpisodeIds[${i}]`, message: `Item at index ${i} must be a valid UUID.` });
      break;
    }
    if (seen.has(id)) {
      errors.push({ field: "orderedEpisodeIds", message: "Duplicate UUID found in orderedEpisodeIds." });
      break;
    }
    seen.add(id);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: { orderedEpisodeIds: ids as string[] } };
}
