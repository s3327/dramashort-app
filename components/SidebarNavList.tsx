"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export type SidebarNavItem = {
  label: string;
  href: string;
  Icon: LucideIcon;
};

export default function SidebarNavList({
  items,
  iconSize = 18,
  itemClassName = "",
  onItemClick,
}: {
  items: SidebarNavItem[];
  iconSize?: number;
  itemClassName?: string;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map(({ label, href, Icon }) => {
        const active =
          pathname === href ||
          (href !== "/admin" &&
            href !== "/admin/dashboard" &&
            href !== "/" &&
            pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            onClick={onItemClick}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-text-muted hover:text-text hover:bg-surface"
            } ${itemClassName}`}
          >
            <Icon size={iconSize} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </>
  );
}
