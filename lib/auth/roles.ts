/**
 * Roles & Authorization Definitions
 *
 * Defines application roles and provides authoritative role resolution.
 * Security standard: ONLY app_metadata is trusted for authorization decisions.
 * user_metadata is user-writable from the browser and MUST NEVER be used for permissions.
 */

export type Role = "admin" | "editor";

export interface UserWithMetadata {
  id?: string;
  email?: string;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * Returns the verified user role from app_metadata.
 * Ignores user_metadata completely to prevent self-elevation vulnerabilities.
 */
export function getUserRole(user: UserWithMetadata | null | undefined): Role | null {
  if (!user || !user.app_metadata) {
    return null;
  }

  const role = user.app_metadata.role;
  if (role === "admin" || role === "editor") {
    return role;
  }

  return null;
}

/**
 * Checks whether the given user has one of the required roles.
 */
export function hasRole(
  user: UserWithMetadata | null | undefined,
  allowedRoles: Role[] = ["admin"]
): boolean {
  const role = getUserRole(user);
  return role !== null && allowedRoles.includes(role);
}
