import Image from "next/image";
import Link from "next/link";
import { Play, Clock } from "lucide-react";
import { continueWatchingHistory } from "@/data/continue-watching.mock";

// The /home page only ever surfaces the 6 most recent watches, no matter
// how large the user's real history is — enforced here, not upstream.
const MAX_VISIBLE = 6;

export default function ContinueWatching() {
  const items = continueWatchingHistory.slice(0, MAX_VISIBLE);

  return (
    <section className="max-w-[1200px] mx-auto px-6 py-8 sm:py-10">
      <h2 className="font-display font-bold text-xl sm:text-2xl text-text mb-4">
        Continue Watching
      </h2>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface py-10 text-center">
          <Clock size={22} strokeWidth={2} className="text-text-muted mb-1" />
          <p className="text-sm font-semibold text-text">Nothing in progress yet</p>
          <p className="text-xs text-text-muted max-w-xs">
            Start watching a title and it'll show up here so you can pick up
            right where you left off.
          </p>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group shrink-0 w-32 sm:w-36 md:w-40 snap-start"
          >
            <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm">
              <Image
                src={item.poster}
                alt={item.title}
                fill
                sizes="(min-width: 768px) 160px, (min-width: 640px) 144px, 128px"
                className="object-cover transition-transform duration-300 ease-brand group-hover:scale-105"
              />

              {/* Legibility scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

              {/* Play affordance on hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <span className="flex items-center justify-center h-10 w-10 rounded-full bg-white/90">
                  <Play size={16} strokeWidth={2.5} fill="currentColor" className="text-primary-dark ml-0.5" />
                </span>
              </div>

              {/* Episode label */}
              <span className="absolute top-2 left-2 rounded-pill bg-black/55 backdrop-blur-sm px-2 py-0.5 text-[10px] font-semibold text-text-light">
                {item.episodeLabel}
              </span>

              {/* Progress bar */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, Math.max(0, item.progress * 100))}%` }}
                />
              </div>
            </div>

            <p className="mt-2 text-xs sm:text-sm font-semibold text-text line-clamp-2 leading-snug">
              {item.title}
            </p>
          </Link>
          ))}
        </div>
      )}
    </section>
  );
}
