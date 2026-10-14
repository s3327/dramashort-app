/**
 * Which Supabase project a maintenance script is about to change.
 *
 * Scripts read `.env.local`, which points at the hosted project once the app runs on it
 * (ADR-0005). Only a local stack started with `supabase start` counts as local; every
 * hosted project is treated as production.
 */
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
