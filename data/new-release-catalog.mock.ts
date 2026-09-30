export type NewReleaseCatalogItem = {
  id: string;
  slug: string;
  title: string;
  poster: string;
  createdAt: string; // ISO date — when the title was added to the catalog
};

// Mock data — stands in for a "GET /titles?sort=newest" response.
export const newReleaseCatalog: NewReleaseCatalogItem[] = [
  { id: "nrc-1", slug: "the-arranged-marriage", title: "The Arranged Marriage", poster: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-29" },
  { id: "nrc-2", slug: "bound-by-the-billionaires-will", title: "Bound by the Billionaire's Will", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-28" },
  { id: "nrc-3", slug: "my-husband-is-secretly-a-duke", title: "My Husband Is Secretly a Duke", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-27" },
  { id: "nrc-4", slug: "second-chance-at-first-love", title: "Second Chance at First Love", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-26" },
  { id: "nrc-5", slug: "the-widow-duke-wants-me-back", title: "The Widow Duke Wants Me Back", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-25" },
  { id: "nrc-6", slug: "never-divorce-a-hidden-heiress", title: "Never Divorce a Hidden Heiress", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-24" },
  { id: "nrc-7", slug: "my-fake-fiance-the-generals-only-son", title: "My Fake Fiancé, the General's Only Son", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-23" },
  { id: "nrc-8", slug: "reborn-as-the-villains-ex-wife", title: "Reborn as the Villain's Ex-Wife", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-22" },
  { id: "nrc-9", slug: "contract-bride-real-heart", title: "Contract Bride, Real Heart", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-21" },
  { id: "nrc-10", slug: "the-ceos-runaway-bride-returns", title: "The CEO's Runaway Bride Returns", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-20" },
  { id: "nrc-11", slug: "married-to-the-enemy-duke-overnight", title: "Married to the Enemy Duke Overnight", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-19" },
  { id: "nrc-12", slug: "the-alphas-forbidden-bride-awakens", title: "The Alpha's Forbidden Bride Awakens", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-18" },
  { id: "nrc-13", slug: "ceo-secret-wife", title: "The CEO's Secret Wife", poster: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-17" },
  { id: "nrc-14", slug: "reborn-to-ruin-him", title: "Reborn to Ruin Him", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-16" },
  { id: "nrc-15", slug: "marrying-my-rival", title: "Marrying My Rival", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-15" },
  { id: "nrc-16", slug: "billionaires-runaway-bride", title: "The Billionaire's Runaway Bride", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-14" },
  { id: "nrc-17", slug: "abandoned-rabbit-knight", title: "The Abandoned Rabbit Knight's New Mate: His Grand Priest", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-13" },
  { id: "nrc-18", slug: "my-savior-taught-me-to-obey", title: "My Savior Taught Me to Obey", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-12" },
  { id: "nrc-19", slug: "someone-like-xavier", title: "Someone Like Xavier", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-11" },
  { id: "nrc-20", slug: "alphas-forbidden-bride", title: "The Alpha's Forbidden Bride", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-10" },
  { id: "nrc-21", slug: "married-to-the-enemy-duke", title: "Married to the Enemy Duke", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-09" },
  { id: "nrc-22", slug: "ceos-runaway-bride", title: "The CEO's Runaway Bride", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-08" },
  { id: "nrc-23", slug: "my-fake-fiance-the-general", title: "My Fake Fiancé, the General", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-07" },
  { id: "nrc-24", slug: "second-chance-at-first-love-encore", title: "Second Chance at First Love: Encore", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-06" },
  { id: "nrc-25", slug: "the-widow-duke-wants-me", title: "The Widow Duke Wants Me", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-05" },
  { id: "nrc-26", slug: "duke-of-my-nightmares", title: "Duke of My Nightmares", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-04" },
  { id: "nrc-27", slug: "the-generals-forbidden-bride", title: "The General's Forbidden Bride", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-03" },
  { id: "nrc-28", slug: "runaway-heiress-hidden-heart", title: "Runaway Heiress, Hidden Heart", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", createdAt: "2026-08-02" },
];
