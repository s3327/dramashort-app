"use client";

import { useEffect, useState } from "react";
import { Pencil, Check, X, Send, Eye, EyeOff, Lock, Loader2, Mail } from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import OtpInput from "@/components/OtpInput";
import { accountUser as fallbackAccountUser } from "@/data/account-user.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountPage() {
  const { theme } = useTheme();
  const {
    user,
    profile,
    updateDisplayName,
    changePassword,
    requestEmailChange,
    verifyEmailChange,
  } = useAuth();

  const currentName = profile?.display_name || user?.user_metadata?.full_name || fallbackAccountUser.name;
  const currentEmail = user?.email || fallbackAccountUser.email;
  const initials = currentName
    .split(" ")
    .map((w: string) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";

  // Generic profile edit (display name)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayName, setDisplayName] = useState(currentName);

  useEffect(() => {
    if (currentName) {
      setDisplayName(currentName);
    }
  }, [currentName]);

  // Email has its own "special handling"
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const { message: emailToastMessage, show: showEmailToast } = useToast();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleEditToggle = async () => {
    if (isEditingProfile) {
      if (displayName.trim() && displayName !== currentName) {
        await updateDisplayName(displayName.trim());
      }
      setIsEditingProfile(false);
    } else {
      setIsEditingProfile(true);
    }
  };

  const handleCancelEdit = () => {
    setDisplayName(currentName);
    setIsEditingProfile(false);
  };

  const openEmailEdit = () => {
    setNewEmail("");
    setEmailCodeSent(false);
    setEmailError("");
    setOtpCode("");
    setOtpError("");
    setIsEditingEmail(true);
  };

  const closeEmailEdit = () => {
    setIsEditingEmail(false);
    setEmailCodeSent(false);
    setNewEmail("");
    setOtpCode("");
    setEmailError("");
    setOtpError("");
  };

  const handleSendEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      setEmailError("Please enter a new email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (trimmed === currentEmail?.toLowerCase()) {
      setEmailError("New email address must be different from your current email.");
      return;
    }

    setIsSendingEmailCode(true);
    const res = await requestEmailChange(trimmed);
    setIsSendingEmailCode(false);

    if (res.error) {
      setEmailError(res.error);
    } else {
      setEmailCodeSent(true);
      setResendCooldown(60);
      setOtpCode("");
      setOtpError("");
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isSendingEmailCode) return;
    setEmailError("");
    setOtpError("");
    setIsSendingEmailCode(true);
    const res = await requestEmailChange(newEmail.trim().toLowerCase());
    setIsSendingEmailCode(false);

    if (res.error) {
      setOtpError(res.error);
    } else {
      setResendCooldown(60);
      showEmailToast("Verification code resent");
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setOtpError("");

    if (otpCode.length < 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    const res = await verifyEmailChange(newEmail.trim().toLowerCase(), otpCode);
    setIsVerifyingOtp(false);

    if (res.error) {
      setOtpError(res.error);
    } else {
      closeEmailEdit();
      showEmailToast("Email updated successfully");
    }
  };

  // Password change gets its own modal, separate from the inline edit
  // flows above — current + new + confirm, same "double check" pattern
  // used on Sign Up.
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const { message: passwordToastMessage, show: showPasswordToast } = useToast();

  const openPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setPasswordError("");
    setIsPasswordModalOpen(true);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from your current password.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }

    setIsSubmittingPassword(true);
    const res = await changePassword(newPassword, currentPassword);
    setIsSubmittingPassword(false);

    if (res.error) {
      setPasswordError(res.error);
    } else {
      setIsPasswordModalOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      showPasswordToast("Password updated successfully");
    }
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      {/* pt-10 keeps the sidebar/content box away from the header instead
          of sitting flush underneath it. */}
      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <AccountSidebar />

          <main className="w-full flex-1 space-y-6">
            {/* Profile card */}
            <div className="bg-surface border border-border rounded-lg shadow-sm p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-display font-bold text-xl">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold text-text">{currentName}</p>
                    <p className="text-sm text-text-muted">{currentEmail}</p>
                  </div>
                </div>

                {/* Edit Account / Save Changes — top right, aligned with the avatar row */}
                {isEditingProfile ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      aria-label="Cancel"
                      className="flex items-center gap-1.5 rounded-full border border-border text-text-muted hover:text-text hover:bg-surface font-semibold text-sm px-3.5 py-2 transition-colors"
                    >
                      <X size={15} strokeWidth={2.5} />
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleEditToggle}
                      className="flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm px-3.5 py-2 shadow-sm transition-colors"
                    >
                      <Check size={15} strokeWidth={2.5} />
                      Save Changes
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleEditToggle}
                    className="flex items-center gap-1.5 rounded-full border border-border text-text hover:bg-surface font-semibold text-sm px-3.5 py-2 transition-colors shrink-0"
                  >
                    <Pencil size={14} strokeWidth={2.5} />
                    Edit Account
                  </button>
                )}
              </div>

              <div className="space-y-4 max-w-md">
                <div>
                  <label
                    htmlFor="displayName"
                    className="block text-sm font-semibold mb-1.5"
                  >
                    Display Name
                  </label>
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!isEditingProfile}
                    className="w-full rounded-md border border-border px-3.5 py-2.5 text-sm text-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:bg-surface disabled:text-text-muted disabled:cursor-not-allowed bg-bg"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="email" className="block text-sm font-semibold">
                      Email
                    </label>
                    {!isEditingEmail && (
                      <button
                        type="button"
                        onClick={openEmailEdit}
                        className="text-xs font-semibold text-link hover:text-link-hover transition-colors"
                      >
                        Edit Email
                      </button>
                    )}
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={currentEmail}
                    disabled
                    readOnly
                    className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text-muted cursor-not-allowed"
                  />

                  {/* Email changes get their own flow — separate from the
                      generic profile edit above. */}
                  {isEditingEmail && (
                    <div className="mt-3 rounded-md border border-dashed border-border p-4 bg-bg">
                      {!emailCodeSent ? (
                        <form onSubmit={handleSendEmailCode} className="space-y-3">
                          {emailError && (
                            <div className="rounded-md bg-danger/10 border border-danger/30 p-2.5 text-xs text-danger font-medium">
                              {emailError}
                            </div>
                          )}
                          <div>
                            <label
                              htmlFor="newEmail"
                              className="block text-xs font-semibold mb-1.5 text-text-muted"
                            >
                              New email address
                            </label>
                            <input
                              id="newEmail"
                              type="email"
                              required
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="new-email@example.com"
                              className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="submit"
                              disabled={isSendingEmailCode}
                              className="rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-xs px-4 py-2 shadow-sm transition-colors flex items-center gap-1.5"
                            >
                              {isSendingEmailCode ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Sending code...</span>
                                </>
                              ) : (
                                "Send Verification Code"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={closeEmailEdit}
                              className="text-xs font-semibold text-text-muted hover:text-text transition-colors px-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-start gap-2 text-xs text-text-muted">
                            <Mail size={15} className="text-primary shrink-0 mt-0.5" />
                            <p>
                              A 6-digit confirmation code was sent to{" "}
                              <span className="font-semibold text-text">{newEmail}</span>. Enter it below to confirm your new email.
                            </p>
                          </div>

                          {otpError && (
                            <div className="rounded-md bg-danger/10 border border-danger/30 p-2.5 text-xs text-danger font-medium">
                              {otpError}
                            </div>
                          )}

                          <div className="max-w-[320px] py-1">
                            <OtpInput
                              length={6}
                              onChange={(val) => {
                                setOtpCode(val);
                                if (otpError) setOtpError("");
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-3 pt-1 flex-wrap">
                            <button
                              type="button"
                              disabled={isVerifyingOtp || otpCode.length < 6}
                              onClick={() => handleVerifyOtp()}
                              className="rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-xs px-5 py-2 shadow-sm transition-colors flex items-center gap-1.5"
                            >
                              {isVerifyingOtp ? (
                                <>
                                  <Loader2 size={13} className="animate-spin" />
                                  <span>Verifying...</span>
                                </>
                              ) : (
                                "Confirm & Update Email"
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={resendCooldown > 0 || isSendingEmailCode}
                              onClick={handleResendOtp}
                              className="text-xs font-semibold text-primary hover:underline disabled:text-text-muted disabled:no-underline transition-colors"
                            >
                              {resendCooldown > 0
                                ? `Resend code (${resendCooldown}s)`
                                : isSendingEmailCode
                                ? "Resending..."
                                : "Resend code"}
                            </button>

                            <button
                              type="button"
                              onClick={closeEmailEdit}
                              className="text-xs font-semibold text-text-muted hover:text-text transition-colors ml-auto"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-semibold">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={openPasswordModal}
                      className="text-xs font-semibold text-link hover:text-link-hover transition-colors"
                    >
                      Change Password
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value="••••••••••"
                    disabled
                    readOnly
                    className="w-full rounded-md border border-border bg-surface px-3.5 py-2.5 text-sm text-text-muted cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Connected accounts card */}
            <div className="bg-surface border border-border rounded-lg shadow-sm p-6 sm:p-8">
              <h2 className="font-display font-bold text-lg mb-1">
                Connected Accounts
              </h2>
              <p className="text-sm text-text-muted mb-5">
                Link other ways to sign in — this is optional.
              </p>

              <div className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#229ED9]/10 text-[#229ED9]">
                    <TelegramIcon />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text">Telegram</p>
                    <p className="text-xs text-text-muted">
                      Not connected · sign in from our Telegram bot too
                    </p>
                  </div>
                </div>
                {/* UI only — this will become the account-linking gateway
                    between the public site and Telegram users once wired up. */}
                <button
                  type="button"
                  className="flex items-center gap-1.5 shrink-0 rounded-full border border-[#229ED9] text-[#229ED9] hover:bg-[#229ED9]/10 font-semibold text-sm px-4 py-2 transition-colors"
                >
                  <Send size={14} strokeWidth={2.5} />
                  Connect Telegram
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>

      <Modal
        open={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Password"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <PasswordField
            id="currentPassword"
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrentPassword}
            onToggleShow={() => setShowCurrentPassword((v) => !v)}
            autoComplete="current-password"
          />
          <PasswordField
            id="newPassword"
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNewPassword}
            onToggleShow={() => setShowNewPassword((v) => !v)}
            autoComplete="new-password"
          />
          <PasswordField
            id="confirmNewPassword"
            label="Confirm New Password"
            value={confirmNewPassword}
            onChange={setConfirmNewPassword}
            show={showConfirmNewPassword}
            onToggleShow={() => setShowConfirmNewPassword((v) => !v)}
            autoComplete="new-password"
          />
          {passwordError && (
            <p className="text-xs font-semibold text-danger">{passwordError}</p>
          )}
          <button
            type="submit"
            disabled={isSubmittingPassword}
            className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors flex items-center justify-center gap-2"
          >
            {isSubmittingPassword ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Updating password...</span>
              </>
            ) : (
              "Save Password"
            )}
          </button>
        </form>
      </Modal>

      <Toast
        message={passwordToastMessage || emailToastMessage}
        icon={
          passwordToastMessage ? (
            <Lock size={14} strokeWidth={2} />
          ) : (
            <Check size={14} strokeWidth={2} />
          )
        }
      />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
        />
        <button
          type="button"
          onClick={onToggleShow}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-text-muted hover:text-text transition-colors"
        >
          {show ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}

function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 240 240" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M120 0C53.7 0 0 53.7 0 120s53.7 120 120 120 120-53.7 120-120S186.3 0 120 0zm55.6 82.1-18.9 89.2c-1.4 6.4-5.2 8-10.5 5l-29-21.4-14 13.5c-1.6 1.6-2.9 2.9-5.9 2.9l2.1-29.9 54.4-49.2c2.4-2.1-.5-3.3-3.6-1.2l-67.2 42.3-29-9.1c-6.3-2-6.4-6.3 1.3-9.3l113.4-43.7c5.2-1.9 9.8 1.3 7 21.9z"
      />
    </svg>
  );
}
