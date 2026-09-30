"use client";

import { useEffect, useState } from "react";

export function useToast(duration = 2500) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  return { message, show: setMessage };
}
