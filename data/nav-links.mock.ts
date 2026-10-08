export type NavLink = {
  label: string;
  href: string;
};

// Mock data — replace with real routes/categories once IA is finalized.
export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Trending", href: "/trending" },
  { label: "Genres", href: "/genres" },
  { label: "New Release", href: "/new-release" },
  { label: "My List", href: "/account/favorite" },
];
