import {
  type GetSupportTicketsQuery,
  type UpdateSupportTicketInput,
  type ReplySupportTicketInput,
  type SupportCategory,
  type SupportStatus,
  type SupportPriority,
  SUPPORT_CATEGORIES,
  SUPPORT_STATUSES,
  SUPPORT_PRIORITIES,
} from "@/types/support";
import { type Result, ok, err } from "@/lib/common/result";

/**
 * Parses and normalizes query parameters for admin support tickets listing.
 */
export function parseSupportTicketsQueryParams(
  searchParams: URLSearchParams | Record<string, any> | GetSupportTicketsQuery
): Required<Omit<GetSupportTicketsQuery, keyof Record<string, unknown>>> & {
  page: number;
  pageSize: number;
  status: string;
  category: string;
  priority: string;
  assigned: string;
  search: string;
} {
  const getParam = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) || undefined;
    }
    const val = (searchParams as Record<string, any>)[key];
    if (Array.isArray(val)) return String(val[0]);
    if (val !== undefined && val !== null) return String(val);
    return undefined;
  };

  // 1. Page
  const rawPage = parseInt(getParam("page") || "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1;

  // 2. PageSize (clamped 1 - 100)
  const rawPageSize = parseInt(getParam("pageSize") || "20", 10);
  const pageSize =
    Number.isFinite(rawPageSize) && rawPageSize > 0
      ? Math.min(Math.max(rawPageSize, 1), 100)
      : 20;

  // 3. Status filter
  const rawStatus = (getParam("status") || "all").toLowerCase().trim();
  const status =
    rawStatus === "all" || (SUPPORT_STATUSES as readonly string[]).includes(rawStatus)
      ? rawStatus
      : "all";

  // 4. Category filter
  const rawCategory = (getParam("category") || "all").toLowerCase().trim();
  const category =
    rawCategory === "all" || (SUPPORT_CATEGORIES as readonly string[]).includes(rawCategory)
      ? rawCategory
      : "all";

  // 5. Priority filter
  const rawPriority = (getParam("priority") || "all").toLowerCase().trim();
  const priority =
    rawPriority === "all" || (SUPPORT_PRIORITIES as readonly string[]).includes(rawPriority)
      ? rawPriority
      : "all";

  // 6. Assigned filter
  const rawAssigned = (getParam("assigned") || "all").trim();
  const assigned = rawAssigned || "all";

  // 7. Search keyword
  const rawSearch = getParam("search") || getParam("q") || "";
  const search = rawSearch.trim().slice(0, 100);

  return {
    page,
    pageSize,
    status,
    category,
    priority,
    assigned,
    search,
  };
}

/**
 * Validates updates to a support ticket.
 */
export function validateUpdateSupportTicket(
  payload: any
): Result<UpdateSupportTicketInput, string> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return err("Request body must be an object.");
  }

  const result: UpdateSupportTicketInput = {};

  if (payload.status !== undefined) {
    if (typeof payload.status !== "string" || !(SUPPORT_STATUSES as readonly string[]).includes(payload.status)) {
      return err(`Invalid status. Must be one of: ${SUPPORT_STATUSES.join(", ")}`);
    }
    result.status = payload.status as SupportStatus;
  }

  if (payload.priority !== undefined) {
    if (typeof payload.priority !== "string" || !(SUPPORT_PRIORITIES as readonly string[]).includes(payload.priority)) {
      return err(`Invalid priority. Must be one of: ${SUPPORT_PRIORITIES.join(", ")}`);
    }
    result.priority = payload.priority as SupportPriority;
  }

  if (payload.assignedTo !== undefined) {
    if (payload.assignedTo !== null && typeof payload.assignedTo !== "string") {
      return err("assignedTo must be a string or null.");
    }
    result.assignedTo = payload.assignedTo;
  }

  if (payload.assignedEmail !== undefined) {
    if (payload.assignedEmail !== null && typeof payload.assignedEmail !== "string") {
      return err("assignedEmail must be a string or null.");
    }
    result.assignedEmail = payload.assignedEmail;
  }

  if (payload.adminNotes !== undefined) {
    if (typeof payload.adminNotes !== "string") {
      return err("adminNotes must be a string.");
    }
    if (payload.adminNotes.length > 5000) {
      return err("adminNotes cannot exceed 5000 characters.");
    }
    result.adminNotes = payload.adminNotes;
  }

  return ok(result);
}

/**
 * Validates reply to a support ticket.
 */
export function validateReplySupportTicket(
  payload: any
): Result<ReplySupportTicketInput, string> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return err("Request body must be an object.");
  }

  const { replyMessage, newStatus } = payload;

  if (typeof replyMessage !== "string" || replyMessage.trim().length < 3) {
    return err("replyMessage must be at least 3 characters.");
  }
  if (replyMessage.length > 5000) {
    return err("replyMessage cannot exceed 5000 characters.");
  }

  const result: ReplySupportTicketInput = {
    replyMessage: replyMessage.trim(),
  };

  if (newStatus !== undefined) {
    if (typeof newStatus !== "string" || !(SUPPORT_STATUSES as readonly string[]).includes(newStatus)) {
      return err(`Invalid newStatus. Must be one of: ${SUPPORT_STATUSES.join(", ")}`);
    }
    result.newStatus = newStatus as SupportStatus;
  }

  return ok(result);
}
