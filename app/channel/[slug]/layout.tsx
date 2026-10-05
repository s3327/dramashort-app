import type { Metadata } from "next";
import { getChannelBySlug } from "@/lib/services/content.service";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  let channel = await getChannelBySlug(slug);

  if (!channel && ENABLE_MOCK_FALLBACK) {
    const { channels } = await import("@/data/channels.mock");
    channel = channels.find((c) => c.slug === slug) || null;
  }

  if (!channel) {
    return {
      title: "Channel Not Found — DramaShort",
      robots: { index: false, follow: false },
    };
  }

  const name = channel.name;
  const title = `${name} — Watch Channel Dramas on DramaShort`;
  const description = `Explore all exclusive short-form drama series from ${name} on DramaShort.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function ChannelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
