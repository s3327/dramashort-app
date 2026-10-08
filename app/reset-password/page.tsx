"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import { useAuth } from "@/contexts/AuthContext";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";

function ResetPasswordForm() {
  const router = useRouter();
  const { user, session, isLoading, updatePassword } = useAuth();
  const { message: toastMessage, show: showToast } = useToast(3000);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    const res = await updatePassword(password);
    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setIsSuccess(true);
    showToast("Password updated successfully! Other sessions signed out.");

    // Redirect to / after brief confirmation
    setTimeout(() => {
      router.push("/");
    }, 1500);
  };

  return (
    <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-md p-8">
      <Toast
        message={toastMessage}
        icon={<CheckCircle2 size={16} className="text-emerald-400" />}
      />

      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text transition-colors mb-5"
      >
        <ArrowLeft size={14} strokeWidth={2.5} />
        Back to login
      </Link>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-xs text-text-muted">Checking reset session...</p>
        </div>
      ) : !user && !session ? (
        <div className="text-center py-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
            <AlertCircle size={24} />
          </div>
          <h1 className="font-display font-bold text-xl mb-2">
            Reset session expired
          </h1>
          <p className="text-xs text-text-muted mb-6 leading-relaxed">
            Your password reset session has expired or is invalid. Please
            request a new reset code to choose a new password.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors"
          >
            Request New Reset Code
          </Link>
        </div>
      ) : isSuccess ? (
        <div className="text-center py-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <CheckCircle2 size={24} />
          </div>
          <h1 className="font-display font-bold text-xl mb-2">
            Password Updated
          </h1>
          <p className="text-xs text-text-muted mb-6 leading-relaxed">
            Your password has been changed successfully and other active sessions
            have been invalidated. Redirecting to home...
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors"
          >
            Continue to Home
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={18} className="text-primary" />
            <h1 className="font-display font-bold text-2xl">
              Set new password
            </h1>
          </div>
          <p className="text-sm text-text-muted mb-6">
            Enter a new password with at least 8 characters.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold mb-1.5"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="At least 8 characters"
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-semibold mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder="Repeat your new password"
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !password || !confirmPassword}
              className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div data-theme="dark" className="min-h-screen flex flex-col bg-bg text-text">
      <div className="relative overflow-hidden flex-1 flex flex-col">
        {/* Ambient glow matching auth branding */}
        <div
          className="pointer-events-none fixed -top-[20%] -inset-x-[10%] h-[70%] z-0"
          style={{
            background:
              "radial-gradient(60% 60% at 30% 20%, rgb(var(--primary) / 0.28), transparent 70%), radial-gradient(50% 50% at 80% 10%, rgb(var(--tertiary) / 0.14), transparent 70%)",
          }}
        />

        <nav className="relative z-10 max-w-[1100px] w-full mx-auto px-6 pt-7">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src={icon} alt="DramaShort" className="h-8 w-8" priority />
            <span className="font-display font-bold text-lg">
              <b className="text-primary">Drama</b>Short
            </span>
          </Link>
        </nav>

        <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
          <Suspense
            fallback={
              <div className="w-full max-w-sm bg-surface border border-border rounded-lg p-8 flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
