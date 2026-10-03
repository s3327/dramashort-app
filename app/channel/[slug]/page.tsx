"use client";

import { use, useEffect, useMemo, useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Breadcrumbs from "@/components/Breadcrumbs";
import TitleCard from "@/components/TitleCard";
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
  const [channel, setChannel] = useState<Channel | null>(() =>
    fallbackChannels.find((c) => c.slug === slug) || null
  );
  const [channelTitles, setChannelTitles] = useState<Title[]>(() =>
    fallbackTitles
      .filter((item) => item.status === "Published" && item.channel === channel?.name)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    getChannelBySlug(slug).then((ch) => {
      if (ch) {
        setChannel(ch);
        getPublishedTitles({ channelName: ch.name, sort: "newest" }).then((dbTitles) => {
          if (dbTitles && dbTitles.length > 0) {
            setChannelTitles(dbTitles);
          }
        });
      }
    });
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
          {channel ? channel.name : "Channel"}
        </h1>

        {channelTitles.length === 0 ? (
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
