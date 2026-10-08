import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Tv, Layers, Star } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import TitleCard from "@/components/TitleCard";
import PageShell from "@/components/PageShell";
import DramaInteractiveActions from "@/components/islands/DramaInteractiveActions";
import SynopsisExpandable from "@/components/islands/SynopsisExpandable";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import {
  getTitleBySlug,
  getRelatedTitlesFromDb,
  getTopTrendingTitles,
} from "@/lib/services/content.service";
import type { Title } from "@/types/content";

export const revalidate = 300;

/**
 * Pre-render top published dramas at build time with ISR regeneration.
 */
export async function generateStaticParams() {
  try {
    const topDramas = await getTopTrendingTitles(20);
    return topDramas
      .filter((drama) => typeof drama?.slug === "string" && drama.slug.trim() !== "")
      .map((drama) => ({
        slug: drama.slug,
      }));
  } catch (err) {
    console.warn("Failed to generate static params for dramas:", err);
    return [];
  }
}

/**
 * Server Component pre-rendering drama details, metadata, synopsis,
 * episodes count, and related dramas directly into the initial server document.
 */
export default async function DramaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const drama = await getTitleBySlug(slug);

  if (!drama) {
    notFound();
  }

  // Canonical redirect if accessed via legacy prefix slug (Task 11.6)
  if (drama.slug !== slug) {
    permanentRedirect(`/drama/${drama.slug}`);
  }

  let related: Title[] = [];
  const dbRelated = await getRelatedTitlesFromDb(drama, 8);
  if (dbRelated && dbRelated.length > 0) {
    related = dbRelated;
  } else if (ENABLE_MOCK_FALLBACK) {
    const { getRelatedTitles } = await import("@/lib/getRelatedTitles");
    related = getRelatedTitles(drama);
  }

  const channelSlug = drama.channel
    ? drama.channel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    : "";

  return (
    <PageShell className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1000px] mx-auto px-6 pt-10 pb-16">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
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
              {drama.rating !== undefined && (
                <span className="flex items-center gap-1.5 font-semibold text-text">
                  <Star size={15} strokeWidth={0} className="fill-tertiary text-tertiary" />
                  {drama.rating.toFixed(1)}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-5">
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

            <SynopsisExpandable synopsis={drama.synopsis} />

            <DramaInteractiveActions slug={drama.slug} title={drama.title} />
          </div>
        </div>

        {/* Episodes Grid */}
        {drama.totalEpisodes > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-display font-bold text-lg sm:text-xl">
                Episodes
              </h2>
              <span className="text-xs text-text-muted">
                {drama.totalEpisodes} Episodes
              </span>
            </div>
            <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {Array.from({ length: Math.min(drama.totalEpisodes, 60) }, (_, i) => i + 1).map((ep) => (
                <Link
                  key={ep}
                  href={`/watch/${drama.slug}?ep=${ep}`}
                  aria-label={`Episode ${ep}`}
                  className="aspect-square rounded-lg text-xs font-bold flex items-center justify-center bg-surface border border-border text-text hover:bg-surface-elevated hover:border-primary/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  {ep}
                </Link>
              ))}
            </div>
            {drama.totalEpisodes > 60 && (
              <div className="mt-3">
                <Link
                  href={`/watch/${drama.slug}`}
                  className="text-xs font-semibold text-link hover:text-link-hover transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
                >
                  View all {drama.totalEpisodes} episodes in player →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Related Titles */}
        <div className="mt-12">
          <h2 className="font-display font-bold text-lg sm:text-xl mb-4">
            Related Titles
          </h2>
          {related.length === 0 ? (
            <p className="text-sm text-text-muted">No related titles found.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-x-4 gap-y-6">
              {related.map((item) => (
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
    </PageShell>
  );
}
