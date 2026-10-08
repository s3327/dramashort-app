"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { navLinks } from "@/data/nav-links.mock";
import icon from "@/public/brand/dramashort-icon-circle.png";
import { useAuth } from "@/contexts/AuthContext";
import DesktopNav from "@/components/header/DesktopNav";
import MobileMenu from "@/components/header/MobileMenu";
import HeaderActions from "@/components/header/HeaderActions";

export default function Header() {
  const pathname = usePathname();
  const { isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);

  // "Channel" isn't a plain link — it needs a dropdown — so it's injected
  // between "New Release" and "My List" rather than living in navLinks.
  const myListIndex = navLinks.findIndex((l) => l.label === "My List");
  const linksBeforeChannel = navLinks.slice(0, myListIndex);
  const linksAfterChannel = navLinks.slice(myListIndex);

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock page scroll while the mobile menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src={icon} alt="DramaShort" className="h-10 w-10" priority />
          <span className="hidden sm:inline font-display font-semibold text-lg">
            DramaShort
          </span>
        </Link>

        <DesktopNav
          linksBeforeChannel={linksBeforeChannel}
          linksAfterChannel={linksAfterChannel}
          pathname={pathname}
        />

        {/* Mobile: menu toggle, centered */}
        <div className="flex md:hidden flex-1 items-center justify-center">
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-full text-text/80 hover:text-primary hover:bg-surface transition-colors"
          >
            {open ? <X size={22} strokeWidth={2} /> : <Menu size={22} strokeWidth={2} />}
          </button>
        </div>

        <HeaderActions isLoggedIn={isLoggedIn} pathname={pathname} />
      </div>

      <MobileMenu
        open={open}
        onClose={() => setOpen(false)}
        linksBeforeChannel={linksBeforeChannel}
        linksAfterChannel={linksAfterChannel}
        pathname={pathname}
      />
    </header>
  );
}
