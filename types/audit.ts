/**
 * Audit Log Domain Types
 * Defines data structures for admin audit logs, query parameters, and diff calculations.
 */

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
  ip: string | null;
  createdAt: string;
}

export interface GetAuditLogsQuery {
  actorEmail?: string;
  actorId?: string;
  entityType?: string;
  action?: string;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortDir?: "asc" | "desc";
}

export interface PaginatedAuditLogsResult {
  entries: AuditLogItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FieldDiff {
  before: any;
  after: any;
}

export interface AuditDiffResult {
  added: Record<string, any>;
  removed: Record<string, any>;
  changed: Record<string, FieldDiff>;
  unchangedCount: number;
}
