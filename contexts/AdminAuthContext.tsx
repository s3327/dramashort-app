"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createUserClient } from "@/lib/supabase/user-client";
import { getUserProfile, type ProfileRow } from "@/lib/services/user.service";
import { getUserRole } from "@/lib/auth/roles";

export type AdminAuthContextValue = {
  user: User | null;
  profile: ProfileRow | null;
  session: Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email?: string, password?: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshAdminStatus: () => Promise<boolean>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createUserClient());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const verifyAdminRole = useCallback(
    async (authUser: User | null): Promise<boolean> => {
      if (!authUser) {
        setUser(null);
        setProfile(null);
        setIsLoggedIn(false);
        return false;
      }

      // Authoritative role check: ONLY app_metadata.role is trusted (prevents client self-elevation)
      const role = getUserRole(authUser);
      if (role === "admin") {
        setUser(authUser);
        setIsLoggedIn(true);
        // fetch profile in background for display purposes
        getUserProfile(authUser.id).then((p) => setProfile(p));
        return true;
      }

      // Not an admin
      setUser(null);
      setProfile(null);
      setIsLoggedIn(false);
      return false;
    },
    []
  );

  // Initialize and subscribe to auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      await verifyAdminRole(session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      await verifyAdminRole(newSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, verifyAdminRole]);

  const login = async (email?: string, password?: string) => {
    if (!email || !password) {
      return { error: "Please enter both admin email and password." };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      if (!data.user) {
        return { error: "Authentication failed. No user record returned." };
      }

      // Verify administrator role in profiles table
      const isAdmin = await verifyAdminRole(data.user);
      if (!isAdmin) {
        // Sign out immediately to prevent unauthorized session usage
        await supabase.auth.signOut();
        return {
          error:
            "Access denied. This account does not have administrator privileges.",
        };
      }

      setSession(data.session);
      return { error: null };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred.";
      return { error: message };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error signing out from admin:", err);
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoggedIn(false);
    }
  };

  const refreshAdminStatus = async (): Promise<boolean> => {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();
    return verifyAdminRole(currentUser);
  };

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoggedIn,
        isLoading,
        login,
        logout,
        refreshAdminStatus,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  return ctx;
}
