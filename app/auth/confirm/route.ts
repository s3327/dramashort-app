import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createUserServerClient } from "@/lib/supabase/user-server";
import { getSafeRedirect } from "@/lib/navigation/safe-redirect";

/**
 * Route handler for email-based verification links (Task 11.1).
 *
 * Verifies email confirmation, password recovery, or email change tokens
 * sent via Supabase Auth email templates (PKCE / SSR flow).
 *
 * Query parameters:
 * - token_hash: cryptographic hash of the verification token
 * - type: EmailOtpType ('email' | 'signup' | 'recovery' | 'email_change' | 'magiclink')
 * - next: sanitized post-verification destination (defaults to /home)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Sanitize redirect target to prevent open redirects (Task 10.5)
  const next = getSafeRedirect(searchParams.get("next"), "/home");

  if (token_hash && type) {
    try {
      const supabase = await createUserServerClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash,
        type,
      });

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
      }

      console.error("[auth/confirm] verifyOtp error:", error.message);
    } catch (err) {
      console.error("[auth/confirm] Unexpected verification failure:", err);
    }
  }

  // Redirect to login with error parameter if verification fails
  return NextResponse.redirect(`${origin}/login?error=verification_failed`);
}
