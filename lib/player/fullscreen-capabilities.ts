/**
 * Fullscreen capabilities and cross-platform adapter.
 * Provides unified fullscreen handling across:
 * 1. Standard Desktop & Android Chrome (Element.requestFullscreen)
 * 2. iOS Safari (iPhone HTMLVideoElement.webkitEnterFullscreen)
 * 3. Telegram Mini App (window.Telegram.WebApp.requestFullscreen / expand)
 * 4. In-App Webviews (Facebook, Instagram, TikTok, Line with permission restrictions)
 */

export interface FullscreenAdapterOptions {
  aspectMode?: string;
  preferNativeVideoOnIos?: boolean;
}

export function isTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).Telegram?.WebApp);
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isIpadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isIos || isIpadOs;
}

export function isIphone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPod/.test(navigator.userAgent);
}

export function isFullscreenSupported(
  video?: HTMLVideoElement | null,
  container?: HTMLElement | null
): boolean {
  if (typeof document === "undefined") return false;

  // Telegram Mini App supports fullscreen or expansion
  if (isTelegramWebApp()) return true;

  // Standard Fullscreen API
  if (document.fullscreenEnabled) return true;
  if ((document as any).webkitFullscreenEnabled) return true;

  // Container support
  if (container?.requestFullscreen) return true;
  if ((container as any)?.webkitRequestFullscreen) return true;

  // iOS Safari / WebKit native video fullscreen
  if (video) {
    if (typeof (video as any).webkitEnterFullscreen === "function") return true;
    if ((video as any).webkitSupportsFullscreen) return true;
  }

  return false;
}

export function getIsFullscreen(video?: HTMLVideoElement | null): boolean {
  if (typeof document === "undefined") return false;

  // Standard Document Fullscreen
  if (Boolean(document.fullscreenElement)) return true;
  if (Boolean((document as any).webkitFullscreenElement)) return true;

  // Telegram Mini App Fullscreen
  if (isTelegramWebApp()) {
    const tg = (window as any).Telegram?.WebApp;
    if (typeof tg?.isFullscreen === "boolean") {
      return tg.isFullscreen;
    }
  }

  // iOS Safari native video fullscreen
  if (video && (video as any).webkitDisplayingFullscreen) {
    return true;
  }

  return false;
}

export async function enterFullscreen(
  container?: HTMLElement | null,
  video?: HTMLVideoElement | null,
  options?: FullscreenAdapterOptions
): Promise<boolean> {
  if (typeof document === "undefined") return false;

  // Attempt screen orientation lock based on aspect ratio
  const tryLockOrientation = () => {
    try {
      if (typeof screen !== "undefined" && (screen as any).orientation?.lock) {
        if (options?.aspectMode === "16:9") {
          (screen as any).orientation.lock("landscape").catch(() => {});
        } else if (options?.aspectMode === "9:16") {
          (screen as any).orientation.lock("portrait").catch(() => {});
        }
      }
    } catch {
      // Orientation lock not supported or blocked
    }
  };

  // 1. Telegram Mini App
  if (isTelegramWebApp()) {
    const tg = (window as any).Telegram.WebApp;
    try {
      if (typeof tg.requestFullscreen === "function") {
        tg.requestFullscreen();
      } else if (typeof tg.expand === "function") {
        tg.expand();
      }
      tryLockOrientation();
      return true;
    } catch (err) {
      console.warn("[Fullscreen] Telegram WebApp fullscreen rejected:", err);
    }
  }

  // 2. iOS iPhone Safari: container.requestFullscreen is unsupported on iPhone,
  // native video.webkitEnterFullscreen is required.
  if (isIphone() && video && typeof (video as any).webkitEnterFullscreen === "function") {
    try {
      (video as any).webkitEnterFullscreen();
      tryLockOrientation();
      return true;
    } catch (err) {
      console.warn("[Fullscreen] iOS Safari webkitEnterFullscreen rejected:", err);
    }
  }

  // 3. Standard Element.requestFullscreen (Desktop, Android, iPadOS)
  if (container?.requestFullscreen) {
    try {
      await container.requestFullscreen();
      tryLockOrientation();
      return true;
    } catch (err) {
      // Common in webviews (FB/IG) or if rejected: fallback to video native fullscreen
      console.warn("[Fullscreen] container.requestFullscreen rejected:", err);
      if (video && typeof (video as any).webkitEnterFullscreen === "function") {
        try {
          (video as any).webkitEnterFullscreen();
          tryLockOrientation();
          return true;
        } catch {
          // ignore fallback error
        }
      }
      return false;
    }
  }

  // 4. WebKit prefix fallback (Safari desktop / legacy Android)
  if ((container as any)?.webkitRequestFullscreen) {
    try {
      (container as any).webkitRequestFullscreen();
      tryLockOrientation();
      return true;
    } catch (err) {
      console.warn("[Fullscreen] webkitRequestFullscreen rejected:", err);
    }
  }

  // 5. Direct video native fallback
  if (video && typeof (video as any).webkitEnterFullscreen === "function") {
    try {
      (video as any).webkitEnterFullscreen();
      tryLockOrientation();
      return true;
    } catch (err) {
      console.warn("[Fullscreen] webkitEnterFullscreen fallback rejected:", err);
    }
  }

  return false;
}

