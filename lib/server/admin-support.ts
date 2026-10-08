import "server-only";
import { createUserServiceRoleClient } from "@/lib/supabase/user-server";
import { type Result, ok, err } from "@/lib/common/result";
import {
  type SupportTicketItem,
  type SupportTicketCounts,
  type GetSupportTicketsQuery,
  type PaginatedSupportTicketsResult,
  type UpdateSupportTicketInput,
  type ReplySupportTicketInput,
  type SupportCategory,
  type SupportStatus,
  type SupportPriority,
} from "@/types/support";
import { parseSupportTicketsQueryParams } from "@/lib/validation/support";
import { recordAuditLog } from "./audit";

/**
 * Maps database row to domain SupportTicketItem.
 */
export function mapSupportTicketRowToItem(row: any): SupportTicketItem {
  let parsedContext: Record<string, unknown> = {};
  if (row.context) {
    if (typeof row.context === "object" && !Array.isArray(row.context)) {
      parsedContext = row.context;
    } else if (typeof row.context === "string") {
      try {
        parsedContext = JSON.parse(row.context);
      } catch {
        parsedContext = {};
      }
    }
  }

  return {
    id: row.id,
    userId: row.user_id || null,
    email: row.email,
    category: row.category as SupportCategory,
    subject: row.subject,
    message: row.message,
    context: parsedContext,
    status: row.status as SupportStatus,
    priority: (row.priority || "normal") as SupportPriority,
    assignedTo: row.assigned_to || null,
    assignedEmail: row.assigned_email || null,
    adminNotes: row.admin_notes || null,
    resolvedAt: row.resolved_at || null,
    resolvedBy: row.resolved_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

/**
 * Retrieves paginated support tickets with filtering and status statistics.
 */
export async function getAdminSupportTicketsServer(
  query: GetSupportTicketsQuery | URLSearchParams,
  client?: any
): Promise<Result<PaginatedSupportTicketsResult, string>> {
  try {
    const dbClient = client || createUserServiceRoleClient();
    const { page, pageSize, status, category, priority, assigned, search } =
      parseSupportTicketsQueryParams(query);

    let queryBuilder = dbClient
      .from("support_tickets")
      .select("*", { count: "exact" });

    // Status filter
    if (status !== "all") {
      queryBuilder = queryBuilder.eq("status", status);
    }

    // Category filter
    if (category !== "all") {
      queryBuilder = queryBuilder.eq("category", category);
    }

    // Priority filter
    if (priority !== "all") {
      queryBuilder = queryBuilder.eq("priority", priority);
    }

    // Assigned filter
    if (assigned === "unassigned") {
      queryBuilder = queryBuilder.is("assigned_to", null);
    } else if (assigned !== "all" && assigned !== "me") {
      queryBuilder = queryBuilder.eq("assigned_to", assigned);
    }

    // Keyword search
    if (search) {
      queryBuilder = queryBuilder.or(
        `email.ilike.%${search}%,subject.ilike.%${search}%,message.ilike.%${search}%`
      );
    }

    // Pagination & Sort
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    queryBuilder = queryBuilder
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, count, error } = await queryBuilder;

    if (error) {
      console.error("[getAdminSupportTicketsServer] Query error:", error);
      return err(error.message || "Failed to fetch support tickets.");
    }

    const total = count ?? (data?.length || 0);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const items = (data || []).map(mapSupportTicketRowToItem);

    // Compute status counts for summary header
    let counts: SupportTicketCounts = {
      total: 0,
      open: 0,
      inProgress: 0,
      resolved: 0,
    };

    try {
      const { data: countRows } = await dbClient
        .from("support_tickets")
        .select("status");

      if (countRows && Array.isArray(countRows)) {
        let open = 0;
        let inProgress = 0;
        let resolved = 0;
        for (const r of countRows) {
          if (r.status === "open") open++;
          else if (r.status === "in_progress") inProgress++;
          else if (r.status === "resolved") resolved++;
        }
        counts = {
          total: countRows.length,
          open,
          inProgress,
          resolved,
        };
      }
    } catch {
      // In case status aggregation fails, fallback to items count
      counts = {
        total,
        open: items.filter((i: SupportTicketItem) => i.status === "open").length,
        inProgress: items.filter((i: SupportTicketItem) => i.status === "in_progress").length,
        resolved: items.filter((i: SupportTicketItem) => i.status === "resolved").length,
      };
    }

    return ok({
      items,
      total,
      page,
      pageSize,
      totalPages,
      counts,
    });
  } catch (error: any) {
    console.error("[getAdminSupportTicketsServer] Unexpected error:", error);
    return err(error?.message || "Failed to retrieve support tickets.");
  }
}

/**
 * Retrieves a single support ticket by its UUID.
 */
export async function getAdminSupportTicketByIdServer(
  id: string,
  client?: any
): Promise<Result<SupportTicketItem, string>> {
  try {
    const dbClient = client || createUserServiceRoleClient();
    const { data, error } = await dbClient
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[getAdminSupportTicketByIdServer] Database error:", error);
      return err(error.message || "Failed to retrieve support ticket.");
    }

    if (!data) {
      return err("Support ticket not found.");
    }

    return ok(mapSupportTicketRowToItem(data));
  } catch (error: any) {
    console.error("[getAdminSupportTicketByIdServer] Unexpected error:", error);
    return err(error?.message || "Failed to retrieve support ticket.");
  }
}

