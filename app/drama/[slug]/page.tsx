"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Star, Tv, Layers, Heart, ListPlus } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AddToListModal from "@/components/AddToListModal";
import CreateListModal from "@/components/CreateListModal";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import Breadcrumbs from "@/components/Breadcrumbs";
import TitleCard from "@/components/TitleCard";
import { DramaDetailSkeleton, DramaCardSkeleton } from "@/components/skeletons";
import Toast from "@/components/Toast";
import { getTitleBySlugOrFallback, type Title } from "@/data/titles.mock";
import { channels as fallbackChannels } from "@/data/channels.mock";
import { getRelatedTitles } from "@/lib/getRelatedTitles";
import { useTheme } from "@/contexts/ThemeContext";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";
import { getTitleBySlug, getRelatedTitlesFromDb } from "@/lib/services/content.service";

const SYNOPSIS_TRUNCATE_LENGTH = 220;

export default function DramaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { theme } = useTheme();
  const { slug } = use(params);
  const [drama, setDrama] = useState<Title>(() => getTitleBySlugOrFallback(slug));
  const [related, setRelated] = useState<Title[]>(() => getRelatedTitles(drama));
  const [isLoading, setIsLoading] = useState(true);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const isLongSynopsis = drama.synopsis.length > SYNOPSIS_TRUNCATE_LENGTH;

  useEffect(() => {
    let isMounted = true;
    getTitleBySlug(slug)
      .then(async (dbDrama) => {
        if (!isMounted) return;
        const resolvedDrama = dbDrama || getTitleBySlugOrFallback(slug);
        setDrama(resolvedDrama);

        if (dbDrama) {
          const dbRelated = await getRelatedTitlesFromDb(dbDrama, 8);
          if (!isMounted) return;
          if (dbRelated && dbRelated.length > 0) {
            setRelated(dbRelated);
          } else {
            setRelated(getRelatedTitles(resolvedDrama));
          }
        } else {
          setRelated(getRelatedTitles(resolvedDrama));
        }
      })
      .catch((err) => {
        console.warn("Failed to load drama from DB, using fallback:", err);
        if (isMounted) {
          const fallback = getTitleBySlugOrFallback(slug);
          setDrama(fallback);
          setRelated(getRelatedTitles(fallback));
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const { isFavorited, toggleFavorite } = useFavorites();
  const { isLoggedIn } = useAuth();
  const favorited = isFavorited(drama.slug);

  const { message: toastMessage, show: showToast } = useToast();
  const [isAddToListOpen, setIsAddToListOpen] = useState(false);
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [isLoginRequiredOpen, setIsLoginRequiredOpen] = useState(false);

  const handleToggleFavorite = () => {
    if (!isLoggedIn) {
      setIsLoginRequiredOpen(true);
      return;
    }
    const wasFavorited = favorited;
    toggleFavorite(drama.slug);
    if (!wasFavorited) showToast("Added to Favorites");
  };

  const handleOpenAddToList = () => {
    if (!isLoggedIn) {
      setIsLoginRequiredOpen(true);
      return;
    }
    setIsAddToListOpen(true);
  };

  const channelSlug = fallbackChannels.find((c) => c.name === drama.channel)?.slug;
  const relatedTitles = related;

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1000px] mx-auto px-6 pt-10 pb-16">
        {isLoading ? (
          <DramaDetailSkeleton />
        ) : (
          <>
            <Breadcrumbs
              items={[
                { label: "Home", href: "/home" },
                { label: "Genres", href: "/genres" },
                { label: drama.genre, href: `/genres?genre=${encodeURIComponent(drama.genre)}` },
                { label: drama.title },
              ]}
            />
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
              <div className="w-40 sm:w-56 shrink-0 mx-auto sm:mx-0">
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md bg-surface">
                  <Image
                    src={drama.poster}
                    alt={drama.title}
                    fill
                    sizes="(min-width: 640px) 224px, 160px"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <h1 className="font-display font-bold text-2xl sm:text-3xl mb-3">
                  {drama.title}
                </h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-muted mb-4">
                  <span className="flex items-center gap-1.5">
                    <Tv size={15} strokeWidth={2} />
                    {channelSlug ? (
                      <Link
                        href={`/channel/${channelSlug}`}
                        className="hover:text-primary transition-colors"
                      >
                        {drama.channel}
                      </Link>
                    ) : (
                      drama.channel
                    )}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers size={15} strokeWidth={2} />
                    {drama.totalEpisodes} Episodes
                  </span>
                  {/* Rating is only shown when the title actually has one */}
                  {drama.rating !== undefined && (
                    <span className="flex items-center gap-1.5 font-semibold text-text">
                      <Star size={15} strokeWidth={0} className="fill-tertiary text-tertiary" />
                      {drama.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-5">
                  {/* Genre — one primary category, visually distinct from tags below */}
                  <Link
                    href={`/genres?genre=${encodeURIComponent(drama.genre)}`}
                    className="rounded-pill bg-primary text-text-light text-xs font-semibold px-3 py-1 hover:bg-primary-hover transition-colors"
                  >
                    {drama.genre}
                  </Link>
                  {drama.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-pill bg-surface border border-border text-text-muted text-xs font-semibold px-3 py-1"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mb-6 max-w-2xl">
                  <p
                    className={`text-sm leading-relaxed text-text-muted ${
                      isLongSynopsis && !isSynopsisExpanded ? "line-clamp-4" : ""
                    }`}
                  >
                    {drama.synopsis}
                  </p>
                  {isLongSynopsis && (
                    <button
                      type="button"
                      onClick={() => setIsSynopsisExpanded((v) => !v)}
                      className="mt-1.5 text-sm font-semibold text-link hover:text-link-hover transition-colors"
                    >
                      {isSynopsisExpanded ? "Read less" : "Read more"}
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href={`/watch/${drama.slug}`}
                    className="inline-flex items-center gap-2 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold px-6 py-3 text-sm shadow-sm transition-colors"
                  >
                    <Play size={16} strokeWidth={2.5} fill="currentColor" />
                    Watch Now
                  </Link>
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
              </div>
            </div>
          </>
        )}

        {/* Related — matched by shared genre, tags, or channel */}
        <div className="mt-12">
          <h2 className="font-display font-bold text-lg sm:text-xl mb-4">
            Related Titles
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <DramaCardSkeleton key={i} />
              ))}
            </div>
          ) : relatedTitles.length === 0 ? (
            <p className="text-sm text-text-muted">No related titles found.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-6">
              {relatedTitles.map((item) => (
                <TitleCard
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  poster={item.poster}
                  title={item.title}
                  sizes="(min-width: 1024px) 12vw, (min-width: 640px) 24vw, 32vw"
                  titleClassName="text-xs"
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <AddToListModal
        open={isAddToListOpen}
        onClose={() => setIsAddToListOpen(false)}
        slug={drama.slug}
        onRequestCreateList={() => setIsCreateListOpen(true)}
        onAdded={(listTitle) => showToast(`Added to ${listTitle}`)}
      />
      <CreateListModal open={isCreateListOpen} onClose={() => setIsCreateListOpen(false)} />
      <LoginRequiredModal
        open={isLoginRequiredOpen}
        onClose={() => setIsLoginRequiredOpen(false)}
        message="Log in to save titles to your favorites and lists."
      />

      <Toast
        message={toastMessage}
        icon={<Heart size={14} strokeWidth={2} className="fill-primary text-primary" />}
      />
    </div>
  );
}
