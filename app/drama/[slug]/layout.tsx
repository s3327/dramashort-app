import type { Metadata } from "next";
import { getTitleBySlug } from "@/lib/services/content.service";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const drama = await getTitleBySlug(slug);

  if (!drama) {
    return {
      title: "Drama Not Found — DramaShort",
      description: "The requested drama could not be found.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const title = `${drama.title} — Watch on DramaShort`;
  const description =
    drama.synopsis?.slice(0, 160) ||
    `Watch ${drama.title} on DramaShort. Stream high-definition short-form drama series.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "video.movie",
      images: drama.poster
        ? [
            {
              url: drama.poster,
              width: 800,
              height: 1200,
              alt: drama.title,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: drama.poster ? [drama.poster] : [],
    },
  };
}

export default function DramaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
