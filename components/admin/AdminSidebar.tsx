"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  Clapperboard,
  Tv,
  Tags,
  Users,
  Settings,
  ShieldCheck,
  Headphones,
  LogOut,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import SidebarNavList from "@/components/SidebarNavList";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

const adminNavItems = [
  { label: "Dashboard", href: "/admin/dashboard", Icon: LayoutDashboard },
  { label: "Import", href: "/admin/import", Icon: Upload },
  { label: "Dramas", href: "/admin/dramas", Icon: Clapperboard },
  { label: "Channels", href: "/admin/channels", Icon: Tv },
  { label: "Genres", href: "/admin/genres", Icon: Tags },
  { label: "Users", href: "/admin/users", Icon: Users },
  { label: "Audit Log", href: "/admin/audit", Icon: ShieldCheck },
  { label: "Support", href: "/admin/support", Icon: Headphones },
  { label: "Settings", href: "/admin/settings", Icon: Settings },
];

export default function AdminSidebar() {
  const router = useRouter();
  const { logout } = useAdminAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-surface border-b border-border z-30 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            aria-label="Open Admin Navigation"
          >
            <Menu size={20} />
          </button>
          <span className="font-display font-bold text-base">
            <b className="text-primary">Drama</b>Short
            <span className="ml-1.5 text-xs font-semibold text-text-muted align-middle">Admin</span>
          </span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="text-xs font-semibold text-text-muted hover:text-danger px-2.5 py-1.5 rounded-md hover:bg-danger-soft transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? "..." : "Logout"}
        </button>
      </div>

      {/* Mobile Drawer (Slide-Over Modal) */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer Content */}
          <aside className="relative flex flex-col w-64 max-w-[80vw] bg-surface border-r border-border h-full shadow-2xl z-10">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <span className="font-display font-bold text-base">
                <b className="text-primary">Drama</b>Short
                <span className="ml-1.5 text-xs font-semibold text-text-muted align-middle">Admin</span>
              </span>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                aria-label="Close Admin Navigation"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
              <SidebarNavList
                items={adminNavItems}
                iconSize={17}
                onItemClick={() => setIsMobileOpen(false)}
              />
            </nav>
            <div className="p-3 border-t border-border">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-semibold text-text-muted hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <LogOut size={17} strokeWidth={2} />
                )}
                {isLoggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
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
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3 rounded-md px-3.5 py-2.5 text-sm font-semibold text-text-muted hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-50"
          >
            {isLoggingOut ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <LogOut size={17} strokeWidth={2} />
            )}
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>
    </>
  );
}