/**
 * Updates a support ticket status, priority, assignment, or notes.
 */
export async function updateAdminSupportTicketServer(
  id: string,
  input: UpdateSupportTicketInput,
  actor?: { id?: string | null; email?: string | null; ip?: string | null },
  client?: any
): Promise<Result<SupportTicketItem, string>> {
  try {
    const dbClient = client || createUserServiceRoleClient();

    // 1. Fetch current row
    const { data: previousRow, error: fetchErr } = await dbClient
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !previousRow) {
      return err("Support ticket not found.");
    }

    // 2. Build update payload
    const updatePayload: Record<string, any> = {};

    if (input.status !== undefined) {
      updatePayload.status = input.status;
      if (input.status === "resolved" && previousRow.status !== "resolved") {
        updatePayload.resolved_at = new Date().toISOString();
        updatePayload.resolved_by = actor?.id || null;
      } else if (input.status !== "resolved" && previousRow.status === "resolved") {
        updatePayload.resolved_at = null;
        updatePayload.resolved_by = null;
      }
    }

    if (input.priority !== undefined) {
      updatePayload.priority = input.priority;
    }

    if (input.assignedTo !== undefined) {
      updatePayload.assigned_to = input.assignedTo;
    }

    if (input.assignedEmail !== undefined) {
      updatePayload.assigned_email = input.assignedEmail;
    }

    if (input.adminNotes !== undefined) {
      updatePayload.admin_notes = input.adminNotes;
    }

    // 3. Persist update
    const { data: updatedRow, error: updateErr } = await dbClient
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[updateAdminSupportTicketServer] Update error:", updateErr);
      return err(updateErr.message || "Failed to update support ticket.");
    }

    const mapped = mapSupportTicketRowToItem(updatedRow);

    // 4. Record audit log
    await recordAuditLog(
      {
        actorId: actor?.id,
        actorEmail: actor?.email,
        action: input.status === "resolved" ? "support.resolve" : "support.update",
        entityType: "support_ticket",
        entityId: id,
        before: previousRow,
        after: updatedRow,
        ip: actor?.ip,
      },
      client
    );

    return ok(mapped);
  } catch (error: any) {
    console.error("[updateAdminSupportTicketServer] Unexpected error:", error);
    return err(error?.message || "Failed to update support ticket.");
  }
}

/**
 * Records an admin reply to a ticket, appends reply to notes, and updates status.
 */
export async function replyAdminSupportTicketServer(
  id: string,
  input: ReplySupportTicketInput,
  actor?: { id?: string | null; email?: string | null; ip?: string | null },
  client?: any
): Promise<Result<SupportTicketItem, string>> {
  try {
    const dbClient = client || createUserServiceRoleClient();

    // 1. Fetch current ticket
    const { data: previousRow, error: fetchErr } = await dbClient
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !previousRow) {
      return err("Support ticket not found.");
    }

    // 2. Append reply to admin notes
    const timestamp = new Date().toISOString();
    const replyAuthor = actor?.email || "Admin";
    const replySnippet = `\n\n--- [Admin Reply by ${replyAuthor} at ${timestamp}] ---\n${input.replyMessage.trim()}`;
    const newNotes = (previousRow.admin_notes || "").trim() + replySnippet;

    const updatePayload: Record<string, any> = {
      admin_notes: newNotes,
    };

    if (input.newStatus) {
      updatePayload.status = input.newStatus;
      if (input.newStatus === "resolved") {
        updatePayload.resolved_at = timestamp;
        updatePayload.resolved_by = actor?.id || null;
      }
    } else if (previousRow.status === "open") {
      // Auto-advance open tickets to in_progress upon reply
      updatePayload.status = "in_progress";
    }

    const { data: updatedRow, error: updateErr } = await dbClient
      .from("support_tickets")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[replyAdminSupportTicketServer] Update error:", updateErr);
      return err(updateErr.message || "Failed to record reply.");
    }

    const mapped = mapSupportTicketRowToItem(updatedRow);

    // 3. Record audit log
    await recordAuditLog(
      {
        actorId: actor?.id,
        actorEmail: actor?.email,
        action: "support.reply",
        entityType: "support_ticket",
        entityId: id,
        before: previousRow,
        after: updatedRow,
        ip: actor?.ip,
      },
      client
    );

    return ok(mapped);
  } catch (error: any) {
    console.error("[replyAdminSupportTicketServer] Unexpected error:", error);
    return err(error?.message || "Failed to record reply.");
  }
}
