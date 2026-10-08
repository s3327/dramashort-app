/**
 * Validation rules and normalization helpers for Genres & Tags Taxonomy (Task 16.6).
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: ValidationError[];
}

export function slugifyTaxonomy(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export interface ValidatedGenreInput {
  name: string;
  slug: string;
  sortOrder: number;
  isVisible: boolean;
}

export function validateGenrePayload(
  payload: unknown,
  mode: "create" | "update" = "create"
): ValidationResult<Partial<ValidatedGenreInput>> {
  const errors: ValidationError[] = [];
  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  const result: Partial<ValidatedGenreInput> = {};

  // 1. Name
  if (mode === "create" || raw.name !== undefined) {
    if (typeof raw.name !== "string" || !raw.name.trim()) {
      errors.push({ field: "name", message: "Genre name is required" });
    } else {
      const name = raw.name.trim();
      if (name.length > 50) {
        errors.push({ field: "name", message: "Genre name must not exceed 50 characters" });
      } else {
        result.name = name;
      }
    }
  }

  // 2. Slug
  if (raw.slug !== undefined) {
    if (typeof raw.slug !== "string" || !raw.slug.trim()) {
      errors.push({ field: "slug", message: "Genre slug cannot be empty if specified" });
    } else {
      const slug = slugifyTaxonomy(raw.slug);
      if (!slug) {
        errors.push({ field: "slug", message: "Genre slug contains no valid characters" });
      } else if (slug.length > 60) {
        errors.push({ field: "slug", message: "Genre slug must not exceed 60 characters" });
      } else {
        result.slug = slug;
      }
    }
  } else if (mode === "create" && result.name) {
    result.slug = slugifyTaxonomy(result.name);
    if (!result.slug) {
      errors.push({ field: "slug", message: "Unable to generate a valid slug from genre name" });
    }
  }

  // 3. Sort Order
  if (raw.sortOrder !== undefined || raw.sort_order !== undefined) {
    const rawOrder = raw.sortOrder !== undefined ? raw.sortOrder : raw.sort_order;
    const parsed = typeof rawOrder === "number" ? rawOrder : parseInt(String(rawOrder), 10);
    if (isNaN(parsed) || parsed < 0) {
      errors.push({ field: "sortOrder", message: "Sort order must be a non-negative integer" });
    } else {
      result.sortOrder = Math.floor(parsed);
    }
  } else if (mode === "create") {
    result.sortOrder = 0;
  }

  // 4. Is Visible
  if (raw.isVisible !== undefined || raw.is_visible !== undefined) {
    const rawVisible = raw.isVisible !== undefined ? raw.isVisible : raw.is_visible;
    result.isVisible = Boolean(rawVisible);
  } else if (mode === "create") {
    result.isVisible = true;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: result, errors: [] };
}

export interface ValidatedTagInput {
  name: string;
  slug: string;
}

export function validateTagPayload(
  payload: unknown,
  mode: "create" | "update" = "create"
): ValidationResult<Partial<ValidatedTagInput>> {
  const errors: ValidationError[] = [];
  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  const result: Partial<ValidatedTagInput> = {};

  // 1. Name
  if (mode === "create" || raw.name !== undefined) {
    if (typeof raw.name !== "string" || !raw.name.trim()) {
      errors.push({ field: "name", message: "Tag name is required" });
    } else {
      const name = raw.name.trim();
      if (name.length > 50) {
        errors.push({ field: "name", message: "Tag name must not exceed 50 characters" });
      } else {
        result.name = name;
      }
    }
  }

  // 2. Slug
  if (raw.slug !== undefined) {
    if (typeof raw.slug !== "string" || !raw.slug.trim()) {
      errors.push({ field: "slug", message: "Tag slug cannot be empty if specified" });
    } else {
      const slug = slugifyTaxonomy(raw.slug);
      if (!slug) {
        errors.push({ field: "slug", message: "Tag slug contains no valid characters" });
      } else if (slug.length > 60) {
        errors.push({ field: "slug", message: "Tag slug must not exceed 60 characters" });
      } else {
        result.slug = slug;
      }
    }
  } else if (mode === "create" && result.name) {
    result.slug = slugifyTaxonomy(result.name);
    if (!result.slug) {
      errors.push({ field: "slug", message: "Unable to generate a valid slug from tag name" });
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: result, errors: [] };
}

export interface ValidatedMergeTagsInput {
  sourceTagId: string;
  targetTagId: string;
}

export function validateMergeTagsPayload(payload: unknown): ValidationResult<ValidatedMergeTagsInput> {
  const errors: ValidationError[] = [];
  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;

  const sourceTagId = typeof raw.sourceTagId === "string" ? raw.sourceTagId.trim() : "";
  const targetTagId = typeof raw.targetTagId === "string" ? raw.targetTagId.trim() : "";

  if (!sourceTagId) {
    errors.push({ field: "sourceTagId", message: "Source tag ID is required" });
  }
  if (!targetTagId) {
    errors.push({ field: "targetTagId", message: "Target tag ID is required" });
  }
  if (sourceTagId && targetTagId && sourceTagId === targetTagId) {
    errors.push({ field: "targetTagId", message: "Source and target tags must be different" });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { sourceTagId, targetTagId }, errors: [] };
}
