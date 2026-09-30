"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import icon from "@/public/brand/dramashort-icon-circle.png";
import OtpInput from "@/components/OtpInput";
import { useAuth } from "@/contexts/AuthContext";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const email = searchParams.get("email") || "your email";

  const [code, setCode] = useState("");
  const [resent, setResent] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: verify the code against the real auth API once it exists.
    // Verifying completes account creation, so it logs the user in too.
    login();
    router.push(searchParams.get("redirect") || "/home");
  };

  const handleResend = () => {
    // TODO: call the real "resend verification code" endpoint once it exists.
    setResent(true);
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
              We sent a 6-digit code to{" "}
              <span className="font-semibold text-text">{email}</span>.
            </p>

            <form onSubmit={handleVerify} className="space-y-6">
              <OtpInput length={6} onChange={setCode} />

              <button
                type="submit"
                disabled={code.length !== 6}
                className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-40 disabled:cursor-not-allowed text-btn-primary-text font-semibold text-sm py-3 shadow-sm transition-colors"
              >
                Verify Email
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-text-muted">
              {resent ? (
                "A new code was sent."
              ) : (
                <>
                  Didn&apos;t get a code?{" "}
                  <button
                    type="button"
                    onClick={handleResend}
                    className="font-semibold text-link hover:text-link-hover transition-colors"
                  >
                    Resend
                  </button>
                </>
              )}
            </p>
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
