"use client";

import { useEffect } from "react";

/**
 * Client component that safely registers the DramaShort service worker
 * in supported browser environments.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register service worker after window load to prevent blocking initial render
    const registerSw = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Listen for updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (
                  installingWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // A new service worker version is available
                }
              };
            }
          };
        })
        .catch((_err) => {
          // Gracefully ignore registration failure in non-HTTPS / unsupported environments
        });
    };

    if (document.readyState === "complete") {
      registerSw();
    } else {
      window.addEventListener("load", registerSw, { once: true });
    }
  }, []);

  return null;
}
