import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { channels as defaultChannels } from "@/data/channels.mock";
import type { Channel } from "@/types/content";
import type { NavLink } from "@/data/nav-links.mock";

function NavLinkItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={`text-sm font-semibold transition-colors ${
        active ? "text-primary" : "text-text/80 hover:text-primary"
      }`}
    >
      {link.label}
    </Link>
  );
}

export default function DesktopNav({
  linksBeforeChannel,
  linksAfterChannel,
  pathname,
  channels = defaultChannels,
}: {
  linksBeforeChannel: NavLink[];
  linksAfterChannel: NavLink[];
  pathname: string;
  channels?: Channel[];
}) {
  return (
    <nav className="hidden md:flex flex-1 items-center justify-center gap-8">
      {linksBeforeChannel.map((link) => (
        <NavLinkItem key={link.href} link={link} active={pathname === link.href} />
      ))}

      {/* Channel — hover reveals the channel list */}
      <div className="relative group">
        <button
          type="button"
          className="flex items-center gap-1 text-sm font-semibold text-text/80 hover:text-primary transition-colors"
        >
          Channel
          <ChevronDown
            size={14}
            strokeWidth={2.5}
            className="transition-transform duration-150 group-hover:rotate-180"
          />
        </button>
        <div className="absolute left-1/2 -translate-x-1/2 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150">
          <div className="w-56 rounded-md border border-border bg-surface shadow-md py-2">
            {channels.map((c) => (
              <Link
                key={c.slug}
                href={`/channel/${c.slug}`}
                className="block px-4 py-2.5 text-sm text-text-muted hover:text-primary hover:bg-surface transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {linksAfterChannel.map((link) => (
        <NavLinkItem key={link.href} link={link} active={pathname === link.href} />
      ))}
    </nav>
  );
}
