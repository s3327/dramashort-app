import { UserRound, Heart, History, Settings } from "lucide-react";
import SidebarNavList from "@/components/SidebarNavList";

// Billing intentionally left out — will be added once the site and backend
// are solid enough to support it.
const accountNavItems = [
  { label: "Account", href: "/account", Icon: UserRound },
  { label: "Favorite", href: "/account/favorite", Icon: Heart },
  { label: "History", href: "/account/history", Icon: History },
  { label: "Setting", href: "/account/settings", Icon: Settings },
];

export default function AccountSidebar() {
  return (
    <aside className="w-full lg:w-60 shrink-0">
      <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible bg-surface border border-border rounded-lg shadow-sm p-3">
        <SidebarNavList items={accountNavItems} iconSize={18} itemClassName="whitespace-nowrap" />
      </nav>
    </aside>
  );
}
