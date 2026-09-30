"use client";

import { useEffect, useState } from "react";

/**
 * Generic debounce hook for delaying state updates (e.g. search query input).
 * @param value The value to debounce.
 * @param delay Milliseconds to delay (defaults to 300ms).
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
