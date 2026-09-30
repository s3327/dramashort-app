"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogIn } from "lucide-react";
import Modal from "@/components/Modal";

export default function LoginRequiredModal({
  open,
  onClose,
  message = "Log in to save this to your account.",
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  const pathname = usePathname();

  return (
    <Modal open={open} onClose={onClose}>
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LogIn size={20} strokeWidth={2} />
        </div>
        <h2 className="font-display font-bold text-lg mb-1.5">Log in required</h2>
        <p className="text-sm text-text-muted mb-6">{message}</p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border text-text hover:bg-surface font-semibold text-sm px-4 py-2 transition-colors"
          >
            Cancel
          </button>
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname)}`}
            className="rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm px-4 py-2 shadow-sm transition-colors"
          >
            Log In
          </Link>
        </div>
      </div>
    </Modal>
  );
}
