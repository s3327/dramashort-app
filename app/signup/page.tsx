"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import GoogleIcon from "@/components/GoogleIcon";
import { useAuth } from "@/contexts/AuthContext";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setPasswordError("");
    setIsSubmitting(true);

    const res = await signUp(email, password);
    if (res.error) {
      setPasswordError(res.error);
      setIsSubmitting(false);
      return;
    }

    const redirect =
      searchParams.get("returnUrl") || searchParams.get("redirect");
    const params = new URLSearchParams({ email });
    if (redirect) params.set("redirect", redirect);
    router.push(`/verify-email?${params.toString()}`);
  };

  const handleGoogleSignIn = async () => {
    setGeneralError("");
    setIsGoogleSubmitting(true);
    const returnPath =
      searchParams.get("returnUrl") || searchParams.get("redirect") || "/home";
    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;

    const res = await signInWithGoogle(redirectUrl);
    if (res.error) {
      setGeneralError(res.error);
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative overflow-hidden flex-1 flex flex-col">
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
          <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-md p-8">
            <h1 className="font-display font-bold text-2xl mb-1">Create your account</h1>
            <p className="text-sm text-text-muted mb-6">
              Join DramaShort to save favorites and pick up where you left off.
            </p>

            {generalError && (
              <div className="mb-4 rounded-md bg-danger/10 border border-danger/30 px-3.5 py-2.5 text-xs text-danger">
                {generalError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm font-semibold mb-1.5">
                  Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Jamie Doe"
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text transition-colors"
                  >
                    {showPassword ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                  </button>
                </div>
                {passwordError && (
                  <p className="mt-1.5 text-xs font-semibold text-danger">{passwordError}</p>
                )}
              </div>

              <label className="flex items-start gap-2.5 pt-1">
                <input
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-xs text-text-muted leading-relaxed">
                  I agree to the{" "}
                  <Link href="/privacy-policy" className="font-semibold text-link hover:text-link-hover transition-colors">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/terms" className="font-semibold text-link hover:text-link-hover transition-colors">
                    Terms of Service
                  </Link>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting || isGoogleSubmitting}
                className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors"
              >
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-text-muted whitespace-nowrap">
                or sign up with
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full flex items-center justify-center gap-2.5 rounded-full border border-border bg-bg hover:bg-surface disabled:opacity-50 text-text font-semibold text-sm py-3 transition-colors"
            >
              {isGoogleSubmitting ? (
                <>
                  <Loader2 size={17} className="animate-spin text-text-muted" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            <p className="mt-6 text-center text-xs text-text-muted">
              Already have an account?{" "}
              <Link
                href={`/login${searchParams.get("redirect") ? `?redirect=${encodeURIComponent(searchParams.get("redirect")!)}` : ""}`}
                className="font-semibold text-link hover:text-link-hover transition-colors"
              >
                Log in
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
