/**
 * Validation rules and normalization for Platform Settings (Task 16.8).
 */

import type { SettingsSection } from "@/types/settings";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: ValidationError[];
}

const VALID_SECTIONS: SettingsSection[] = ["general", "site", "users", "ads", "features"];

export function isValidSection(section: string): section is SettingsSection {
  return VALID_SECTIONS.includes(section as SettingsSection);
}

/**
 * Validates settings update payload for a given section.
 */
export function validateSettingsPayload(
  section: string,
  payload: unknown
): ValidationResult<Record<string, unknown>> {
  const errors: ValidationError[] = [];

  if (!isValidSection(section)) {
    return {
      ok: false,
      errors: [
        {
          field: "section",
          message: `Invalid section "${section}". Allowed sections: ${VALID_SECTIONS.join(", ")}`,
        },
      ],
    };
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return {
      ok: false,
      errors: [{ field: "values", message: "Values must be an object of key-value settings" }],
    };
  }

  const raw = payload as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  if (section === "general") {
    if (raw.siteName !== undefined) {
      if (typeof raw.siteName !== "string" || !raw.siteName.trim()) {
        errors.push({ field: "siteName", message: "Site Name must be a non-empty string" });
      } else if (raw.siteName.trim().length > 100) {
        errors.push({ field: "siteName", message: "Site Name must not exceed 100 characters" });
      } else {
        sanitized.siteName = raw.siteName.trim();
      }
    }
    if (raw.siteTagline !== undefined) {
      if (typeof raw.siteTagline !== "string") {
        errors.push({ field: "siteTagline", message: "Site Tagline must be a string" });
      } else {
        sanitized.siteTagline = raw.siteTagline.trim();
      }
    }
    if (raw.defaultLanguage !== undefined) {
      if (typeof raw.defaultLanguage !== "string") {
        errors.push({ field: "defaultLanguage", message: "Default Language must be a string" });
      } else {
        sanitized.defaultLanguage = raw.defaultLanguage.trim();
      }
    }
    if (raw.timezone !== undefined) {
      if (typeof raw.timezone !== "string") {
        errors.push({ field: "timezone", message: "Timezone must be a string" });
      } else {
        sanitized.timezone = raw.timezone.trim();
      }
    }
    if (raw.maintenanceMode !== undefined) {
      if (typeof raw.maintenanceMode !== "boolean") {
        errors.push({ field: "maintenanceMode", message: "Maintenance Mode must be a boolean" });
      } else {
        sanitized.maintenanceMode = raw.maintenanceMode;
      }
    }
  } else if (section === "site") {
    if (raw.trendingPeriod !== undefined) {
      if (typeof raw.trendingPeriod !== "string") {
        errors.push({ field: "trendingPeriod", message: "Trending Period must be a string" });
      } else {
        sanitized.trendingPeriod = raw.trendingPeriod.trim();
      }
    }
    if (raw.relatedTitlesSource !== undefined) {
      if (typeof raw.relatedTitlesSource !== "string") {
        errors.push({ field: "relatedTitlesSource", message: "Related Titles Source must be a string" });
      } else {
        sanitized.relatedTitlesSource = raw.relatedTitlesSource.trim();
      }
    }
    if (raw.historyRetentionDays !== undefined) {
      const days = Number(raw.historyRetentionDays);
      if (!Number.isFinite(days) || days < 1) {
        errors.push({ field: "historyRetentionDays", message: "History Retention Days must be at least 1" });
      } else {
        sanitized.historyRetentionDays = Math.round(days);
      }
    }
    if (raw.newReleaseMaxDisplay !== undefined) {
      const max = Number(raw.newReleaseMaxDisplay);
      if (!Number.isFinite(max) || max < 1 || max > 100) {
        errors.push({ field: "newReleaseMaxDisplay", message: "New Release Max Display must be between 1 and 100" });
      } else {
        sanitized.newReleaseMaxDisplay = Math.round(max);
      }
    }
    if (raw.showContinueWatching !== undefined) {
      if (typeof raw.showContinueWatching !== "boolean") {
        errors.push({ field: "showContinueWatching", message: "Show Continue Watching must be a boolean" });
      } else {
        sanitized.showContinueWatching = raw.showContinueWatching;
      }
    }
    if (raw.showTopTrending !== undefined) {
      if (typeof raw.showTopTrending !== "boolean") {
        errors.push({ field: "showTopTrending", message: "Show Top Trending must be a boolean" });
      } else {
        sanitized.showTopTrending = raw.showTopTrending;
      }
    }
  } else if (section === "users") {
    if (raw.defaultPlan !== undefined) {
      if (typeof raw.defaultPlan !== "string") {
        errors.push({ field: "defaultPlan", message: "Default Plan must be a string" });
      } else {
        sanitized.defaultPlan = raw.defaultPlan.trim();
      }
    }
    if (raw.requireEmailVerification !== undefined) {
      if (typeof raw.requireEmailVerification !== "boolean") {
        errors.push({ field: "requireEmailVerification", message: "Require Email Verification must be a boolean" });
      } else {
        sanitized.requireEmailVerification = raw.requireEmailVerification;
      }
    }
    if (raw.allowGoogleLogin !== undefined) {
      if (typeof raw.allowGoogleLogin !== "boolean") {
        errors.push({ field: "allowGoogleLogin", message: "Allow Google Login must be a boolean" });
      } else {
        sanitized.allowGoogleLogin = raw.allowGoogleLogin;
      }
    }
    if (raw.allowTelegramLogin !== undefined) {
      if (typeof raw.allowTelegramLogin !== "boolean") {
        errors.push({ field: "allowTelegramLogin", message: "Allow Telegram Login must be a boolean" });
      } else {
        sanitized.allowTelegramLogin = raw.allowTelegramLogin;
      }
    }
    if (raw.signupEnabled !== undefined) {
      if (typeof raw.signupEnabled !== "boolean") {
        errors.push({ field: "signupEnabled", message: "Signup Enabled must be a boolean" });
      } else {
        sanitized.signupEnabled = raw.signupEnabled;
      }
    }
    if (raw.deletionGracePeriodDays !== undefined) {
      const days = Number(raw.deletionGracePeriodDays);
      if (!Number.isFinite(days) || days < 0) {
        errors.push({ field: "deletionGracePeriodDays", message: "Deletion Grace Period Days must be >= 0" });
      } else {
        sanitized.deletionGracePeriodDays = Math.round(days);
      }
    }
    if (raw.defaultFreeEpisodes !== undefined) {
      const ep = Number(raw.defaultFreeEpisodes);
      if (!Number.isFinite(ep) || ep < 0) {
        errors.push({ field: "defaultFreeEpisodes", message: "Default Free Episodes must be >= 0" });
      } else {
        sanitized.defaultFreeEpisodes = Math.round(ep);
      }
    }
  } else if (section === "ads") {
    if (raw.enabled !== undefined) {
      if (typeof raw.enabled !== "boolean") {
        errors.push({ field: "enabled", message: "Ads Enabled must be a boolean" });
      } else {
        sanitized.enabled = raw.enabled;
      }
    }
    if (raw.network !== undefined) {
      if (typeof raw.network !== "string") {
        errors.push({ field: "network", message: "Ad Network must be a string" });
      } else {
        sanitized.network = raw.network.trim();
      }
    }
    if (raw.showOnHome !== undefined) {
      if (typeof raw.showOnHome !== "boolean") {
        errors.push({ field: "showOnHome", message: "Show Ads on Home must be a boolean" });
      } else {
        sanitized.showOnHome = raw.showOnHome;
      }
    }
    if (raw.showOnWatch !== undefined) {
      if (typeof raw.showOnWatch !== "boolean") {
        errors.push({ field: "showOnWatch", message: "Show Ads on Watch must be a boolean" });
      } else {
        sanitized.showOnWatch = raw.showOnWatch;
      }
    }
    if (raw.frequency !== undefined) {
      if (typeof raw.frequency !== "string") {
        errors.push({ field: "frequency", message: "Ad Frequency must be a string" });
      } else {
        sanitized.frequency = raw.frequency.trim();
      }
    }
  } else if (section === "features") {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v !== "boolean") {
        errors.push({ field: k, message: `Feature flag "${k}" must be a boolean` });
      } else {
        sanitized[k] = v;
      }
    }
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? sanitized : undefined,
    errors,
  };
}
