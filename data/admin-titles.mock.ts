export type AdminTitleStatus = "Published" | "Draft" | "Scheduled" | "Archived";

export type AdminTitle = {
  id: string;
  slug: string;
  title: string;
  poster: string;
  year: number;
  episodes: number;
  channel: string;
  status: AdminTitleStatus;
};

// Mock data — stands in for a "GET /admin/titles" response.
export const adminTitles: AdminTitle[] = [
  { id: "t-1", slug: "ceo-secret-wife", title: "The CEO's Secret Wife", poster: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 40, channel: "DramaShort Originals", status: "Published" },
  { id: "t-2", slug: "reborn-to-ruin-him", title: "Reborn to Ruin Him", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 32, channel: "Velvet Frame", status: "Published" },
  { id: "t-3", slug: "marrying-my-rival", title: "Marrying My Rival", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 28, channel: "Golden Hour Studios", status: "Published" },
  { id: "t-4", slug: "billionaires-runaway-bride", title: "The Billionaire's Runaway Bride", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=300&auto=format&fit=crop", year: 2025, episodes: 36, channel: "Nightingale Pictures", status: "Published" },
  { id: "t-5", slug: "abandoned-rabbit-knight", title: "The Abandoned Rabbit Knight's New Mate: His Grand Priest", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 45, channel: "DramaShort Originals", status: "Published" },
  { id: "t-6", slug: "the-arranged-marriage", title: "The Arranged Marriage", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 30, channel: "Golden Hour Studios", status: "Published" },
  { id: "t-7", slug: "my-savior-taught-me-to-obey", title: "My Savior Taught Me to Obey", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=300&auto=format&fit=crop", year: 2025, episodes: 26, channel: "Velvet Frame", status: "Published" },
  { id: "t-8", slug: "someone-like-xavier", title: "Someone Like Xavier", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=300&auto=format&fit=crop", year: 2025, episodes: 24, channel: "Nightingale Pictures", status: "Published" },
  { id: "t-9", slug: "alphas-forbidden-bride", title: "The Alpha's Forbidden Bride", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 38, channel: "DramaShort Originals", status: "Published" },
  { id: "t-10", slug: "married-to-the-enemy-duke", title: "Married to the Enemy Duke", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=300&auto=format&fit=crop", year: 2025, episodes: 34, channel: "Golden Hour Studios", status: "Published" },
  { id: "t-11", slug: "contract-bride-real-heart", title: "Contract Bride, Real Heart", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=300&auto=format&fit=crop", year: 2025, episodes: 24, channel: "Velvet Frame", status: "Published" },
  { id: "t-12", slug: "ceos-runaway-bride", title: "The CEO's Runaway Bride", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=300&auto=format&fit=crop", year: 2025, episodes: 26, channel: "Nightingale Pictures", status: "Archived" },
  { id: "t-13", slug: "my-fake-fiance-the-general", title: "My Fake Fiancé, the General", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 30, channel: "DramaShort Originals", status: "Published" },
  { id: "t-14", slug: "second-chance-at-first-love", title: "Second Chance at First Love", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 20, channel: "Velvet Frame", status: "Published" },
  { id: "t-15", slug: "the-widow-duke-wants-me", title: "The Widow Duke Wants Me", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 26, channel: "Golden Hour Studios", status: "Published" },
  { id: "t-16", slug: "never-divorce-a-hidden-heiress", title: "Never Divorce a Hidden Heiress", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 28, channel: "Nightingale Pictures", status: "Draft" },
  { id: "t-17", slug: "reborn-as-the-villains-ex-wife", title: "Reborn as the Villain's Ex-Wife", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 22, channel: "Velvet Frame", status: "Draft" },
  { id: "t-18", slug: "my-husband-is-secretly-a-duke", title: "My Husband Is Secretly a Duke", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 24, channel: "DramaShort Originals", status: "Scheduled" },
  { id: "t-19", slug: "bound-by-the-billionaires-will", title: "Bound by the Billionaire's Will", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 20, channel: "Golden Hour Studios", status: "Scheduled" },
  { id: "t-20", slug: "married-to-the-enemy-duke-overnight", title: "Married to the Enemy Duke Overnight", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 18, channel: "Nightingale Pictures", status: "Draft" },
  { id: "t-21", slug: "the-alphas-forbidden-bride-awakens", title: "The Alpha's Forbidden Bride Awakens", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 16, channel: "Velvet Frame", status: "Draft" },
  { id: "t-22", slug: "the-ceos-runaway-bride-returns", title: "The CEO's Runaway Bride Returns", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 20, channel: "DramaShort Originals", status: "Scheduled" },
  { id: "t-23", slug: "my-fake-fiance-the-generals-only-son", title: "My Fake Fiancé, the General's Only Son", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 24, channel: "Golden Hour Studios", status: "Draft" },
  { id: "t-24", slug: "the-widow-duke-wants-me-back", title: "The Widow Duke Wants Me Back", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=300&auto=format&fit=crop", year: 2024, episodes: 24, channel: "Nightingale Pictures", status: "Archived" },
  { id: "t-25", slug: "duke-of-my-nightmares", title: "Duke of My Nightmares", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=300&auto=format&fit=crop", year: 2024, episodes: 22, channel: "Golden Hour Studios", status: "Archived" },
  { id: "t-26", slug: "the-generals-forbidden-bride", title: "The General's Forbidden Bride", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=300&auto=format&fit=crop", year: 2024, episodes: 20, channel: "DramaShort Originals", status: "Archived" },
  { id: "t-27", slug: "runaway-heiress-hidden-heart", title: "Runaway Heiress, Hidden Heart", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=300&auto=format&fit=crop", year: 2024, episodes: 18, channel: "Nightingale Pictures", status: "Archived" },
  { id: "t-28", slug: "someone-like-xavier-part-two", title: "Someone Like Xavier: Part Two", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 24, channel: "Nightingale Pictures", status: "Published" },
  { id: "t-29", slug: "contract-bride-real-heart-returns", title: "Contract Bride, Real Heart: Season Two", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 24, channel: "Velvet Frame", status: "Published" },
  { id: "t-30", slug: "the-alpha-and-the-outcast", title: "The Alpha and the Outcast", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=300&auto=format&fit=crop", year: 2025, episodes: 26, channel: "DramaShort Originals", status: "Published" },
  { id: "t-31", slug: "second-chance-at-first-love-encore", title: "Second Chance at First Love: Encore", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 18, channel: "Velvet Frame", status: "Draft" },
  { id: "t-32", slug: "my-fake-fiance-the-generals-only-son-2", title: "My Fake Fiancé, the General's Only Son: Season Two", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 20, channel: "Golden Hour Studios", status: "Scheduled" },
  { id: "t-33", slug: "never-divorce-a-hidden-heiress-2", title: "Never Divorce a Hidden Heiress: Part Two", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 16, channel: "Nightingale Pictures", status: "Draft" },
  { id: "t-34", slug: "my-savior-taught-me-to-obey-2", title: "My Savior Taught Me to Obey: Season Two", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 20, channel: "Velvet Frame", status: "Scheduled" },
  { id: "t-35", slug: "abandoned-rabbit-knight-2", title: "The Abandoned Rabbit Knight's New Mate: Book Two", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=300&auto=format&fit=crop", year: 2026, episodes: 30, channel: "DramaShort Originals", status: "Draft" },
];
