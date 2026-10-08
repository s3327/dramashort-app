"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShieldCheck,
  Search,
  RefreshCw,
  Clock,
  Filter,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ArrowRight,
  FileCode,
  UserCheck,
  Globe,
  AlertTriangle,
} from "lucide-react";
import type { AuditLogItem } from "@/types/audit";
import { computeAuditDiff } from "@/lib/validation/audit";

const ENTITY_OPTIONS = [
  { value: "all", label: "All Entities" },
  { value: "drama", label: "Drama" },
  { value: "episode", label: "Episode" },
  { value: "channel", label: "Channel" },
  { value: "taxonomy_genre", label: "Genre" },
  { value: "taxonomy_tag", label: "Tag" },
  { value: "user", label: "User" },
  { value: "settings", label: "Platform Settings" },
];

const DATE_PRESETS = [
  { value: "all", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [datePreset, setDatePreset] = useState("all");

  // Selected Log for Inspector Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<"visual" | "raw">("visual");

  const computeDateRange = (preset: string) => {
    if (preset === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { startDate: start.toISOString() };
    }
    if (preset === "7d") {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString() };
    }
    if (preset === "30d") {
      const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return { startDate: start.toISOString() };
    }
    return {};
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (search.trim()) params.set("search", search.trim());
      if (entityType !== "all") params.set("entityType", entityType);

      const dateRange = computeDateRange(datePreset);
      if (dateRange.startDate) params.set("startDate", dateRange.startDate);

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (res.status === 403) {
        setError("Access Restricted: Superuser administrator permissions required to view audit logs.");
        setLogs([]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to load audit logs (${res.status})`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setLogs(json.data.entries || []);
        setTotal(json.data.total || 0);
        setTotalPages(json.data.totalPages || 1);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, entityType, datePreset]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return {
        relative: d.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        full: d.toISOString(),
      };
    } catch {
      return { relative: isoString, full: isoString };
    }
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("delete") || act.includes("ban") || act.includes("archive") || act.includes("force_signout")) {
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    }
    if (act.includes("create") || act.includes("publish") || act.includes("unban")) {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    }
    if (act.includes("update") || act.includes("role_change") || act.includes("reorder")) {
      return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
    if (act.includes("duplicate") || act.includes("merge")) {
      return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    }
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  };

  const computedDiff = useMemo(() => {
    if (!selectedLog) return null;
    return computeAuditDiff(selectedLog.before, selectedLog.after);
  }, [selectedLog]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <ShieldCheck size={22} />
            </div>
            <h1 className="text-2xl font-bold font-display text-text">Audit Log</h1>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Immutable administrative operations ledger and before/after state diffs across platform entities.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-elevated border border-border text-sm font-medium text-text hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
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
            placeholder="Search by actor email, action, or entity ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:border-primary transition-colors"
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

        {/* Entity Select */}
        <div className="relative">
          <Filter size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            {ENTITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Preset */}
        <div className="relative">
          <Clock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <select
            value={datePreset}
            onChange={(e) => {
              setDatePreset(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm text-text focus:outline-none focus:border-primary transition-colors appearance-none cursor-pointer"
          >
            {DATE_PRESETS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error / Forbidden Notice */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-sm text-rose-400">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Security Access Restriction</p>
            <p className="mt-0.5 text-text-muted">{error}</p>
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated/50 border-b border-border text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && logs.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-4"><div className="h-4 bg-surface-elevated rounded w-28" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-surface-elevated rounded w-36" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-surface-elevated rounded w-24" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-surface-elevated rounded w-28" /></td>
                    <td className="py-4 px-4"><div className="h-4 bg-surface-elevated rounded w-20" /></td>
                    <td className="py-4 px-4 text-right"><div className="h-7 bg-surface-elevated rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted">
                    <ShieldCheck size={36} className="mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No audit entries found</p>
                    <p className="text-xs mt-1">Try adjusting your search keywords or date filters.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const ts = formatTimestamp(log.createdAt);
                  return (
                    <tr key={log.id} className="hover:bg-surface-hover/50 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono text-xs text-text-muted whitespace-nowrap" title={ts.full}>
                        {ts.relative}
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs text-text font-medium">
                          <UserCheck size={13} className="text-text-muted shrink-0" />
                          <span className="truncate max-w-[180px]">{log.actorEmail || "System"}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getActionBadgeColor(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text font-mono text-[11px]">
                            {log.entityType}
                          </span>
                          <span className="font-mono text-text-muted text-[11px] truncate max-w-[100px]" title={log.entityId}>
                            {log.entityId.slice(0, 8)}…
                          </span>
                        </div>
                      </td>

                      {/* IP */}
                      <td className="py-3.5 px-4 font-mono text-xs text-text-muted">
                        {log.ip ? (
                          <span className="inline-flex items-center gap-1">
                            <Globe size={11} className="text-text-muted" />
                            {log.ip}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      {/* Details / Diff Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-elevated hover:bg-surface-hover border border-border text-xs font-medium text-text transition-colors"
                        >
                          <Eye size={12} />
                          Diff
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 bg-surface-elevated/40 border-t border-border flex items-center justify-between text-xs text-text-muted">
          <span>
            Showing {logs.length > 0 ? (page - 1) * pageSize + 1 : 0} to{" "}
            {Math.min(page * pageSize, total)} of {total} records
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="p-1 rounded bg-surface border border-border text-text hover:bg-surface-hover disabled:opacity-40 transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-medium text-text">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="p-1 rounded bg-surface border border-border text-text hover:bg-surface-hover disabled:opacity-40 transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Inspector / Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-elevated/30">
              <div className="flex items-center gap-2.5">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getActionBadgeColor(selectedLog.action)}`}>
                  {selectedLog.action}
                </span>
                <span className="text-sm font-mono text-text-muted">
                  {selectedLog.entityType}: {selectedLog.entityId}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Metadata Chips */}
            <div className="px-5 py-3 border-b border-border bg-surface-elevated/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-text-muted block">Timestamp</span>
                <span className="font-mono text-text">{formatTimestamp(selectedLog.createdAt).relative}</span>
              </div>
              <div>
                <span className="text-text-muted block">Actor</span>
                <span className="text-text font-medium truncate block">{selectedLog.actorEmail || "System"}</span>
              </div>
              <div>
                <span className="text-text-muted block">Client IP</span>
                <span className="font-mono text-text">{selectedLog.ip || "—"}</span>
              </div>
              <div>
                <span className="text-text-muted block">Log Entry ID</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-text truncate max-w-[90px]">{selectedLog.id.slice(0, 8)}…</span>
                  <button
                    onClick={() => handleCopy(selectedLog.id, "entry-id")}
                    className="text-text-muted hover:text-text"
                  >
                    {copiedKey === "entry-id" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className="px-5 pt-3 pb-1 flex items-center gap-2 border-b border-border">
              <button
                onClick={() => setDiffViewMode("visual")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  diffViewMode === "visual"
                    ? "bg-primary text-primary-contrast"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}
              >
                Visual Diff
              </button>
              <button
                onClick={() => setDiffViewMode("raw")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  diffViewMode === "raw"
                    ? "bg-primary text-primary-contrast"
                    : "text-text-muted hover:text-text hover:bg-surface-hover"
                }`}
              >
                Raw JSON
              </button>
            </div>

            {/* Diff Content Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {diffViewMode === "visual" && computedDiff && (
                <div className="space-y-4 text-xs font-mono">
                  {/* Changed Fields */}
                  {Object.keys(computedDiff.changed).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-text mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Modified Fields ({Object.keys(computedDiff.changed).length})
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(computedDiff.changed).map(([key, diff]) => (
                          <div key={key} className="p-2.5 rounded-lg bg-surface-elevated border border-border">
                            <span className="font-bold text-text block mb-1.5">{key}</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                                <span className="text-[10px] text-rose-400 block font-sans font-semibold uppercase">Before</span>
                                <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(diff.before, null, 2)}</pre>
                              </div>
                              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                <span className="text-[10px] text-emerald-400 block font-sans font-semibold uppercase">After</span>
                                <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(diff.after, null, 2)}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Added Fields */}
                  {Object.keys(computedDiff.added).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-text mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Added Fields ({Object.keys(computedDiff.added).length})
                      </h4>
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-1">
                        {Object.entries(computedDiff.added).map(([k, v]) => (
                          <div key={k} className="flex items-start gap-2">
                            <span className="font-bold text-emerald-400">{k}:</span>
                            <span className="break-all">{JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Removed Fields */}
                  {Object.keys(computedDiff.removed).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-text mb-2 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        Removed Fields ({Object.keys(computedDiff.removed).length})
                      </h4>
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                        {Object.entries(computedDiff.removed).map(([k, v]) => (
                          <div key={k} className="flex items-start gap-2">
                            <span className="font-bold text-rose-400">{k}:</span>
                            <span className="break-all">{JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unchanged / No Diff State */}
                  {Object.keys(computedDiff.changed).length === 0 &&
                    Object.keys(computedDiff.added).length === 0 &&
                    Object.keys(computedDiff.removed).length === 0 && (
                      <div className="py-8 text-center text-text-muted">
                        <FileCode size={30} className="mx-auto mb-2 opacity-50" />
                        <p>No field modifications detected between snapshots.</p>
                      </div>
                    )}
                </div>
              )}

              {diffViewMode === "raw" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <span className="text-text-muted block mb-1 font-sans font-semibold">Before Snapshot</span>
                    <pre className="p-3 bg-surface-elevated border border-border rounded-lg max-h-[300px] overflow-auto text-text">
                      {selectedLog.before ? JSON.stringify(selectedLog.before, null, 2) : "null"}
                    </pre>
                  </div>
                  <div>
                    <span className="text-text-muted block mb-1 font-sans font-semibold">After Snapshot</span>
                    <pre className="p-3 bg-surface-elevated border border-border rounded-lg max-h-[300px] overflow-auto text-text">
                      {selectedLog.after ? JSON.stringify(selectedLog.after, null, 2) : "null"}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-surface-elevated/40 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
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
