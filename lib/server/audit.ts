import "server-only";
import { getContentAdminClient } from "@/lib/supabase/content";

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
export async function recordAuditLog(entry: AuditLogEntry): Promise<boolean> {
  try {
    const adminClient = getContentAdminClient();
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
