import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function TitleCard({
  href,
  poster,
  title,
  overlay,
  subtitle,
  priority = false,
  sizes = "(min-width: 1024px) 16vw, (min-width: 640px) 24vw, 32vw",
  titleClassName = "text-xs sm:text-sm",
}: {
  href: string;
  poster: string;
  title: string;
  overlay?: ReactNode; // e.g. a rank badge positioned inside the poster
  subtitle?: ReactNode; // e.g. a view count line below the title
  priority?: boolean;
  sizes?: string;
  titleClassName?: string;
}) {
  return (
    <Link href={href} className="group">
      <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm">
        <Image
          src={poster}
          alt={title}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
        />
        {overlay}
      </div>
      <p className={`mt-2 font-semibold text-text line-clamp-2 leading-snug ${titleClassName}`}>
        {title}
      </p>
      {subtitle}
    </Link>
  );
}

export function TitleCardSkeleton({
  hasSubtitle = false,
  className = "",
}: {
  hasSubtitle?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="aspect-[2/3] w-full rounded-md bg-surface border border-border/40 animate-pulse" />
      <div className="h-4 w-3/4 rounded bg-surface border border-border/30 animate-pulse" />
      {hasSubtitle ? (
        <div className="h-3 w-1/2 rounded bg-surface border border-border/20 animate-pulse" />
      ) : null}
    </div>
  );
}
