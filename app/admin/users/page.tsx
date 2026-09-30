"use client";

import { useMemo, useState, Fragment } from "react";
import { Search, ChevronDown, ArrowUpDown } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { adminUsers, type AdminUserStatus } from "@/data/admin-users.mock";
import { formatDate, formatDateTime } from "@/lib/format";

const ALL_STATUS = "All";
type SortBy = "createdAt" | "lastLoginAt";
type SortDir = "asc" | "desc";

export default function AdminUsersPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminUserStatus | typeof ALL_STATUS>(ALL_STATUS);
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = adminUsers.filter((u) => {
      const emailLocalPart = u.email.split("@")[0].toLowerCase();
      const matchesQuery =
        q === "" || u.username.toLowerCase().includes(q) || emailLocalPart.includes(q);
      const matchesStatus = statusFilter === ALL_STATUS || u.status === statusFilter;
      return matchesQuery && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      const aTime = new Date(a[sortBy]).getTime();
      const bTime = new Date(b[sortBy]).getTime();
      return sortDir === "asc" ? aTime - bTime : bTime - aTime;
    });
  }, [query, statusFilter, sortBy, sortDir]);

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <h1 className="font-display font-bold text-2xl mb-1">Users</h1>
        <p className="text-sm text-text-muted mb-6">
          {adminUsers.length} users in the database.
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={16}
              strokeWidth={2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username or email..."
              className="w-full rounded-md border border-border bg-surface pl-9 pr-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AdminUserStatus | typeof ALL_STATUS)}
            className="rounded-md border border-border bg-surface text-sm text-text px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value={ALL_STATUS}>All statuses</option>
            <option value="Free">Free</option>
            <option value="VIP">VIP</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-md border border-border bg-surface text-sm text-text px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value="createdAt">Sort by: Created At</option>
            <option value="lastLoginAt">Sort by: Last Login</option>
          </select>

          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface text-sm text-text hover:bg-surface px-3.5 py-2.5 transition-colors"
          >
            <ArrowUpDown size={14} strokeWidth={2} />
            {sortDir === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-text-muted">
                <th className="w-12 px-4 py-3">No</th>
                <th className="px-3 py-3">Username</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Last Login</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u, index) => {
                const expanded = expandedId === u.id;
                return (
                  <Fragment key={u.id}>
                    <tr
                      className="border-b border-border last:border-0 hover:bg-surface transition-colors"
                    >
                      <td className="px-4 py-3 text-text-muted">{index + 1}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : u.id)}
                          aria-expanded={expanded}
                          className="flex items-center gap-1.5 font-semibold text-text hover:text-primary transition-colors"
                        >
                          <ChevronDown
                            size={14}
                            strokeWidth={2.5}
                            className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
                          />
                          {u.username}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-pill border px-2.5 py-1 text-xs font-semibold ${
                            u.status === "VIP"
                              ? "bg-tertiary-soft text-text border-tertiary"
                              : "bg-surface text-text-muted border-border"
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-text-muted">
                        {formatDateTime(u.lastLoginAt)}
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="border-b border-border last:border-0 bg-surface">
                        <td />
                        <td colSpan={3} className="px-3 py-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm max-w-lg">
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1">Email</p>
                              <p className="text-text">{u.email}</p>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1">
                                Social Login
                              </p>
                              {u.socialLogins.length === 0 ? (
                                <p className="text-text-muted">Not connected</p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {u.socialLogins.map((provider) => (
                                    <span
                                      key={provider}
                                      className="rounded-pill bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1"
                                    >
                                      {provider}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-text-muted mb-1">
                                Created At
                              </p>
                              <p className="text-text">{formatDate(u.createdAt)}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <p className="text-sm text-text-muted text-center py-10">
              No users match your search or filters.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
