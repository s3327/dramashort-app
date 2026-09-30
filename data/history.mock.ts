export type HistoryItem = {
  id: string;
  slug: string;
  title: string;
  poster: string;
  episodeLabel: string;
  progress: number; // 0–1
  watchedAt: string; // ISO date
};

// Mock data — stands in for a "GET /me/history?since=60d" response.
// Every watch event is retained in the real database indefinitely; this
// mock only represents the last-60-days window the History page shows.
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

export const historyItems: HistoryItem[] = [
  { id: "h-1", slug: "ceo-secret-wife", title: "The CEO's Secret Wife", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 12 of 40", progress: 0.62, watchedAt: daysAgo(0) },
  { id: "h-2", slug: "reborn-to-ruin-him", title: "Reborn to Ruin Him", poster: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 3 of 32", progress: 0.18, watchedAt: daysAgo(0) },
  { id: "h-3", slug: "marrying-my-rival", title: "Marrying My Rival", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 27 of 28", progress: 0.91, watchedAt: daysAgo(1) },
  { id: "h-4", slug: "billionaires-runaway-bride", title: "The Billionaire's Runaway Bride", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 8 of 36", progress: 0.44, watchedAt: daysAgo(1) },
  { id: "h-5", slug: "contract-bride-real-heart", title: "Contract Bride, Real Heart", poster: "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 15 of 24", progress: 0.7, watchedAt: daysAgo(2) },
  { id: "h-6", slug: "my-fake-fiance-the-general", title: "My Fake Fiancé, the General", poster: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 1 of 30", progress: 0.05, watchedAt: daysAgo(2) },
  { id: "h-7", slug: "second-chance-at-first-love", title: "Second Chance at First Love", poster: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 20 of 20", progress: 0.98, watchedAt: daysAgo(5) },
  { id: "h-8", slug: "the-widow-duke-wants-me", title: "The Widow Duke Wants Me", poster: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 9 of 26", progress: 0.33, watchedAt: daysAgo(5) },
  { id: "h-9", slug: "the-arranged-marriage", title: "The Arranged Marriage", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 30 of 30", progress: 1, watchedAt: daysAgo(9) },
  { id: "h-10", slug: "someone-like-xavier", title: "Someone Like Xavier", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 6 of 24", progress: 0.25, watchedAt: daysAgo(9) },
  { id: "h-11", slug: "alphas-forbidden-bride", title: "The Alpha's Forbidden Bride", poster: "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 38 of 38", progress: 1, watchedAt: daysAgo(16) },
  { id: "h-12", slug: "married-to-the-enemy-duke", title: "Married to the Enemy Duke", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 11 of 34", progress: 0.32, watchedAt: daysAgo(16) },
  { id: "h-13", slug: "ceos-runaway-bride", title: "The CEO's Runaway Bride", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 26 of 26", progress: 1, watchedAt: daysAgo(24) },
  { id: "h-14", slug: "abandoned-rabbit-knight", title: "The Abandoned Rabbit Knight's New Mate: His Grand Priest", poster: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 40 of 45", progress: 0.89, watchedAt: daysAgo(24) },
  { id: "h-15", slug: "my-savior-taught-me-to-obey", title: "My Savior Taught Me to Obey", poster: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 2 of 26", progress: 0.08, watchedAt: daysAgo(38) },
  { id: "h-16", slug: "the-ceos-runaway-bride-returns", title: "The CEO's Runaway Bride Returns", poster: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 5 of 26", progress: 0.19, watchedAt: daysAgo(38) },
  { id: "h-17", slug: "never-divorce-a-hidden-heiress", title: "Never Divorce a Hidden Heiress", poster: "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 18 of 28", progress: 0.64, watchedAt: daysAgo(52) },
  { id: "h-18", slug: "my-husband-is-secretly-a-duke", title: "My Husband Is Secretly a Duke", poster: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop", episodeLabel: "EP 22 of 22", progress: 1, watchedAt: daysAgo(59) },
];
