import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { getContentAdminClient } from "@/lib/supabase/content";
import type { Database } from "@/types/supabase";
import type {
  AdminGenre,
  CreateGenreInput,
  UpdateGenreInput,
  AdminTag,
  CreateTagInput,
  UpdateTagInput,
  MergeTagsInput,
} from "@/types/content";
import {
  validateGenrePayload,
  validateTagPayload,
  validateMergeTagsPayload,
} from "@/lib/validation/taxonomy";
import { recordAuditLog } from "@/lib/server/audit";
import { type Result, ok, err } from "@/lib/common/result";

type GenreRow = Database["public"]["Tables"]["genres"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];

function mapRowToAdminGenre(row: GenreRow, dramaCount = 0): AdminGenre {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    sortOrder: row.sort_order ?? 0,
    isVisible: row.is_visible ?? true,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    dramaCount,
  };
}

function mapRowToAdminTag(row: TagRow, dramaCount = 0): AdminTag {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    dramaCount,
  };
}

// ============================================================================
// GENRES OPERATIONS
// ============================================================================

/**
 * Fetches all genres with live aggregated drama counts from titles.
 */
export async function getAdminGenresServer(): Promise<AdminGenre[]> {
  const adminClient = getContentAdminClient();

  const { data: genreRows, error: genreErr } = await adminClient
    .from("genres")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (genreErr || !genreRows) {
    console.error("[getAdminGenresServer] Error fetching genres:", genreErr);
    return [];
  }

  // Count titles by genre_id and case-insensitive genre name
  const countsByGenreId = new Map<string, number>();
  const countsByGenreName = new Map<string, number>();

  try {
    const { data: titleRows } = await adminClient
      .from("titles")
      .select("id, genre_id, genre");

    if (titleRows) {
      for (const t of titleRows) {
        if (t.genre_id) {
          countsByGenreId.set(t.genre_id, (countsByGenreId.get(t.genre_id) ?? 0) + 1);
        }
        if (t.genre) {
          const lower = t.genre.trim().toLowerCase();
          countsByGenreName.set(lower, (countsByGenreName.get(lower) ?? 0) + 1);
        }
      }
    }
  } catch (err) {
    console.warn("[getAdminGenresServer] Could not count titles:", err);
  }

  return (genreRows as GenreRow[]).map((row: GenreRow) => {
    const countById = countsByGenreId.get(row.id);
    const countByName = countsByGenreName.get(row.name.trim().toLowerCase());
    const dramaCount = countById !== undefined ? countById : (countByName ?? 0);
    return mapRowToAdminGenre(row, dramaCount);
  });
}

/**
 * Fetches a single genre by ID with drama count.
 */
export async function getAdminGenreByIdServer(id: string): Promise<AdminGenre | null> {
  if (!id) return null;
  const adminClient = getContentAdminClient();

  const { data: row, error } = await adminClient
    .from("genres")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) return null;

  let dramaCount = 0;
  try {
    const { data: titles } = await adminClient
      .from("titles")
      .select("id")
      .or(`genre_id.eq.${id},genre.ilike."${row.name}"`);
    dramaCount = titles?.length || 0;
  } catch {}

  return mapRowToAdminGenre(row, dramaCount);
}

/**
 * Creates a new genre. Enforces unique name and slug.
 */
