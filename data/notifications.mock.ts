export type NotificationItem = {
  id: string;
  message: string;
  href?: string;
  createdAt: string; // ISO datetime
  read: boolean;
};

// Mock data — stands in for a "GET /me/notifications" response.
export const notificationItems: NotificationItem[] = [
  {
    id: "n-1",
    message: "New episode of \"The CEO's Secret Wife\" just dropped.",
    href: "/drama/ceo-secret-wife",
    createdAt: "2026-09-04T09:10:00Z",
    read: false,
  },
  {
    id: "n-2",
    message: "The title you requested was added to DramaShort.",
    href: "/search",
    createdAt: "2026-09-03T18:45:00Z",
    read: false,
  },
  {
    id: "n-3",
    message: "Your report about a video playback issue has been resolved.",
    createdAt: "2026-09-02T12:00:00Z",
    read: false,
  },
  {
    id: "n-4",
    message: "This week's Trending list just updated.",
    href: "/trending",
    createdAt: "2026-08-30T08:00:00Z",
    read: true,
  },
  {
    id: "n-5",
    message: "Welcome to DramaShort! Start by favoriting a title to see it here.",
    createdAt: "2026-08-28T10:00:00Z",
    read: true,
  },
];
