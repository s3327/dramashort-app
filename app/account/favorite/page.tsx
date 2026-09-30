"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ListPlus, FolderPlus, ArrowLeft, Eye, List, Heart } from "lucide-react";
import Header from "@/components/Header";
import AccountSidebar from "@/components/account/AccountSidebar";
import AddToListModal from "@/components/AddToListModal";
import CreateListModal from "@/components/CreateListModal";
import { accountUser } from "@/data/account-user.mock";
import { getTitleBySlugOrFallback } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { useFavorites } from "@/contexts/FavoritesContext";

export default function FavoritePage() {
  const { theme } = useTheme();
  const { favoritedSlugs, lists } = useFavorites();
  const [view, setView] = useState<"favorites" | "myLists">("favorites");

  const [isCreateListOpen, setIsCreateListOpen] = useState(false);

  // The slug of the favorite card currently running "Add to List" — also
  // doubles as the add-to-list modal's open/closed state.
  const [addToListTargetSlug, setAddToListTargetSlug] = useState<string | null>(null);

  const handleOpenListPreview = (listId: string) => {
    // UI only — no real per-list filtering yet, just opens a new window
    // to demonstrate the "see" affordance.
    window.open(`/account/favorite?list=${listId}`, "_blank", "noopener,noreferrer");
  };

  // Every favorited slug resolves to a title/poster via the same drama
  // catalog the rest of the site uses — including titles favorited from
  // elsewhere (e.g. the drama page's heart), not just the original mocks.
  const favoriteEntries = Array.from(favoritedSlugs).map(getTitleBySlugOrFallback);

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <div className="max-w-[1100px] mx-auto px-6 pt-10 pb-16">
        <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
          <AccountSidebar />

          <main className="w-full flex-1 space-y-6">
            {/* Profile block — same avatar/email as Account, different actions */}
            <div className="bg-surface border border-border rounded-lg shadow-sm p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center font-display font-bold text-xl">
                    {accountUser.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-text">{accountUser.name}</p>
                    <p className="text-sm text-text-muted">{accountUser.email}</p>
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
                    onClick={() => setView("myLists")}
                    className="flex items-center gap-1.5 rounded-full border border-border text-text hover:bg-surface font-semibold text-sm px-3.5 py-2 transition-colors"
                  >
                    <List size={15} strokeWidth={2.5} />
                    My List
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

                      {/* Hover overlay — heart icon intentionally lives on
                          the drama detail page, not here. Watch lives there
                          too now; this overlay's only action is Add to List. */}
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
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h2 className="font-display font-bold text-lg">My Lists</h2>
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
                  <div className="space-y-3">
                    {lists.map((list) => (
                      <div
                        key={list.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border p-4"
                      >
                        <div>
                          <p className="font-semibold text-text">{list.title}</p>
                          <p className="text-xs text-text-muted">
                            {list.itemSlugs.length} title{list.itemSlugs.length === 1 ? "" : "s"} added
                          </p>
                        </div>
                        {/* Opens the favorited titles for this list in a new
                            window — UI only, no real per-list filtering yet. */}
                        <button
                          type="button"
                          onClick={() => handleOpenListPreview(list.id)}
                          aria-label={`Open ${list.title} in a new window`}
                          className="p-2 rounded-full border border-border text-text-muted hover:text-primary hover:bg-surface transition-colors shrink-0"
                        >
                          <Eye size={16} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      {addToListTargetSlug && (
        <AddToListModal
          open={addToListTargetSlug !== null}
          onClose={() => setAddToListTargetSlug(null)}
          slug={addToListTargetSlug}
          onRequestCreateList={() => setIsCreateListOpen(true)}
        />
      )}

      <CreateListModal open={isCreateListOpen} onClose={() => setIsCreateListOpen(false)} />
    </div>
  );
}
