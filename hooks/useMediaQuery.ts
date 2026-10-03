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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mediaQueryList as any).addListener(listener);
    }

    return () => {
      if (mediaQueryList.removeEventListener) {
        mediaQueryList.removeEventListener("change", listener);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mediaQueryList as any).removeListener(listener);
      }
    };
  }, [query]);

  return matches;
}
