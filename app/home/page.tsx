"use client";

import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ContinueWatching from "@/components/ContinueWatching";
import TopTrending from "@/components/TopTrending";
import NewRelease from "@/components/NewRelease";
import Footer from "@/components/Footer";
import { useTheme } from "@/contexts/ThemeContext";

export default function HomePage() {
  const { theme } = useTheme();
  return (
    <div data-theme={theme} className="min-h-screen bg-bg text-text">
      <Header />
      <Hero />
      <ContinueWatching />
      <TopTrending />
      <NewRelease />
      <Footer />
    </div>
  );
}
