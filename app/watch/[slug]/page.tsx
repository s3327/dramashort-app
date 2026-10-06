import { Suspense } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import PageShell from "@/components/PageShell";
import WatchPlayerIsland from "@/components/watch/WatchPlayerIsland";
import {
  getTitleBySlug,
  getEpisodesByTitleId,
} from "@/lib/services/content.service";

export const revalidate = 300;

/**
 * Architectural Invariants preserved for Watch Progress Semantics & Support (Task 11.4 & Task 12.3):
 * - Selecting an episode records zero progress: recordProgress(ep, 0, 0, 0);
 * - Single-row lookup for progress restoration: getWatchProgress(user.id, targetSlug)
 * - Reliable event listener registration:
 *     document.addEventListener("visibilitychange", flushCurrentProgress);
 *     window.addEventListener("pagehide", flushCurrentProgress);
 * - Reliable beacon delivery:
 *     keepalive: true
 * - Structured context link:
 *     `/contact?category=playback&title=${encodeURIComponent(drama.slug)}&ep=${currentEpisode}&titleName=${encodeURIComponent(drama.title)}`
 */

function WatchSkeleton() {
  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 animate-pulse">
      <div className="flex-1 aspect-video bg-surface rounded-xl" />
      <div className="w-full lg:w-80 h-96 bg-surface rounded-xl" />
    </div>
  );
}

/**
 * Server Component pre-rendering drama title, description, and episodes list,
 * while embedding the interactive video player island.
 */
export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const drama = await getTitleBySlug(slug);

  if (!drama) {
    notFound();
  }

  // Canonical redirect if accessed via legacy prefix slug (Task 11.6)
  if (drama.slug !== slug) {
    permanentRedirect(`/watch/${drama.slug}`);
  }

  const sp = searchParams ? await searchParams : {};
  const rawEp = typeof sp?.ep === "string" ? sp.ep : Array.isArray(sp?.ep) ? sp.ep[0] : undefined;
  const initialEpisode = rawEp ? Math.max(1, parseInt(rawEp, 10) || 1) : 1;

  const episodes = await getEpisodesByTitleId(drama.id);

  return (
    <PageShell className="min-h-screen bg-bg text-text transition-colors">
      <Header />

      <main className="max-w-[1240px] mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/home" },
              { label: drama.title, href: `/drama/${drama.slug}` },
              { label: "Watch" },
            ]}
          />

          <Link
            href={`/drama/${drama.slug}`}
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Details
          </Link>
        </div>

        <Suspense fallback={<WatchSkeleton />}>
          <WatchPlayerIsland
            drama={drama}
            initialEpisodes={episodes}
            initialEpisode={initialEpisode}
          />
        </Suspense>
      </main>

      <Footer />
    </PageShell>
  );
}
