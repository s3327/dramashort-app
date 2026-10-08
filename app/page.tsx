import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import TopTrending from "@/components/TopTrending";
import NewRelease from "@/components/NewRelease";
import PageShell from "@/components/PageShell";
import ContinueWatchingIsland from "@/components/islands/ContinueWatchingIsland";
import WelcomeBanner from "@/components/home/WelcomeBanner";
import {
  getHeroSlides,
  getTopTrendingTitles,
  getNewReleaseTitles,
} from "@/lib/services/content.service";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "DramaShort — Stream Short-Form Vertical Dramas",
  description:
    "Stream high-definition short-form vertical drama series, top trending titles, and new releases. Free to stream on web and mobile.",
};

/**
 * Server Component pre-rendering hero slides, top trending titles,
 * and new release catalog items directly into the initial server document (Task 14.5).
 */
export default async function LandingPage() {
  const [heroSlides, trendingTitles, newReleaseTitles] = await Promise.all([
    getHeroSlides(),
    getTopTrendingTitles(10),
    getNewReleaseTitles(12),
  ]);

  return (
    <PageShell className="min-h-screen bg-bg text-text">
      <Header />
      <WelcomeBanner />
      <Hero initialSlides={heroSlides} />
      <ContinueWatchingIsland />
      <TopTrending initialTitles={trendingTitles} />
      <NewRelease initialTitles={newReleaseTitles} />
      <Footer />
    </PageShell>
  );
}
