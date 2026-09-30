"use client";

import { useState } from "react";
import { Check, AlertTriangle, Sun, Sunset, Moon } from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import Modal from "@/components/Modal";
import { useTheme, type SiteTheme } from "@/contexts/ThemeContext";

type ThemeOption = {
  value: SiteTheme;
  label: string;
  Icon: typeof Sun;
  swatchBg: string;
  swatchIcon: string;
};

// Matches the three data-theme values tokens.css supports.
const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light", Icon: Sun, swatchBg: "#FFFFFF", swatchIcon: "#1A1A1A" },
  { value: "soft", label: "Soft", Icon: Sunset, swatchBg: "#F3E7EA", swatchIcon: "#3A2330" },
  { value: "dark", label: "Dark", Icon: Moon, swatchBg: "#1C1220", swatchIcon: "#FFF7FA" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleConfirmDelete = () => {
    // TODO: call the real account-deletion API once it exists.
    setIsDeleteModalOpen(false);
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <AccountSidebar />

          <main className="w-full flex-1 space-y-6">
            {/* Theme */}
            <div className="bg-surface border border-border rounded-lg shadow-sm p-6 sm:p-8">
              <h1 className="font-display font-bold text-xl sm:text-2xl mb-1">Settings</h1>
              <p className="text-sm text-text-muted mb-6">
                Choose how DramaShort looks.
              </p>

              <div className="grid grid-cols-3 gap-3 max-w-md">
                {themeOptions.map((option) => {
                  const active = option.value === theme;
                  const ThemeIcon = option.Icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setTheme(option.value)}
                      aria-pressed={active}
                      className={`relative rounded-lg border p-2 transition-colors ${
                        active ? "border-primary" : "border-border hover:border-text-muted"
                      }`}
                    >
                      <div
                        className="h-12 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: option.swatchBg }}
                      >
                        <ThemeIcon size={18} strokeWidth={2} color={option.swatchIcon} />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-text">{option.label}</p>
                      {active && (
                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-text-light">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Danger zone */}
            <div className="bg-surface border border-danger-soft rounded-lg shadow-sm p-6 sm:p-8">
              <h2 className="font-display font-bold text-lg mb-1">Delete Account</h2>
              <p className="text-sm text-text-muted mb-5 max-w-md">
                Permanently delete your account and all associated data, including
                favorites, lists, and watch history. This can&apos;t be undone.
              </p>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="rounded-full border border-danger-light text-danger hover:bg-danger-soft font-semibold text-sm px-4 py-2 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </main>
        </div>
      </div>

      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
          <h2 className="font-display font-bold text-lg mb-1.5">Delete your account?</h2>
          <p className="text-sm text-text-muted mb-6">
            This is permanent. Your profile, favorites, lists, and watch history
            will all be deleted immediately and can&apos;t be recovered.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="rounded-full border border-border text-text hover:bg-surface font-semibold text-sm px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              className="rounded-full bg-danger hover:bg-danger-hover text-text-light font-semibold text-sm px-4 py-2 shadow-sm transition-colors"
            >
              Yes, Delete My Account
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
