import type { Metadata } from "next";
import { getChannelBySlug } from "@/lib/services/content.service";
import { channels as fallbackChannels } from "@/data/channels.mock";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const channel = (await getChannelBySlug(slug)) || fallbackChannels.find((c) => c.slug === slug);
  const name = channel ? channel.name : "Channel";
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
