"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  AlertTriangle,
  Sun,
  Sunset,
  Moon,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { useTheme, type SiteTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";

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
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, deleteAccount } = useAuth();
  const { message: toastMessage, show: showToast } = useToast(3000);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasPasswordProvider =
    user?.app_metadata?.provider === "email" ||
    user?.identities?.some((id) => id.provider === "email");

  const handleOpenDeleteModal = () => {
    setDeleteConfirmationText("");
    setDeletePassword("");
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    if (isDeleting) return;
    setIsDeleteModalOpen(false);
    setDeleteConfirmationText("");
    setDeletePassword("");
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmationText !== "DELETE") {
      setDeleteError("You must type DELETE in all uppercase to confirm.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    const res = await deleteAccount(
      deleteConfirmationText,
      deletePassword || undefined
    );
    setIsDeleting(false);

    if (res.error) {
      setDeleteError(res.error);
      return;
    }

    setIsDeleteModalOpen(false);
    showToast("Your account has been permanently deleted.");

    setTimeout(() => {
      router.push("/login?deleted=true");
    }, 1200);
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />
      <Toast
        message={toastMessage}
        icon={<CheckCircle2 size={16} className="text-emerald-400" />}
      />

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
                onClick={handleOpenDeleteModal}
                className="rounded-full border border-danger-light text-danger hover:bg-danger-soft font-semibold text-sm px-4 py-2 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </main>
        </div>
      </div>

      <Modal open={isDeleteModalOpen} onClose={handleCloseDeleteModal}>
        <div className="text-left max-w-md">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertTriangle size={20} strokeWidth={2.5} />
          </div>
          <h2 className="font-display font-bold text-xl text-center mb-1.5">
            Delete your account?
          </h2>
          <p className="text-xs text-text-muted text-center mb-5 leading-relaxed">
            This action is permanent and cannot be undone. In accordance with GDPR
            Right to Erasure, your profile, favorites, custom lists, and watch
            history will be immediately erased.
          </p>

          {deleteError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{deleteError}</span>
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label
                htmlFor="confirm-delete-input"
                className="block text-xs font-semibold text-text mb-1.5"
              >
                Type <span className="font-bold text-danger">DELETE</span> to confirm:
              </label>
              <input
                id="confirm-delete-input"
                type="text"
                autoComplete="off"
                value={deleteConfirmationText}
                onChange={(e) => {
                  setDeleteConfirmationText(e.target.value);
                  setDeleteError(null);
                }}
                placeholder="DELETE"
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-danger/50 focus:border-danger transition-colors font-mono"
              />
            </div>

            {hasPasswordProvider && (
              <div>
                <label
                  htmlFor="delete-password-input"
                  className="block text-xs font-semibold text-text mb-1.5"
                >
                  Password confirmation (optional if recently logged in):
                </label>
                <div className="relative">
                  <input
                    id="delete-password-input"
                    type={showDeletePassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={(e) => {
                      setDeletePassword(e.target.value);
                      setDeleteError(null);
                    }}
                    placeholder="Enter your password"
                    className="w-full rounded-md border border-border bg-bg px-3.5 py-2 pr-10 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-danger/50 focus:border-danger transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeletePassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                    aria-label={
                      showDeletePassword ? "Hide password" : "Show password"
                    }
                  >
                    {showDeletePassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleCloseDeleteModal}
              disabled={isDeleting}
              className="rounded-full border border-border text-text hover:bg-surface font-semibold text-xs px-4 py-2 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleteConfirmationText !== "DELETE" || isDeleting}
              className="rounded-full bg-danger hover:bg-danger-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-light font-semibold text-xs px-4 py-2 shadow-sm transition-colors flex items-center gap-1.5"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Deleting Account...</span>
                </>
              ) : (
                "Permanently Delete"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
