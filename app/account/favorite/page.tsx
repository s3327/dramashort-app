"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ListPlus,
  FolderPlus,
  ArrowLeft,
  List,
  Heart,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
} from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import AddToListModal from "@/components/AddToListModal";
import CreateListModal from "@/components/CreateListModal";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import type { Title } from "@/types/content";
import { getTitlesBySlugs } from "@/lib/services/content.service";
import { useTheme } from "@/contexts/ThemeContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAuth } from "@/contexts/AuthContext";

export default function FavoritePage() {
  const { theme } = useTheme();
  const { user, profile } = useAuth();
  const {
    favoritedSlugs,
    lists,
    renameList,
    deleteList,
    removeFromList,
  } = useFavorites();
  const [view, setView] = useState<"favorites" | "myLists">("favorites");

  const { message: toastMessage, show: showToast } = useToast();
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [addToListTargetSlug, setAddToListTargetSlug] = useState<string | null>(null);

  // List management states
  const [editingList, setEditingList] = useState<{ id: string; title: string } | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [deletingList, setDeletingList] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [expandedListId, setExpandedListId] = useState<string | null>(null);
  const [expandedTitles, setExpandedTitles] = useState<Title[]>([]);
  const [isLoadingExpandedTitles, setIsLoadingExpandedTitles] = useState(false);

  const currentName =
    profile?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const currentEmail = user?.email || "";
  const initials =
    currentName
      .split(" ")
      .map((w: string) => w[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U";

  // Hydrate favorite titles from Content DB
  const [favoriteEntries, setFavoriteEntries] = useState<Title[]>([]);

  useEffect(() => {
    let isMounted = true;
    const slugs = Array.from(favoritedSlugs);
    if (slugs.length === 0) {
      setFavoriteEntries([]);
      return;
    }

    getTitlesBySlugs(slugs).then((dbTitles) => {
      if (!isMounted) return;
      setFavoriteEntries(dbTitles);
    });

    return () => {
      isMounted = false;
    };
  }, [favoritedSlugs]);

  // Load titles for expanded custom list
  const loadExpandedListTitles = useCallback(async (slugs: string[]) => {
    if (slugs.length === 0) {
      setExpandedTitles([]);
      return;
    }
    setIsLoadingExpandedTitles(true);
    try {
      const titles = await getTitlesBySlugs(slugs);
      setExpandedTitles(titles);
    } catch {
      setExpandedTitles([]);
    } finally {
      setIsLoadingExpandedTitles(false);
    }
  }, []);

  const handleToggleExpandList = (listId: string, itemSlugs: string[]) => {
    if (expandedListId === listId) {
      setExpandedListId(null);
      setExpandedTitles([]);
    } else {
      setExpandedListId(listId);
      loadExpandedListTitles(itemSlugs);
    }
  };

  const handleOpenRenameModal = (list: { id: string; title: string }) => {
    setEditingList(list);
    setEditTitleInput(list.title);
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList || !editTitleInput.trim() || isRenaming) return;

    setIsRenaming(true);
    try {
      const success = await renameList(editingList.id, editTitleInput.trim());
      if (success) {
        showToast("List renamed");
        setEditingList(null);
      } else {
        showToast("Failed to rename list. Please try again.");
      }
    } finally {
      setIsRenaming(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingList || isDeleting) return;

    setIsDeleting(true);
    try {
      const success = await deleteList(deletingList.id);
      if (success) {
        showToast("List deleted");
        if (expandedListId === deletingList.id) {
          setExpandedListId(null);
          setExpandedTitles([]);
        }
        setDeletingList(null);
      } else {
        showToast("Failed to delete list. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRemoveFromExpandedList = async (listId: string, slug: string) => {
    const success = await removeFromList(listId, slug);
    if (success) {
      showToast("Removed from list");
      setExpandedTitles((prev) => prev.filter((t) => t.slug !== slug));
    } else {
      showToast("Failed to remove title from list.");
    }
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <AccountSidebar />

          <main className="w-full flex-1 space-y-6">
            {/* Profile block */}
            <div className="bg-surface border border-border rounded-lg shadow-sm p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-display font-bold text-xl">
                    {initials}
                  </div>
                  <div>
                    <p className="font-semibold text-text">{currentName}</p>
                    <p className="text-sm text-text-muted">{currentEmail}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCreateListOpen(true)}
                    className="flex items-center gap-1.5 rounded-full border border-border text-text hover:bg-surface font-semibold text-sm px-3.5 py-2 transition-colors"
                  >
                    <FolderPlus size={15} strokeWidth={2.5} />
                    Create List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView((v) => (v === "favorites" ? "myLists" : "favorites"))}
                    className="flex items-center gap-1.5 rounded-full border border-border text-text hover:bg-surface font-semibold text-sm px-3.5 py-2 transition-colors"
                  >
                    <List size={15} strokeWidth={2.5} />
                    {view === "favorites" ? "My Lists" : "Favorites"}
                  </button>
                </div>
              </div>
            </div>

            {view === "favorites" ? (
              favoriteEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border bg-surface py-14 text-center">
                  <Heart size={22} strokeWidth={2} className="text-text-muted mb-1" />
                  <p className="text-sm font-semibold text-text">
                    You haven&apos;t favorited anything yet
                  </p>
                  <p className="text-xs text-text-muted max-w-xs">
                    Tap the heart on any title&apos;s page to add it here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3 sm:gap-4">
                  {favoriteEntries.map((item) => (
                    <Link
                      key={item.slug}
                      href={`/drama/${item.slug}`}
                      className="group relative block aspect-[2/3] rounded-md overflow-hidden bg-surface shadow-sm"
                    >
                      <Image
                        src={item.poster}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 22vw, (min-width: 640px) 24vw, 45vw"
                        className="object-cover"
                      />

                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/60 transition-colors">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAddToListTargetSlug(item.slug);
                          }}
                          className="flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-xs px-4 py-2 shadow-md opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap"
                        >
                          <ListPlus size={13} strokeWidth={2.5} />
                          Add to List
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              )
            ) : (
              <div className="bg-surface border border-border rounded-lg shadow-sm p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-display font-bold text-lg">My Custom Lists</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      Organize your favorite dramas into personalized collections.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setView("favorites")}
                    className="flex items-center gap-1.5 text-sm font-semibold text-link hover:text-link-hover transition-colors"
                  >
                    <ArrowLeft size={15} strokeWidth={2.5} />
                    Back to Favorites
                  </button>
                </div>

                {lists.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-text-muted mb-4">
                      You haven&apos;t created any lists yet.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCreateListOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm px-4 py-2 shadow-sm transition-colors"
                    >
                      <FolderPlus size={15} strokeWidth={2.5} />
                      Create List
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lists.map((list) => {
                      const isExpanded = expandedListId === list.id;

                      return (
                        <div
                          key={list.id}
                          className="rounded-lg border border-border bg-bg/50 overflow-hidden"
                        >
                          <div className="flex items-center justify-between gap-3 p-4 bg-surface">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-text truncate">{list.title}</p>
                              <p className="text-xs text-text-muted">
                                {list.itemSlugs.length} title
                                {list.itemSlugs.length === 1 ? "" : "s"}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenRenameModal(list)}
                                aria-label={`Rename ${list.title}`}
                                className="p-2 rounded-full text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
                              >
                                <Pencil size={15} strokeWidth={2} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingList(list)}
                                aria-label={`Delete ${list.title}`}
                                className="p-2 rounded-full text-text-muted hover:text-danger hover:bg-danger-soft transition-colors"
                              >
                                <Trash2 size={15} strokeWidth={2} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleExpandList(list.id, list.itemSlugs)}
                                aria-label={isExpanded ? "Collapse list" : "Expand list"}
                                className="p-2 rounded-full text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronUp size={16} strokeWidth={2} />
                                ) : (
                                  <ChevronDown size={16} strokeWidth={2} />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Expanded items section */}
                          {isExpanded && (
                            <div className="p-4 border-t border-border bg-bg/30">
                              {isLoadingExpandedTitles ? (
                                <div className="flex items-center justify-center py-6 text-text-muted gap-2 text-xs">
                                  <Loader2 size={16} className="animate-spin text-primary" />
                                  <span>Loading titles...</span>
                                </div>
                              ) : list.itemSlugs.length === 0 ? (
                                <p className="text-xs text-text-muted text-center py-4">
                                  This list is empty. Add titles from any drama detail page.
                                </p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                  {expandedTitles.map((drama) => (
                                    <div
                                      key={drama.slug}
                                      className="relative group rounded-md border border-border bg-surface p-2 flex flex-col gap-2"
                                    >
                                      <div className="relative aspect-[2/3] rounded overflow-hidden bg-bg">
                                        <Image
                                          src={drama.poster}
                                          alt={drama.title}
                                          fill
                                          sizes="(min-width: 640px) 15vw, 40vw"
                                          className="object-cover"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoveFromExpandedList(list.id, drama.slug)
                                          }
                                          aria-label={`Remove ${drama.title} from list`}
                                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-white hover:bg-danger transition-colors shadow-sm"
                                        >
                                          <X size={13} strokeWidth={2.5} />
                                        </button>
                                      </div>
                                      <Link
                                        href={`/drama/${drama.slug}`}
                                        className="text-xs font-semibold text-text hover:text-primary transition-colors line-clamp-1"
                                      >
                                        {drama.title}
                                      </Link>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Add To List Modal */}
      {addToListTargetSlug && (
        <AddToListModal
          open={addToListTargetSlug !== null}
          onClose={() => setAddToListTargetSlug(null)}
          slug={addToListTargetSlug}
          onRequestCreateList={() => setIsCreateListOpen(true)}
          onAdded={(listTitle) => showToast(`Added to "${listTitle}"`)}
        />
      )}

      {/* Create List Modal */}
      <CreateListModal
        open={isCreateListOpen}
        onClose={() => setIsCreateListOpen(false)}
      />

      {/* Rename List Modal */}
      {editingList && (
        <Modal
          open={editingList !== null}
          onClose={() => !isRenaming && setEditingList(null)}
          title="Rename List"
        >
          <form onSubmit={handleSaveRename} className="space-y-4">
            <div>
              <label htmlFor="renameTitle" className="block text-sm font-semibold mb-1.5">
                New List Name
              </label>
              <input
                id="renameTitle"
                type="text"
                required
                disabled={isRenaming}
                value={editTitleInput}
                onChange={(e) => setEditTitleInput(e.target.value)}
                autoFocus
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isRenaming}
                onClick={() => setEditingList(null)}
                className="rounded-full border border-border text-text hover:bg-surface font-semibold text-xs px-4 py-2 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isRenaming || !editTitleInput.trim()}
                className="flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-xs px-4 py-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isRenaming && <Loader2 size={13} className="animate-spin" />}
                {isRenaming ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete List Modal */}
      {deletingList && (
        <Modal
          open={deletingList !== null}
          onClose={() => !isDeleting && setDeletingList(null)}
          title="Delete List"
        >
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-text">&quot;{deletingList.title}&quot;</span>?
              Dramas in this list will remain in your favorites.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingList(null)}
                className="rounded-full border border-border text-text hover:bg-surface font-semibold text-xs px-4 py-2 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 rounded-full bg-danger hover:bg-danger/90 text-white font-semibold text-xs px-4 py-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={13} className="animate-spin" />}
                {isDeleting ? "Deleting..." : "Delete List"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Toast message={toastMessage} />
    </div>
  );
}
