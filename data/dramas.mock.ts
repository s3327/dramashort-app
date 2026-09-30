export type DramaDetail = {
  slug: string;
  title: string;
  poster: string;
  synopsis: string;
  channel: string; // "channel" is this project's term for what's usually called "provider"
  tags: string[];
  totalEpisodes: number;
  rating?: number; // out of 5 — optional, some titles may not have one yet
};

// Curated entries for the titles that show up most (Hero + Top Trending).
// Anything else falls back to getDramaBySlug()'s generator below.
const dramaCatalog: DramaDetail[] = [
  {
    slug: "ceo-secret-wife",
    title: "The CEO's Secret Wife",
    poster:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "She married a stranger to save her family from ruin, never expecting the marriage certificate to bear the name of the city's most powerful and most feared CEO. Behind closed doors he's colder than his reputation suggests — until she starts noticing the cracks. As old enemies circle and a decade-old secret threatens to surface, she has to decide whether the man she married is a monster or the only person willing to protect her.",
    channel: "DramaShort Originals",
    tags: ["Marriage", "CEO", "Revenge"],
    totalEpisodes: 40,
    rating: 4.7,
  },
  {
    slug: "reborn-to-ruin-him",
    title: "Reborn to Ruin Him",
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "She died betrayed by the man she loved and the sister she trusted. She wakes up ten years younger, in the same bedroom, on the same rainy morning — and this time she remembers everything. No more kindness, no more second chances for the people who destroyed her. But rewriting the past means outsmarting people who don't yet know they're being hunted.",
    channel: "Velvet Frame",
    tags: ["Rebirth", "Revenge", "Romance"],
    totalEpisodes: 32,
    rating: 4.5,
  },
  {
    slug: "marrying-my-rival",
    title: "Marrying My Rival",
    poster:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "One merger, one contract, and one wedding neither of them wanted. Forced into an arranged partnership to save both their family companies, two rival heirs who've spent years trying to outdo each other now have to share a house, a boardroom, and — against every instinct — a growing, inconvenient attraction.",
    channel: "Golden Hour Studios",
    tags: ["Rivals", "Wedding", "Enemies to Lovers"],
    totalEpisodes: 28,
    rating: 4.3,
  },
  {
    slug: "billionaires-runaway-bride",
    title: "The Billionaire's Runaway Bride",
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "She fled the altar with his ring still on her finger and never looked back. Five years, a new name, and a new life later, he finds her — and he hasn't spent a single one of those years letting go.",
    channel: "Nightingale Pictures",
    tags: ["Billionaire", "Runaway Bride", "Second Chance"],
    totalEpisodes: 36,
    rating: 4.6,
  },
  {
    slug: "abandoned-rabbit-knight",
    title: "The Abandoned Rabbit Knight's New Mate: His Grand Priest",
    poster:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "Cast out by the pack that raised him, a shifter knight with nothing left to lose finds an unlikely ally in the temple's grand priest — a man bound by vows he never chose. Together they uncover a conspiracy that reaches the throne itself, while a bond neither of them can explain grows harder to deny with every battle they survive side by side.",
    channel: "DramaShort Originals",
    tags: ["Fantasy", "Shifter", "Forbidden Love"],
    totalEpisodes: 45,
    rating: 4.8,
  },
  {
    slug: "the-arranged-marriage",
    title: "The Arranged Marriage",
    poster:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "Two families, one debt, and a wedding neither the bride nor the groom asked for. She walks down the aisle a stranger to the man waiting at the end of it — and slowly discovers that the marriage arranged to save her father's business might be the one honest relationship in her life.",
    channel: "Golden Hour Studios",
    tags: ["Arranged Marriage", "Slow Burn"],
    totalEpisodes: 30,
  },
  {
    slug: "my-savior-taught-me-to-obey",
    title: "My Savior Taught Me to Obey",
    poster:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "He pulled her out of the worst night of her life and never let go. What starts as protection slowly tightens into something she can't quite name — possessive, consuming, and impossible to walk away from, even when every instinct tells her she should.",
    channel: "Velvet Frame",
    tags: ["Dark Romance", "Rescue", "Obsession"],
    totalEpisodes: 26,
    rating: 4.4,
  },
  {
    slug: "someone-like-xavier",
    title: "Someone Like Xavier",
    poster:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "The new kid, the girl who's never fit in, and a friendship that turns into the kind of first love you never fully get over. A coming-of-age story about the year everything — friendships, families, and futures — started to change.",
    channel: "Nightingale Pictures",
    tags: ["High School", "Coming of Age"],
    totalEpisodes: 24,
    rating: 4.2,
  },
  {
    slug: "alphas-forbidden-bride",
    title: "The Alpha's Forbidden Bride",
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "Pack law forbids it. Her family forbids it. Even her own instincts scream at her to run. But the alpha who was never supposed to be her mate is the only one who's ever made her feel safe — and safety, it turns out, is the most dangerous thing of all.",
    channel: "DramaShort Originals",
    tags: ["Alpha", "Shifter", "Forbidden Love"],
    totalEpisodes: 38,
    rating: 4.6,
  },
  {
    slug: "married-to-the-enemy-duke",
    title: "Married to the Enemy Duke",
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "Their houses have been at war for three generations. Peace, when it finally comes, arrives in the form of a marriage contract — and a duke she's sworn, her whole life, to despise.",
    channel: "Golden Hour Studios",
    tags: ["Duke", "Enemies to Lovers", "Period"],
    totalEpisodes: 34,
    rating: 4.5,
  },
  {
    slug: "contract-bride-real-heart",
    title: "Contract Bride, Real Heart",
    poster:
      "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "It was only supposed to be paperwork — a fake marriage to satisfy his grandfather's will and pay off her family's debt. Neither of them planned on the paperwork starting to feel real.",
    channel: "Velvet Frame",
    tags: ["Contract Marriage", "Slow Burn"],
    totalEpisodes: 24,
    rating: 4.1,
  },
  {
    slug: "ceos-runaway-bride",
    title: "The CEO's Runaway Bride",
    poster:
      "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "She left her own engagement party without a word. He spent a year telling himself he didn't care why. When she walks back into his boardroom as a rival company's new negotiator, both of them are about to find out he was lying.",
    channel: "Nightingale Pictures",
    tags: ["CEO", "Runaway Bride"],
    totalEpisodes: 26,
    rating: 4.0,
  },
  {
    slug: "my-fake-fiance-the-general",
    title: "My Fake Fiancé, the General",
    poster:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800&auto=format&fit=crop",
    synopsis:
      "To get her overbearing family off her back, she needs a fiancé. To get his own family off his back, the army's youngest general needs the same. The arrangement is supposed to be temporary — and entirely fake.",
    channel: "DramaShort Originals",
    tags: ["Fake Relationship", "Military"],
    totalEpisodes: 30,
  },
];

const FALLBACK_POSTERS = [
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=800&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=800&auto=format&fit=crop",
];

function slugToTitle(slug: string) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function hashSlug(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Every slug in the app resolves to something here, even ones outside the
// curated list above — we haven't confirmed what metadata DramaBoss will
// actually provide yet, so uncurated titles fall back to a generic (but
// plausible) placeholder rather than a broken page.
export function getDramaBySlug(slug: string): DramaDetail {
  const curated = dramaCatalog.find((d) => d.slug === slug);
  if (curated) return curated;

  const hash = hashSlug(slug);
  return {
    slug,
    title: slugToTitle(slug),
    poster: FALLBACK_POSTERS[hash % FALLBACK_POSTERS.length],
    synopsis:
      "Full synopsis for this title hasn't synced from the catalog yet. Once channel metadata is confirmed, this placeholder will be replaced with the real synopsis, tags, and episode details.",
    channel: "DramaShort Originals",
    tags: ["Romance", "Drama"],
    totalEpisodes: 20 + (hash % 25),
    rating: undefined,
  };
}
