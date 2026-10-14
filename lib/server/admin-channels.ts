import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { getContentAdminClient } from "@/lib/supabase/content";
import type { Database } from "@/types/supabase";
import type { AdminChannel, CreateChannelInput, UpdateChannelInput } from "@/types/content";
import { validateChannelPayload } from "@/lib/validation/channel";
import { recordAuditLog } from "@/lib/server/audit";
import { type Result, ok, err } from "@/lib/common/result";

type ChannelRow = Database["public"]["Tables"]["channels"]["Row"];

function mapRowToAdminChannel(row: ChannelRow, dramaCount = 0): AdminChannel {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code,
    description: row.description || null,
    avatarUrl: row.avatar_url || null,
    bannerUrl: row.banner_url || null,
    createdAt: row.created_at || null,
    updatedAt: (row as any).updated_at || null,
    dramaCount,
  };
}

/**
 * Fetches all channels from the database with live aggregated drama counts.
 */
export async function getAdminChannelsServer(): Promise<AdminChannel[]> {
  const adminClient = getContentAdminClient();

  const { data: channelRows, error: channelErr } = await adminClient
    .from("channels")
    .select("*")
    .order("name", { ascending: true });

  if (channelErr || !channelRows) {
    console.error("[getAdminChannelsServer] Error fetching channels:", channelErr);
    return [];
  }

  // Count titles by channel_id and channel_name
  const countsByChannelId = new Map<string, number>();
  const countsByChannelName = new Map<string, number>();

  try {
    const { data: titleRows } = await adminClient
      .from("titles")
      .select("id, channel_id, channel_name");

    if (titleRows) {
      for (const t of titleRows) {
        if (t.channel_id) {
          countsByChannelId.set(
            t.channel_id,
            (countsByChannelId.get(t.channel_id) || 0) + 1
          );
        }
        if (t.channel_name) {
          const norm = t.channel_name.trim().toLowerCase();
          countsByChannelName.set(
            norm,
            (countsByChannelName.get(norm) || 0) + 1
          );
        }
      }
    }
  } catch (err) {
    console.warn("[getAdminChannelsServer] Warning fetching drama counts:", err);
  }

  return (channelRows as ChannelRow[]).map((row: ChannelRow) => {
    const idCount = countsByChannelId.get(row.id) || 0;
    const nameCount = countsByChannelName.get(row.name.trim().toLowerCase()) || 0;
    const count = Math.max(idCount, nameCount);
    return mapRowToAdminChannel(row, count);
  });
}

/**
 * Fetches a single channel by ID or slug with live drama count.
 */
export async function getAdminChannelByIdServer(idOrSlug: string): Promise<AdminChannel | null> {
  if (!idOrSlug) return null;
  const adminClient = getContentAdminClient();

  // Try by id first, then by slug
  let row: ChannelRow | null = null;
  const { data: byId } = await adminClient
    .from("channels")
    .select("*")
    .eq("id", idOrSlug)
    .maybeSingle();

  if (byId) {
    row = byId;
  } else {
    const { data: bySlug } = await adminClient
      .from("channels")
      .select("*")
      .eq("slug", idOrSlug.toLowerCase())
      .maybeSingle();
    row = bySlug;
  }

  if (!row) return null;

  // Compute drama count
  let dramaCount = 0;
  try {
    const { count } = await adminClient
      .from("titles")
      .select("id", { count: "exact", head: true })
      .or(`channel_id.eq.${row.id},channel_name.eq."${row.name}"`);
    dramaCount = count || 0;
  } catch {
    // fallback count query
    const { data: titles } = await adminClient
      .from("titles")
      .select("id, channel_id, channel_name");
    if (titles) {
      dramaCount = (titles as any[]).filter(
        (t: any) => t.channel_id === row!.id || t.channel_name === row!.name
      ).length;
    }
  }

  return mapRowToAdminChannel(row, dramaCount);
}

/**
 * Creates a new channel with uniqueness enforcement and cache invalidation.
 */
