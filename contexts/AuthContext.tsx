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
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<boolean>;
  changePassword: (
    newPassword: string,
    currentPassword?: string
  ) => Promise<{ error: string | null }>;
  requestEmailChange: (newEmail: string) => Promise<{ error: string | null }>;
  verifyEmailChange: (
    newEmail: string,
    token: string
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
    } catch (err: any) {
      return { error: err?.message || "An unexpected error occurred during login." };
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: displayName || splitEmail(email),
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || "An unexpected error occurred during signup." };
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

  const updateDisplayName = async (displayName: string): Promise<boolean> => {
    if (!user) return false;
    const success = await updateUserProfile(user.id, { display_name: displayName });
    if (success) {
      setProfile((prev) => (prev ? { ...prev, display_name: displayName } : null));
    }
    return success;
  };

  const changePassword = async (
    newPassword: string,
    currentPassword?: string
  ): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: "You must be signed in to change your password." };
    }

    try {
      // 1. Verify current password if provided and user has email
      if (currentPassword && user.email) {
        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

        if (verifyError) {
          return { error: "Current password is incorrect." };
        }
      }

      // 2. Update to new password via Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { error: updateError.message };
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
        logout,
        updateDisplayName,
        changePassword,
        requestEmailChange,
        verifyEmailChange,
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
