import type { Role } from "./roles";

/**
 * Granular Administrative Permissions
 * Aligned with Task 16.9 permissions matrix:
 * - editor: dramas, episodes, channels, taxonomy, stats
 * - admin: everything, plus users, settings, roles, wallet grants, audit logs
 */
export type AdminPermission =
  | "dramas:read"
  | "dramas:write"
  | "episodes:read"
  | "episodes:write"
  | "channels:read"
  | "channels:write"
  | "taxonomy:read"
  | "taxonomy:write"
  | "stats:read"
  | "users:read"
  | "users:write"
  | "roles:write"
  | "settings:read"
  | "settings:write"
  | "audit:read"
  | "support:read"
  | "support:write"
  | "import:read"
  | "import:write"
  | "wallet:write";

/**
 * Explicit role-to-permissions mapping matrix.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly AdminPermission[]> = {
  editor: [
    "dramas:read",
    "dramas:write",
    "episodes:read",
    "episodes:write",
    "channels:read",
    "channels:write",
    "taxonomy:read",
    "taxonomy:write",
    "stats:read",
    "import:read",
    "import:write",
  ],
  admin: [
    "dramas:read",
    "dramas:write",
    "episodes:read",
    "episodes:write",
    "channels:read",
    "channels:write",
    "taxonomy:read",
    "taxonomy:write",
    "stats:read",
    "users:read",
    "users:write",
    "roles:write",
    "settings:read",
    "settings:write",
    "audit:read",
    "support:read",
    "support:write",
    "import:read",
    "import:write",
    "wallet:write",
  ],
} as const;

/**
 * Helper role groupings for route authorization guards.
 */
export const CONTENT_ROLES: Role[] = ["admin", "editor"];
export const ADMIN_ONLY_ROLES: Role[] = ["admin"];

/**
 * Evaluates whether a given role holds a specific permission.
 */
export function hasPermission(
  role: Role | null | undefined,
  permission: AdminPermission
): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Returns all permissions granted to a given role.
 */
export function getRolePermissions(role: Role | null | undefined): readonly AdminPermission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}
