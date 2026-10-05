"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/user-client";
import {
  getUserProfile,
  updateUserProfile,
  syncGuestWatchHistory,
  type ProfileRow,
} from "@/lib/services/user.service";

type AuthContextValue = {
  user: User | null;
  profile: ProfileRow | null;
  session: Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email?: string, password?: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{
    error: string | null;
    needsEmailVerification: boolean;
    session: Session | null;
  }>;
  verifySignupOtp: (
    email: string,
    token: string
  ) => Promise<{ error: string | null }>;
  resendSignupOtp: (
    email: string
  ) => Promise<{ error: string | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  verifyPasswordRecoveryOtp: (
    email: string,
    token: string
  ) => Promise<{ error: string | null }>;
  updatePassword: (
    newPassword: string
  ) => Promise<{ error: string | null }>;
  deleteAccount: (
    confirmationText: string,
    password?: string
  ) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<boolean>;
  changePassword: (
    newPassword: string,
    currentPassword?: string,
    nonce?: string
  ) => Promise<{ error: string | null; needsReauthentication?: boolean }>;
  reauthenticate: () => Promise<{ error: string | null }>;
  hasPasswordIdentity: boolean;
  requestEmailChange: (newEmail: string) => Promise<{ error: string | null }>;
  verifyEmailChange: (
    newEmail: string,
    token: string
  ) => Promise<{ error: string | null }>;
  signInWithGoogle: (
    customRedirect?: string
  ) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createUserClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const prof = await getUserProfile(userId);
    setProfile(prof);
  };

  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        syncGuestWatchHistory(session.user.id);
      }
      setIsLoading(false);
    });

    // 2. Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
        syncGuestWatchHistory(session.user.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const login = async (email?: string, password?: string) => {
    if (!email || !password) {
      // Demo fallback if called without params
      return { error: "Please enter both email and password." };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      setUser(data.user);
      setSession(data.session);
      if (data.user) {
        await fetchProfile(data.user.id);
      }
      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred during login.";
      return { error: message };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName?: string
  ): Promise<{
    error: string | null;
    needsEmailVerification: boolean;
    session: Session | null;
  }> => {
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/confirm`
          : undefined;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName || splitEmail(email),
          },
          emailRedirectTo,
        },
      });

      if (error) {
        return { error: error.message, needsEmailVerification: false, session: null };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        if (data.session.user) {
          await fetchProfile(data.session.user.id);
          syncGuestWatchHistory(data.session.user.id);
        }
        return { error: null, needsEmailVerification: false, session: data.session };
      }

      // If user was created but session is null, email confirmation is required
      return {
        error: null,
        needsEmailVerification: true,
        session: null,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred during signup.";
      return { error: message, needsEmailVerification: false, session: null };
    }
  };

  const verifySignupOtp = async (
    email: string,
    token: string
  ): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim();
      const trimmedToken = token.trim();

      let result = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: "signup",
      });

      if (
        result.error &&
        (result.error.message.toLowerCase().includes("type") ||
          result.error.status === 400)
      ) {
        result = await supabase.auth.verifyOtp({
          email: trimmedEmail,
          token: trimmedToken,
          type: "email",
        });
      }

      if (result.error) {
        return { error: result.error.message };
      }

      if (result.data.session) {
        setSession(result.data.session);
        setUser(result.data.session.user);
        if (result.data.session.user) {
          await fetchProfile(result.data.session.user.id);
          syncGuestWatchHistory(result.data.session.user.id);
        }
      } else if (result.data.user) {
        setUser(result.data.user);
        await fetchProfile(result.data.user.id);
        syncGuestWatchHistory(result.data.user.id);
      }

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to verify confirmation code.";
      return { error: message };
    }
  };

  const resendSignupOtp = async (
    email: string
  ): Promise<{ error: string | null }> => {
    try {
      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/confirm`
          : undefined;

      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to resend confirmation code.";
      return { error: message };
    }
  };

  const resetPasswordForEmail = async (
    email: string
  ): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim();
      if (!trimmedEmail) {
        return { error: "Please enter your email address." };
      }

      const emailRedirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/confirm?type=recovery&next=/reset-password`
          : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: emailRedirectTo,
      });

      if (error) {
        const lower = error.message.toLowerCase();
        if (
          lower.includes("rate") ||
          lower.includes("frequency") ||
          error.status === 429
        ) {
          return { error: error.message };
        }
        // To prevent account enumeration per Task 11.2 specs, don't leak user absence
      }

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send reset code.";
      return { error: message };
    }
  };

  const verifyPasswordRecoveryOtp = async (
    email: string,
    token: string
  ): Promise<{ error: string | null }> => {
    try {
      const trimmedEmail = email.trim();
      const trimmedToken = token.trim();

      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token: trimmedToken,
        type: "recovery",
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        if (data.session.user) {
          await fetchProfile(data.session.user.id);
        }
      } else if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to verify reset code.";
      return { error: message };
    }
  };

  const updatePassword = async (
    newPassword: string
  ): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { error: error.message };
      }

      // Invalidate all other sessions for security (Task 11.2)
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch (signOutErr) {
        console.warn("Failed to sign out other sessions:", signOutErr);
      }

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update password.";
      return { error: message };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const deleteAccount = async (
    confirmationText: string,
    password?: string
  ): Promise<{ error: string | null }> => {
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmationText, password }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg =
          body?.error?.message ||
          body?.error ||
          "Failed to delete account. Please try again.";
        return { error: errorMsg };
      }

      // Cleanup local client state
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("dramashort_guest_watch_history");
          localStorage.removeItem("dramashort_theme");
        } catch {
          // ignore storage clearing errors
        }
      }

      try {
        await supabase.auth.signOut();
      } catch (signOutErr) {
        console.warn("Sign out after deletion warning:", signOutErr);
      }

      setUser(null);
      setSession(null);
      setProfile(null);

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      return { error: message };
    }
  };

  const updateDisplayName = async (displayName: string): Promise<boolean> => {
    if (!user) return false;
    const success = await updateUserProfile(user.id, { display_name: displayName });
    if (success) {
      setProfile((prev) => (prev ? { ...prev, display_name: displayName } : null));
    }
    return success;
  };

  const hasPasswordIdentity = Boolean(
    user?.identities?.some((id: { provider: string }) => id.provider === "email") ??
    user?.app_metadata?.providers?.includes("email")
  );

  const reauthenticate = async (): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.reauthenticate();
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send reauthentication code.";
      return { error: message };
    }
  };

  const changePassword = async (
    newPassword: string,
    currentPassword?: string,
    nonce?: string
  ): Promise<{ error: string | null; needsReauthentication?: boolean }> => {
    if (!user) {
      return { error: "You must be signed in to change your password." };
    }

    if (newPassword.length < 8) {
      return { error: "New password must be at least 8 characters long." };
    }

    try {
      const updatePayload: { password: string; current_password?: string; nonce?: string } = {
        password: newPassword,
      };

      if (currentPassword?.trim()) {
        updatePayload.current_password = currentPassword.trim();
      }

      if (nonce?.trim()) {
        updatePayload.nonce = nonce.trim();
      }

      const { error: updateError } = await supabase.auth.updateUser(updatePayload);

      if (updateError) {
        const errorMsg = updateError.message || "";
        const errorLower = errorMsg.toLowerCase();

        // Check if GoTrue requires reauthentication or nonce
        if (
          errorLower.includes("reauth") ||
          errorLower.includes("nonce") ||
          errorLower.includes("recent") ||
          updateError.status === 422 ||
          updateError.status === 403
        ) {
          return { error: errorMsg, needsReauthentication: true };
        }

        return { error: errorMsg };
      }

      // Invalidate all other active sessions for this user (Task 11.5)
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch (signOutErr) {
        console.warn("Failed to sign out other sessions:", signOutErr);
      }

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update password.";
      return { error: message };
    }
  };

  const requestEmailChange = async (
    newEmail: string
  ): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: "You must be signed in to change your email." };
    }

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to initiate email change.";
      return { error: message };
    }
  };

  const verifyEmailChange = async (
    newEmail: string,
    token: string
  ): Promise<{ error: string | null }> => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: newEmail,
        token: token.trim(),
        type: "email_change",
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }
      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to verify email code.";
      return { error: message };
    }
  };

  const signInWithGoogle = async (
    customRedirect?: string
  ): Promise<{ error: string | null }> => {
    try {
      const redirectUrl =
        customRedirect || `${window.location.origin}/auth/callback?next=/home`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data?.url) {
        window.location.href = data.url;
      }

      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to initiate Google sign-in.";
      return { error: message };
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoggedIn: !!user,
        isLoading,
        login,
        signUp,
        verifySignupOtp,
        resendSignupOtp,
        resetPasswordForEmail,
        verifyPasswordRecoveryOtp,
        updatePassword,
        deleteAccount,
        logout,
        updateDisplayName,
        changePassword,
        reauthenticate,
        hasPasswordIdentity,
        requestEmailChange,
        verifyEmailChange,
        signInWithGoogle,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function splitEmail(email: string): string {
  return email.split("@")[0] || "User";
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
