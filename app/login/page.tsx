"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Mail, Loader2 } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import GoogleIcon from "@/components/GoogleIcon";
import { useAuth } from "@/contexts/AuthContext";
import { readReturnUrl, returnUrlQuery } from "@/lib/navigation/safe-redirect";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const urlError = searchParams.get("error");
  const [errorMessage, setErrorMessage] = useState(() => {
    if (urlError === "oauth_error") {
      return "Unable to sign in with Google. Please try again or use your email and password.";
    }
    return "";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const res = await login(email, password);
    if (res.error) {
      setErrorMessage(res.error);
      setIsSubmitting(false);
      return;
    }

    router.push(readReturnUrl(searchParams));
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage("");
    setIsGoogleSubmitting(true);
    const returnPath = readReturnUrl(searchParams);
    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnPath)}`;

    const res = await signInWithGoogle(redirectUrl);
    if (res.error) {
      setErrorMessage(res.error);
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative overflow-hidden flex-1 flex flex-col">
        {/* Ambient glow, matching the landing gate */}
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
            <h1 className="font-display font-bold text-2xl mb-1">Welcome back</h1>
            <p className="text-sm text-text-muted mb-6">
              Log in to pick up right where you left off.
            </p>

            {errorMessage && (
              <div className="mb-4 rounded-md bg-danger/10 border border-danger/30 px-3.5 py-2.5 text-xs text-danger">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold mb-1.5"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-sm font-semibold">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-semibold text-link hover:text-link-hover transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff size={17} strokeWidth={2} />
                    ) : (
                      <Eye size={17} strokeWidth={2} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors"
              >
                {isSubmitting ? "Logging in..." : "Log In"}
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

            <Link
              href={`/signup${returnUrlQuery(readReturnUrl(searchParams))}`}
              className="mt-2.5 w-full flex items-center justify-center gap-2.5 rounded-full border border-border bg-bg hover:bg-surface text-text font-semibold text-sm py-3 transition-colors"
            >
              <Mail size={17} strokeWidth={2} />
              Sign Up with Email
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
