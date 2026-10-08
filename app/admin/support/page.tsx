"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Headphones,
  Search,
  RefreshCw,
  Filter,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Mail,
  Clock,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  PlaySquare,
  Film,
  Send,
  User,
  Shield,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import type {
  SupportTicketItem,
  SupportTicketCounts,
  SupportCategory,
  SupportStatus,
  SupportPriority,
} from "@/types/support";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES } from "@/types/support";

const STATUS_TABS = [
  { id: "all", label: "All Tickets" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "resolved", label: "Resolved" },
] as const;

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [counts, setCounts] = useState<SupportTicketCounts>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  // Ticket Inspector & Actions
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketItem | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [adminNotesInput, setAdminNotesInput] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("pageSize", pageSize.toString());
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/support?${params.toString()}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Access Denied: Support Inbox requires administrative privileges.");
        }
        throw new Error(`Failed to load tickets (HTTP ${res.status})`);
      }

      const json = await res.json();
      const payload = json.data || json;
      setTickets(payload.items || []);
      setTotal(payload.total || 0);
      setTotalPages(payload.totalPages || 1);
      if (payload.counts) {
        setCounts(payload.counts);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load support tickets.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, categoryFilter, priorityFilter, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Sync admin notes input when selecting a ticket
  useEffect(() => {
    if (selectedTicket) {
      setAdminNotesInput(selectedTicket.adminNotes || "");
      setReplyMessage("");
    }
  }, [selectedTicket]);

  const handleUpdateTicket = async (updates: {
    status?: SupportStatus;
    priority?: SupportPriority;
    adminNotes?: string;
  }) => {
    if (!selectedTicket || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/support/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Failed to update ticket.");
      }

      const json = await res.json();
      const updated = json.data || json;
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      showToast("Ticket updated successfully.");
      // Refresh count numbers
      fetchTickets();
    } catch (err: any) {
      showToast(err.message || "Update error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim() || isReplying) return;
    setIsReplying(true);
    try {
      const res = await fetch(`/api/admin/support/${selectedTicket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyMessage: replyMessage.trim(),
          newStatus: "in_progress",
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Failed to record reply.");
      }

      const json = await res.json();
      const updated = json.data || json;
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setReplyMessage("");
      showToast("Reply recorded and ticket updated to In Progress.");
      fetchTickets();
    } catch (err: any) {
      showToast(err.message || "Failed to submit reply.");
    } finally {
      setIsReplying(false);
    }
  };

  const getStatusBadge = (status: SupportStatus) => {
    switch (status) {
      case "open":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Open
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            In Progress
          </span>
        );
      case "resolved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CheckCircle2 size={12} />
            Resolved
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: SupportPriority) => {
    switch (priority) {
      case "urgent":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-danger/10 text-danger border border-danger/20">
            <AlertTriangle size={12} />
            Urgent
          </span>
        );
      case "high":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20">
            High
          </span>
        );
      case "normal":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface-elevated text-text-muted border border-border">
            Normal
          </span>
        );
      case "low":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-surface-elevated text-text-muted/70 border border-border">
            Low
          </span>
        );
    }
  };

  const getCategoryBadge = (cat: SupportCategory) => {
    const colors: Record<SupportCategory, string> = {
      playback: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      billing: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      content: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      account: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      general: "bg-surface-elevated text-text-muted border-border",
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${colors[cat] || ""}`}>
        {cat}
      </span>
    );
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex flex-col md:flex-row">
      <AdminSidebar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg bg-surface-elevated border border-border shadow-xl text-sm font-medium text-text flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 size={16} className="text-primary" />
          {toastMessage}
        </div>
      )}

      <main className="flex-1 px-6 sm:px-8 py-8 pt-16 md:pt-8 max-w-[1400px]">
        <div className="space-y-6 pb-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <Headphones size={22} />
                </div>
                <h1 className="text-2xl font-bold font-display text-text">Support Inbox</h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {counts.open} Open
                </span>
              </div>
              <p className="text-sm text-text-muted mt-1">
                Customer inquiries, playback bug reports, and diagnostic resolution workflow.
              </p>
            </div>
            <button
              onClick={fetchTickets}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-sm font-medium text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {/* Status Tabs with Counters */}
          <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-px">
            {STATUS_TABS.map((tab) => {
              const countVal =
                tab.id === "all"
                  ? counts.total
                  : tab.id === "open"
                  ? counts.open
                  : tab.id === "in_progress"
                  ? counts.inProgress
                  : counts.resolved;
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-text-muted hover:text-text hover:border-border"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive
                        ? "bg-primary text-white"
                        : "bg-surface-elevated text-text-muted"
                    }`}
                  >
                    {countVal}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by email, subject, or message content..."
                className="w-full pl-10 pr-8 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:border-primary transition-colors"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Category Filter */}
            <div className="relative">
              <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All Categories</option>
                {SUPPORT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="relative">
              <AlertCircle size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
              >
                <option value="all">All Priorities</option>
                {SUPPORT_PRIORITIES.map((pri) => (
                  <option key={pri} value={pri}>
                    {pri.charAt(0).toUpperCase() + pri.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Ticket Listing */}
          <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-elevated/40 text-text-muted text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Ticket</th>
                    <th className="py-3 px-4">Sender</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Subject & Context</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading && tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-text-muted">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-primary" />
                        <p>Loading support tickets...</p>
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-text-muted">
                        <Headphones size={36} className="mx-auto mb-3 opacity-30" />
                        <p className="font-semibold text-text">No tickets match criteria</p>
                        <p className="text-xs mt-1">Try adjusting your filters or search keywords.</p>
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => {
                      const hasContext = !!(
                        t.context?.titleSlug ||
                        t.context?.titleName ||
                        t.context?.episodeNumber
                      );
                      const titleSlug = (t.context?.titleSlug as string) || "";
                      const epNum = t.context?.episodeNumber as number | undefined;

                      return (
                        <tr
                          key={t.id}
                          className="hover:bg-surface-hover/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedTicket(t)}
                        >
                          {/* Ticket ID & Time */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold text-text">
                              #{t.id.slice(0, 8)}
                            </span>
                            <div className="text-xs text-text-muted mt-0.5">
                              {new Date(t.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>

                          {/* Sender Email */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-medium text-text">
                              <User size={13} className="text-text-muted" />
                              <span>{t.email}</span>
                            </div>
                            {t.userId && (
                              <span className="inline-block mt-0.5 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.2 rounded">
                                Registered User
                              </span>
                            )}
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getCategoryBadge(t.category)}
                          </td>

                          {/* Subject & Linked Context */}
                          <td className="py-3.5 px-4 max-w-md">
                            <div className="font-semibold text-text line-clamp-1">
                              {t.subject}
                            </div>
                            <div className="text-xs text-text-muted line-clamp-1 mt-0.5">
                              {t.message}
                            </div>

                            {/* Linked Drama/Episode Context Badge */}
                            {hasContext && (
                              <div
                                className="mt-1.5 flex items-center gap-2 flex-wrap text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {titleSlug && (
                                  <Link
                                    href={`/drama/${titleSlug}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium text-[11px]"
                                  >
                                    <Film size={11} />
                                    <span>{(t.context?.titleName as string) || titleSlug}</span>
                                    <ExternalLink size={10} />
                                  </Link>
                                )}
                                {titleSlug && epNum && (
                                  <Link
                                    href={`/watch/${titleSlug}?ep=${epNum}`}
                                    target="_blank"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors font-medium text-[11px]"
                                  >
                                    <PlaySquare size={11} />
                                    <span>EP {epNum}</span>
                                    <ExternalLink size={10} />
                                  </Link>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getPriorityBadge(t.priority)}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {getStatusBadge(t.status)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicket(t);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs font-semibold text-text hover:bg-surface-hover hover:border-primary/50 transition-colors inline-flex items-center gap-1.5"
                            >
                              <Eye size={13} />
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-t border-border bg-surface-elevated/20 text-xs text-text-muted">
              <div>
                Showing{" "}
                <span className="font-semibold text-text">
                  {tickets.length > 0 ? (page - 1) * pageSize + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-text">
                  {Math.min(page * pageSize, total)}
                </span>{" "}
                of <span className="font-semibold text-text">{total}</span> tickets
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 rounded-md bg-surface border border-border text-text hover:bg-surface-hover disabled:opacity-40 transition-colors inline-flex items-center gap-1"
                >
                  <ChevronLeft size={14} />
                  Prev
                </button>
                <span className="px-2 font-medium">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1.5 rounded-md bg-surface border border-border text-text hover:bg-surface-hover disabled:opacity-40 transition-colors inline-flex items-center gap-1"
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Ticket Inspector Modal / Drawer */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-start justify-between gap-4 bg-surface-elevated/40">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-surface border border-border text-text-muted">
                    #{selectedTicket.id.slice(0, 8)}
                  </span>
                  {getCategoryBadge(selectedTicket.category)}
                  {getPriorityBadge(selectedTicket.priority)}
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <h2 className="text-xl font-bold font-display text-text mt-2">
                  {selectedTicket.subject}
                </h2>
                <div className="flex items-center gap-4 text-xs text-text-muted mt-1">
                  <span>
                    From: <b className="text-text">{selectedTicket.email}</b>
                  </span>
                  <span>
                    Created:{" "}
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
                aria-label="Close ticket inspector"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
              {/* Linked Drama / Episode Context Section */}
              {(selectedTicket.context?.titleSlug || selectedTicket.context?.episodeNumber) && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider mb-2">
                    <Film size={14} />
                    Linked Context
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {selectedTicket.context.titleSlug && (
                      <Link
                        href={`/drama/${selectedTicket.context.titleSlug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-primary/30 text-primary font-medium hover:bg-surface-hover transition-colors text-xs"
                      >
                        <Film size={13} />
                        Drama:{" "}
                        {(selectedTicket.context.titleName as string) ||
                          selectedTicket.context.titleSlug}
                        <ExternalLink size={11} />
                      </Link>
                    )}
                    {selectedTicket.context.titleSlug && selectedTicket.context.episodeNumber && (
                      <Link
                        href={`/watch/${selectedTicket.context.titleSlug}?ep=${selectedTicket.context.episodeNumber}`}
                        target="_blank"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-purple-500/30 text-purple-400 font-medium hover:bg-surface-hover transition-colors text-xs"
                      >
                        <PlaySquare size={13} />
                        Watch Episode {selectedTicket.context.episodeNumber}
                        <ExternalLink size={11} />
                      </Link>
                    )}
                    {selectedTicket.context.playbackTime && (
                      <span className="text-xs text-text-muted bg-surface px-2.5 py-1.5 rounded-lg border border-border">
                        Position: {Math.floor(Number(selectedTicket.context.playbackTime))}s
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* User Message */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-text-muted block mb-2">
                  User Message
                </label>
                <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border text-text whitespace-pre-wrap leading-relaxed font-sans">
                  {selectedTicket.message}
                </div>
              </div>

              {/* Status & Priority Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-elevated/30 border border-border">
                <div>
                  <label className="text-xs font-semibold text-text-muted block mb-1.5">
                    Ticket Status
                  </label>
                  <select
                    value={selectedTicket.status}
                    onChange={(e) =>
                      handleUpdateTicket({ status: e.target.value as SupportStatus })
                    }
                    disabled={isUpdating}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="open">Open (Unresolved)</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-text-muted block mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) =>
                      handleUpdateTicket({ priority: e.target.value as SupportPriority })
                    }
                    disabled={isUpdating}
                    className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Internal Admin Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Internal Admin Notes & Activity Log
                  </label>
                  <button
                    onClick={() => handleUpdateTicket({ adminNotes: adminNotesInput })}
                    disabled={isUpdating || adminNotesInput === (selectedTicket.adminNotes || "")}
                    className="text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                  >
                    Save Notes
                  </button>
                </div>
                <textarea
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  placeholder="Add private staff notes or audit context..."
                  rows={4}
                  className="w-full p-3 bg-surface border border-border rounded-xl text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:border-primary transition-colors font-mono text-xs"
                />
              </div>

              {/* Email Reply Generator & Action */}
              <div className="p-4 rounded-xl bg-surface-elevated/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text">
                    <Mail size={16} className="text-primary" />
                    Reply to User ({selectedTicket.email})
                  </div>
                  <a
                    href={`mailto:${selectedTicket.email}?subject=Re: [Ticket %23${selectedTicket.id.slice(0, 8)}] ${encodeURIComponent(selectedTicket.subject)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface border border-border text-xs font-medium text-text hover:bg-surface-hover transition-colors"
                  >
                    <Mail size={12} />
                    Open Email Client
                  </a>
                </div>

                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type an official admin response to log in ticket history and advance to In Progress..."
                  rows={3}
                  className="w-full p-3 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:border-primary transition-colors"
                />

                <div className="flex justify-end">
                  <button
                    onClick={handleSendReply}
                    disabled={isReplying || !replyMessage.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    <Send size={13} className={isReplying ? "animate-spin" : ""} />
                    {isReplying ? "Recording Reply..." : "Record Reply & Update Ticket"}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface-elevated/40 flex justify-between items-center">
              <span className="text-xs text-text-muted">
                Last updated: {new Date(selectedTicket.updatedAt).toLocaleString()}
              </span>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-4 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-text hover:bg-surface-hover transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