export async function createAdminChannelServer(
  input: CreateChannelInput,
  adminEmail?: string
): Promise<Result<AdminChannel, { field: string; message: string }[]>> {
  const validation = validateChannelPayload(input, "create");
  if (!validation.ok) {
    return err(validation.errors);
  }

  const { name, slug, code, description, avatarUrl, bannerUrl } = validation.value;
  const adminClient = getContentAdminClient();

  // Check unique slug
  const { data: existingSlug } = await adminClient
    .from("channels")
    .select("id")
    .eq("slug", slug!)
    .maybeSingle();

  if (existingSlug) {
    return err([
      { field: "slug", message: `A channel with slug '${slug}' already exists.` },
    ]);
  }

  // Check unique code
  const { data: existingCode } = await adminClient
    .from("channels")
    .select("id")
    .eq("code", code!)
    .maybeSingle();

  if (existingCode) {
    return err([
      { field: "code", message: `A channel with code '${code}' already exists.` },
    ]);
  }

  const insertPayload = {
    name: name!,
    slug: slug!,
    code: code!,
    description: description || null,
    avatar_url: avatarUrl || null,
    banner_url: bannerUrl || null,
  };

  const { data: createdRow, error: insertErr } = await adminClient
    .from("channels")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insertErr || !createdRow) {
    console.error("[createAdminChannelServer] Database error inserting channel:", insertErr);
    return err([
      { field: "database", message: insertErr?.message || "Failed to create channel." },
    ]);
  }

  // Audit logging
  await recordAuditLog({
    action: "channel.create",
    entityType: "channel",
    entityId: createdRow.id,
    after: {
      name: createdRow.name,
      slug: createdRow.slug,
      code: createdRow.code,
    },
    actorEmail: adminEmail,
  });

  // Invalidate caches
  try {
    revalidateTag("channels");
    revalidatePath("/");
    revalidatePath("/browse");
  } catch (err) {
    console.warn("[createAdminChannelServer] Cache revalidation warning:", err);
  }

  return ok(mapRowToAdminChannel(createdRow, 0));
}

/**
 * Updates an existing channel with uniqueness checks and cascade synchronization.
 */
export async function updateAdminChannelServer(
  id: string,
  input: UpdateChannelInput,
  adminEmail?: string
): Promise<Result<AdminChannel, { field: string; message: string }[]>> {
  if (!id) {
    return err([{ field: "id", message: "Channel ID is required." }]);
  }

  const adminClient = getContentAdminClient();

  // 1. Fetch existing channel
  const { data: existing, error: fetchErr } = await adminClient
    .from("channels")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !existing) {
    return err([{ field: "id", message: "Channel not found." }]);
  }

  // 2. Validate payload
  const validation = validateChannelPayload(input, "update");
  if (!validation.ok) {
    return err(validation.errors);
  }

  const updates = validation.value;

  // 3. Check slug uniqueness if changed
  if (updates.slug && updates.slug !== existing.slug) {
    const { data: conflict } = await adminClient
      .from("channels")
      .select("id")
      .eq("slug", updates.slug)
      .neq("id", id)
      .maybeSingle();

    if (conflict) {
      return err([
        { field: "slug", message: `A channel with slug '${updates.slug}' already exists.` },
      ]);
    }
  }

  // 4. Check code uniqueness if changed
  if (updates.code && updates.code !== existing.code) {
    const { data: conflict } = await adminClient
      .from("channels")
      .select("id")
      .eq("code", updates.code)
      .neq("id", id)
      .maybeSingle();

    if (conflict) {
      return err([
        { field: "code", message: `A channel with code '${updates.code}' already exists.` },
      ]);
    }
  }

  // 5. Construct update object
  const updatePayload: Record<string, any> = {};
  if (updates.name !== undefined) updatePayload.name = updates.name;
  if (updates.slug !== undefined) updatePayload.slug = updates.slug;
  if (updates.code !== undefined) updatePayload.code = updates.code;
  if (updates.description !== undefined) updatePayload.description = updates.description;
  if (updates.avatarUrl !== undefined) updatePayload.avatar_url = updates.avatarUrl;
  if (updates.bannerUrl !== undefined) updatePayload.banner_url = updates.bannerUrl;

  const { data: updatedRow, error: updateErr } = await adminClient
    .from("channels")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (updateErr || !updatedRow) {
    console.error("[updateAdminChannelServer] Database error updating channel:", updateErr);
    return err([
      { field: "database", message: updateErr?.message || "Failed to update channel." },
    ]);
  }

  // In test environments or when Postgres triggers don't run in-memory, sync titles
  if (updates.name || updates.code) {
    try {
      const titleUpdates: Record<string, any> = {};
      if (updates.name) titleUpdates.channel_name = updates.name;
      if (updates.code) titleUpdates.channel_code = updates.code;
      await adminClient.from("titles").update(titleUpdates).eq("channel_id", id);
    } catch (err) {
      console.warn("[updateAdminChannelServer] Secondary titles sync warning:", err);
    }
  }

  // 6. Audit logging
  await recordAuditLog({
    action: "channel.update",
    entityType: "channel",
    entityId: id,
    before: { name: existing.name, slug: existing.slug, code: existing.code },
    after: updatePayload,
    actorEmail: adminEmail,
  });

  // 7. Invalidate caches
  try {
    revalidateTag("channels");
    revalidateTag(`channel-${existing.slug}`);
    revalidateTag(`channel-${updatedRow.slug}`);
    revalidatePath(`/channel/${existing.slug}`);
    revalidatePath(`/channel/${updatedRow.slug}`);
    revalidatePath("/");
    revalidatePath("/browse");
  } catch (err) {
    console.warn("[updateAdminChannelServer] Cache revalidation warning:", err);
  }

  // Compute drama count
  let dramaCount = 0;
  try {
    const { data: titles } = await adminClient
      .from("titles")
      .select("id")
      .eq("channel_id", id);
    dramaCount = titles?.length || 0;
  } catch {}

  return ok(mapRowToAdminChannel(updatedRow, dramaCount));
}

