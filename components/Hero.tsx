"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { heroSlides } from "@/data/hero-slides.mock";

const AUTOPLAY_DELAY_MS = 5000;
const TRANSITION_MS = 700;

export default function Hero() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = heroSlides.length;

  const goTo = useCallback(
    (index: number) => {
      setActive(((index % total) + total) % total);
    },
    [total]
  );

  // Delayed auto-advance — resets whenever the active slide changes,
  // so a manual click restarts the countdown instead of jump-cutting.
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      goTo(active + 1);
    }, AUTOPLAY_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, goTo]);

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden bg-bg">
      {/* Slide backgrounds — stacked, crossfading via opacity */}
      {heroSlides.map((slide, index) => (
        <div
          key={slide.id}
          className="absolute inset-0"
          style={{
            opacity: index === active ? 1 : 0,
            transition: `opacity ${TRANSITION_MS}ms var(--ease-brand)`,
          }}
          aria-hidden={index !== active}
        >
          <Image
            src={slide.image}
            alt=""
            fill
            priority={index === 0}
            sizes="100vw"
            className="object-cover"
            style={{
              transform: index === active ? "scale(1.06)" : "scale(1)",
              transition: `transform ${AUTOPLAY_DELAY_MS + TRANSITION_MS}ms linear`,
            }}
          />
        </div>
      ))}

      {/* Scrim for legible text over any image */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/10 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full max-w-[1200px] mx-auto px-6 flex flex-col justify-end pb-16">
        <div className="grid max-w-xl">
          {heroSlides.map((slide, index) => (
            <div
              key={slide.id}
              style={{
                gridArea: "1 / 1",
                opacity: index === active ? 1 : 0,
                transform: index === active ? "translateY(0)" : "translateY(14px)",
                transition: `opacity ${TRANSITION_MS}ms var(--ease-brand), transform ${TRANSITION_MS}ms var(--ease-brand)`,
                pointerEvents: index === active ? "auto" : "none",
              }}
              aria-hidden={index !== active}
            >
              <span className="inline-flex w-fit items-center rounded-pill bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-text-light">
                {slide.badge}
              </span>
              <h1 className="mt-4 font-display font-bold text-3xl sm:text-4xl md:text-5xl leading-tight text-text-light">
                {slide.title}
              </h1>
              <p className="mt-3 text-sm sm:text-base text-text-light/80 max-w-md">
                {slide.tagline}
              </p>
              <Link
                href={slide.href}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-pill bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold px-6 py-3 text-sm shadow-md transition-colors"
              >
                <Play size={16} strokeWidth={2.5} fill="currentColor" />
                Watch Now
              </Link>
            </div>
          ))}
        </div>

        {/* Pagination dots */}
        <div className="mt-8 flex items-center gap-2">
          {heroSlides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to slide ${index + 1}: ${slide.title}`}
              aria-current={index === active}
              onClick={() => goTo(index)}
              className="h-1.5 rounded-pill bg-white/35 hover:bg-white/60 transition-all"
              style={{
                width: index === active ? 28 : 8,
                backgroundColor: index === active ? "rgb(var(--tertiary))" : undefined,
                transitionDuration: `${TRANSITION_MS}ms`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
