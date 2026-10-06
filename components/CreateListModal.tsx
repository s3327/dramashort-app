"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import Modal from "@/components/Modal";
import { useFavorites } from "@/contexts/FavoritesContext";

export default function CreateListModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { createList } = useFavorites();
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    setTitle("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const listId = await createList(trimmed);
      if (listId) {
        setTitle("");
        onClose();
      } else {
        setError("Failed to create list. Please try again.");
      }
    } catch {
      setError("An unexpected error occurred while creating the list.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Create List">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-danger-soft p-3 text-xs font-medium text-danger border border-danger-light">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label htmlFor="listTitle" className="block text-sm font-semibold mb-1.5">
            List Title
          </label>
          <input
            id="listTitle"
            type="text"
            required
            disabled={isSubmitting}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekend Binge"
            autoFocus
            className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !title.trim()}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors disabled:opacity-50"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? "Creating list..." : "Save List"}
        </button>
      </form>
    </Modal>
  );
}
