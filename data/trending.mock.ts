export type TrendingItem = {
  id: string;
  slug: string;
  title: string;
  poster: string;
  views: number;
};

// Mock data — stands in for a "GET /trending?period=weekly" response, where
// `views` is a count of users who opened the watch page and pressed play.
// The real period (weekly/monthly/etc.) will be configurable from an admin
// settings page later; for now this just represents whatever period is
// currently active. Total row count is also whatever the backend decides
// to return — not artificially capped or padded here.
export const trendingCatalog: TrendingItem[] = [
  { id: "tr-1", slug: "abandoned-rabbit-knight", title: "The Abandoned Rabbit Knight's New Mate: His Grand Priest", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop", views: 482300 },
  { id: "tr-2", slug: "the-arranged-marriage", title: "The Arranged Marriage", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop", views: 451900 },
  { id: "tr-3", slug: "my-savior-taught-me-to-obey", title: "My Savior Taught Me to Obey", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop", views: 439100 },
  { id: "tr-4", slug: "someone-like-xavier", title: "Someone Like Xavier", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop", views: 402700 },
  { id: "tr-5", slug: "alphas-forbidden-bride", title: "The Alpha's Forbidden Bride", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", views: 388600 },
  { id: "tr-6", slug: "married-to-the-enemy-duke", title: "Married to the Enemy Duke", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", views: 375200 },
  { id: "tr-7", slug: "contract-bride-real-heart", title: "Contract Bride, Real Heart", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop", views: 361800 },
  { id: "tr-8", slug: "ceos-runaway-bride", title: "The CEO's Runaway Bride", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", views: 348400 },
  { id: "tr-9", slug: "reborn-to-ruin-him", title: "Reborn to Ruin Him", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop", views: 336900 },
  { id: "tr-10", slug: "my-fake-fiance-the-general", title: "My Fake Fiancé, the General", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop", views: 322500 },
  { id: "tr-11", slug: "ceo-secret-wife", title: "The CEO's Secret Wife", poster: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop", views: 309100 },
  { id: "tr-12", slug: "marrying-my-rival", title: "Marrying My Rival", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop", views: 297600 },
  { id: "tr-13", slug: "billionaires-runaway-bride", title: "The Billionaire's Runaway Bride", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", views: 284200 },
  { id: "tr-14", slug: "second-chance-at-first-love", title: "Second Chance at First Love", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop", views: 271800 },
  { id: "tr-15", slug: "the-widow-duke-wants-me", title: "The Widow Duke Wants Me", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop", views: 259300 },
  { id: "tr-16", slug: "never-divorce-a-hidden-heiress", title: "Never Divorce a Hidden Heiress", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", views: 247900 },
  { id: "tr-17", slug: "reborn-as-the-villains-ex-wife", title: "Reborn as the Villain's Ex-Wife", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop", views: 235500 },
  { id: "tr-18", slug: "my-husband-is-secretly-a-duke", title: "My Husband Is Secretly a Duke", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop", views: 224100 },
  { id: "tr-19", slug: "bound-by-the-billionaires-will", title: "Bound by the Billionaire's Will", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop", views: 212700 },
  { id: "tr-20", slug: "married-to-the-enemy-duke-overnight", title: "Married to the Enemy Duke Overnight", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", views: 201300 },
  { id: "tr-21", slug: "the-alphas-forbidden-bride-awakens", title: "The Alpha's Forbidden Bride Awakens", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop", views: 189800 },
  { id: "tr-22", slug: "the-ceos-runaway-bride-returns", title: "The CEO's Runaway Bride Returns", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", views: 178400 },
  { id: "tr-23", slug: "my-fake-fiance-the-generals-only-son", title: "My Fake Fiancé, the General's Only Son", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop", views: 167000 },
  { id: "tr-24", slug: "the-widow-duke-wants-me-back", title: "The Widow Duke Wants Me Back", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop", views: 155600 },
  { id: "tr-25", slug: "contract-bride-real-heart-returns", title: "Contract Bride, Real Heart: Season Two", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop", views: 144200 },
  { id: "tr-26", slug: "someone-like-xavier-part-two", title: "Someone Like Xavier: Part Two", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop", views: 132800 },
  { id: "tr-27", slug: "the-alpha-and-the-outcast", title: "The Alpha and the Outcast", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", views: 121400 },
  { id: "tr-28", slug: "duke-of-my-nightmares", title: "Duke of My Nightmares", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop", views: 110000 },
  { id: "tr-29", slug: "the-generals-forbidden-bride", title: "The General's Forbidden Bride", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop", views: 98600 },
  { id: "tr-30", slug: "runaway-heiress-hidden-heart", title: "Runaway Heiress, Hidden Heart", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", views: 87200 },
];
