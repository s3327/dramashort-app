export type FooterLink = {
  label: string;
  href: string;
};

export type FooterLinkGroup = {
  heading: string;
  links: FooterLink[];
};

// Mock data — Help Center doesn't have a real page yet, so it stays a "#"
// placeholder. Contact Us, FAQ, and the Legal links all point to real pages.
export const footerLinkGroups: FooterLinkGroup[] = [
  {
    heading: "Support",
    links: [
      { label: "Help Center", href: "#" },
      { label: "Contact Us", href: "/contact" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Content Guidelines", href: "/content-guidelines" },
    ],
  },
];
