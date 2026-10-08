"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { channels as defaultChannels } from "@/data/channels.mock";
import type { Channel } from "@/types/content";
import type { NavLink } from "@/data/nav-links.mock";

export default function MobileMenu({
  open,
  onClose,
  linksBeforeChannel,
  linksAfterChannel,
  pathname,
  channels = defaultChannels,
}: {
  open: boolean;
  onClose: () => void;
  linksBeforeChannel: NavLink[];
  linksAfterChannel: NavLink[];
  pathname: string;
  channels?: Channel[];
}) {
  const [isChannelOpen, setIsChannelOpen] = useState(false);

  // Collapse the channel accordion whenever the route changes.
  useEffect(() => {
    setIsChannelOpen(false);
  }, [pathname]);

  return (
    <>
      <div
        className="md:hidden fixed inset-x-0 top-16 bottom-0 bg-black/40 transition-opacity"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transitionDuration: open ? "300ms" : "150ms",
        }}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={`md:hidden grid overflow-hidden bg-surface border-b border-border shadow-md transition-[grid-template-rows] ${
          open ? "grid-rows-[1fr] duration-300 ease-brand" : "grid-rows-[0fr] duration-150 ease-in"
        }`}
      >
        <nav className="overflow-hidden">
          <ul className="flex flex-col py-2">
            {linksBeforeChannel.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`block px-6 py-3.5 text-base font-semibold transition-colors ${
                      isActive
                        ? "text-primary bg-primary/5"
                        : "text-text/85 hover:text-primary hover:bg-surface"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}

            {/* Channel — tap to expand/collapse the channel list */}
            <li>
              <button
                type="button"
                onClick={() => setIsChannelOpen((v) => !v)}
                aria-expanded={isChannelOpen}
                className="w-full flex items-center justify-between px-6 py-3.5 text-base font-semibold text-text/85 hover:text-primary hover:bg-surface transition-colors"
              >
                Channel
                <ChevronDown
                  size={18}
                  strokeWidth={2.5}
                  className={`transition-transform ${isChannelOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-brand ${
                  isChannelOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <ul className="overflow-hidden">
                  {channels.map((c) => (
                    <li key={c.slug}>
                      <Link
                        href={`/channel/${c.slug}`}
                        onClick={onClose}
                        className="block px-10 py-3 text-sm font-semibold text-text-muted hover:text-primary hover:bg-surface transition-colors"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </li>

            {linksAfterChannel.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`block px-6 py-3.5 text-base font-semibold transition-colors ${
                      isActive
                        ? "text-primary bg-primary/5"
                        : "text-text/85 hover:text-primary hover:bg-surface"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}
