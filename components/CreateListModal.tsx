"use client";

import { useState } from "react";
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createList(trimmed);
    setTitle("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Create List">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="listTitle" className="block text-sm font-semibold mb-1.5">
            List Title
          </label>
          <input
            id="listTitle"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Weekend Binge"
            autoFocus
            className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm py-2.5 shadow-sm transition-colors"
        >
          Save List
        </button>
      </form>
    </Modal>
  );
}
