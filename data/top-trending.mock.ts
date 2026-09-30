export type TrendingTitle = {
  id: string;
  rank: number;
  title: string;
  poster: string;
  href: string;
};

// Mock data — stands in for a "GET /trending?scope=global&limit=10" response,
// pre-sorted by total views across all users.
export const trendingTitles: TrendingTitle[] = [
  {
    id: "tt-1",
    rank: 1,
    title: "The Abandoned Rabbit Knight's New Mate: His Grand Priest",
    poster:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop",
    href: "/drama/abandoned-rabbit-knight",
  },
  {
    id: "tt-2",
    rank: 2,
    title: "The Arranged Marriage",
    poster:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop",
    href: "/drama/the-arranged-marriage",
  },
  {
    id: "tt-3",
    rank: 3,
    title: "My Savior Taught Me to Obey",
    poster:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop",
    href: "/drama/my-savior-taught-me-to-obey",
  },
  {
    id: "tt-4",
    rank: 4,
    title: "Someone Like Xavier",
    poster:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop",
    href: "/drama/someone-like-xavier",
  },
  {
    id: "tt-5",
    rank: 5,
    title: "The Alpha's Forbidden Bride",
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    href: "/drama/alphas-forbidden-bride",
  },
  {
    id: "tt-6",
    rank: 6,
    title: "Married to the Enemy Duke",
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop",
    href: "/drama/married-to-the-enemy-duke",
  },
  {
    id: "tt-7",
    rank: 7,
    title: "Contract Bride, Real Heart",
    poster:
      "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop",
    href: "/drama/contract-bride-real-heart",
  },
  {
    id: "tt-8",
    rank: 8,
    title: "The CEO's Runaway Bride",
    poster:
      "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop",
    href: "/drama/ceos-runaway-bride",
  },
  {
    id: "tt-9",
    rank: 9,
    title: "Reborn to Ruin Him",
    poster:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
    href: "/drama/reborn-to-ruin-him",
  },
  {
    id: "tt-10",
    rank: 10,
    title: "My Fake Fiancé, the General",
    poster:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop",
    href: "/drama/my-fake-fiance-the-general",
  },
];
