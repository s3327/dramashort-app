"use client";

import { UserRound, Heart, History, Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import SidebarNavList from "@/components/SidebarNavList";
import { useAuth } from "@/contexts/AuthContext";

const accountNavItems = [
  { label: "Account", href: "/account", Icon: UserRound },
  { label: "Favorite", href: "/account/favorite", Icon: Heart },
  { label: "History", href: "/account/history", Icon: History },
  { label: "Setting", href: "/account/settings", Icon: Settings },
];

export default function AccountSidebar() {
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/home");
  };

  return (
    <aside className="w-full lg:w-60 shrink-0">
      <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible bg-surface border border-border rounded-lg shadow-sm p-3">
        <SidebarNavList items={accountNavItems} iconSize={18} itemClassName="whitespace-nowrap" />
        <div className="hidden lg:block my-2 border-t border-border" />
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-danger/80 hover:text-danger hover:bg-danger/10 rounded-md transition-colors w-full text-left"
        >
          <LogOut size={18} strokeWidth={2} />
          <span>Log Out</span>
        </button>
      </nav>
    </aside>
  );
}
