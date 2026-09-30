// Seed data for a first-time demo user's favorites — every other field
// (title, poster, synopsis, etc.) is looked up live from titles.mock.ts
// via getTitleBySlugOrFallback, so this file only needs to be the list of
// which slugs start out favorited.
export const defaultFavoriteSlugs: string[] = [
  "ceo-secret-wife",
  "reborn-to-ruin-him",
  "marrying-my-rival",
  "billionaires-runaway-bride",
  "contract-bride-real-heart",
  "my-fake-fiance-the-general",
  "second-chance-at-first-love",
  "the-widow-duke-wants-me",
  "the-arranged-marriage",
  "someone-like-xavier",
  "married-to-the-enemy-duke",
  "ceos-runaway-bride",
];
