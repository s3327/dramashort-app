import { isAllowedImageUrl } from "@/lib/validation/drama";

/**
 * Validation rules and limits for Channel operations (Task 16.5).
 */
export const CHANNEL_LIMITS = {
  nameMin: 2,
  nameMax: 100,
  slugMin: 2,
  slugMax: 80,
  codeMin: 2,
  codeMax: 10,
  descriptionMax: 2000,
  urlMax: 2048,
} as const;

export interface NormalizedChannelFields {
  name?: string;
  slug?: string;
  code?: string;
  description?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
}

export interface FieldError {
  field: string;
  message: string;
}

export type ChannelValidationResult =
  | { ok: true; value: NormalizedChannelFields }
  | { ok: false; errors: FieldError[] };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CODE_RE = /^[a-zA-Z0-9_-]{2,10}$/;

/**
 * Generates a clean, URL-safe slug from a channel name.
 */
export function slugifyChannelName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}



/**
 * Validates a channel creation or update payload.
 */
export function validateChannelPayload(
  payload: unknown,
  mode: "create" | "update"
): ChannelValidationResult {
  const errors: FieldError[] = [];

  if (!payload || typeof payload !== "object") {
    return {
      ok: false,
      errors: [{ field: "payload", message: "Payload must be an object." }],
    };
  }

  const p = payload as Record<string, unknown>;
  const normalized: NormalizedChannelFields = {};

  // 1. Name validation
  const rawName = p.name;
  if (rawName !== undefined) {
    if (typeof rawName !== "string") {
      errors.push({ field: "name", message: "Channel name must be a string." });
    } else {
      const trimmed = rawName.trim();
      if (trimmed.length < CHANNEL_LIMITS.nameMin) {
        errors.push({
          field: "name",
          message: `Channel name must be at least ${CHANNEL_LIMITS.nameMin} characters.`,
        });
      } else if (trimmed.length > CHANNEL_LIMITS.nameMax) {
        errors.push({
          field: "name",
          message: `Channel name cannot exceed ${CHANNEL_LIMITS.nameMax} characters.`,
        });
      } else {
        normalized.name = trimmed;
      }
    }
  } else if (mode === "create") {
    errors.push({ field: "name", message: "Channel name is required." });
  }

  // 2. Code validation (acronym 2-10 chars)
  const rawCode = p.code;
  if (rawCode !== undefined) {
    if (typeof rawCode !== "string") {
      errors.push({ field: "code", message: "Channel code must be a string." });
    } else {
      const trimmed = rawCode.trim().toUpperCase();
      if (!CODE_RE.test(trimmed)) {
        errors.push({
          field: "code",
          message: `Channel code must be 2 to 10 alphanumeric characters.`,
        });
      } else {
        normalized.code = trimmed;
      }
    }
  } else if (mode === "create") {
    errors.push({ field: "code", message: "Channel code is required." });
  }

  // 3. Slug validation
  const rawSlug = p.slug;
  if (rawSlug !== undefined && rawSlug !== null && String(rawSlug).trim() !== "") {
    if (typeof rawSlug !== "string") {
      errors.push({ field: "slug", message: "Channel slug must be a string." });
    } else {
      const trimmed = rawSlug.trim().toLowerCase();
      if (!SLUG_RE.test(trimmed)) {
        errors.push({
          field: "slug",
          message: "Channel slug must contain only lowercase alphanumeric characters and hyphens.",
        });
      } else if (
        trimmed.length < CHANNEL_LIMITS.slugMin ||
        trimmed.length > CHANNEL_LIMITS.slugMax
      ) {
        errors.push({
          field: "slug",
          message: `Channel slug must be between ${CHANNEL_LIMITS.slugMin} and ${CHANNEL_LIMITS.slugMax} characters.`,
        });
      } else {
        normalized.slug = trimmed;
      }
    }
  } else if (mode === "create" && normalized.name) {
    // Auto-generate slug if omitted
    const generated = slugifyChannelName(normalized.name);
    if (!SLUG_RE.test(generated) || generated.length < CHANNEL_LIMITS.slugMin) {
      errors.push({
        field: "slug",
        message: "Could not generate a valid URL slug from the channel name. Please provide one explicitly.",
      });
    } else {
      normalized.slug = generated.slice(0, CHANNEL_LIMITS.slugMax);
    }
  }

  // 4. Description validation
  const rawDescription = p.description;
  if (rawDescription !== undefined && rawDescription !== null) {
    if (typeof rawDescription !== "string") {
      errors.push({ field: "description", message: "Description must be a string." });
    } else {
      const trimmed = rawDescription.trim();
      if (trimmed.length > CHANNEL_LIMITS.descriptionMax) {
        errors.push({
          field: "description",
          message: `Description cannot exceed ${CHANNEL_LIMITS.descriptionMax} characters.`,
        });
      } else {
        normalized.description = trimmed === "" ? null : trimmed;
      }
    }
  } else if (mode === "update" && rawDescription === null) {
    normalized.description = null;
  }

  // 5. Avatar URL validation (supports avatarUrl or avatar_url)
  const rawAvatar = p.avatarUrl !== undefined ? p.avatarUrl : p.avatar_url;
  if (rawAvatar !== undefined && rawAvatar !== null) {
    if (typeof rawAvatar !== "string") {
      errors.push({ field: "avatarUrl", message: "Avatar URL must be a string." });
    } else {
      const trimmed = rawAvatar.trim();
      if (trimmed === "") {
        normalized.avatarUrl = null;
      } else if (trimmed.length > CHANNEL_LIMITS.urlMax) {
        errors.push({ field: "avatarUrl", message: "Avatar URL exceeds maximum length." });
      } else if (!isAllowedImageUrl(trimmed)) {
        errors.push({
          field: "avatarUrl",
          message: "Avatar URL must be a valid HTTP/HTTPS URL from an allowed domain.",
        });
      } else {
        normalized.avatarUrl = trimmed;
      }
    }
  } else if (mode === "update" && (p.avatarUrl === null || p.avatar_url === null)) {
    normalized.avatarUrl = null;
  }

  // 6. Banner URL validation (supports bannerUrl or banner_url)
  const rawBanner = p.bannerUrl !== undefined ? p.bannerUrl : p.banner_url;
  if (rawBanner !== undefined && rawBanner !== null) {
    if (typeof rawBanner !== "string") {
      errors.push({ field: "bannerUrl", message: "Banner URL must be a string." });
    } else {
      const trimmed = rawBanner.trim();
      if (trimmed === "") {
        normalized.bannerUrl = null;
      } else if (trimmed.length > CHANNEL_LIMITS.urlMax) {
        errors.push({ field: "bannerUrl", message: "Banner URL exceeds maximum length." });
      } else if (!isAllowedImageUrl(trimmed)) {
        errors.push({
          field: "bannerUrl",
          message: "Banner URL must be a valid HTTP/HTTPS URL from an allowed domain.",
        });
      } else {
        normalized.bannerUrl = trimmed;
      }
    }
  } else if (mode === "update" && (p.bannerUrl === null || p.banner_url === null)) {
    normalized.bannerUrl = null;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: normalized };
}
