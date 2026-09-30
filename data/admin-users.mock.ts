export type AdminUserStatus = "Free" | "VIP";

export type AdminUser = {
  id: string;
  username: string;
  email: string;
  status: AdminUserStatus;
  createdAt: string; // ISO date
  lastLoginAt: string; // ISO date
  socialLogins: string[]; // e.g. ["Google"], ["Telegram"], or [] if none bound
};

// Mock data — stands in for a "GET /admin/users" response.
export const adminUsers: AdminUser[] = [
  { id: "u-1", username: "jamie.doe", email: "jamie.doe@example.com", status: "VIP", createdAt: "2026-02-14", lastLoginAt: "2026-08-31T10:12:00Z", socialLogins: ["Google"] },
  { id: "u-2", username: "mira.santos", email: "mira.santos@example.com", status: "Free", createdAt: "2026-05-02", lastLoginAt: "2026-08-30T21:05:00Z", socialLogins: [] },
  { id: "u-3", username: "kevin.ray", email: "kevin.ray@example.com", status: "VIP", createdAt: "2025-11-20", lastLoginAt: "2026-08-31T08:40:00Z", socialLogins: ["Telegram"] },
  { id: "u-4", username: "priya.k", email: "priya.k@example.com", status: "Free", createdAt: "2026-07-08", lastLoginAt: "2026-08-25T15:20:00Z", socialLogins: [] },
  { id: "u-5", username: "ahmad.fauzi", email: "ahmad.fauzi@example.com", status: "VIP", createdAt: "2025-09-12", lastLoginAt: "2026-08-29T12:00:00Z", socialLogins: ["Google", "Telegram"] },
  { id: "u-6", username: "lena.wu", email: "lena.wu@example.com", status: "Free", createdAt: "2026-06-18", lastLoginAt: "2026-08-14T09:55:00Z", socialLogins: [] },
  { id: "u-7", username: "carlos.mendes", email: "carlos.mendes@example.com", status: "Free", createdAt: "2026-04-03", lastLoginAt: "2026-08-28T19:30:00Z", socialLogins: ["Google"] },
  { id: "u-8", username: "sofia.rossi", email: "sofia.rossi@example.com", status: "VIP", createdAt: "2025-12-29", lastLoginAt: "2026-08-31T07:15:00Z", socialLogins: ["Google"] },
  { id: "u-9", username: "budi.santoso", email: "budi.santoso@example.com", status: "Free", createdAt: "2026-08-01", lastLoginAt: "2026-08-20T13:45:00Z", socialLogins: ["Telegram"] },
  { id: "u-10", username: "nadia.putri", email: "nadia.putri@example.com", status: "VIP", createdAt: "2026-01-25", lastLoginAt: "2026-08-30T06:10:00Z", socialLogins: [] },
  { id: "u-11", username: "tomasz.k", email: "tomasz.k@example.com", status: "Free", createdAt: "2026-03-11", lastLoginAt: "2026-07-30T11:00:00Z", socialLogins: [] },
  { id: "u-12", username: "hana.kim", email: "hana.kim@example.com", status: "VIP", createdAt: "2025-10-05", lastLoginAt: "2026-08-31T02:50:00Z", socialLogins: ["Google", "Telegram"] },
  { id: "u-13", username: "grace.n", email: "grace.n@example.com", status: "Free", createdAt: "2026-07-22", lastLoginAt: "2026-08-27T17:25:00Z", socialLogins: [] },
  { id: "u-14", username: "farid.rahman", email: "farid.rahman@example.com", status: "Free", createdAt: "2026-06-30", lastLoginAt: "2026-08-10T08:00:00Z", socialLogins: ["Telegram"] },
  { id: "u-15", username: "olivia.b", email: "olivia.b@example.com", status: "VIP", createdAt: "2025-08-19", lastLoginAt: "2026-08-31T14:05:00Z", socialLogins: ["Google"] },
  { id: "u-16", username: "diego.torres", email: "diego.torres@example.com", status: "Free", createdAt: "2026-05-27", lastLoginAt: "2026-08-05T10:40:00Z", socialLogins: [] },
  { id: "u-17", username: "wulan.dari", email: "wulan.dari@example.com", status: "Free", createdAt: "2026-04-15", lastLoginAt: "2026-08-22T16:15:00Z", socialLogins: ["Google"] },
  { id: "u-18", username: "ethan.clarke", email: "ethan.clarke@example.com", status: "VIP", createdAt: "2025-07-02", lastLoginAt: "2026-08-29T20:00:00Z", socialLogins: [] },
];
