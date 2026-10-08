import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import TitleCard from "@/components/TitleCard";
import PageShell from "@/components/PageShell";
import PaginationIsland from "@/components/islands/PaginationIsland";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import {
  getChannelBySlug,
  searchPublishedTitles,
} from "@/lib/services/content.service";

export const revalidate = 300;

const PAGE_SIZE = 24;

/**
 * Server Component resolving channel details and server-side paginated titles.
 */
export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  const rawPage = typeof sp?.page === "string" ? sp.page : Array.isArray(sp?.page) ? sp.page[0] : undefined;
  const page = Math.max(1, parseInt(rawPage || "1", 10) || 1);

  const normalizedSlug = slug.toLowerCase();
  let channel = await getChannelBySlug(normalizedSlug);
  if (!channel && ENABLE_MOCK_FALLBACK) {
    const { channels } = await import("@/data/channels.mock");
    channel = channels.find((c) => c.slug.toLowerCase() === normalizedSlug) || null;
  }

  if (!channel) {
    notFound();
  }

  // Canonical redirect if accessed via non-canonical casing or legacy slug
  if (channel.slug !== slug) {
    permanentRedirect(`/channel/${channel.slug}`);
  }

  const results = await searchPublishedTitles({
    channelId: channel.id,
    channelSlug: channel.slug,
    channelName: channel.name,
    sort: "newest",
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <PageShell className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: channel.name },
          ]}
        />
        <h1 className="font-display font-bold text-2xl mb-8">
          {channel.name}
        </h1>

        {results.items.length === 0 ? (
          <p className="text-sm text-text-muted py-12 text-center">
            No titles from this channel yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {results.items.map((item) => (
                <TitleCard
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  poster={item.poster}
                  title={item.title}
                />
              ))}
            </div>

            <Suspense fallback={null}>
              <PaginationIsland
                page={results.page}
                totalPages={results.totalPages}
                basePath={`/channel/${channel.slug}`}
              />
            </Suspense>
          </>
        )}
      </main>

      <Footer />
    </PageShell>
  );
}
