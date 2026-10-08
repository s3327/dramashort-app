"use client";

import { useEffect, useRef, useId, type ReactNode } from "react";
import { X } from "lucide-react";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

const FOCUSABLE_SELECTORS = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * Accessible Modal Dialog Component (Task 14.9).
 * Implements WCAG 2.1 AA focus trap, Escape key handling, focus restoration,
 * background scroll locking, and ARIA dialog semantics.
 */
export default function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    // 1. Capture current focused element for post-close focus restoration
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      previousActiveElementRef.current = document.activeElement;
    }

    // 2. Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 3. Move initial focus into modal
    const dialog = dialogRef.current;
    if (dialog) {
      const autofocusEl = dialog.querySelector<HTMLElement>("[autofocus]");
      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      );

      if (autofocusEl && focusableElements.includes(autofocusEl)) {
        autofocusEl.focus();
      } else if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        dialog.focus();
      }
    }

    // 4. Keyboard trap (Tab / Shift+Tab) and Escape key listener
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        if (!dialog) return;
        const focusableElements = Array.from(
          dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
        );

        if (focusableElements.length === 0) {
          e.preventDefault();
          dialog.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === dialog) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);

      // Restore focus to opener element
      if (
        previousActiveElementRef.current &&
        typeof previousActiveElementRef.current.focus === "function"
      ) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="region"
      aria-label={title ? `${title} overlay` : "Modal overlay"}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className="relative w-full max-w-sm bg-surface border border-border rounded-lg shadow-lg p-6 focus:outline-none"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-3 right-3 p-1.5 rounded-full text-text-muted hover:text-text hover:bg-surface transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
        {title && (
          <h2 id={titleId} className="font-display font-bold text-lg mb-4 pr-6">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
