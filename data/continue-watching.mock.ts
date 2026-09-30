export type ContinueWatchingItem = {
  id: string;
  title: string;
  episodeLabel: string;
  progress: number; // 0–1, fraction of the episode watched
  poster: string;
  href: string;
};

// Mock data — stands in for a "GET /me/continue-watching" response.
// In production this endpoint can return hundreds of rows (a user's full
// watch history); the /home page is only ever allowed to render the 6
// most recent, enforced in <ContinueWatching /> via .slice(0, 6) rather
// than by trusting the data source to already be capped.
export const continueWatchingHistory: ContinueWatchingItem[] = [
  {
    id: "cw-1",
    title: "The CEO's Secret Wife",
    episodeLabel: "EP 12 of 40",
    progress: 0.62,
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    href: "/drama/ceo-secret-wife",
  },
  {
    id: "cw-2",
    title: "Reborn to Ruin Him",
    episodeLabel: "EP 3 of 32",
    progress: 0.18,
    poster:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop",
    href: "/drama/reborn-to-ruin-him",
  },
  {
    id: "cw-3",
    title: "Marrying My Rival",
    episodeLabel: "EP 27 of 28",
    progress: 0.91,
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop",
    href: "/drama/marrying-my-rival",
  },
  {
    id: "cw-4",
    title: "The Billionaire's Runaway Bride",
    episodeLabel: "EP 8 of 36",
    progress: 0.44,
    poster:
      "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop",
    href: "/drama/billionaires-runaway-bride",
  },
  {
    id: "cw-5",
    title: "Contract Bride, Real Heart",
    episodeLabel: "EP 15 of 24",
    progress: 0.7,
    poster:
      "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop",
    href: "/drama/contract-bride-real-heart",
  },
  {
    id: "cw-6",
    title: "My Fake Fiancé, the General",
    episodeLabel: "EP 1 of 30",
    progress: 0.05,
    poster:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
    href: "/drama/my-fake-fiance-the-general",
  },
  {
    id: "cw-7",
    title: "Second Chance at First Love",
    episodeLabel: "EP 20 of 20",
    progress: 0.98,
    poster:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop",
    href: "/drama/second-chance-at-first-love",
  },
  {
    id: "cw-8",
    title: "The Widow Duke Wants Me",
    episodeLabel: "EP 9 of 26",
    progress: 0.33,
    poster:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop",
    href: "/drama/the-widow-duke-wants-me",
  },
];
