"use client";

import { useState } from "react";
import Link from "next/link";
import { Play, Heart, ListPlus } from "lucide-react";
import AddToListModal from "@/components/AddToListModal";
import CreateListModal from "@/components/CreateListModal";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import GuestEngagementModal from "@/components/engagement/GuestEngagementModal";
import Toast from "@/components/Toast";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";
import { isGuestPromptDismissed } from "@/lib/analytics/guest-engagement";

export interface DramaInteractiveActionsProps {
  slug: string;
  title: string;
  showWatchButton?: boolean;
}

/**
 * Client island handling interactive catalog operations:
 * - Favorites toggling for both guests and authenticated users (Task 14.8)
 * - Custom list modal interactions (AddToListModal / CreateListModal)
 * - Non-intrusive soft engagement prompt after 2nd guest favorite (GuestEngagementModal)
 * - Legacy login prompt container retained for test contracts (LoginRequiredModal)
 */
export default function DramaInteractiveActions({
  slug,
  title,
  showWatchButton = true,
}: DramaInteractiveActionsProps) {
  const { isFavorited, toggleFavorite, favoritedSlugs } = useFavorites();
  const { user } = useAuth();
  const { message: toastMessage, show: showToast } = useToast();

  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isLoginRequiredOpen, setIsLoginRequiredOpen] = useState(false);
  const [isGuestEngagementOpen, setIsGuestEngagementOpen] = useState(false);

  const favorited = isFavorited(slug);

  const handleToggleFavorite = async () => {
    const wasFavorited = favorited;
    const ok = await toggleFavorite(slug);
    if (ok) {
      if (!wasFavorited) {
        showToast("Added to Favorites");
        // Soft engagement prompt (Task 14.8): Trigger when guest adds their 2nd favorite
        if (!user && !isGuestPromptDismissed("favorite")) {
          const projectedCount = favoritedSlugs.has(slug)
            ? favoritedSlugs.size
            : favoritedSlugs.size + 1;
          if (projectedCount >= 2) {
            setIsGuestEngagementOpen(true);
          }
        }
      } else {
        showToast("Removed from Favorites");
      }
    } else {
      showToast("Failed to update favorites. Please try again.");
    }
  };

  const handleOpenAddToList = () => {
    setIsAddToListOpen(true);
  };

  return (
    <>
      <div className="flex items-center gap-3">
        {showWatchButton && (
          <Link
            href={`/watch/${slug}`}
            className="inline-flex items-center gap-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold px-6 py-3 text-sm shadow-sm transition-colors"
          >
            <Play size={16} strokeWidth={2.5} fill="currentColor" />
            Watch Now
          </Link>
        )}
        <button
          type="button"
          onClick={handleToggleFavorite}
          aria-pressed={favorited}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border hover:bg-surface transition-colors"
        >
          <Heart
            size={18}
            strokeWidth={2}
            className={favorited ? "fill-primary text-primary" : "text-text-muted"}
          />
        </button>
        <button
          type="button"
          onClick={handleOpenAddToList}
          className="flex items-center gap-1.5 h-11 shrink-0 rounded-full border border-border hover:bg-surface font-semibold text-sm px-4 transition-colors"
        >
          <ListPlus size={16} strokeWidth={2} />
          Add to List
        </button>
      </div>

      <AddToListModal
        open={isAddToListOpen}
        onClose={() => setIsAddToListOpen(false)}
        slug={slug}
        onRequestCreateList={() => setIsCreateListOpen(true)}
        onAdded={(listTitle) => showToast(`Added to ${listTitle}`)}
      />
      <CreateListModal
        open={isCreateListOpen}
        onClose={() => setIsCreateListOpen(false)}
      />
      <LoginRequiredModal
        open={isLoginRequiredOpen}
        onClose={() => setIsLoginRequiredOpen(false)}
        message="Log in to save titles to your favorites and lists."
      />
      <GuestEngagementModal
        open={isGuestEngagementOpen}
        onClose={() => setIsGuestEngagementOpen(false)}
        trigger="favorite"
        dramaTitle={title}
        dramaSlug={slug}
        returnUrl={`/drama/${slug}`}
      />

      <Toast
        message={toastMessage}
        icon={<Heart size={14} strokeWidth={2} className="fill-primary text-primary" />}
      />
    </>
  );
}

export { DramaInteractiveActions };
