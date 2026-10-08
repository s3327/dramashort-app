"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Pause, ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroSlide } from "@/types/content";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import { getHeroSlides } from "@/lib/services/content.service";
import { CarouselSkeleton } from "@/components/skeletons";

const AUTOPLAY_DELAY_MS = 5000;
const TRANSITION_MS = 700;

export interface HeroProps {
  initialSlides?: HeroSlide[];
}

export default function Hero({ initialSlides }: HeroProps = {}) {
  const [slides, setSlides] = useState<HeroSlide[]>(initialSlides || []);
  const [isLoading, setIsLoading] = useState(!initialSlides || initialSlides.length === 0);
  const [active, setActive] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (initialSlides && initialSlides.length > 0) {
      setSlides(initialSlides);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    getHeroSlides()
      .then(async (dbSlides) => {
        if (!isMounted) return;
        if (dbSlides && dbSlides.length > 0) {
          setSlides(dbSlides);
        } else if (ENABLE_MOCK_FALLBACK) {
          const { heroSlides } = await import("@/data/hero-slides.mock");
          if (isMounted) setSlides(heroSlides);
        } else {
          setSlides([]);
        }
      })
      .catch(async (err) => {
        console.warn("Failed to load hero slides from DB:", err);
        if (ENABLE_MOCK_FALLBACK) {
          const { heroSlides } = await import("@/data/hero-slides.mock");
          if (isMounted) setSlides(heroSlides);
        } else if (isMounted) {
          setSlides([]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialSlides]);

  const total = slides.length;

  const goTo = useCallback(
    (index: number) => {
      if (total === 0) return;
      setActive(((index % total) + total) % total);
    },
    [total]
  );

  // Pause conditions for autoplay:
  // 1. Manually paused by user
  // 2. Mouse hovered over carousel
  // 3. Keyboard focused within carousel
  // 4. prefers-reduced-motion enabled
  const isRotationPaused =
    isManuallyPaused || isHovered || isFocused || prefersReducedMotion;

  // Delayed auto-advance — resets whenever the active slide changes or pause state changes
  useEffect(() => {
    if (total === 0 || isLoading || isRotationPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      goTo(active + 1);
    }, AUTOPLAY_DELAY_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, goTo, total, isLoading, isRotationPaused]);

  // Keyboard navigation for arrow keys
  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(active - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(active + 1);
    }
  };

  if (isLoading) {
    return <CarouselSkeleton />;
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <section
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured Dramas"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsFocused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      className="relative h-[54svh] max-h-[440px] sm:max-h-none sm:h-[65svh] md:h-[72vh] lg:h-[78vh] min-h-[350px] md:min-h-[520px] w-full overflow-hidden bg-bg"
    >
      {/* Polite live region for screen-reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isRotationPaused
          ? `Slide rotation paused. Showing slide ${active + 1} of ${total}: ${slides[active]?.title}`
          : `Showing slide ${active + 1} of ${total}: ${slides[active]?.title}`}
      </div>

      {/* Slide backgrounds — stacked, crossfading via opacity */}
      {slides.map((slide, index) => {
        const hasBanner = Boolean(slide.bannerUrl);
        const bgImage = slide.bannerUrl || slide.posterUrl || slide.image;
        return (
          <div
            key={slide.id}
            className="absolute inset-0 overflow-hidden"
            style={{
              opacity: index === active ? 1 : 0,
              transition: prefersReducedMotion
                ? "none"
                : `opacity ${TRANSITION_MS}ms var(--ease-brand)`,
            }}
            aria-hidden={index !== active}
          >
            <Image
              src={bgImage}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              className={
                hasBanner
                  ? "object-cover"
                  : "object-cover blur-2xl scale-110 brightness-40 saturate-150"
              }
              style={{
                transform:
                  !prefersReducedMotion && index === active
                    ? hasBanner
                      ? "scale(1.06)"
                      : "scale(1.15)"
                    : hasBanner
                    ? "scale(1)"
                    : "scale(1.10)",
                transition: prefersReducedMotion
                  ? "none"
                  : `transform ${AUTOPLAY_DELAY_MS + TRANSITION_MS}ms linear`,
              }}
            />
          </div>
        );
      })}

      {/* Scrim gradients for legible text over any backdrop */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full max-w-[1200px] mx-auto px-6 flex flex-col justify-end pb-8 sm:pb-12 md:pb-16">
        {/* Single canonical H1 for page heading hierarchy (WCAG 2.1 AA) */}
        <h1 className="sr-only">Featured Dramas</h1>

        <div className="grid w-full">
          {slides.map((slide, index) => {
            const hasBanner = Boolean(slide.bannerUrl);
            return (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`Slide ${index + 1} of ${total}: ${slide.title}`}
                style={{
                  gridArea: "1 / 1",
                  opacity: index === active ? 1 : 0,
                  transform: index === active ? "translateY(0)" : "translateY(14px)",
                  transition: prefersReducedMotion
                    ? "none"
                    : `opacity ${TRANSITION_MS}ms var(--ease-brand), transform ${TRANSITION_MS}ms var(--ease-brand)`,
                  pointerEvents: index === active ? "auto" : "none",
                }}
                aria-hidden={index !== active}
                className="flex items-end justify-between gap-8"
              >
                <div className="max-w-xl">
                  <span className="inline-flex w-fit items-center rounded-pill bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-text-light">
                    {slide.badge}
                  </span>
                  {/* Slide drama title is an H2, preserving a single H1 per page */}
                  <h2 className="mt-2 sm:mt-4 font-display font-bold text-2xl sm:text-4xl md:text-5xl leading-tight text-text-light">
                    {slide.title}
                  </h2>
                  <p className="mt-2 sm:mt-3 text-xs sm:text-base text-text-light/80 max-w-md line-clamp-2 sm:line-clamp-none">
                    {slide.tagline}
                  </p>
                  <Link
                    href={slide.href}
                    className="mt-4 sm:mt-6 inline-flex w-fit items-center gap-2 rounded-pill bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold px-4 py-2 sm:px-6 sm:py-3 text-xs sm:text-sm shadow-md transition-colors"
                  >
                    <Play size={16} strokeWidth={2.5} fill="currentColor" />
                    Watch Now
                  </Link>
                </div>

                {/* Sharp Portrait Poster beside text on desktop when landscape banner is absent */}
                {!hasBanner && (
                  <div className="hidden md:block shrink-0 relative w-44 lg:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl border border-white/20 mb-2">
                    <Image
                      src={slide.posterUrl || slide.image}
                      alt={slide.title}
                      fill
                      sizes="(min-width: 1024px) 208px, 176px"
                      className="object-cover"
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Controls bar: Pagination dots, Pause/Play toggle, and Prev/Next buttons */}
        <div className="mt-4 sm:mt-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => goTo(index)}
                className="h-1.5 rounded-pill bg-white/35 hover:bg-white/60 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={{
                  width: index === active ? 28 : 8,
                  backgroundColor: index === active ? "rgb(var(--tertiary))" : undefined,
                  transitionDuration: `${TRANSITION_MS}ms`,
                }}
              />
            ))}

            {/* Manual pause/play rotation button for WCAG 2.2.2 */}
            <button
              type="button"
              aria-label={isManuallyPaused ? "Resume slide rotation" : "Pause slide rotation"}
              onClick={() => setIsManuallyPaused((prev) => !prev)}
              className="ml-2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/15 hover:bg-white/30 text-white/90 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              {isManuallyPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
            </button>
          </div>

          {/* Accessible arrow navigation for desktop */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              aria-label="Previous slide"
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors border border-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              aria-label="Next slide"
              className="p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white transition-colors border border-white/10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
