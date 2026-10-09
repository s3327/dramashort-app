/**
 * DramaShort Progressive Web App (PWA) Service Worker
 * Phase 9: Mobile PWA & Advanced Video Player UX
 */

const CACHE_NAME = "dramashort-pwa-v1";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/brand/dramashort-icon-circle.png",
  "/brand/dramashort-icon-square.png",
  "/brand/dramashort-logo.png",
];

// URLs/Patterns strictly excluded from service worker caching
function isExcludedUrl(url) {
  const pathname = url.pathname;

  // 1. Streaming video chunks and manifests (.m3u8, .ts, .mp4, /api/playback/*)
  if (
    pathname.endsWith(".m3u8") ||
    pathname.endsWith(".ts") ||
    pathname.endsWith(".mp4") ||
    pathname.includes("/api/playback/")
  ) {
    return true;
  }

  // 2. Authenticated user, admin, payments, and auth endpoints
  if (
    pathname.startsWith("/api/user/") ||
    pathname.startsWith("/api/admin/") ||
    pathname.startsWith("/api/payments/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/auth/")
  ) {
    return true;
  }

  // 3. Supabase direct API calls or signed tokens
  if (url.hostname.includes("supabase.co")) {
    return true;
  }

  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Check exclusion list
  if (isExcludedUrl(url)) {
    return;
  }

  // Cache-first for static Next.js assets, fonts, and brand images
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/brand/") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-first with cache fallback for page navigation
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match("/");
          });
        })
    );
    return;
  }

  // Default: network with cache fallback
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
