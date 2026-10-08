"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import {
  Save,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Wrench,
  Sparkles,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  type AdsSettings,
  type FeaturesSettings,
  type GeneralSettings,
  type PlatformSettings,
  type SettingsSection,
  type SiteSettings,
  type UserSettings,
  DEFAULT_ADS_SETTINGS,
  DEFAULT_FEATURES_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  DEFAULT_USER_SETTINGS,
} from "@/types/settings";

const tabs = [
  { key: "general", label: "General" },
  { key: "site", label: "Site" },
  { key: "users", label: "Users" },
  { key: "ads", label: "Ads" },
  { key: "features", label: "Feature Flags" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6 py-4">
      <div className="pr-4">
        <p className="text-sm font-semibold text-text">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleControl({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? "bg-primary" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

export default function AdminSettingsPage() {
  const { user: currentAdmin } = useAdminAuth();
  const isAdmin = currentAdmin?.app_metadata?.role === "admin";
  const { message: toastMessage, show: showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Settings state
  const [general, setGeneral] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [users, setUsers] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [ads, setAds] = useState<AdsSettings>(DEFAULT_ADS_SETTINGS);
  const [features, setFeatures] = useState<FeaturesSettings>(DEFAULT_FEATURES_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<PlatformSettings | null>(null);

  // Maintenance Confirmation Modal
  const [showMaintModal, setShowMaintModal] = useState(false);

  // Fetch settings from API
  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to load platform settings");
      const json = await res.json();
      const data: PlatformSettings = json.data || json;

      setGeneral(data.general || DEFAULT_GENERAL_SETTINGS);
      setSite(data.site || DEFAULT_SITE_SETTINGS);
      setUsers(data.users || DEFAULT_USER_SETTINGS);
      setAds(data.ads || DEFAULT_ADS_SETTINGS);
      setFeatures(data.features || DEFAULT_FEATURES_SETTINGS);
      setSavedSettings(data);
    } catch (err: unknown) {
      console.error("[AdminSettingsPage] Error fetching settings:", err);
      showToast("Error loading platform settings");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Check if current active section has unsaved edits
  const isSectionDirty = (section: SettingsSection): boolean => {
    if (!savedSettings) return false;
    if (section === "general") {
      return JSON.stringify(general) !== JSON.stringify(savedSettings.general);
    }
    if (section === "site") {
      return JSON.stringify(site) !== JSON.stringify(savedSettings.site);
    }
    if (section === "users") {
      return JSON.stringify(users) !== JSON.stringify(savedSettings.users);
    }
    if (section === "ads") {
      return JSON.stringify(ads) !== JSON.stringify(savedSettings.ads);
    }
    if (section === "features") {
      return JSON.stringify(features) !== JSON.stringify(savedSettings.features);
    }
    return false;
  };

  const currentTabDirty = isSectionDirty(activeTab);

  // Save current active section
  const handleSaveSection = async (section: SettingsSection) => {
    if (!isAdmin) {
      showToast("Administrator privileges required to modify settings");
      return;
    }

    setIsSaving(true);
    try {
      let values: Record<string, unknown> = {};
      if (section === "general") values = general as any;
      if (section === "site") values = site as any;
      if (section === "users") values = users as any;
      if (section === "ads") values = ads as any;
      if (section === "features") values = features as any;

      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, values }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || `Failed to update ${section} settings`);
      }

      showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully!`);
      // Update saved reference
      setSavedSettings((prev) => (prev ? { ...prev, [section]: json.data?.values || values } : null));
    } catch (err: unknown) {
      console.error(`[AdminSettingsPage] Error saving ${section}:`, err);
      showToast(err instanceof Error ? err.message : "Error saving settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />
      <Toast message={toastMessage} />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[960px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <span>Settings</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Persistent DB
              </span>
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              Site-wide configuration, access policies, and platform features.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isAdmin && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 text-amber-700 text-xs font-semibold border border-amber-500/30">
                <Shield size={13} />
                Editor (Read Only)
              </span>
            )}
            <button
              type="button"
              disabled={isSaving || !currentTabDirty || !isAdmin}
              onClick={() => handleSaveSection(activeTab)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {currentTabDirty ? "Save Changes" : "Saved"}
            </button>
          </div>
        </div>

        {/* Maintenance Mode Alert Banner if active */}
        {general.maintenanceMode && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-4 mb-6 flex items-start gap-3">
            <Wrench className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-amber-800">Maintenance Mode is Active</p>
              <p className="text-xs text-amber-700 mt-0.5">
                All public visitors are being redirected to <code>/maintenance</code>. The admin console
                remains accessible for administrators.
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto">
          {tabs.map((tab) => {
            const dirty = isSectionDirty(tab.key);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-current={activeTab === tab.key}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-text-muted hover:text-text"
                }`}
              >
                <span>{tab.label}</span>
                {dirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Unsaved changes" />}
              </button>
            );
          })}
        </div>

        {/* Settings Container */}
        <div className="bg-surface border border-border rounded-lg shadow-sm px-6 sm:px-8 divide-y divide-border">
          {isLoading ? (
            <div className="py-16 text-center text-text-muted animate-pulse">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-xs">Loading platform configuration...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: GENERAL */}
              {activeTab === "general" && (
                <>
                  <Row label="Site Name" description="Primary branding used in titles and notifications.">
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={general.siteName}
                      onChange={(e) => setGeneral({ ...general, siteName: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </Row>
                  <Row label="Site Tagline" description="Shown in the browser tab and share previews.">
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={general.siteTagline}
                      onChange={(e) => setGeneral({ ...general, siteTagline: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </Row>
                  <Row label="Default Language" description="Platform localization fallback.">
                    <select
                      disabled={!isAdmin}
                      value={general.defaultLanguage}
                      onChange={(e) => setGeneral({ ...general, defaultLanguage: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="English">English</option>
                      <option value="Indonesian">Indonesian</option>
                      <option value="Spanish">Spanish</option>
                    </select>
                  </Row>
                  <Row label="Timezone" description="Used for scheduling releases and reports.">
                    <select
                      disabled={!isAdmin}
                      value={general.timezone}
                      onChange={(e) => setGeneral({ ...general, timezone: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="UTC">UTC</option>
                      <option value="WIB (UTC+7)">WIB (UTC+7)</option>
                      <option value="Pacific (UTC-8)">Pacific (UTC-8)</option>
                    </select>
                  </Row>
                  <Row
                    label="Maintenance Mode"
                    description="Takes the public site offline and routes visitors to /maintenance while keeping the admin console accessible."
                  >
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={general.maintenanceMode}
                      onChange={(val) => {
                        if (val) {
                          setShowMaintModal(true);
                        } else {
                          setGeneral({ ...general, maintenanceMode: false });
                        }
                      }}
                    />
                  </Row>
                </>
              )}

              {/* TAB 2: SITE */}
              {activeTab === "site" && (
                <>
                  <Row
                    label="Trending Period"
                    description="How often the Trending page's ranking calculation resets."
                  >
                    <select
                      disabled={!isAdmin}
                      value={site.trendingPeriod}
                      onChange={(e) => setSite({ ...site, trendingPeriod: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="Daily">Daily</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </Row>
                  <Row
                    label="Related Titles Source"
                    description="Algorithm for choosing recommendations on drama detail pages."
                  >
                    <select
                      disabled={!isAdmin}
                      value={site.relatedTitlesSource}
                      onChange={(e) => setSite({ ...site, relatedTitlesSource: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="Genre / Tags / Channel">Genre / Tags / Channel</option>
                      <option value="User Watch History">User Watch History</option>
                    </select>
                  </Row>
                  <Row
                    label="History Retention Window (Days)"
                    description="Days of playback history shown on user account history page."
                  >
                    <input
                      type="number"
                      min={1}
                      disabled={!isAdmin}
                      value={site.historyRetentionDays}
                      onChange={(e) => setSite({ ...site, historyRetentionDays: Number(e.target.value) })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </Row>
                  <Row
                    label="New Release Max Display"
                    description="Maximum titles shown per page on New Release and Discovery pages."
                  >
                    <input
                      type="number"
                      min={1}
                      max={100}
                      disabled={!isAdmin}
                      value={site.newReleaseMaxDisplay}
                      onChange={(e) => setSite({ ...site, newReleaseMaxDisplay: Number(e.target.value) })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </Row>
                  <Row
                    label="Show Continue Watching"
                    description="Toggles the continue watching carousel on the home page."
                  >
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={site.showContinueWatching}
                      onChange={(val) => setSite({ ...site, showContinueWatching: val })}
                    />
                  </Row>
                  <Row
                    label="Show Top Trending"
                    description="Toggles the top trending banner on the home page."
                  >
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={site.showTopTrending}
                      onChange={(val) => setSite({ ...site, showTopTrending: val })}
                    />
                  </Row>
                </>
              )}

              {/* TAB 3: USERS */}
              {activeTab === "users" && (
                <>
                  <Row
                    label="Default Plan for New Users"
                    description="Account tier assigned upon user registration."
                  >
                    <select
                      disabled={!isAdmin}
                      value={users.defaultPlan}
                      onChange={(e) => setUsers({ ...users, defaultPlan: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="Free">Free</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </Row>
                  <Row
                    label="User Signup Enabled"
                    description="Allow new user registrations. When disabled, public signups are halted."
                  >
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={users.signupEnabled}
                      onChange={(val) => setUsers({ ...users, signupEnabled: val })}
                    />
                  </Row>
                  <Row
                    label="Default Free Episodes"
                    description="Default number of free episodes available to users before coin gates (Phase 8)."
                  >
                    <input
                      type="number"
                      min={0}
                      disabled={!isAdmin}
                      value={users.defaultFreeEpisodes}
                      onChange={(e) => setUsers({ ...users, defaultFreeEpisodes: Number(e.target.value) })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </Row>
                  <Row
                    label="Require Email Verification"
                    description="Users must verify their email address before accessing streaming playback."
                  >
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={users.requireEmailVerification}
                      onChange={(val) => setUsers({ ...users, requireEmailVerification: val })}
                    />
                  </Row>
                  <Row label="Allow Google Login" description="Enables Google OAuth authentication on sign-in pages.">
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={users.allowGoogleLogin}
                      onChange={(val) => setUsers({ ...users, allowGoogleLogin: val })}
                    />
                  </Row>
                  <Row
                    label="Allow Telegram Login"
                    description="Enables Telegram widget and Mini App authentication."
                  >
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={users.allowTelegramLogin}
                      onChange={(val) => setUsers({ ...users, allowTelegramLogin: val })}
                    />
                  </Row>
                  <Row
                    label="Account Deletion Grace Period (Days)"
                    description="Days before a deleted account is purged from the database (GDPR right to erasure)."
                  >
                    <input
                      type="number"
                      min={0}
                      disabled={!isAdmin}
                      value={users.deletionGracePeriodDays}
                      onChange={(e) =>
                        setUsers({ ...users, deletionGracePeriodDays: Number(e.target.value) })
                      }
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </Row>
                </>
              )}

              {/* TAB 4: ADS */}
              {activeTab === "ads" && (
                <>
                  <Row label="Enable Ads" description="Master switch for advertising across the application.">
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={ads.enabled}
                      onChange={(val) => setAds({ ...ads, enabled: val })}
                    />
                  </Row>
                  <Row label="Ad Network" description="Integrated advertising partner.">
                    <select
                      disabled={!isAdmin}
                      value={ads.network}
                      onChange={(e) => setAds({ ...ads, network: e.target.value })}
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      <option value="None">None</option>
                      <option value="Google AdSense">Google AdSense</option>
                      <option value="Custom Network">Custom Network</option>
                    </select>
                  </Row>
                  <Row label="Show Ads on Home Page" description="Displays banner ads in discovery feeds.">
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={ads.showOnHome}
                      onChange={(val) => setAds({ ...ads, showOnHome: val })}
                    />
                  </Row>
                  <Row label="Show Ads on Watch Page" description="Displays mid-roll or post-roll video ad breaks.">
                    <ToggleControl
                      disabled={!isAdmin}
                      checked={ads.showOnWatch}
                      onChange={(val) => setAds({ ...ads, showOnWatch: val })}
                    />
                  </Row>
                  <Row
                    label="Ad Frequency"
                    description="Frequency rule for ad break insertion (e.g. Every 3 episodes)."
                  >
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={ads.frequency}
                      onChange={(e) => setAds({ ...ads, frequency: e.target.value })}
                      placeholder="Every 3 episodes"
                      className="w-full sm:w-64 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </Row>
                </>
              )}

              {/* TAB 5: FEATURE FLAGS */}
              {activeTab === "features" && (
                <>
                  <div className="py-3">
                    <p className="text-xs text-text-muted flex items-center gap-1.5 mb-2">
                      <Sparkles size={14} className="text-primary" />
                      Dynamic feature toggles controlling client and server runtime capabilities (Task 15.5).
                    </p>
                  </div>
                  {Object.entries(features).map(([flagKey, flagValue]) => (
                    <Row
                      key={flagKey}
                      label={flagKey}
                      description={`Runtime feature flag "${flagKey}". Toggles behavior without code deployments.`}
                    >
                      <ToggleControl
                        disabled={!isAdmin}
                        checked={flagValue}
                        onChange={(val) => setFeatures({ ...features, [flagKey]: val })}
                      />
                    </Row>
                  ))}
                </>
              )}
            </>
          )}
        </div>

        {/* Maintenance Confirmation Modal */}
        <Modal
          open={showMaintModal}
          onClose={() => setShowMaintModal(false)}
          title="Enable Platform Maintenance Mode?"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800">
              <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Public Site Interruption Notice</p>
                <p>
                  Enabling Maintenance Mode will immediately redirect all public users to the holding
                  page at <code>/maintenance</code>. Ongoing playback sessions will pause.
                </p>
                <p className="mt-1 font-semibold">
                  The admin console (/admin) and administrative APIs will remain fully reachable.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowMaintModal(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded border border-border bg-surface text-text hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeneral({ ...general, maintenanceMode: true });
                  setShowMaintModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center gap-1.5"
              >
                <Wrench size={13} />
                Confirm & Enable
              </button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
