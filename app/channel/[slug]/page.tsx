"use client";

import { use, useEffect, useState, Suspense } from "react";
import { notFound, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import type { Channel } from "@/types/content";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import { useTheme } from "@/contexts/ThemeContext";
import {
  getChannelBySlug,
  searchPublishedTitles,
  type PaginatedTitlesResult,
} from "@/lib/services/content.service";

const PAGE_SIZE = 24;

function ChannelContent({ slug }: { slug: string }) {
  const { theme } = useTheme();
  const searchParams = useSearchParams();

  const initialPage = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const [page, setPage] = useState(initialPage);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [results, setResults] = useState<PaginatedTitlesResult>({
    items: [],
    total: 0,
    page: initialPage,
    pageSize: PAGE_SIZE,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  if (!isLoading && !channel) {
    notFound();
  }

  // 1. Resolve channel by slug
  useEffect(() => {
    let isMounted = true;
    getChannelBySlug(slug)
      .then(async (ch) => {
        if (!isMounted) return;
        if (ch) {
          setChannel(ch);
        } else if (ENABLE_MOCK_FALLBACK) {
          const { channels } = await import("@/data/channels.mock");
          const found = channels.find((c) => c.slug === slug) || null;
          setChannel(found);
        } else {
          setChannel(null);
        }
      })
      .catch(async (err) => {
        console.warn("Failed to load channel from DB:", err);
        if (ENABLE_MOCK_FALLBACK) {
          const { channels } = await import("@/data/channels.mock");
          const found = channels.find((c) => c.slug === slug) || null;
          if (isMounted) setChannel(found);
        } else if (isMounted) {
          setChannel(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // 2. Fetch server-side paginated titles by channel_id
  useEffect(() => {
    if (!channel) return;
    let isMounted = true;
    setIsLoading(true);

    searchPublishedTitles({
      channelId: channel.id,
      channelSlug: channel.slug,
      channelName: channel.name,
      sort: "newest",
      page,
      pageSize: PAGE_SIZE,
    })
      .then((res) => {
        if (!isMounted) return;
        setResults(res);
      })
      .catch((err) => {
        console.warn("Failed to load channel titles from DB:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [channel, page]);

  // 3. Keep URL ?page= parameter in sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));

    const queryString = params.toString();
    const newUrl = queryString ? `/channel/${slug}?${queryString}` : `/channel/${slug}`;
    window.history.replaceState(null, "", newUrl);
  }, [slug, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 pt-10 pb-16">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/home" },
            { label: channel ? channel.name : "Channel" },
          ]}
        />
        <h1 className="font-display font-bold text-2xl mb-8">
          {isLoading ? (
            <div className="h-8 w-48 rounded bg-surface border border-border/40 animate-pulse" />
          ) : (
            channel ? channel.name : "Channel"
          )}
        </h1>

        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <TitleCardSkeleton key={i} />
            ))}
          </div>
        ) : results.items.length === 0 ? (
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

            <Pagination
              page={results.page}
              totalPages={results.totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <Suspense fallback={null}>
      <ChannelContent slug={slug} />
    </Suspense>
  );
}
