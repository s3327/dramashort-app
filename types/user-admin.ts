/**
 * Admin User Management Domain Types (Task 16.7).
 */

export type AdminUserRole = "user" | "editor" | "admin";

export type AdminUserStatusFilter = "all" | "active" | "banned";
export type AdminUserRoleFilter = "all" | "user" | "editor" | "admin";
export type AdminUserSortBy = "createdAt" | "lastLoginAt" | "displayName" | "email";
export type AdminUserSortDir = "asc" | "desc";

export interface AdminManagedUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: AdminUserRole;
  isBanned: boolean;
  bannedUntil: string | null;
  banReason: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  socialLogins: string[];
  watchHistoryCount: number;
  favoritesCount: number;
}

export interface AdminUserDetail extends AdminManagedUser {
  identities?: Array<{
    id: string;
    provider: string;
    createdAt?: string;
  }>;
  recentActivity?: {
    lastWatchedTitle?: string | null;
    lastWatchedAt?: string | null;
  };
}

export interface GetAdminUsersQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: AdminUserStatusFilter;
  role?: AdminUserRoleFilter;
  sortBy?: AdminUserSortBy;
  sortDir?: AdminUserSortDir;
}

export interface PaginatedAdminUsersResult {
  items: AdminManagedUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface BanUserPayload {
  duration?: string; // e.g. "24h", "168h", "720h", "876000h"
  reason?: string;
}

export interface UnbanUserPayload {
  reason?: string;
}

export interface UpdateRolePayload {
  role: AdminUserRole;
}
