"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import {
  Search,
  ChevronDown,
  ArrowUpDown,
  Shield,
  UserCheck,
  UserX,
  LogOut,
  Heart,
  Tv,
  Loader2,
  AlertCircle,
  X,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { formatDate, formatDateTime } from "@/lib/format";
import type {
  AdminManagedUser,
  AdminUserRole,
  AdminUserRoleFilter,
  AdminUserSortBy,
  AdminUserSortDir,
  AdminUserStatusFilter,
  PaginatedAdminUsersResult,
} from "@/types/user-admin";

const BAN_DURATION_OPTIONS = [
  { label: "Permanent (Account Termination)", value: "876000h" },
  { label: "24 Hours (Warning Suspension)", value: "24h" },
  { label: "7 Days (Standard Ban)", value: "168h" },
  { label: "30 Days (Extended Suspension)", value: "720h" },
];

export default function AdminUsersPage() {
  const { user: currentAdmin } = useAdminAuth();
  const { message: toastMessage, show: showToast } = useToast();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<AdminUserRoleFilter>("all");
  const [sortBy, setSortBy] = useState<AdminUserSortBy>("createdAt");
  const [sortDir, setSortDir] = useState<AdminUserSortDir>("desc");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Data State
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [forbiddenError, setForbiddenError] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Modal Action States
  const [roleModalUser, setRoleModalUser] = useState<AdminManagedUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<AdminUserRole>("user");
  const [banModalUser, setBanModalUser] = useState<AdminManagedUser | null>(null);
  const [banDuration, setBanDuration] = useState("876000h");
  const [banReason, setBanReason] = useState("");
  const [unbanModalUser, setUnbanModalUser] = useState<AdminManagedUser | null>(null);
  const [signOutModalUser, setSignOutModalUser] = useState<AdminManagedUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, statusFilter, roleFilter, sortBy, sortDir]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setGeneralError(null);
    setForbiddenError(false);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "10",
        query: debouncedQuery,
        status: statusFilter,
        role: roleFilter,
        sortBy,
        sortDir,
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.status === 403) {
        setForbiddenError(true);
        setIsLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Failed to fetch users (HTTP ${res.status})`);
      }

      const json = await res.json();
      const data: PaginatedAdminUsersResult = json.data || json;
      setUsers(data.items || []);
      setPagination(data.pagination || { page, pageSize: 10, total: 0, totalPages: 1 });
    } catch (err: unknown) {
      console.error("[AdminUsersPage] Error loading users:", err);
      setGeneralError(err instanceof Error ? err.message : "Failed to load user catalog.");
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedQuery, statusFilter, roleFilter, sortBy, sortDir]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Handle Role Change
  const handleRoleChange = async () => {
    if (!roleModalUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${roleModalUser.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to update role");
      }

      showToast(`User role updated to ${selectedRole.toUpperCase()}`);
      setRoleModalUser(null);
      await loadUsers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error updating role");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Ban
  const handleBanUser = async () => {
    if (!banModalUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${banModalUser.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration: banDuration,
          reason: banReason.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to ban user");
      }

      showToast(`User ${banModalUser.displayName} has been banned.`);
      setBanModalUser(null);
      setBanReason("");
      await loadUsers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error banning user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Unban
  const handleUnbanUser = async () => {
    if (!unbanModalUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${unbanModalUser.id}/unban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to unban user");
      }

      showToast(`Ban lifted for ${unbanModalUser.displayName}.`);
      setUnbanModalUser(null);
      await loadUsers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error unbanning user");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Force Sign-Out
  const handleForceSignOut = async () => {
    if (!signOutModalUser) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${signOutModalUser.id}/signout`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to force sign-out");
      }

      showToast(`Active sessions revoked for ${signOutModalUser.displayName}.`);
      setSignOutModalUser(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Error revoking sessions");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />
      <Toast message={toastMessage} />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl flex items-center gap-2">
              <span>Users</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                Live Data
              </span>
            </h1>
            <p className="text-sm text-text-muted mt-0.5">
              {pagination.total} registered users in the database.
            </p>
          </div>
        </div>

        {/* 403 Forbidden Access Guard Display */}
        {forbiddenError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 my-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-red-600 mb-1">Access Restricted (403 Forbidden)</h2>
            <p className="text-sm text-text-muted max-w-md mx-auto">
              User account management and personally identifiable information (PII) are restricted strictly
              to accounts with the <strong>Admin</strong> role. Editor staff cannot view user records.
            </p>
          </div>
        )}

        {!forbiddenError && (
          <>
            {/* Search and Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  size={16}
                  strokeWidth={2}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search email, username, or UUID..."
                  className="w-full rounded-md border border-border bg-surface pl-9 pr-8 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search query"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5 rounded"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as AdminUserStatusFilter)}
                className="rounded-md border border-border bg-surface text-sm text-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="banned">Banned only</option>
              </select>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as AdminUserRoleFilter)}
                className="rounded-md border border-border bg-surface text-sm text-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="all">All roles</option>
                <option value="user">User</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>

              {/* Sort By Field */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as AdminUserSortBy)}
                className="rounded-md border border-border bg-surface text-sm text-text px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="createdAt">Sort: Created Date</option>
                <option value="lastLoginAt">Sort: Last Login</option>
                <option value="displayName">Sort: Display Name</option>
                <option value="email">Sort: Email Address</option>
              </select>

              {/* Sort Direction Toggle */}
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                aria-label={`Toggle sort direction. Currently ${sortDir === "asc" ? "Ascending" : "Descending"}`}
                className="flex items-center gap-1.5 rounded-md border border-border bg-surface text-sm text-text hover:bg-surface-subtle px-3 py-2 transition-colors"
              >
                <ArrowUpDown size={14} strokeWidth={2} />
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </div>

            {/* Error Message */}
            {generalError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 rounded-md p-3 mb-4 text-sm flex items-center gap-2">
                <AlertCircle size={16} />
                <span>{generalError}</span>
              </div>
            )}

            {/* Table Container */}
            <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-text-muted bg-surface-subtle">
                    <th className="w-12 px-4 py-3">No</th>
                    <th className="px-3 py-3">User</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Engagement</th>
                    <th className="px-3 py-3">Last Login</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    // Skeleton Shimmer State
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="border-b border-border animate-pulse">
                        <td className="px-4 py-3">
                          <div className="h-4 w-5 bg-border/40 rounded" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-4 w-36 bg-border/40 rounded mb-1" />
                          <div className="h-3 w-28 bg-border/20 rounded" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-5 w-16 bg-border/40 rounded-pill" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-5 w-16 bg-border/40 rounded-pill" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-4 w-24 bg-border/40 rounded" />
                        </td>
                        <td className="px-3 py-3">
                          <div className="h-4 w-20 bg-border/40 rounded" />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="h-6 w-14 bg-border/40 rounded ml-auto" />
                        </td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-text-muted">
                        <UserX className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="font-semibold text-base mb-1">No users found</p>
                        <p className="text-xs">No user accounts match your search filters.</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((u, index) => {
                      const expanded = expandedId === u.id;
                      const isSelf = currentAdmin?.id === u.id;

                      return (
                        <Fragment key={u.id}>
                          <tr className="border-b border-border last:border-0 hover:bg-surface-subtle transition-colors">
                            <td className="px-4 py-3 text-text-muted font-mono text-xs">
                              {(pagination.page - 1) * pagination.pageSize + index + 1}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                                  {u.displayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-text truncate max-w-[180px] sm:max-w-[220px]">
                                    {u.displayName}
                                    {isSelf && (
                                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30 rounded px-1 py-0.2">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-text-muted truncate max-w-[180px] sm:max-w-[220px]">
                                    {u.email || "No email"}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Role Badge */}
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-semibold ${
                                  u.role === "admin"
                                    ? "bg-purple-500/10 text-purple-700 border-purple-500/30"
                                    : u.role === "editor"
                                    ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                                    : "bg-surface text-text-muted border-border"
                                }`}
                              >
                                <Shield size={11} />
                                {u.role.toUpperCase()}
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold ${
                                  u.isBanned
                                    ? "bg-red-500/10 text-red-600 border-red-500/30"
                                    : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                                }`}
                              >
                                {u.isBanned ? <UserX size={12} /> : <UserCheck size={12} />}
                                {u.isBanned ? "Banned" : "Active"}
                              </span>
                            </td>

                            {/* Engagement Counters */}
                            <td className="px-3 py-3 text-xs text-text-muted">
                              <div className="flex items-center gap-3">
                                <span className="inline-flex items-center gap-1" title="Dramas watched">
                                  <Tv size={13} className="text-primary" />
                                  <span className="font-semibold text-text">{u.watchHistoryCount}</span>
                                </span>
                                <span className="inline-flex items-center gap-1" title="Dramas favorited">
                                  <Heart size={13} className="text-rose-500" />
                                  <span className="font-semibold text-text">{u.favoritesCount}</span>
                                </span>
                              </div>
                            </td>

                            {/* Last Login */}
                            <td className="px-3 py-3 text-text-muted text-xs whitespace-nowrap">
                              {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}
                            </td>

                            {/* Details Toggle */}
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedId(expanded ? null : u.id)}
                                aria-expanded={expanded}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-text-muted hover:text-primary transition-colors py-1 px-2 rounded hover:bg-surface"
                              >
                                {expanded ? "Hide" : "Manage"}
                                <ChevronDown
                                  size={13}
                                  strokeWidth={2.5}
                                  className={`transition-transform ${expanded ? "rotate-180" : ""}`}
                                />
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {expanded && (
                            <tr className="border-b border-border last:border-0 bg-surface-subtle/70">
                              <td />
                              <td colSpan={6} className="px-3 py-4">
                                <div className="space-y-4 max-w-3xl">
                                  {/* User Meta Information Grid */}
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                    <div className="bg-surface p-2.5 rounded border border-border">
                                      <p className="font-semibold text-text-muted mb-0.5">User ID</p>
                                      <p className="font-mono text-[11px] text-text break-all select-all">
                                        {u.id}
                                      </p>
                                    </div>
                                    <div className="bg-surface p-2.5 rounded border border-border">
                                      <p className="font-semibold text-text-muted mb-0.5">Registration Date</p>
                                      <p className="text-text">{formatDate(u.createdAt)}</p>
                                    </div>
                                    <div className="bg-surface p-2.5 rounded border border-border">
                                      <p className="font-semibold text-text-muted mb-0.5">Auth Providers</p>
                                      {u.socialLogins.length === 0 ? (
                                        <p className="text-text-muted">Email / Password</p>
                                      ) : (
                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                          {u.socialLogins.map((p) => (
                                            <span
                                              key={p}
                                              className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5"
                                            >
                                              {p}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Ban Notice if user is banned */}
                                  {u.isBanned && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs text-red-700">
                                      <p className="font-bold flex items-center gap-1.5 mb-1">
                                        <UserX size={14} /> Account Banned
                                      </p>
                                      {u.bannedUntil && (
                                        <p>
                                          <strong>Suspension expires:</strong> {formatDateTime(u.bannedUntil)}
                                        </p>
                                      )}
                                      {u.banReason && (
                                        <p className="mt-0.5">
                                          <strong>Reason:</strong> {u.banReason}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {/* Action Controls Bar */}
                                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
                                    {/* Change Role Button */}
                                    <button
                                      type="button"
                                      disabled={isSelf}
                                      onClick={() => {
                                        setRoleModalUser(u);
                                        setSelectedRole(u.role);
                                      }}
                                      title={isSelf ? "Cannot demote your own account" : undefined}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-border bg-surface text-text hover:bg-surface-subtle transition-colors ${
                                        isSelf ? "opacity-50 cursor-not-allowed" : ""
                                      }`}
                                    >
                                      <Shield size={13} />
                                      Change Role
                                    </button>

                                    {/* Ban / Unban Button */}
                                    {u.isBanned ? (
                                      <button
                                        type="button"
                                        onClick={() => setUnbanModalUser(u)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                      >
                                        <UserCheck size={13} />
                                        Lift Ban
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={isSelf}
                                        onClick={() => {
                                          setBanModalUser(u);
                                          setBanDuration("876000h");
                                          setBanReason("");
                                        }}
                                        title={isSelf ? "Cannot ban your own account" : undefined}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors ${
                                          isSelf ? "opacity-50 cursor-not-allowed" : ""
                                        }`}
                                      >
                                        <UserX size={13} />
                                        Ban User
                                      </button>
                                    )}

                                    {/* Force Sign-Out Button */}
                                    <button
                                      type="button"
                                      onClick={() => setSignOutModalUser(u)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-border bg-surface text-text hover:text-red-600 hover:border-red-300 transition-colors"
                                    >
                                      <LogOut size={13} />
                                      Force Sign Out
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Pagination Footer */}
              {!isLoading && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-surface text-xs text-text-muted">
                  <span>
                    Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-2.5 py-1 rounded border border-border bg-surface text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-subtle transition-colors"
                    >
                      Previous
                    </button>
                    <span className="font-semibold text-text px-1">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      className="px-2.5 py-1 rounded border border-border bg-surface text-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-subtle transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Change Role Modal */}
        <Modal
          open={!!roleModalUser}
          onClose={() => !isSubmitting && setRoleModalUser(null)}
          title={`Change Role: ${roleModalUser?.displayName}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Select an authoritative role for this account. The change will update both Supabase
              Auth metadata and public profile records.
            </p>

            <div className="space-y-2">
              {(["user", "editor", "admin"] as AdminUserRole[]).map((r) => (
                <label
                  key={r}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRole === r
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-surface-subtle"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={selectedRole === r}
                    onChange={() => setSelectedRole(r)}
                    className="mt-0.5 text-primary focus:ring-primary"
                  />
                  <div>
                    <div className="font-semibold text-sm capitalize text-text">{r}</div>
                    <div className="text-xs text-text-muted">
                      {r === "admin" && "Full administrative access: users, settings, dramas, and taxonomy."}
                      {r === "editor" && "Content management access: dramas, episodes, tags, and channels."}
                      {r === "user" && "Standard public user privileges with no console access."}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setRoleModalUser(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded border border-border bg-surface text-text hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || selectedRole === roleModalUser?.role}
                onClick={handleRoleChange}
                className="px-4 py-2 text-xs font-semibold rounded bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                Confirm Role
              </button>
            </div>
          </div>
        </Modal>

        {/* Ban User Modal */}
        <Modal
          open={!!banModalUser}
          onClose={() => !isSubmitting && setBanModalUser(null)}
          title={`Ban User: ${banModalUser?.displayName}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Suspends authentication access for this user account. Banned users cannot obtain valid
              JWT tokens or access protected playback.
            </p>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">Ban Duration</label>
              <select
                value={banDuration}
                onChange={(e) => setBanDuration(e.target.value)}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {BAN_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Reason for Ban <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                rows={3}
                placeholder="Specify violation, chargeback, or policy reason..."
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setBanModalUser(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded border border-border bg-surface text-text hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleBanUser}
                className="px-4 py-2 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                Confirm Ban
              </button>
            </div>
          </div>
        </Modal>

        {/* Unban User Modal */}
        <Modal
          open={!!unbanModalUser}
          onClose={() => !isSubmitting && setUnbanModalUser(null)}
          title={`Lift Ban: ${unbanModalUser?.displayName}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Are you sure you want to lift the suspension for{" "}
              <strong>{unbanModalUser?.displayName}</strong> ({unbanModalUser?.email})? The user
              will immediately regain login access.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setUnbanModalUser(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded border border-border bg-surface text-text hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleUnbanUser}
                className="px-4 py-2 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                Lift Suspension
              </button>
            </div>
          </div>
        </Modal>

        {/* Force Sign-Out Modal */}
        <Modal
          open={!!signOutModalUser}
          onClose={() => !isSubmitting && setSignOutModalUser(null)}
          title={`Revoke Sessions: ${signOutModalUser?.displayName}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              Revoking active sessions forces user{" "}
              <strong>{signOutModalUser?.displayName}</strong> ({signOutModalUser?.email}) to sign
              back in with valid credentials on all connected devices.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setSignOutModalUser(null)}
                className="px-3.5 py-2 text-xs font-semibold rounded border border-border bg-surface text-text hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleForceSignOut}
                className="px-4 py-2 text-xs font-semibold rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                Revoke All Sessions
              </button>
            </div>
          </div>
        </Modal>
      </main>
    </div>
  );
}
