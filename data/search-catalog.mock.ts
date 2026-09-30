export type SearchCatalogItem = {
  id: string;
  slug: string;
  title: string;
  poster: string;
  channel: string;
  genre: string;
  tags: string[];
};

// Mock data — stands in for a "GET /titles/search" response with filters.
export const searchCatalog: SearchCatalogItem[] = [
  {
    id: "sc-1",
    slug: "ceo-secret-wife",
    title: "The CEO's Secret Wife",
    poster:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop",
    channel: "DramaShort Originals",
    genre: "Marriage",
    tags: ["Marriage", "CEO", "Revenge"],
  },
  {
    id: "sc-2",
    slug: "reborn-to-ruin-him",
    title: "Reborn to Ruin Him",
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    channel: "Velvet Frame",
    genre: "Rebirth",
    tags: ["Rebirth", "Revenge", "Romance"],
  },
  {
    id: "sc-3",
    slug: "marrying-my-rival",
    title: "Marrying My Rival",
    poster:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop",
    channel: "Golden Hour Studios",
    genre: "Rivals",
    tags: ["Rivals", "Wedding", "Enemies to Lovers"],
  },
  {
    id: "sc-4",
    slug: "billionaires-runaway-bride",
    title: "The Billionaire's Runaway Bride",
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop",
    channel: "Nightingale Pictures",
    genre: "Romance",
    tags: ["Billionaire", "Runaway Bride", "Second Chance"],
  },
  {
    id: "sc-5",
    slug: "abandoned-rabbit-knight",
    title: "The Abandoned Rabbit Knight's New Mate: His Grand Priest",
    poster:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop",
    channel: "DramaShort Originals",
    genre: "Fantasy",
    tags: ["Fantasy", "Shifter", "Forbidden Love"],
  },
  {
    id: "sc-6",
    slug: "the-arranged-marriage",
    title: "The Arranged Marriage",
    poster:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop",
    channel: "Golden Hour Studios",
    genre: "Marriage",
    tags: ["Arranged Marriage", "Slow Burn"],
  },
  {
    id: "sc-7",
    slug: "my-savior-taught-me-to-obey",
    title: "My Savior Taught Me to Obey",
    poster:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop",
    channel: "Velvet Frame",
    genre: "Dark Romance",
    tags: ["Dark Romance", "Rescue", "Obsession"],
  },
  {
    id: "sc-8",
    slug: "someone-like-xavier",
    title: "Someone Like Xavier",
    poster:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop",
    channel: "Nightingale Pictures",
    genre: "Coming of Age",
    tags: ["High School", "Coming of Age"],
  },
  {
    id: "sc-9",
    slug: "alphas-forbidden-bride",
    title: "The Alpha's Forbidden Bride",
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    channel: "DramaShort Originals",
    genre: "Fantasy",
    tags: ["Alpha", "Shifter", "Forbidden Love"],
  },
  {
    id: "sc-10",
    slug: "married-to-the-enemy-duke",
    title: "Married to the Enemy Duke",
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop",
    channel: "Golden Hour Studios",
    genre: "Period",
    tags: ["Duke", "Enemies to Lovers", "Period"],
  },
  {
    id: "sc-11",
    slug: "contract-bride-real-heart",
    title: "Contract Bride, Real Heart",
    poster:
      "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop",
    channel: "Velvet Frame",
    genre: "Marriage",
    tags: ["Contract Marriage", "Slow Burn"],
  },
  {
    id: "sc-12",
    slug: "ceos-runaway-bride",
    title: "The CEO's Runaway Bride",
    poster:
      "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop",
    channel: "Nightingale Pictures",
    genre: "Romance",
    tags: ["CEO", "Runaway Bride"],
  },
  {
    id: "sc-13",
    slug: "my-fake-fiance-the-general",
    title: "My Fake Fiancé, the General",
    poster:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
    channel: "DramaShort Originals",
    genre: "Military",
    tags: ["Fake Relationship", "Military"],
  },
  {
    id: "sc-14",
    slug: "second-chance-at-first-love",
    title: "Second Chance at First Love",
    poster:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop",
    channel: "Velvet Frame",
    genre: "Romance",
    tags: ["Second Chance", "Slow Burn"],
  },
  {
    id: "sc-15",
    slug: "the-widow-duke-wants-me",
    title: "The Widow Duke Wants Me",
    poster:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop",
    channel: "Golden Hour Studios",
    genre: "Period",
    tags: ["Duke", "Widow", "Second Chance"],
  },
  {
    id: "sc-16",
    slug: "never-divorce-a-hidden-heiress",
    title: "Never Divorce a Hidden Heiress",
    poster:
      "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop",
    channel: "Nightingale Pictures",
    genre: "Marriage",
    tags: ["Heiress", "Divorce", "Revenge"],
  },
  {
    id: "sc-17",
    slug: "reborn-as-the-villains-ex-wife",
    title: "Reborn as the Villain's Ex-Wife",
    poster:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
    channel: "Velvet Frame",
    genre: "Rebirth",
    tags: ["Rebirth", "Revenge"],
  },
  {
    id: "sc-18",
    slug: "my-husband-is-secretly-a-duke",
    title: "My Husband Is Secretly a Duke",
    poster:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop",
    channel: "DramaShort Originals",
    genre: "Period",
    tags: ["Duke", "Secret Identity"],
  },
  {
    id: "sc-19",
    slug: "bound-by-the-billionaires-will",
    title: "Bound by the Billionaire's Will",
    poster:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop",
    channel: "Golden Hour Studios",
    genre: "Romance",
    tags: ["Billionaire", "Contract Marriage"],
  },
  {
    id: "sc-20",
    slug: "married-to-the-enemy-duke-overnight",
    title: "Married to the Enemy Duke Overnight",
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    channel: "Nightingale Pictures",
    genre: "Period",
    tags: ["Duke", "Enemies to Lovers"],
  },
  {
    id: "sc-21",
    slug: "the-alphas-forbidden-bride-awakens",
    title: "The Alpha's Forbidden Bride Awakens",
    poster:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop",
    channel: "Velvet Frame",
    genre: "Fantasy",
    tags: ["Alpha", "Shifter"],
  },
  {
    id: "sc-22",
    slug: "the-ceos-runaway-bride-returns",
    title: "The CEO's Runaway Bride Returns",
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop",
    channel: "DramaShort Originals",
    genre: "Romance",
    tags: ["CEO", "Runaway Bride"],
  },
  {
    id: "sc-23",
    slug: "my-fake-fiance-the-generals-only-son",
    title: "My Fake Fiancé, the General's Only Son",
    poster:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop",
    channel: "Golden Hour Studios",
    genre: "Military",
    tags: ["Fake Relationship", "Military"],
  },
  {
    id: "sc-24",
    slug: "the-widow-duke-wants-me-back",
    title: "The Widow Duke Wants Me Back",
    poster:
      "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop",
    channel: "Nightingale Pictures",
    genre: "Period",
    tags: ["Duke", "Widow", "Second Chance"],
  },
];