export async function exitFullscreen(
  video?: HTMLVideoElement | null
): Promise<boolean> {
  if (typeof document === "undefined") return false;

  // Unlock orientation
  try {
    if (typeof screen !== "undefined" && (screen as any).orientation?.unlock) {
      (screen as any).orientation.unlock();
    }
  } catch {}

  // 1. Telegram Mini App
  if (isTelegramWebApp()) {
    const tg = (window as any).Telegram?.WebApp;
    try {
      if (typeof tg.exitFullscreen === "function") {
        tg.exitFullscreen();
        return true;
      }
    } catch {}
  }

  // 2. Standard document.exitFullscreen
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
      return true;
    } catch (err) {
      console.warn("[Fullscreen] document.exitFullscreen rejected:", err);
    }
  }

  // 3. WebKit document exit fullscreen
  if ((document as any).webkitFullscreenElement && (document as any).webkitExitFullscreen) {
    try {
      (document as any).webkitExitFullscreen();
      return true;
    } catch (err) {
      console.warn("[Fullscreen] document.webkitExitFullscreen rejected:", err);
    }
  }

  // 4. iOS Safari native video exit
  if (video && typeof (video as any).webkitExitFullscreen === "function") {
    try {
      (video as any).webkitExitFullscreen();
      return true;
    } catch {}
  }

  return false;
}

export async function toggleFullscreen(
  container?: HTMLElement | null,
  video?: HTMLVideoElement | null,
  options?: FullscreenAdapterOptions
): Promise<boolean> {
  const isCurrentlyFs = getIsFullscreen(video);
  if (isCurrentlyFs) {
    return exitFullscreen(video);
  } else {
    return enterFullscreen(container, video, options);
  }
}

export function addFullscreenChangeListener(
  video: HTMLVideoElement | null,
  onChange: (isFullscreen: boolean) => void
): () => void {
  if (typeof document === "undefined") return () => {};

  const handleDocumentChange = () => {
    onChange(getIsFullscreen(video));
  };

  const handleVideoBeginFs = () => {
    onChange(true);
  };

  const handleVideoEndFs = () => {
    onChange(false);
  };

  const handlePresentationMode = () => {
    if (video) {
      const mode = (video as any).webkitPresentationMode;
      onChange(mode === "fullscreen");
    }
  };

  // Standard events
  document.addEventListener("fullscreenchange", handleDocumentChange);
  document.addEventListener("webkitfullscreenchange", handleDocumentChange);

  // iOS WebKit events on HTMLVideoElement
  if (video) {
    video.addEventListener("webkitbeginfullscreen", handleVideoBeginFs);
    video.addEventListener("webkitendfullscreen", handleVideoEndFs);
    video.addEventListener("webkitpresentationmodechanged", handlePresentationMode);
  }

  // Telegram Mini App events
  let hasSubscribedTelegram = false;
  if (isTelegramWebApp()) {
    const tg = (window as any).Telegram?.WebApp;
    if (typeof tg?.onEvent === "function") {
      try {
        tg.onEvent("fullscreen_changed", handleDocumentChange);
        tg.onEvent("viewportChanged", handleDocumentChange);
        hasSubscribedTelegram = true;
      } catch {}
    }
  }

  return () => {
    document.removeEventListener("fullscreenchange", handleDocumentChange);
    document.removeEventListener("webkitfullscreenchange", handleDocumentChange);

    if (video) {
      video.removeEventListener("webkitbeginfullscreen", handleVideoBeginFs);
      video.removeEventListener("webkitendfullscreen", handleVideoEndFs);
      video.removeEventListener("webkitpresentationmodechanged", handlePresentationMode);
    }

    if (hasSubscribedTelegram && typeof window !== "undefined") {
      const tg = (window as any).Telegram?.WebApp;
      if (typeof tg?.offEvent === "function") {
        try {
          tg.offEvent("fullscreen_changed", handleDocumentChange);
          tg.offEvent("viewportChanged", handleDocumentChange);
        } catch {}
      }
    }
  };
}
