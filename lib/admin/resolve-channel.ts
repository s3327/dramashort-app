import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase-content";
import { escapeLikePattern } from "@/lib/validation/drama";

export interface ResolvedChannel {
  id: string;
  name: string;
  code: string;
}

/**
 * Looks up a channel by name (case-insensitive, wildcards escaped) in the
 * Content DB. Returns null when no channel matches or the lookup fails; callers
 * keep the admin-supplied display name in that case.
 */
export async function resolveChannelByName(
  client: SupabaseClient<Database>,
  name: string
): Promise<ResolvedChannel | null> {
  const { data, error } = await client
    .from("channels")
    .select("id, name, code")
    .ilike("name", escapeLikePattern(name))
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[resolveChannelByName] channel lookup failed:", error.message);
    return null;
  }
  return data;
}
