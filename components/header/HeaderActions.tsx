import Link from "next/link";
import { User } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SearchDropdown from "@/components/SearchDropdown";

export default function HeaderActions({
  isLoggedIn,
  pathname,
}: {
  isLoggedIn: boolean;
  pathname: string;
}) {
  return (
    <div className="flex items-center gap-4 shrink-0">
      <SearchDropdown />
      {isLoggedIn && <NotificationBell />}
      <div className="relative group">
        {/* Routes straight to /account when logged in, otherwise to
            /login with a redirect back to wherever the user was. */}
        <Link
          href={isLoggedIn ? "/account" : `/login?redirect=${encodeURIComponent(pathname)}`}
          aria-label={isLoggedIn ? "Account" : "Login"}
          className="p-2 rounded-full text-text/80 hover:text-primary hover:bg-surface transition-colors block"
        >
          <User size={20} strokeWidth={2} />
        </Link>
        <span className="pointer-events-none absolute top-full right-0 mt-2 whitespace-nowrap rounded-md bg-text text-text-inverse text-xs font-semibold px-2.5 py-1.5 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 shadow-md">
          {isLoggedIn ? "Account" : "Login"}
        </span>
      </div>
    </div>
  );
}
