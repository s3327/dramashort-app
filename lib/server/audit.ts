import "server-only";
import { getContentAdminClient } from "@/lib/supabase/content";
import type {
  AuditLogItem,
  GetAuditLogsQuery,
  PaginatedAuditLogsResult,
} from "@/types/audit";
import { type Result, ok, err } from "@/lib/common/result";

export interface AuditLogEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  ip?: string | null;
}

/**
 * Records an entry into public.admin_audit_log using service-role client.
 * Non-blocking / fails open with console warning if database insertion fails.
 */
export async function recordAuditLog(
  entry: AuditLogEntry,
  client?: any
): Promise<boolean> {
  try {
    const adminClient = client ?? getContentAdminClient();
    const { error } = await adminClient.from("admin_audit_log").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      before: entry.before ?? null,
      after: entry.after ?? null,
      ip: entry.ip ?? null,
    });

    if (error) {
      console.warn("[recordAuditLog] Failed to record audit log entry:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[recordAuditLog] Unexpected error recording audit log:", err);
    return false;
  }
}

/**
 * Fetches server-side paginated and filtered audit logs.
 */
export async function getAuditLogsServer(
  query: GetAuditLogsQuery = {},
  client?: any
): Promise<Result<PaginatedAuditLogsResult, string>> {
  try {
    const adminClient = client ?? getContentAdminClient();
    const page = query.page && query.page >= 1 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize >= 1 ? Math.min(query.pageSize, 100) : 25;
    const sortAsc = query.sortDir === "asc";

    let dbQuery = adminClient
      .from("admin_audit_log")
      .select("*", { count: "exact" });

    if (query.actorEmail) {
      dbQuery = dbQuery.ilike("actor_email", `%${query.actorEmail}%`);
    }

    if (query.actorId) {
      dbQuery = dbQuery.eq("actor_id", query.actorId);
    }

    if (query.entityType && query.entityType !== "all") {
      dbQuery = dbQuery.eq("entity_type", query.entityType);
    }

    if (query.action && query.action !== "all") {
      dbQuery = dbQuery.ilike("action", `%${query.action}%`);
    }

    if (query.entityId) {
      dbQuery = dbQuery.eq("entity_id", query.entityId);
    }

    if (query.startDate) {
      dbQuery = dbQuery.gte("created_at", query.startDate);
    }

    if (query.endDate) {
      dbQuery = dbQuery.lte("created_at", query.endDate);
    }

    if (query.search) {
      const s = query.search;
      dbQuery = dbQuery.or(
        `action.ilike.%${s}%,actor_email.ilike.%${s}%,entity_id.ilike.%${s}%`
      );
    }

    dbQuery = dbQuery.order("created_at", { ascending: sortAsc });

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    dbQuery = dbQuery.range(from, to);

    const { data, count, error } = await dbQuery;

    if (error) {
      console.error("[getAuditLogsServer] Database query error:", error.message);
      return err(error.message || "Failed to load audit logs");
    }

    const total = count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const entries: AuditLogItem[] = (data || []).map((row: any) => ({
      id: row.id,
      actorId: row.actor_id,
      actorEmail: row.actor_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      before: row.before,
      after: row.after,
      ip: row.ip,
      createdAt: row.created_at,
    }));

    return ok({
      entries,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("[getAuditLogsServer] Unexpected error:", error);
    return err(error instanceof Error ? error.message : "Error loading audit logs");
  }
}

/**
 * Fetches a single audit log entry by ID.
 */
export async function getAuditLogByIdServer(
  id: string
): Promise<Result<AuditLogItem, string>> {
  try {
    const adminClient = getContentAdminClient();
    const { data, error } = await adminClient
      .from("admin_audit_log")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return err(error.message || "Failed to load audit entry");
    }
    if (!data) {
      return err("Audit entry not found");
    }

    return ok({
      id: data.id,
      actorId: data.actor_id,
      actorEmail: data.actor_email,
      action: data.action,
      entityType: data.entity_type,
      entityId: data.entity_id,
      before: data.before,
      after: data.after,
      ip: data.ip,
      createdAt: data.created_at,
    });
  } catch (error) {
    return err(error instanceof Error ? error.message : "Error loading audit entry");
  }
}
