"use client";

import { useState, type ReactNode } from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";

const tabs = [
  { key: "general", label: "General" },
  { key: "site", label: "Site" },
  { key: "users", label: "Users" },
  { key: "ads", label: "Ads" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="pr-4">
        <p className="text-sm font-semibold text-text">{label}</p>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleControl({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <button
      type="button"
      onClick={() => setChecked((v) => !v)}
      aria-pressed={checked}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function TextControl({ defaultValue, placeholder }: { defaultValue?: string; placeholder?: string }) {
  return (
    <input
      type="text"
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-56 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
    />
  );
}

function SelectControl({ defaultValue, options }: { defaultValue?: string; options: string[] }) {
  return (
    <select
      defaultValue={defaultValue}
      className="w-56 rounded-md border border-border bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[900px]">
        <h1 className="font-display font-bold text-2xl mb-1">Settings</h1>
        <p className="text-sm text-text-muted mb-6">
          Site-wide configuration.
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-current={activeTab === tab.key}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-surface border border-border rounded-lg shadow-sm px-6 sm:px-8 divide-y divide-border">
          {activeTab === "general" && (
            <>
              <Row label="Site Name">
                <TextControl defaultValue="DramaShort" />
              </Row>
              <Row label="Site Tagline" description="Shown in the browser tab and share previews.">
                <TextControl defaultValue="Vertical dramas for a 12-minute break" />
              </Row>
              <Row label="Default Language">
                <SelectControl defaultValue="English" options={["English", "Indonesian", "Spanish"]} />
              </Row>
              <Row label="Timezone" description="Used for scheduling releases and reports.">
                <SelectControl defaultValue="UTC" options={["UTC", "WIB (UTC+7)", "Pacific (UTC-8)"]} />
              </Row>
              <Row label="Maintenance Mode" description="Takes the public site offline for everyone but admins.">
                <ToggleControl />
              </Row>
            </>
          )}

          {activeTab === "site" && (
            <>
              <Row label="Trending Period" description="How often the Trending page's ranking window resets.">
                <SelectControl defaultValue="Weekly" options={["Daily", "Weekly", "Monthly"]} />
              </Row>
              <Row label="Related Titles Source" description="How 'Related Titles' on a drama page are chosen. Switches to real user watch history once that data exists.">
                <SelectControl defaultValue="Genre / Tags / Channel" options={["Genre / Tags / Channel", "User Watch History"]} />
              </Row>
              <Row label="History Retention Window" description="Days of watch history shown on a user's History page.">
                <TextControl defaultValue="60" />
              </Row>
              <Row label="New Release Max Display" description="Titles shown per page on New Release and Genres.">
                <TextControl defaultValue="24" />
              </Row>
              <Row label="Show Continue Watching" description="Toggles the section on the home page.">
                <ToggleControl defaultChecked />
              </Row>
              <Row label="Show Top Trending" description="Toggles the section on the home page.">
                <ToggleControl defaultChecked />
              </Row>
            </>
          )}

          {activeTab === "users" && (
            <>
              <Row label="Default Plan for New Users">
                <SelectControl defaultValue="Free" options={["Free", "VIP"]} />
              </Row>
              <Row label="Require Email Verification" description="Users must verify before watching.">
                <ToggleControl defaultChecked />
              </Row>
              <Row label="Allow Google Login">
                <ToggleControl defaultChecked />
              </Row>
              <Row label="Allow Telegram Login">
                <ToggleControl defaultChecked />
              </Row>
              <Row label="Account Deletion Grace Period" description="Days before a deleted account is permanently removed.">
                <TextControl defaultValue="14" />
              </Row>
            </>
          )}

          {activeTab === "ads" && (
            <>
              <Row label="Enable Ads">
                <ToggleControl />
              </Row>
              <Row label="Ad Network">
                <SelectControl defaultValue="None" options={["None", "Google AdSense", "Custom Network"]} />
              </Row>
              <Row label="Show Ads on Home Page">
                <ToggleControl />
              </Row>
              <Row label="Show Ads on Watch Page">
                <ToggleControl />
              </Row>
              <Row label="Ad Frequency" description="e.g. how often an ad break appears during playback.">
                <TextControl placeholder="Every 3 episodes" />
              </Row>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
