"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { newReleaseTitles as fallbackNewReleases, type NewReleaseTitle } from "@/data/new-release.mock";
import { getNewReleaseTitles } from "@/lib/services/content.service";

export default function NewRelease() {
  const [items, setItems] = useState<NewReleaseTitle[]>(fallbackNewReleases.slice(0, 12));

  useEffect(() => {
    getNewReleaseTitles(12).then((titles) => {
      if (titles && titles.length > 0) {
        setItems(
          titles.map((t) => ({
            id: t.id,
            title: t.title,
            poster: t.poster,
            href: `/drama/${t.slug}`,
          }))
        );
      }
    });
  }, []);

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-8 sm:py-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl sm:text-2xl text-text">
          New Release
        </h2>
        <Link
          href="/new-release"
          className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          See More
          <ChevronRight size={16} strokeWidth={2.5} />
        </Link>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="group">
            <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm">
              <Image
                src={item.poster}
                alt={item.title}
                fill
                sizes="(min-width: 1024px) 16vw, (min-width: 640px) 24vw, 32vw"
                className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
              />
            </div>
            <p className="mt-2 text-xs sm:text-sm font-semibold text-text line-clamp-2 leading-snug">
              {item.title}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
