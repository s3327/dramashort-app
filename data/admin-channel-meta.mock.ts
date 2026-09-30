export type AdminChannelStatus = "Active" | "Inactive";

export type AdminChannelMeta = {
  logo?: string; // not every channel has one synced yet
  status: AdminChannelStatus;
  lastSyncedAt: string; // ISO datetime — last time this channel's catalog was synced
};

// Mock data — stands in for admin-only fields joined onto the public
// channel list (data/channels.mock.ts) via slug, e.g. a
// "GET /admin/channels" response that includes ops metadata the public
// site doesn't need.
export const adminChannelMeta: Record<string, AdminChannelMeta> = {
  "dramashort-originals": {
    status: "Active",
    lastSyncedAt: "2026-08-31T09:12:00Z",
  },
  "velvet-frame": {
    status: "Active",
    lastSyncedAt: "2026-08-30T14:45:00Z",
  },
  "golden-hour-studios": {
    status: "Active",
    lastSyncedAt: "2026-08-29T22:03:00Z",
  },
  "nightingale-pictures": {
    status: "Inactive",
    lastSyncedAt: "2026-08-12T08:00:00Z",
  },
};
