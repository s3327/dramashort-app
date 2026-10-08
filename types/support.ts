import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support/types";

export { SUPPORT_CATEGORIES, type SupportCategory };

export const SUPPORT_STATUSES = ["open", "in_progress", "resolved"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export interface SupportTicketContext {
  titleSlug?: string;
  titleName?: string;
  episodeNumber?: number;
  playbackTime?: number;
  sourceUrl?: string;
  userAgent?: string;
  deviceInfo?: string;
  errorDetails?: string;
  [key: string]: unknown;
}

export interface SupportTicketItem {
  id: string;
  userId: string | null;
  email: string;
  category: SupportCategory;
  subject: string;
  message: string;
  context: SupportTicketContext;
  status: SupportStatus;
  priority: SupportPriority;
  assignedTo: string | null;
  assignedEmail: string | null;
  adminNotes: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketCounts {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

export interface GetSupportTicketsQuery {
  status?: string;
  category?: string;
  priority?: string;
  search?: string;
  assigned?: string;
  page?: number | string;
  pageSize?: number | string;
  [key: string]: unknown;
}

export interface PaginatedSupportTicketsResult {
  items: SupportTicketItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  counts: SupportTicketCounts;
}

export interface UpdateSupportTicketInput {
  status?: SupportStatus;
  priority?: SupportPriority;
  assignedTo?: string | null;
  assignedEmail?: string | null;
  adminNotes?: string | null;
}

export interface ReplySupportTicketInput {
  replyMessage: string;
  newStatus?: SupportStatus;
}