export async function createAdminGenreServer(
  input: CreateGenreInput,
  actor?: { id?: string; email?: string }
): Promise<Result<AdminGenre, { message: string; field?: string }>> {
  const validation = validateGenrePayload(input, "create");
  if (!validation.ok || !validation.value) {
    const firstErr = validation.errors[0];
    return err({ message: firstErr?.message || "Validation failed", field: firstErr?.field });
  }

  const { name, slug, sortOrder, isVisible } = validation.value;
  const adminClient = getContentAdminClient();

  // Check collision for name or slug
  const { data: existing } = await adminClient
    .from("genres")
    .select("id, name, slug")
    .or(`name.ilike."${name}",slug.eq."${slug}"`)
    .maybeSingle();

  if (existing) {
    if (existing.slug === slug) {
      return err({ message: `A genre with slug '${slug}' already exists.`, field: "slug" });
    }
    return err({ message: `A genre with name '${name}' already exists.`, field: "name" });
  }

  const { data: createdRow, error: insertErr } = await adminClient
    .from("genres")
    .insert({
      name: name!,
      slug: slug!,
      sort_order: sortOrder ?? 0,
      is_visible: isVisible ?? true,
    })
    .select("*")
    .single();

  if (insertErr || !createdRow) {
    console.error("[createAdminGenreServer] Database insert error:", insertErr);
    return err({ message: insertErr?.message || "Failed to create genre." });
  }

  await recordAuditLog({
    action: "taxonomy.genre_create",
    entityType: "genre",
    entityId: createdRow.id,
    after: {
      name: createdRow.name,
      slug: createdRow.slug,
      sortOrder: createdRow.sort_order,
      isVisible: createdRow.is_visible,
    },
    actorId: actor?.id,
    actorEmail: actor?.email,
  });

  try {
    revalidateTag("genres");
    revalidateTag("taxonomy");
    revalidatePath("/genres");
  } catch {}

  return ok(mapRowToAdminGenre(createdRow, 0));
}

/**
 * Updates an existing genre. Propagates name changes to titles and links genre_id.
 */
export async function updateAdminGenreServer(
  id: string,
  input: UpdateGenreInput,
  actor?: { id?: string; email?: string }
): Promise<Result<AdminGenre, { message: string; field?: string }>> {
  if (!id) return err({ message: "Genre ID is required." });

  const validation = validateGenrePayload(input, "update");
  if (!validation.ok || !validation.value) {
    const firstErr = validation.errors[0];
    return err({ message: firstErr?.message || "Validation failed", field: firstErr?.field });
  }

  const adminClient = getContentAdminClient();

  const { data: existing, error: fetchErr } = await adminClient
    .from("genres")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return err({ message: "Genre not found." });
  }

  const updates = validation.value;

  // Collision checks if changing name or slug
  if (updates.name && updates.name.toLowerCase() !== existing.name.toLowerCase()) {
    const { data: nameMatch } = await adminClient
      .from("genres")
      .select("id")
      .ilike("name", updates.name)
      .neq("id", id)
      .maybeSingle();

    if (nameMatch) {
      return err({ message: `A genre with name '${updates.name}' already exists.`, field: "name" });
    }
  }

  if (updates.slug && updates.slug !== existing.slug) {
    const { data: slugMatch } = await adminClient
      .from("genres")
      .select("id")
      .eq("slug", updates.slug)
      .neq("id", id)
      .maybeSingle();

    if (slugMatch) {
      return err({ message: `A genre with slug '${updates.slug}' already exists.`, field: "slug" });
    }
  }

  const rowUpdates: Partial<Database["public"]["Tables"]["genres"]["Update"]> = {};
  if (updates.name !== undefined) rowUpdates.name = updates.name;
  if (updates.slug !== undefined) rowUpdates.slug = updates.slug;
  if (updates.sortOrder !== undefined) rowUpdates.sort_order = updates.sortOrder;
  if (updates.isVisible !== undefined) rowUpdates.is_visible = updates.isVisible;

  const { data: updatedRow, error: updateErr } = await adminClient
    .from("genres")
    .update(rowUpdates)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedRow) {
    console.error("[updateAdminGenreServer] Database update error:", updateErr);
    return err({ message: updateErr?.message || "Failed to update genre." });
  }

  // Renaming propagation across titles table
  if (updates.name && updates.name !== existing.name) {
    try {
      await adminClient
        .from("titles")
        .update({
          genre: updatedRow.name,
          genre_id: updatedRow.id,
        })
        .or(`genre_id.eq.${id},genre.ilike."${existing.name}"`);
    } catch (propagateErr) {
      console.warn("[updateAdminGenreServer] Could not propagate genre rename to titles:", propagateErr);
    }
  }

  // Get live drama count
  let dramaCount = 0;
  try {
    const { data: titles } = await adminClient
      .from("titles")
      .select("id")
      .or(`genre_id.eq.${id},genre.ilike."${updatedRow.name}"`);
    dramaCount = titles?.length || 0;
  } catch {}

  await recordAuditLog({
    action: "taxonomy.genre_update",
    entityType: "genre",
    entityId: id,
    before: {
      name: existing.name,
      slug: existing.slug,
      sortOrder: existing.sort_order,
      isVisible: existing.is_visible,
    },
    after: {
      name: updatedRow.name,
      slug: updatedRow.slug,
      sortOrder: updatedRow.sort_order,
      isVisible: updatedRow.is_visible,
    },
    actorId: actor?.id,
    actorEmail: actor?.email,
  });

  try {
    revalidateTag("genres");
    revalidateTag("taxonomy");
    revalidateTag("titles");
    revalidatePath("/genres");
    revalidatePath("/browse");
  } catch {}

  return ok(mapRowToAdminGenre(updatedRow, dramaCount));
}

