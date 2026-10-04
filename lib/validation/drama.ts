import { imageRemotePatterns } from "@/lib/config/image-hosts.mjs";

/**
 * Request validation for the admin Drama API (Task 10.3).
 *
 * Accepts the payload shapes sent by `createDrama()` / `updateDrama()` in
 * lib/services/content.service.ts (camelCase and snake_case aliases), and
 * returns normalized fields ready for the `titles` table. Unknown fields are
 * ignored. channel_code / channel_id are never taken from the client; routes
 * resolve them from the channels table.
 */

export const DRAMA_STATUSES = ["Published", "Draft", "Scheduled", "Archived"] as const;
export type DramaStatus = (typeof DRAMA_STATUSES)[number];

export const DRAMA_LIMITS = {
  titleMax: 200,
  synopsisMax: 5000,
  genreMax: 50,
  channelMax: 100,
  tagMax: 40,
  tagsMax: 20,
  episodesMin: 1,
  episodesMax: 500,
  urlMax: 2048,
} as const;

export interface DramaFields {
  title?: string;
  synopsis?: string;
  genre?: string;
  tags?: string[];
  channelName?: string;
  status?: DramaStatus;
  totalEpisodes?: number;
  posterUrl?: string;
}

export interface FieldError {
  field: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: DramaFields }
  | { ok: false; errors: FieldError[] };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Matches a hostname against a next/image pattern ("*" = one label, "**" = any). */
function hostnameMatches(hostname: string, pattern: string): boolean {
  const hostParts = hostname.toLowerCase().split(".");
  const patternParts = pattern.toLowerCase().split(".");

  if (patternParts[0] === "**") {
    const suffix = patternParts.slice(1);
    return (
      hostParts.length > suffix.length &&
      hostParts.slice(hostParts.length - suffix.length).join(".") === suffix.join(".")
    );
  }

  if (hostParts.length !== patternParts.length) return false;
  return patternParts.every((part, i) => part === "*" || part === hostParts[i]);
}

/** Matches a pathname against a next/image pattern ending in "/**" (prefix) or exact. */
function pathnameMatches(pathname: string, pattern: string | undefined): boolean {
  if (!pattern) return true;
  if (pattern.endsWith("/**")) {
    return pathname.startsWith(pattern.slice(0, -2));
  }
  return pathname === pattern;
}

/** True when next/image would accept this remote URL under the shared remotePatterns. */
export function isAllowedImageUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;

  return imageRemotePatterns.some(
    (p) =>
      url.protocol === `${p.protocol}:` &&
      hostnameMatches(url.hostname, p.hostname) &&
      pathnameMatches(url.pathname, "pathname" in p ? p.pathname : undefined)
  );
}

function firstDefined(body: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (body[key] !== undefined) return body[key];
  }
  return undefined;
}

function normalizeTags(raw: unknown, errors: FieldError[]): string[] | undefined {
  let list: unknown[];
  if (typeof raw === "string") {
    list = raw.split(",");
  } else if (Array.isArray(raw)) {
    list = raw;
  } else {
    errors.push({ field: "tags", message: "Tags must be an array of strings or a comma-separated string." });
    return undefined;
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") {
      errors.push({ field: "tags", message: "Every tag must be a string." });
      return undefined;
    }
    const tag = item.trim();
    if (!tag) continue;
    if (tag.length > DRAMA_LIMITS.tagMax) {
      errors.push({ field: "tags", message: `Each tag must be at most ${DRAMA_LIMITS.tagMax} characters.` });
      return undefined;
    }
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }

  if (tags.length > DRAMA_LIMITS.tagsMax) {
    errors.push({ field: "tags", message: `At most ${DRAMA_LIMITS.tagsMax} tags are allowed.` });
    return undefined;
  }
  return tags;
}

function readText(
  value: unknown,
  field: string,
  max: number,
  errors: FieldError[],
  { allowEmpty }: { allowEmpty: boolean }
): string | undefined {
  if (typeof value !== "string") {
    errors.push({ field, message: `${field} must be a string.` });
    return undefined;
  }
  const text = value.trim();
  if (!allowEmpty && !text) {
    errors.push({ field, message: `${field} cannot be empty.` });
    return undefined;
  }
  if (text.length > max) {
    errors.push({ field, message: `${field} must be at most ${max} characters.` });
    return undefined;
  }
  return text;
}

/**
 * Validates a create (`mode: "create"`, title required) or partial update
 * (`mode: "update"`) payload.
 */
export function validateDramaPayload(input: unknown, mode: "create" | "update"): ValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: [{ field: "body", message: "Request body must be a JSON object." }] };
  }

  const body = input as Record<string, unknown>;
  const errors: FieldError[] = [];
  const value: DramaFields = {};

  if (body.title !== undefined) {
    value.title = readText(body.title, "title", DRAMA_LIMITS.titleMax, errors, { allowEmpty: false });
  } else if (mode === "create") {
    errors.push({ field: "title", message: "title is required." });
  }

  if (body.synopsis !== undefined) {
    value.synopsis = readText(body.synopsis, "synopsis", DRAMA_LIMITS.synopsisMax, errors, { allowEmpty: true });
  }

  if (body.genre !== undefined) {
    value.genre = readText(body.genre, "genre", DRAMA_LIMITS.genreMax, errors, { allowEmpty: false });
  }

  const channel = firstDefined(body, ["channel_name", "channel"]);
  if (channel !== undefined) {
    value.channelName = readText(channel, "channel", DRAMA_LIMITS.channelMax, errors, { allowEmpty: false });
  }

  if (body.status !== undefined) {
    if (typeof body.status === "string" && (DRAMA_STATUSES as readonly string[]).includes(body.status)) {
      value.status = body.status as DramaStatus;
    } else {
      errors.push({ field: "status", message: `status must be one of: ${DRAMA_STATUSES.join(", ")}.` });
    }
  }

  const episodes = firstDefined(body, ["totalEpisodes", "total_episodes"]);
  if (episodes !== undefined) {
    const n = typeof episodes === "string" && episodes.trim() !== "" ? Number(episodes) : episodes;
    if (
      typeof n !== "number" ||
      !Number.isInteger(n) ||
      n < DRAMA_LIMITS.episodesMin ||
      n > DRAMA_LIMITS.episodesMax
    ) {
      errors.push({
        field: "totalEpisodes",
        message: `totalEpisodes must be a whole number from ${DRAMA_LIMITS.episodesMin} to ${DRAMA_LIMITS.episodesMax}.`,
      });
    } else {
      value.totalEpisodes = n;
    }
  }

  if (body.tags !== undefined) {
    value.tags = normalizeTags(body.tags, errors);
  }

  const poster = firstDefined(body, ["poster_url", "poster"]);
  if (poster !== undefined) {
    if (typeof poster !== "string" || !poster.trim()) {
      errors.push({ field: "poster", message: "poster must be a non-empty URL string." });
    } else if (poster.trim().length > DRAMA_LIMITS.urlMax) {
      errors.push({ field: "poster", message: `poster URL must be at most ${DRAMA_LIMITS.urlMax} characters.` });
    } else if (!isAllowedImageUrl(poster.trim())) {
      errors.push({
        field: "poster",
        message: "poster must be an https URL on an allowed image host (see lib/config/image-hosts.mjs).",
      });
    } else {
      value.posterUrl = poster.trim();
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** Escapes LIKE/ILIKE wildcards so a channel name is matched literally. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
