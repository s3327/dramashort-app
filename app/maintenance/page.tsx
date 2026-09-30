"use client";

import Image from "next/image";
import { Wrench } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import { useTheme } from "@/contexts/ThemeContext";

// UI only — not yet wired to the "Maintenance Mode" toggle in Admin
// Settings. Once that's real, middleware should check the flag and
// redirect all public traffic here while it's on.
export default function MaintenancePage() {
  const { theme } = useTheme();
  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text flex flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-2.5 mb-10">
        <Image src={icon} alt="DramaShort" className="h-8 w-8" />
        <span className="font-display font-bold text-lg">
          <b className="text-primary">Drama</b>Short
        </span>
      </div>

      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-5">
        <Wrench size={26} strokeWidth={2} />
      </div>

      <h1 className="font-display font-bold text-xl sm:text-2xl mb-2">
        We&apos;ll be back soon
      </h1>
      <p className="text-sm text-text-muted max-w-sm">
        DramaShort is currently down for scheduled maintenance. We&apos;re working
        on it and expect to be back shortly — thanks for your patience.
      </p>
    </div>
  );
}
