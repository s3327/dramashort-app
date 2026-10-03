"use client";

import { use, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import TitleCard, { TitleCardSkeleton } from "@/components/TitleCard";
import Pagination from "@/components/Pagination";
import { channels as fallbackChannels, type Channel } from "@/data/channels.mock";
import { titles as fallbackTitles, type Title } from "@/data/titles.mock";
import { useTheme } from "@/contexts/ThemeContext";
import { getChannelBySlug, getPublishedTitles } from "@/lib/services/content.service";

const PAGE_SIZE = 24;

export default function ChannelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { theme } = useTheme();
  const { slug } = use(params);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channelTitles, setChannelTitles] = useState<Title[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    getChannelBySlug(slug)
      .then(async (ch) => {
        if (!isMounted) return;
        const resolvedChannel = ch || fallbackChannels.find((c) => c.slug === slug) || null;
        setChannel(resolvedChannel);

        if (resolvedChannel) {
          const dbTitles = await getPublishedTitles({ channelName: resolvedChannel.name, sort: "newest" });
          if (!isMounted) return;
          if (dbTitles && dbTitles.length > 0) {
            setChannelTitles(dbTitles);
          } else {
            setChannelTitles(
              fallbackTitles
                .filter((item) => item.status === "Published" && item.channel === resolvedChannel.name)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to load channel from DB, using fallback:", err);
        if (isMounted) {
          const ch = fallbackChannels.find((c) => c.slug === slug) || null;
          setChannel(ch);
          if (ch) {
            setChannelTitles(
              fallbackTitles
                .filter((item) => item.status === "Published" && item.channel === ch.name)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
          }
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const totalPages = Math.max(1, Math.ceil(channelTitles.length / PAGE_SIZE));
  const pageItems = channelTitles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        ) : channelTitles.length === 0 ? (
          <p className="text-sm text-text-muted py-12 text-center">
            No titles from this channel yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6">
              {pageItems.map((item) => (
                <TitleCard
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  poster={item.poster}
                  title={item.title}
                />
              ))}
            </div>

            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
