"use client";

import Modal from "@/components/Modal";
import { useFavorites } from "@/contexts/FavoritesContext";

export default function AddToListModal({
  open,
  onClose,
  slug,
  onRequestCreateList,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  onRequestCreateList: () => void;
  onAdded?: (listTitle: string) => void;
}) {
  const { lists, addToList } = useFavorites();

  return (
    <Modal open={open} onClose={onClose} title={lists.length > 0 ? "Add to List" : undefined}>
      {lists.length === 0 ? (
        <div className="text-center">
          <p className="text-sm text-text-muted mb-5">
            You haven&apos;t created any lists yet.
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border text-text hover:bg-surface font-semibold text-sm px-4 py-2 transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onRequestCreateList();
              }}
              className="rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm px-4 py-2 shadow-sm transition-colors"
            >
              Create List
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
            >
              <div>
                <p className="text-sm font-semibold text-text">{list.title}</p>
                <p className="text-xs text-text-muted">
                  {list.itemSlugs.length} title{list.itemSlugs.length === 1 ? "" : "s"} added
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  addToList(list.id, slug);
                  onClose();
                  onAdded?.(list.title);
                }}
                className="shrink-0 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-xs px-3.5 py-2 shadow-sm transition-colors"
              >
                Add to this list
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
