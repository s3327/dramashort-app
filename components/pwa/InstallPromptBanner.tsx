"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Download, X } from "lucide-react";

export const PWA_DISMISSED_STORAGE_KEY = "dramashort_pwa_dismissed_until";
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if running in standalone display mode already
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as any)?.standalone);

    if (isStandalone) {
      return;
    }

    // Check 14-day dismissal cooldown
    try {
      const dismissedUntil = localStorage.getItem(PWA_DISMISSED_STORAGE_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        return;
      }
    } catch {}

    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent automatic browser mini-infobar
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === "accepted") {
        setIsVisible(false);
        setDeferredPrompt(null);
      }
    } catch {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      const cooldownUntil = Date.now() + FOURTEEN_DAYS_MS;
      localStorage.setItem(PWA_DISMISSED_STORAGE_KEY, String(cooldownUntil));
    } catch {}
  };

  if (!isVisible || !deferredPrompt) {
    return null;
  }

  return (
    <aside
      aria-label="Install DramaShort App"
      className="fixed bottom-4 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="bg-surface/95 border border-primary/40 backdrop-blur-md rounded-2xl p-3.5 shadow-2xl flex items-center gap-3">
        {/* App Icon */}
        <div className="relative h-11 w-11 shrink-0 rounded-xl overflow-hidden shadow-sm border border-border">
          <Image
            src="/brand/dramashort-icon-circle.png"
            alt="DramaShort Icon"
            width={44}
            height={44}
            className="h-full w-full object-cover"
            priority
          />
        </div>

        {/* Text Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-extrabold text-xs text-text truncate">
            Install DramaShort
          </h3>
          <p className="text-[11px] text-text-muted line-clamp-1 leading-tight mt-0.5">
            Watch full-screen vertical dramas in standalone app mode
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-text font-bold text-xs shadow-sm flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
          >
            <Download size={13} strokeWidth={2.5} />
            <span>Install</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
