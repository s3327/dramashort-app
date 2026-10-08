/**
 * Telemetry and state management for Guest-Friendly Engagement (Task 14.8).
 * Provides event dispatching for Phase 15 analytics integration and manages
 * local dismissal cooldowns for non-intrusive prompts.
 */

export type GuestEngagementTrigger = "favorite" | "episode_3";
export type GuestEngagementAction = "shown" | "cta_click" | "dismiss";

export interface GuestEngagementEventData {
  action: GuestEngagementAction;
  trigger: GuestEngagementTrigger;
  dramaSlug?: string;
  episodeNumber?: number;
  timestamp?: number;
}

export const GUEST_PROMPT_FAV_DISMISSED_KEY = "dramashort_guest_prompt_fav_dismissed";
export const GUEST_PROMPT_EP3_DISMISSED_KEY = "dramashort_guest_prompt_ep3_dismissed";

/**
 * Checks if the guest prompt for a given trigger has been dismissed by the viewer.
 */
export function isGuestPromptDismissed(trigger: GuestEngagementTrigger): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key =
      trigger === "favorite"
        ? GUEST_PROMPT_FAV_DISMISSED_KEY
        : GUEST_PROMPT_EP3_DISMISSED_KEY;
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

/**
 * Records that the guest prompt for a given trigger has been dismissed.
 */
export function setGuestPromptDismissed(trigger: GuestEngagementTrigger): void {
  if (typeof window === "undefined") return;
  try {
    const key =
      trigger === "favorite"
        ? GUEST_PROMPT_FAV_DISMISSED_KEY
        : GUEST_PROMPT_EP3_DISMISSED_KEY;
    window.localStorage.setItem(key, "true");
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clears guest prompt dismissal state (useful for tests or post-login cleanup).
 */
export function clearGuestPromptDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(GUEST_PROMPT_FAV_DISMISSED_KEY);
    window.localStorage.removeItem(GUEST_PROMPT_EP3_DISMISSED_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Tracks a guest engagement event. Dispatches a custom DOM event for client listeners
 * and defensively relays to the analytics ingestion endpoint (Phase 15.1) if available.
 */
export function trackGuestEngagementEvent(data: GuestEngagementEventData): void {
  const payload = {
    ...data,
    timestamp: data.timestamp || Date.now(),
  };

  if (typeof window !== "undefined") {
    // 1. Dispatch custom DOM event for client listeners / tests
    try {
      window.dispatchEvent(
        new CustomEvent("dramashort:guest-engagement", { detail: payload })
      );
    } catch {
      // Ignore DOM dispatch error
    }

    // 2. Prepare forwarder to /api/events (Phase 15.1)
    try {
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        const blob = new Blob([JSON.stringify(payload)], {
          type: "application/json",
        });
        navigator.sendBeacon("/api/events", blob);
      } else if (typeof fetch === "function") {
        fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // Silent catch: endpoint will be activated in Task 15.1
        });
      }
    } catch {
      // Silent catch
    }
  }
}
