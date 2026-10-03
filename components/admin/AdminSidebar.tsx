"use client";

import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Clapperboard,
  Tv,
  Tags,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import SidebarNavList from "@/components/SidebarNavList";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

// Trending is configured inside Settings later, not its own menu item.
// Most of these don't have real pages behind them yet — this establishes
// the admin nav structure; each section gets built out as its own task.
const adminNavItems = [
  { label: "Dashboard", href: "/admin/dashboard", Icon: LayoutDashboard },
  { label: "Import", href: "/admin/import", Icon: Upload },
  { label: "Dramas", href: "/admin/dramas", Icon: Clapperboard },
  { label: "Channels", href: "/admin/channels", Icon: Tv },
  { label: "Genres", href: "/admin/genres", Icon: Tags },
  { label: "Users", href: "/admin/users", Icon: Users },
  { label: "Settings", href: "/admin/settings", Icon: Settings },
];

export default function AdminSidebar() {
  const router = useRouter();
  const { logout } = useAdminAuth();

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface min-h-screen hidden md:flex md:flex-col">
      <div className="px-5 py-5 border-b border-border">
        <span className="font-display font-bold text-base">
          <b className="text-primary">Drama</b>Short
          <span className="ml-1.5 text-xs font-semibold text-text-muted align-middle">Admin</span>
        </span>
      </div>
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        <SidebarNavList items={adminNavItems} iconSize={17} />
      </nav>
      <div className="p-3 border-t border-border">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-semibold text-text-muted hover:text-danger hover:bg-danger-soft transition-colors"
        >
          <LogOut size={17} strokeWidth={2} />
          Logout
        </button>
      </div>
    </aside>
  );
}
