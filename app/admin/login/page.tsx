"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { getSafeAdminRedirect } from "@/lib/navigation/safe-redirect";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = getSafeAdminRedirect(searchParams.get("returnUrl"));
  const urlError = searchParams.get("error");

  const { login, isLoggedIn, isLoading } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(() => {
    if (urlError === "unauthorized") {
      return "Access denied. Your account does not have administrator privileges.";
    }
    if (urlError === "session_required") {
      return "Please sign in with your staff account to access the admin portal.";
    }
    return null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated as admin, proceed to dashboard
  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      router.replace(returnUrl);
    }
  }, [isLoading, isLoggedIn, router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await login(email, password);
    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
    } else {
      router.replace(returnUrl);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-2.5 justify-center mb-8">
        <Image src={icon} alt="DramaShort" className="h-8 w-8" priority />
        <span className="font-display font-bold text-lg">
          <b className="text-primary">Drama</b>Short
          <span className="ml-1.5 text-xs font-semibold text-text-muted align-middle">
            Admin
          </span>
        </span>
      </div>

      <div className="bg-surface border border-border rounded-xl shadow-lg p-8">
        <h1 className="font-display font-bold text-xl mb-1">Admin sign in</h1>
        <p className="text-sm text-text-muted mb-6">
          Restricted access — staff and administrators only.
        </p>

        {error && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft p-3 text-xs text-danger font-medium">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@dramashort.com"
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div
      data-theme="light"
      className="min-h-screen bg-bg text-text flex items-center justify-center px-6"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }
      >
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
