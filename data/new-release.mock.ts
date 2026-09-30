export type NewReleaseTitle = {
  id: string;
  title: string;
  poster: string;
  href: string;
};

// Mock data — stands in for a "GET /titles?sort=newest&limit=12" response.
export const newReleaseTitles: NewReleaseTitle[] = [
  {
    id: "nr-1",
    title: "The Arranged Marriage",
    poster:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600&auto=format&fit=crop",
    href: "/drama/the-arranged-marriage",
  },
  {
    id: "nr-2",
    title: "Bound by the Billionaire's Will",
    poster:
      "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=600&auto=format&fit=crop",
    href: "/drama/bound-by-the-billionaires-will",
  },
  {
    id: "nr-3",
    title: "My Husband Is Secretly a Duke",
    poster:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?q=80&w=600&auto=format&fit=crop",
    href: "/drama/my-husband-is-secretly-a-duke",
  },
  {
    id: "nr-4",
    title: "Second Chance at First Love",
    poster:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop",
    href: "/drama/second-chance-at-first-love",
  },
  {
    id: "nr-5",
    title: "The Widow Duke Wants Me Back",
    poster:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop",
    href: "/drama/the-widow-duke-wants-me-back",
  },
  {
    id: "nr-6",
    title: "Never Divorce a Hidden Heiress",
    poster:
      "https://images.unsplash.com/photo-1500336624523-d727130c3328?q=80&w=600&auto=format&fit=crop",
    href: "/drama/never-divorce-a-hidden-heiress",
  },
  {
    id: "nr-7",
    title: "My Fake Fiancé, the General's Only Son",
    poster:
      "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=600&auto=format&fit=crop",
    href: "/drama/my-fake-fiance-the-generals-only-son",
  },
  {
    id: "nr-8",
    title: "Reborn as the Villain's Ex-Wife",
    poster:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop",
    href: "/drama/reborn-as-the-villains-ex-wife",
  },
  {
    id: "nr-9",
    title: "Contract Bride, Real Heart",
    poster:
      "https://images.unsplash.com/photo-1503104834685-7205e8607eb9?q=80&w=600&auto=format&fit=crop",
    href: "/drama/contract-bride-real-heart",
  },
  {
    id: "nr-10",
    title: "The CEO's Runaway Bride Returns",
    poster:
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?q=80&w=600&auto=format&fit=crop",
    href: "/drama/the-ceos-runaway-bride-returns",
  },
  {
    id: "nr-11",
    title: "Married to the Enemy Duke Overnight",
    poster:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop",
    href: "/drama/married-to-the-enemy-duke-overnight",
  },
  {
    id: "nr-12",
    title: "The Alpha's Forbidden Bride Awakens",
    poster:
      "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=600&auto=format&fit=crop",
    href: "/drama/the-alphas-forbidden-bride-awakens",
  },
];
