/**
 * Platform Settings Domain Types (Task 16.8).
 */

export interface GeneralSettings {
  siteName: string;
  siteTagline: string;
  defaultLanguage: string;
  timezone: string;
  maintenanceMode: boolean;
}

export interface SiteSettings {
  trendingPeriod: string;
  relatedTitlesSource: string;
  historyRetentionDays: number;
  newReleaseMaxDisplay: number;
  showContinueWatching: boolean;
  showTopTrending: boolean;
}

export interface UserSettings {
  defaultPlan: string;
  requireEmailVerification: boolean;
  allowGoogleLogin: boolean;
  allowTelegramLogin: boolean;
  signupEnabled: boolean;
  deletionGracePeriodDays: number;
  defaultFreeEpisodes: number;
}

export interface AdsSettings {
  enabled: boolean;
  network: string;
  showOnHome: boolean;
  showOnWatch: boolean;
  frequency: string;
}

export type FeaturesSettings = Record<string, boolean>;

export type SettingsSection = "general" | "site" | "users" | "ads" | "features";

export interface PlatformSettings {
  general: GeneralSettings;
  site: SiteSettings;
  users: UserSettings;
  ads: AdsSettings;
  features: FeaturesSettings;
  updatedAt?: string;
  updatedBy?: string | null;
}

export interface UpdateSettingsSectionInput {
  section: SettingsSection;
  values: Record<string, unknown>;
}

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  siteName: "DramaShort",
  siteTagline: "Vertical dramas for a 12-minute break",
  defaultLanguage: "English",
  timezone: "UTC",
  maintenanceMode: false,
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  trendingPeriod: "Weekly",
  relatedTitlesSource: "Genre / Tags / Channel",
  historyRetentionDays: 60,
  newReleaseMaxDisplay: 24,
  showContinueWatching: true,
  showTopTrending: true,
};

export const DEFAULT_USER_SETTINGS: UserSettings = {
  defaultPlan: "Free",
  requireEmailVerification: true,
  allowGoogleLogin: true,
  allowTelegramLogin: true,
  signupEnabled: true,
  deletionGracePeriodDays: 14,
  defaultFreeEpisodes: 3,
};

export const DEFAULT_ADS_SETTINGS: AdsSettings = {
  enabled: false,
  network: "None",
  showOnHome: false,
  showOnWatch: false,
  frequency: "Every 3 episodes",
};

export const DEFAULT_FEATURES_SETTINGS: FeaturesSettings = {
  autoplayNext: true,
  hlsStreaming: true,
  guestFavorites: true,
};

