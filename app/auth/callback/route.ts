import { NextResponse, type NextRequest } from "next/server";
import { createUserServerClient } from "@/lib/supabase/user-server";

/**
 * Route handler for Supabase OAuth callback (e.g. Google OAuth code exchange).
 * Exchanges the auth code for a user session and sets the appropriate cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") || "/home";

  // Prevent open redirect vulnerabilities
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/home";
  }

  if (code) {
    const supabase = await createUserServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      console.error("OAuth code exchange error:", error.message);
    }
  }

  // Redirect to login with error parameter if code exchange fails
  return NextResponse.redirect(`${origin}/login?error=oauth_error`);
}
