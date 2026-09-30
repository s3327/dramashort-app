"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";

const CODE_LENGTH = 6;

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const codeInputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: call the real auth API to send a reset code once it exists.
    setStep("code");
    // Focus the first code box once it mounts.
    requestAnimationFrame(() => codeInputsRef.current[0]?.focus());
  };

  const handleCodeChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < CODE_LENGTH - 1) {
      codeInputsRef.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    setCode((prev) => {
      const next = [...prev];
      for (let i = 0; i < CODE_LENGTH; i++) next[i] = pasted[i] ?? "";
      return next;
    });
    codeInputsRef.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: verify the code against the real auth API once it exists.
  };

  const handleResend = () => {
    // TODO: call the real "resend code" endpoint once it exists.
    setCode(Array(CODE_LENGTH).fill(""));
    requestAnimationFrame(() => codeInputsRef.current[0]?.focus());
  };

  const isCodeComplete = code.every((digit) => digit !== "");

  return (
    <div className="min-h-screen flex flex-col">
      <div className="relative overflow-hidden flex-1 flex flex-col">
        {/* Ambient glow, matching the login page */}
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

            {step === "email" ? (
              <>
                <h1 className="font-display font-bold text-2xl mb-1">
                  Forgot your password?
                </h1>
                <p className="text-sm text-text-muted mb-6">
                  Enter the email on your account and we&apos;ll send you a
                  code to reset it.
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
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors"
                  >
                    Reset Password
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
                    disabled={!isCodeComplete}
                    className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors"
                  >
                    Verify Code
                  </button>
                </form>

                <p className="mt-5 text-center text-xs text-text-muted">
                  Didn&apos;t get a code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    className="font-semibold text-link hover:text-link-hover transition-colors"
                  >
                    Resend
                  </button>
                </p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
