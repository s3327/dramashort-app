"use client";

import { useEffect, useState } from "react";

/**
 * Custom hook that tracks CSS media query matching for responsive layouts.
 * Safe for Server-Side Rendering (defaults to defaultValue until client mounts).
 *
 * @example
 * const isMobile = useMediaQuery("(max-width: 768px)");
 * const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState<boolean>(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", listener);
    } else {
      // Fallback for older WebKit / Safari browsers
      const legacyList = mediaQueryList as unknown as {
        addListener?: (cb: (e: MediaQueryListEvent) => void) => void;
      };
      legacyList.addListener?.(listener);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener("change", listener);
      } else {
        const legacyList = mediaQueryList as unknown as {
          removeListener?: (cb: (e: MediaQueryListEvent) => void) => void;
        };
        legacyList.removeListener?.(listener);
      }
    };
  }, [query]);

  return matches;
}
