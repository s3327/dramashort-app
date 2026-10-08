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
    <Link
      href={href}
      className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
    >
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

export { DramaCardSkeleton as TitleCardSkeleton } from "@/components/skeletons";