/**
 * Deletes a genre. Prevents deletion if any dramas are assigned to it, unless force = true.
 */
export async function deleteAdminGenreServer(
  id: string,
  actor?: { id?: string; email?: string },
  options?: { force?: boolean }
): Promise<Result<{ success: boolean }, { message: string; count?: number; code?: string }>> {
  if (!id) return err({ message: "Genre ID is required." });

  const adminClient = getContentAdminClient();

  const { data: existing, error: fetchErr } = await adminClient
    .from("genres")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return err({ message: "Genre not found." });
  }

  // Check assigned dramas
  const { data: titles } = await adminClient
    .from("titles")
    .select("id, title")
    .or(`genre_id.eq.${id},genre.ilike."${existing.name}"`);

  const dramaCount = titles?.length || 0;

  if (dramaCount > 0 && !options?.force) {
    return err({
      code: "CONFLICT",
      message: `Cannot delete genre '${existing.name}'. It is currently assigned to ${dramaCount} drama${
        dramaCount === 1 ? "" : "s"
      }. Reassign or remove these dramas first.`,
      count: dramaCount,
    });
  }

  if (options?.force && dramaCount > 0) {
    // Unlink genre_id from titles
    try {
      await adminClient
        .from("titles")
        .update({ genre_id: null })
        .eq("genre_id", id);
    } catch {}
  }

  const { error: deleteErr } = await adminClient
    .from("genres")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    console.error("[deleteAdminGenreServer] Delete error:", deleteErr);
    return err({ message: deleteErr.message || "Failed to delete genre." });
  }

  await recordAuditLog({
    action: "taxonomy.genre_delete",
    entityType: "genre",
    entityId: id,
    before: {
      name: existing.name,
      slug: existing.slug,
    },
    actorId: actor?.id,
    actorEmail: actor?.email,
  });

  try {
    revalidateTag("genres");
    revalidateTag("taxonomy");
    revalidatePath("/genres");
    revalidatePath("/browse");
  } catch {}

  return ok({ success: true });
}

// ============================================================================
// TAGS OPERATIONS
// ============================================================================

/**
 * Fetches all tags with live usage counts from titles.tags.
 */
