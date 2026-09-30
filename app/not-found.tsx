"use client";

import Image from "next/image";
import Link from "next/link";
import { Home } from "lucide-react";
import icon from "@/public/brand/dramashort-icon-circle.png";
import { useTheme } from "@/contexts/ThemeContext";

export default function NotFound() {
  const { theme } = useTheme();
  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text flex flex-col items-center justify-center px-6 text-center">
      <Link href="/home" className="inline-flex items-center gap-2.5 mb-10">
        <Image src={icon} alt="DramaShort" className="h-8 w-8" priority />
        <span className="font-display font-bold text-lg">
          <b className="text-primary">Drama</b>Short
        </span>
      </Link>

      <p className="font-display font-bold text-6xl sm:text-7xl text-primary mb-3">404</p>
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-2">
        This page went missing mid-episode
      </h1>
      <p className="text-sm text-text-muted max-w-sm mb-8">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved.
      </p>

      <Link
        href="/home"
        className="inline-flex items-center gap-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold px-6 py-3 text-sm shadow-sm transition-colors"
      >
        <Home size={16} strokeWidth={2.5} />
        Back to Home
      </Link>
    </div>
  );
}
