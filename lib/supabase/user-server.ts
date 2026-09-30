import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase-user";

const userUrl =
  process.env.NEXT_PUBLIC_USER_SUPABASE_URL || "https://placeholder.supabase.co";
const userAnonKey =
  process.env.NEXT_PUBLIC_USER_SUPABASE_ANON_KEY || "placeholder-anon-key";

/**
 * Server-side Supabase client for the User Database (Project 2).
 * Reads and sets cookies for session management in Server Components and Route Handlers.
 */
export async function createUserServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(userUrl, userAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });
}