export async function getAdminTagsServer(): Promise<AdminTag[]> {
  const adminClient = getContentAdminClient();

  const { data: tagRows, error: tagErr } = await adminClient
    .from("tags")
    .select("*")
    .order("name", { ascending: true });

  if (tagErr || !tagRows) {
    console.error("[getAdminTagsServer] Error fetching tags:", tagErr);
    return [];
  }

  // Calculate usage counts across all titles.tags
  const tagUsageCounts = new Map<string, number>();

  try {
    const { data: titleRows } = await adminClient
      .from("titles")
      .select("tags");

    if (titleRows) {
      for (const t of titleRows) {
        if (Array.isArray(t.tags)) {
          for (const rawTag of t.tags) {
            if (typeof rawTag === "string") {
              const lower = rawTag.trim().toLowerCase();
              tagUsageCounts.set(lower, (tagUsageCounts.get(lower) ?? 0) + 1);
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[getAdminTagsServer] Could not count tags:", err);
  }

  return (tagRows as TagRow[]).map((row: TagRow) => {
    const count = tagUsageCounts.get(row.name.trim().toLowerCase()) ?? 0;
    return mapRowToAdminTag(row, count);
  });
}

/**
 * Fetches a single tag by ID with usage count.
 */
export async function getAdminTagByIdServer(id: string): Promise<AdminTag | null> {
  if (!id) return null;
  const adminClient = getContentAdminClient();

  const { data: row, error } = await adminClient
    .from("tags")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) return null;

  let dramaCount = 0;
  try {
    const { data: titles } = await adminClient
      .from("titles")
      .select("id, tags")
      .contains("tags", [row.name]);
    dramaCount = titles?.length || 0;
  } catch {}

  return mapRowToAdminTag(row, dramaCount);
}

/**
 * Creates a new tag.
 */
export async function createAdminTagServer(
  input: CreateTagInput,
  actor?: { id?: string; email?: string }
): Promise<Result<AdminTag, { message: string; field?: string }>> {
  const validation = validateTagPayload(input, "create");
  if (!validation.ok || !validation.value) {
    const firstErr = validation.errors[0];
    return err({ message: firstErr?.message || "Validation failed", field: firstErr?.field });
  }

  const { name, slug } = validation.value;
  const adminClient = getContentAdminClient();

  // Collision check
  const { data: existing } = await adminClient
    .from("tags")
    .select("id, name, slug")
    .or(`name.ilike."${name}",slug.eq."${slug}"`)
    .maybeSingle();

  if (existing) {
    if (existing.slug === slug) {
      return err({ message: `A tag with slug '${slug}' already exists.`, field: "slug" });
    }
    return err({ message: `A tag with name '${name}' already exists.`, field: "name" });
  }

  const { data: createdRow, error: insertErr } = await adminClient
    .from("tags")
    .insert({
      name: name!,
      slug: slug!,
    })
    .select("*")
    .single();

  if (insertErr || !createdRow) {
    console.error("[createAdminTagServer] Database insert error:", insertErr);
    return err({ message: insertErr?.message || "Failed to create tag." });
  }

  await recordAuditLog({
    action: "taxonomy.tag_create",
    entityType: "tag",
    entityId: createdRow.id,
    after: { name: createdRow.name, slug: createdRow.slug },
    actorId: actor?.id,
    actorEmail: actor?.email,
  });

  try {
    revalidateTag("tags");
    revalidateTag("taxonomy");
  } catch {}

  return ok(mapRowToAdminTag(createdRow, 0));
}

/**
 * Updates a tag. Propagates name changes across titles.tags array.
 */
export async function updateAdminTagServer(
  id: string,
  input: UpdateTagInput,
  actor?: { id?: string; email?: string }
): Promise<Result<AdminTag, { message: string; field?: string }>> {
  if (!id) return err({ message: "Tag ID is required." });

  const validation = validateTagPayload(input, "update");
  if (!validation.ok || !validation.value) {
    const firstErr = validation.errors[0];
    return err({ message: firstErr?.message || "Validation failed", field: firstErr?.field });
  }

  const adminClient = getContentAdminClient();

  const { data: existing, error: fetchErr } = await adminClient
    .from("tags")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return err({ message: "Tag not found." });
  }

  const updates = validation.value;

  if (updates.name && updates.name.toLowerCase() !== existing.name.toLowerCase()) {
    const { data: nameMatch } = await adminClient
      .from("tags")
      .select("id")
      .ilike("name", updates.name)
      .neq("id", id)
      .maybeSingle();

    if (nameMatch) {
      return err({ message: `A tag with name '${updates.name}' already exists.`, field: "name" });
    }
  }

  if (updates.slug && updates.slug !== existing.slug) {
    const { data: slugMatch } = await adminClient
      .from("tags")
      .select("id")
      .eq("slug", updates.slug)
      .neq("id", id)
      .maybeSingle();

    if (slugMatch) {
      return err({ message: `A tag with slug '${updates.slug}' already exists.`, field: "slug" });
    }
  }

  const rowUpdates: Partial<Database["public"]["Tables"]["tags"]["Update"]> = {};
  if (updates.name !== undefined) rowUpdates.name = updates.name;
  if (updates.slug !== undefined) rowUpdates.slug = updates.slug;

  const { data: updatedRow, error: updateErr } = await adminClient
    .from("tags")
    .update(rowUpdates)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedRow) {
    console.error("[updateAdminTagServer] Database update error:", updateErr);
    return err({ message: updateErr?.message || "Failed to update tag." });
  }

  // Renaming propagation across titles.tags text[] array
  let affectedTitles = 0;
  if (updates.name && updates.name !== existing.name) {
    try {
      const { data: titlesWithTag } = await adminClient
        .from("titles")
        .select("id, tags")
        .contains("tags", [existing.name]);

      if (titlesWithTag && titlesWithTag.length > 0) {
        for (const t of titlesWithTag) {
          const currentTags: string[] = Array.isArray(t.tags) ? t.tags : [];
          const newTags = Array.from(
            new Set(currentTags.map((tag) => (tag === existing.name ? updatedRow.name : tag)))
          );
          await adminClient
            .from("titles")
            .update({ tags: newTags })
            .eq("id", t.id);
          affectedTitles++;
        }
      }
    } catch (err) {
      console.warn("[updateAdminTagServer] Could not propagate tag rename to titles:", err);
    }
  }

  await recordAuditLog({
    action: "taxonomy.tag_update",
    entityType: "tag",
    entityId: id,
    before: { name: existing.name, slug: existing.slug },
    after: { name: updatedRow.name, slug: updatedRow.slug },
    actorId: actor?.id,
    actorEmail: actor?.email,
  });

  try {
    revalidateTag("tags");
    revalidateTag("taxonomy");
    revalidateTag("titles");
  } catch {}

  return ok(mapRowToAdminTag(updatedRow, affectedTitles));
}

/**
 * Merges sourceTag into targetTag.
 * Replaces sourceTag with targetTag across all titles.tags arrays, then deletes sourceTag.
 */
export async function mergeTagsServer(
  input: MergeTagsInput,
  actor?: { id?: string; email?: string }
): Promise<Result<{ mergedInto: AdminTag; affectedTitlesCount: number }, { message: string; field?: string }>> {
  const validation = validateMergeTagsPayload(input);
  if (!validation.ok || !validation.value) {
    const firstErr = validation.errors[0];
    return err({ message: firstErr?.message || "Validation failed", field: firstErr?.field });
  }

  const { sourceTagId, targetTagId } = validation.value;
  const adminClient = getContentAdminClient();

  const [sourceRes, targetRes] = await Promise.all([
    adminClient.from("tags").select("*").eq("id", sourceTagId).maybeSingle(),
    adminClient.from("tags").select("*").eq("id", targetTagId).maybeSingle(),
  ]);

  if (!sourceRes.data) return err({ message: "Source tag not found.", field: "sourceTagId" });
  if (!targetRes.data) return err({ message: "Target tag not found.", field: "targetTagId" });

  const sourceTag = sourceRes.data;
  const targetTag = targetRes.data;

  // Find all titles with source tag
  let affectedTitlesCount = 0;
  try {
    const { data: titlesWithSource } = await adminClient
      .from("titles")
      .select("id, tags")
      .contains("tags", [sourceTag.name]);

    if (titlesWithSource && titlesWithSource.length > 0) {
      for (const t of titlesWithSource) {
        const currentTags: string[] = Array.isArray(t.tags) ? t.tags : [];
        // Replace sourceTag with targetTag and deduplicate
        const updatedTags = Array.from(
          new Set(
            currentTags.map((tag) => (tag === sourceTag.name ? targetTag.name : tag))
          )
        );
        await adminClient
          .from("titles")
          .update({ tags: updatedTags })
          .eq("id", t.id);
        affectedTitlesCount++;
      }
    }
  } catch (catchErr) {
    console.error("[mergeTagsServer] Error replacing tags on titles:", catchErr);
    return err({ message: "Failed to update titles with merged tag." });
  }

  // Delete source tag
  const { error: deleteErr } = await adminClient
    .from("tags")
    .delete()
    .eq("id", sourceTagId);

  if (deleteErr) {
    console.error("[mergeTagsServer] Error deleting source tag:", deleteErr);
    return err({ message: "Failed to delete source tag during merge." });
  }

  await recordAuditLog({
    action: "taxonomy.tag_merge",
    entityType: "tag",
    entityId: targetTagId,
    before: { sourceTagId, sourceTagName: sourceTag.name },
    after: { targetTagId, targetTagName: targetTag.name, affectedTitlesCount },
    actorId: actor?.id,
    actorEmail: actor?.email,
  });

  try {
    revalidateTag("tags");
    revalidateTag("taxonomy");
    revalidateTag("titles");
  } catch {}

  // Recalculate target drama count
  let targetDramaCount = 0;
  try {
    const { data: countRes } = await adminClient
      .from("titles")
      .select("id")
      .contains("tags", [targetTag.name]);
    targetDramaCount = countRes?.length || 0;
  } catch {}

  return ok({
    mergedInto: mapRowToAdminTag(targetTag, targetDramaCount),
    affectedTitlesCount,
  });
}

/**
 * Deletes a tag. Optionally removes it from titles.tags.
 */
export async function deleteAdminTagServer(
  id: string,
  actor?: { id?: string; email?: string },
  options?: { removeFromTitles?: boolean }
): Promise<Result<{ success: boolean }, { message: string }>> {
  if (!id) return err({ message: "Tag ID is required." });

  const adminClient = getContentAdminClient();

  const { data: existing, error: fetchErr } = await adminClient
    .from("tags")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return err({ message: "Tag not found." });
  }

  if (options?.removeFromTitles) {
    try {
      const { data: titlesWithTag } = await adminClient
        .from("titles")
        .select("id, tags")
        .contains("tags", [existing.name]);

      if (titlesWithTag) {
        for (const t of titlesWithTag) {
          const currentTags: string[] = Array.isArray(t.tags) ? t.tags : [];
          const newTags = currentTags.filter((tag) => tag !== existing.name);
          await adminClient
            .from("titles")
            .update({ tags: newTags })
            .eq("id", t.id);
        }
      }
    } catch (err) {
      console.warn("[deleteAdminTagServer] Could not scrub tag from titles:", err);
    }
  }

  const { error: deleteErr } = await adminClient
    .from("tags")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    console.error("[deleteAdminTagServer] Delete error:", deleteErr);
    return err({ message: deleteErr.message || "Failed to delete tag." });
  }

  await recordAuditLog({
    action: "taxonomy.tag_delete",
    entityType: "tag",
    entityId: id,
    before: { name: existing.name, slug: existing.slug },
    actorId: actor?.id,
    actorEmail: actor?.email,
  });

  try {
    revalidateTag("tags");
    revalidateTag("taxonomy");
    revalidateTag("titles");
  } catch {}

  return ok({ success: true });
}
