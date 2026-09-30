import Image from "next/image";
import Link from "next/link";
import { Instagram, Twitter, Youtube, Facebook } from "lucide-react";
import { navLinks } from "@/data/nav-links.mock";
import { footerLinkGroups } from "@/data/footer-links.mock";
import icon from "@/public/brand/dramashort-icon-circle.png";

const socialLinks = [
  { label: "Instagram", href: "#", Icon: Instagram },
  { label: "Twitter", href: "#", Icon: Twitter },
  { label: "Youtube", href: "#", Icon: Youtube },
  { label: "Facebook", href: "#", Icon: Facebook },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="max-w-[1200px] mx-auto px-6 pt-12 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10 pb-10">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <Link href="/home" className="flex items-center gap-2.5">
              <Image src={icon} alt="DramaShort" className="h-9 w-9" />
              <span className="font-display font-semibold text-lg text-text">
                DramaShort
              </span>
            </Link>
            <p className="mt-3 text-sm text-text-muted max-w-[240px] leading-relaxed">
              Vertical dramas built for a 12-minute break — revenge, rebirth,
              forbidden marriages, repeat.
            </p>
            <div className="flex items-center gap-2 mt-4">
              {socialLinks.map(({ label, href, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="p-2 rounded-full text-text-muted hover:text-primary hover:bg-surface-raised transition-colors"
                >
                  <Icon size={18} strokeWidth={2} />
                </Link>
              ))}
            </div>
          </div>

          {/* Browse column — reuses the same nav data as the header */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Browse</h3>
            <ul className="space-y-2">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-text-muted hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support / Legal columns */}
          {footerLinkGroups.map((group) => (
            <div key={group.heading}>
              <h3 className="text-sm font-semibold text-text mb-3">
                {group.heading}
              </h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-text-muted hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted/70 text-center sm:text-left">
          <p>© {year} DramaShort. All rights reserved.</p>
          <p>Content for 16+ · vertical dramas from partner studios worldwide</p>
        </div>
      </div>
    </footer>
  );
}
