"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import { useAuth } from "@/contexts/AuthContext";

const CODE_LENGTH = 6;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { resetPasswordForEmail, verifyPasswordRecoveryOtp } = useAuth();

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setInfoMessage(null);

    const res = await resetPasswordForEmail(trimmed);
    setIsSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setStep("code");
    setCooldown(60);
    setCode(Array(CODE_LENGTH).fill(""));
    setInfoMessage(
      "If an account exists for this email, we have sent a 6-digit verification code and reset link."
    );
    requestAnimationFrame(() => codeInputsRef.current[0]?.focus());
  };

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    setError(null);
    if (digit && index < CODE_LENGTH - 1) {
      codeInputsRef.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setError(null);
    setCode((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LENGTH; i++) next[i] = pasted[i] ?? "";
      return next;
    });
    codeInputsRef.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length < CODE_LENGTH) {
      setError(`Please enter the complete ${CODE_LENGTH}-digit code.`);
      return;
    }

    setIsVerifying(true);
    setError(null);

    const res = await verifyPasswordRecoveryOtp(email, fullCode);
    setIsVerifying(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    router.push("/reset-password");
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    setError(null);
    setInfoMessage(null);

    const res = await resetPasswordForEmail(email);
    setIsResending(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    setCooldown(60);
    setCode(Array(CODE_LENGTH).fill(""));
    setInfoMessage("A new verification code has been sent.");
    requestAnimationFrame(() => codeInputsRef.current[0]?.focus());
  };

  const isCodeComplete = code.every((digit) => digit !== "");

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
          <div className="w-full max-w-sm bg-surface border border-border rounded-lg shadow-md p-8">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text transition-colors mb-5"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Back to login
            </Link>

            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div
                role="status"
                className="mb-5 flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-primary"
              >
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>{infoMessage}</span>
              </div>
            )}

            {step === "email" ? (
              <>
                <h1 className="font-display font-bold text-2xl mb-1">
                  Forgot your password?
                </h1>
                <p className="text-sm text-text-muted mb-6">
                  Enter your email address and we&apos;ll send you a 6-digit code
                  and reset link.
                </p>

                <form onSubmit={handleEmailSubmit} className="space-y-4">
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
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(null);
                      }}
                      placeholder="you@example.com"
                      className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Sending reset code...</span>
                      </>
                    ) : (
                      "Reset Password"
                    )}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h1 className="font-display font-bold text-2xl mb-1">
                  Enter the code
                </h1>
                <p className="text-sm text-text-muted mb-6">
                  We sent a {CODE_LENGTH}-digit code to{" "}
                  <span className="font-semibold text-text">
                    {email || "your email"}
                  </span>
                  .
                </p>

                <form onSubmit={handleVerifySubmit} className="space-y-6">
                  <div className="flex items-center justify-between gap-2">
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          codeInputsRef.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(index, e)}
                        onPaste={handleCodePaste}
                        aria-label={`Digit ${index + 1}`}
                        className="w-11 h-12 sm:w-12 sm:h-14 text-center text-lg font-bold rounded-md border border-border bg-bg text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!isCodeComplete || isVerifying}
                    className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Verifying code...</span>
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </button>
                </form>

                <div className="mt-5 flex items-center justify-between text-xs text-text-muted">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-text-muted hover:text-text transition-colors"
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || isResending}
                    className="font-semibold text-link hover:text-link-hover disabled:text-text-muted/50 disabled:cursor-not-allowed transition-colors"
                  >
                    {cooldown > 0
                      ? `Resend in ${cooldown}s`
                      : isResending
                      ? "Sending..."
                      : "Resend Code"}
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
