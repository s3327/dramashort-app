export type HeroSlide = {
  id: string;
  title: string;
  tagline: string;
  badge: string;
  image: string;
  href: string;
};

// Mock data — replace with real "featured/spotlight" API results later.
export const heroSlides: HeroSlide[] = [
  {
    id: "hs-1",
    title: "The CEO's Secret Wife",
    tagline: "She married a stranger to save her family. He turned out to own the city.",
    badge: "🔥 #1 Trending",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1600&auto=format&fit=crop",
    href: "/drama/ceo-secret-wife",
  },
  {
    id: "hs-2",
    title: "Reborn to Ruin Him",
    tagline: "She died betrayed. She woke up ten years younger — and done being kind.",
    badge: "✨ New Episode Daily",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1600&auto=format&fit=crop",
    href: "/drama/reborn-to-ruin-him",
  },
  {
    id: "hs-3",
    title: "Marrying My Rival",
    tagline: "One contract, two enemies, and a wedding neither of them wanted to survive.",
    badge: "💎 Editor's Pick",
    image:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=1600&auto=format&fit=crop",
    href: "/drama/marrying-my-rival",
  },
  {
    id: "hs-4",
    title: "The Billionaire's Runaway Bride",
    tagline: "She fled the altar with his ring. He spent five years hunting her down.",
    badge: "🎬 Fan Favorite",
    image:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=1600&auto=format&fit=crop",
    href: "/drama/billionaires-runaway-bride",
  },
];
