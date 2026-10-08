/**
 * Validation rules and parameter normalization for Admin User Management (Task 16.7).
 */

import type {
  AdminUserRole,
  AdminUserRoleFilter,
  AdminUserSortBy,
  AdminUserSortDir,
  AdminUserStatusFilter,
  BanUserPayload,
  GetAdminUsersQuery,
  UnbanUserPayload,
  UpdateRolePayload,
} from "@/types/user-admin";

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: ValidationError[];
}

const VALID_ROLES: AdminUserRole[] = ["user", "editor", "admin"];
const VALID_STATUSES: AdminUserStatusFilter[] = ["all", "active", "banned"];
const VALID_ROLE_FILTERS: AdminUserRoleFilter[] = ["all", "user", "editor", "admin"];
const VALID_SORT_FIELDS: AdminUserSortBy[] = ["createdAt", "lastLoginAt", "displayName", "email"];
const VALID_SORT_DIRS: AdminUserSortDir[] = ["asc", "desc"];

/**
 * Validates payload for banning a user.
 */
export function validateBanUserPayload(payload: unknown): ValidationResult<BanUserPayload> {
  const errors: ValidationError[] = [];
  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  const result: BanUserPayload = {};

  // Duration
  if (raw.duration !== undefined && raw.duration !== null && raw.duration !== "") {
    if (typeof raw.duration !== "string") {
      errors.push({ field: "duration", message: "Duration must be a string (e.g., '24h', '168h', 'permanent')" });
    } else {
      const trimmed = raw.duration.trim().toLowerCase();
      if (trimmed === "permanent") {
        result.duration = "876000h"; // ~100 years
      } else if (/^\d+h$/.test(trimmed)) {
        const hours = parseInt(trimmed.replace("h", ""), 10);
        if (hours <= 0 || hours > 876000) {
          errors.push({ field: "duration", message: "Duration hours must be between 1 and 876000" });
        } else {
          result.duration = trimmed;
        }
      } else {
        errors.push({
          field: "duration",
          message: "Invalid duration format. Use '24h', '168h', '720h', or 'permanent'",
        });
      }
    }
  } else {
    // Default to permanent ban if duration is not specified
    result.duration = "876000h";
  }

  // Reason
  if (raw.reason !== undefined && raw.reason !== null) {
    if (typeof raw.reason !== "string") {
      errors.push({ field: "reason", message: "Reason must be a string" });
    } else {
      const reason = raw.reason.trim();
      if (reason.length > 500) {
        errors.push({ field: "reason", message: "Reason must not exceed 500 characters" });
      } else {
        result.reason = reason;
      }
    }
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? result : undefined,
    errors,
  };
}

/**
 * Validates payload for unbanning a user.
 */
export function validateUnbanUserPayload(payload: unknown): ValidationResult<UnbanUserPayload> {
  const errors: ValidationError[] = [];
  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;
  const result: UnbanUserPayload = {};

  if (raw.reason !== undefined && raw.reason !== null) {
    if (typeof raw.reason !== "string") {
      errors.push({ field: "reason", message: "Reason must be a string" });
    } else {
      const reason = raw.reason.trim();
      if (reason.length > 500) {
        errors.push({ field: "reason", message: "Reason must not exceed 500 characters" });
      } else {
        result.reason = reason;
      }
    }
  }

  return {
    ok: errors.length === 0,
    value: errors.length === 0 ? result : undefined,
    errors,
  };
}

/**
 * Validates payload for changing user role.
 */
export function validateUpdateRolePayload(payload: unknown): ValidationResult<UpdateRolePayload> {
  const errors: ValidationError[] = [];
  const raw = (typeof payload === "object" && payload !== null ? payload : {}) as Record<string, unknown>;

  if (!raw.role || typeof raw.role !== "string") {
    errors.push({ field: "role", message: "Role is required and must be a string" });
  } else {
    const role = raw.role.trim().toLowerCase() as AdminUserRole;
    if (!VALID_ROLES.includes(role)) {
      errors.push({
        field: "role",
        message: `Invalid role "${raw.role}". Allowed roles: ${VALID_ROLES.join(", ")}`,
      });
    } else {
      return {
        ok: true,
        value: { role },
        errors: [],
      };
    }
  }

  return {
    ok: false,
    errors,
  };
}

/**
 * Normalizes query parameters for listing admin users.
 */
export function parseAdminUsersQueryParams(searchParams: URLSearchParams): GetAdminUsersQuery {
  // Page
  const rawPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  // PageSize
  const rawPageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.min(rawPageSize, 100) : 10;

  // Query search
  const query = searchParams.get("query")?.trim() || "";

  // Status
  const rawStatus = (searchParams.get("status")?.toLowerCase() || "all") as AdminUserStatusFilter;
  const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "all";

  // Role
  const rawRole = (searchParams.get("role")?.toLowerCase() || "all") as AdminUserRoleFilter;
  const role = VALID_ROLE_FILTERS.includes(rawRole) ? rawRole : "all";

  // Sort
  const rawSortBy = (searchParams.get("sortBy") || "createdAt") as AdminUserSortBy;
  const sortBy = VALID_SORT_FIELDS.includes(rawSortBy) ? rawSortBy : "createdAt";

  const rawSortDir = (searchParams.get("sortDir")?.toLowerCase() || "desc") as AdminUserSortDir;
  const sortDir = VALID_SORT_DIRS.includes(rawSortDir) ? rawSortDir : "desc";

  return {
    page,
    pageSize,
    query,
    status,
    role,
    sortBy,
    sortDir,
  };
}
