import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Home — DramaShort",
  description:
    "Stream high-definition short-form vertical drama series, top trending titles, and new releases.",
};

/**
 * Server Component permanently redirecting /home to the root catalog feed / (Task 14.5).
 */
export default async function HomePage() {
  permanentRedirect("/");
}
