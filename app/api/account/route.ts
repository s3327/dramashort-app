import { type NextRequest } from "next/server";
import {
  createUserServerClient,
  createUserServiceRoleClient,
} from "@/lib/supabase/user-server";
import { apiError, apiSuccess } from "@/lib/api/responses";

interface DeleteAccountPayload {
  confirmationText?: string;
  password?: string;
}

/**
 * DELETE /api/account
 *
 * Permanently deletes the authenticated user's account and all associated
 * data via cascading foreign key relationships (Task 11.3).
 *
 * Requirements:
 * 1. User must be authenticated (`auth.getUser()`).
 * 2. User must supply `{ confirmationText: "DELETE" }`.
 * 3. Recent re-authentication requirement:
 *    - Valid password verification if password provided or identity has password and session > 5 min.
 *    - OAuth accounts must have signed in within the last 5 minutes.
 * 4. Executes service role `auth.admin.deleteUser(userId)`.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createUserServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiError(
        "UNAUTHORIZED",
        "Authentication required to delete account.",
        401
      );
    }

    let payload: DeleteAccountPayload = {};
    try {
      payload = await request.json();
    } catch {
      // Body empty or non-JSON
    }

    const { confirmationText, password } = payload;

    // 1. Mandatory confirmation string "DELETE"
    if (confirmationText !== "DELETE") {
      return apiError(
        "VALIDATION_ERROR",
        "Please type DELETE to confirm account deletion.",
        400
      );
    }

    // 2. Re-authentication check
    const lastSignIn = user.last_sign_in_at
      ? new Date(user.last_sign_in_at).getTime()
      : 0;
    const isRecentSignIn = Date.now() - lastSignIn < 5 * 60 * 1000; // 5 minutes

    const hasPassword =
      user.app_metadata?.provider === "email" ||
      user.identities?.some((id: { provider: string }) => id.provider === "email");

    if (password) {
      if (user.email) {
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: user.email,
          password,
        });
        if (verifyErr) {
          return apiError(
            "INVALID_CREDENTIALS",
            "Incorrect password provided.",
            400
          );
        }
      }
    } else if (!isRecentSignIn) {
      return apiError(
        "REAUTHENTICATION_REQUIRED",
        hasPassword
          ? "Please provide your current password to confirm account deletion."
          : "For security, please sign in again before deleting your account.",
        403
      );
    }

    // 3. Execution of account deletion via service role
    const serviceRoleClient = createUserServiceRoleClient();
    const { error: deleteError } =
      await serviceRoleClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error(
        "[api/account/delete] Failed to delete user:",
        deleteError.message
      );
      return apiError(
        "DELETION_FAILED",
        "Failed to delete account. Please try again or contact support.",
        500
      );
    }

    return apiSuccess({
      deleted: true,
      message: "Account and associated data successfully deleted.",
    });
  } catch (err: unknown) {
    console.error("[api/account/delete] Unexpected failure:", err);
    return apiError(
      "INTERNAL_ERROR",
      "An unexpected error occurred during account deletion.",
      500
    );
  }
}
