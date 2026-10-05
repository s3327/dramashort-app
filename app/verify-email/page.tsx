"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import OtpInput from "@/components/OtpInput";
import { useAuth } from "@/contexts/AuthContext";
import { readReturnUrl } from "@/lib/navigation/safe-redirect";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { verifySignupOtp, resendSignupOtp } = useAuth();
  const email = searchParams.get("email")?.trim() || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 60-second cooldown timer for resend code
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    if (!email) {
      setError("Missing email address. Please return to the signup page.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    const res = await verifySignupOtp(email, code);
    if (res.error) {
      setError(res.error);
      setIsSubmitting(false);
      return;
    }

    const returnUrl = readReturnUrl(searchParams);
    router.push(returnUrl);
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending || !email) return;

    setError("");
    setResendStatus("");
    setIsResending(true);

    const res = await resendSignupOtp(email);
    setIsResending(false);

    if (res.error) {
      setError(res.error);
    } else {
      setResendStatus("A new 6-digit code has been sent to your inbox.");
      setCooldown(60);
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
            <h1 className="font-display font-bold text-2xl mb-1">Verify your email</h1>
            <p className="text-sm text-text-muted mb-6">
              {email ? (
                <>
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-text">{email}</span>.
                </>
              ) : (
                <>Enter the 6-digit confirmation code sent to your email.</>
              )}
            </p>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-md bg-danger/10 border border-danger/30 px-3.5 py-2.5 text-xs text-danger"
              >
                {error}
              </div>
            )}

            {resendStatus && (
              <div
                role="status"
                className="mb-5 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-2.5 text-xs text-emerald-400"
              >
                {resendStatus}
              </div>
            )}

            <form onSubmit={handleVerify} className="space-y-6">
              <OtpInput length={6} onChange={setCode} />

              <button
                type="submit"
                disabled={code.length !== 6 || isSubmitting}
                className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify Email</span>
                )}
              </button>
            </form>

            <div className="mt-5 text-center text-xs text-text-muted space-y-2">
              <p>
                Didn&apos;t get a code?{" "}
                {cooldown > 0 ? (
                  <span className="font-medium text-text-muted">
                    Resend in {cooldown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending || !email}
                    className="font-semibold text-link hover:text-link-hover disabled:opacity-50 transition-colors"
                  >
                    {isResending ? "Sending..." : "Resend"}
                  </button>
                )}
              </p>

              {!email && (
                <p>
                  <Link
                    href="/signup"
                    className="font-semibold text-link hover:text-link-hover transition-colors"
                  >
                    Back to Sign Up
                  </Link>
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
