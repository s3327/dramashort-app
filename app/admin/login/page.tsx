"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import icon from "@/public/brand/dramashort-icon-circle.png";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAdminAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up to the real admin auth API once it exists.
    login();
    router.push("/admin/dashboard");
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <Image src={icon} alt="DramaShort" className="h-8 w-8" priority />
          <span className="font-display font-bold text-lg">
            <b className="text-primary">Drama</b>Short
            <span className="ml-1.5 text-xs font-semibold text-text-muted align-middle">Admin</span>
          </span>
        </div>

        <div className="bg-surface border border-border rounded-lg shadow-sm p-8">
          <h1 className="font-display font-bold text-xl mb-1">Admin sign in</h1>
          <p className="text-sm text-text-muted mb-6">
            Restricted access — staff accounts only.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="you@dramashort.com"
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
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-md bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