/**
 * Safely deletes a channel. Prevents deletion if any active dramas belong to this channel.
 */
export async function deleteAdminChannelServer(
  id: string,
  adminEmail?: string
): Promise<Result<{ success: boolean }, { message: string; count?: number }>> {
  if (!id) {
    return err({ message: "Channel ID is required." });
  }

  const adminClient = getContentAdminClient();

  // 1. Fetch channel
  const { data: channel, error: fetchErr } = await adminClient
    .from("channels")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !channel) {
    return err({ message: "Channel not found." });
  }

  // 2. Check for assigned dramas (safeguard)
  const { data: titles, error: titleErr } = await adminClient
    .from("titles")
    .select("id, title")
    .or(`channel_id.eq.${id},channel_name.eq."${channel.name}"`);

  const dramaCount = titles?.length || 0;
  if (dramaCount > 0) {
    return err({
      message: `Cannot delete channel '${channel.name}'. It is currently assigned to ${dramaCount} drama${
        dramaCount === 1 ? "" : "s"
      }. Please reassign or delete these dramas before removing the channel.`,
      count: dramaCount,
    });
  }

  // 3. Perform deletion
  const { error: deleteErr } = await adminClient
    .from("channels")
    .delete()
    .eq("id", id);

  if (deleteErr) {
    console.error("[deleteAdminChannelServer] Database error deleting channel:", deleteErr);
    return err({ message: deleteErr.message || "Failed to delete channel." });
  }

  // 4. Audit logging
  await recordAuditLog({
    action: "channel.delete",
    entityType: "channel",
    entityId: id,
    before: {
      name: channel.name,
      slug: channel.slug,
      code: channel.code,
    },
    actorEmail: adminEmail,
  });

  // 5. Invalidate caches
  try {
    revalidateTag("channels");
    revalidateTag(`channel-${channel.slug}`);
    revalidatePath(`/channel/${channel.slug}`);
    revalidatePath("/");
    revalidatePath("/browse");
  } catch (err) {
    console.warn("[deleteAdminChannelServer] Cache revalidation warning:", err);
  }

  return ok({ success: true });
}
