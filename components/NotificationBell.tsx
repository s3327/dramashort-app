"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { NotificationItem } from "@/data/notifications.mock";
import { formatRelativeTime } from "@/lib/format";

/**
 * Checks whether the notifications feature flag is enabled.
 * Default: false (hidden until real persistent notifications backend is active).
 */
export function isNotificationsFeatureEnabled(): boolean {
  return process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS === "true";
}

export interface NotificationBellProps {
  forceEnabled?: boolean;
  initialItems?: NotificationItem[];
}

export default function NotificationBell({
  forceEnabled = false,
  initialItems,
}: NotificationBellProps = {}) {
  const isEnabled = forceEnabled || isNotificationsFeatureEnabled();
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialItems || []
  );
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy-load mock items only when the feature flag is actively enabled
  useEffect(() => {
    if (!isEnabled) return;
    if (initialItems) {
      setNotifications(initialItems);
      return;
    }

    let isMounted = true;
    import("@/data/notifications.mock").then((mod) => {
      if (isMounted) {
        setNotifications(mod.notificationItems);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isEnabled, initialItems]);

  // Close on outside click.
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  if (!isEnabled) {
    return null;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    // TODO: persist read state to the real notifications API once it exists.
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative p-2 rounded-full text-text/80 hover:text-primary hover:bg-surface transition-colors"
      >
        <Bell size={20} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-text-light text-[10px] font-bold px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-md border border-border bg-surface shadow-md overflow-hidden z-30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-text">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-link hover:text-link-hover transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-text-muted">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => {
                const content = (
                  <div
                    className={`px-4 py-3 text-sm transition-colors ${
                      n.read ? "text-text-muted" : "text-text bg-primary/5"
                    } hover:bg-primary/10`}
                  >
                    <p className="leading-snug">{n.message}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {formatRelativeTime(n.createdAt)}
                    </p>
                  </div>
                );

                return n.href ? (
                  <Link
                    key={n.id}
                    href={n.href}
                    onClick={() => {
                      markOneRead(n.id);
                      setIsOpen(false);
                    }}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markOneRead(n.id)}
                    className="block w-full text-left"
                  >
                    {content}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
