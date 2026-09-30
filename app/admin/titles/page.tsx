"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, List, LayoutGrid, Pencil } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Pagination from "@/components/Pagination";
import { channels as initialChannels, type Channel } from "@/data/channels.mock";
import { titles as adminTitles, type TitleStatus, type Title } from "@/data/titles.mock";
import { getAdminDramas, getChannels } from "@/lib/services/content.service";

const ALL_CHANNELS = "All Channels";
const ROWS_PER_PAGE_OPTIONS = [20, 50, 75, 100, 250];

const STATUS_STYLES: Record<TitleStatus, string> = {
  Published: "bg-green-50 text-green-700 border-green-200",
  Draft: "bg-surface text-text-muted border-border",
  Scheduled: "bg-tertiary-soft text-text border-tertiary",
  Archived: "bg-danger-soft text-danger border-danger-light",
};

export default function AdminTitlesPage() {
  const [dramas, setDramas] = useState<Title[]>(adminTitles);
  const [channelList, setChannelList] = useState<Channel[]>(initialChannels);
  const [query, setQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(ALL_CHANNELS);
  const [view, setView] = useState<"list" | "card">("list");
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dynamic catalog hydration from Supabase Content DB
  useEffect(() => {
    let mounted = true;
    async function loadCatalog() {
      try {
        const [dbDramas, dbChannels] = await Promise.all([
          getAdminDramas(),
          getChannels().catch(() => initialChannels),
        ]);
        if (!mounted) return;
        if (dbDramas && dbDramas.length > 0) {
          setDramas(dbDramas);
        }
        if (dbChannels && dbChannels.length > 0) {
          setChannelList(dbChannels);
        }
      } catch (err) {
        console.warn("Failed to dynamically hydrate admin catalog:", err);
      }
    }
    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dramas.filter((t) => {
      const matchesQuery = q === "" || t.title.toLowerCase().includes(q);
      const matchesChannel =
        selectedChannel === ALL_CHANNELS || t.channel === selectedChannel;
      return matchesQuery && matchesChannel;
    });
  }, [dramas, query, selectedChannel]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const pageItems = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  // Keep the page valid whenever filters or page size change.
  useEffect(() => {
    setPage(1);
  }, [query, selectedChannel, rowsPerPage]);

  const allOnPageSelected = pageItems.length > 0 && pageItems.every((t) => selectedIds.has(t.id));

  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageItems.forEach((t) => next.delete(t.id));
      } else {
        pageItems.forEach((t) => next.add(t.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <h1 className="font-display font-bold text-2xl mb-1">Titles</h1>
        <p className="text-sm text-text-muted mb-6">
          All titles in the database.
        </p>

        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 mb-6">
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
              placeholder="Search titles..."
              className="w-full rounded-md border border-border bg-surface pl-9 pr-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="rounded-md border border-border bg-surface text-sm text-text px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value={ALL_CHANNELS}>{ALL_CHANNELS}</option>
            {channelList.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            aria-label="Search"
            className="flex items-center justify-center rounded-md bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text p-2.5 shadow-sm transition-colors"
          >
            <Search size={16} strokeWidth={2.5} />
          </button>

          {/* List / card view toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
            <button
              type="button"
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              aria-label="List view"
              className={`p-2.5 transition-colors ${
                view === "list"
                  ? "bg-primary text-text-light"
                  : "bg-surface text-text-muted hover:text-text"
              }`}
            >
              <List size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setView("card")}
              aria-pressed={view === "card"}
              aria-label="Card view"
              className={`p-2.5 border-l border-border transition-colors ${
                view === "card"
                  ? "bg-primary text-text-light"
                  : "bg-surface text-text-muted hover:text-text"
              }`}
            >
              <LayoutGrid size={16} strokeWidth={2} />
            </button>
          </div>
        </form>

        {/* Rows-per-page + selection count */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-xs text-text-muted">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${filtered.length} title${filtered.length === 1 ? "" : "s"}`}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="rowsPerPage" className="text-xs text-text-muted">
              Show
            </label>
            <select
              id="rowsPerPage"
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="rounded-md border border-border bg-surface text-xs text-text px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            >
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg shadow-sm p-12 text-center">
            <p className="text-sm text-text-muted">No titles match your search or filters.</p>
          </div>
        ) : view === "list" ? (
          <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-semibold text-text-muted">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAllOnPage}
                      aria-label="Select all on this page"
                      className="h-4 w-4 accent-primary"
                    />
                  </th>
                  <th className="px-3 py-3">Title</th>
                  <th className="px-3 py-3">Year</th>
                  <th className="px-3 py-3">Episodes</th>
                  <th className="px-3 py-3">Channel</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-surface transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(t.id)}
                        onChange={() => toggleOne(t.id)}
                        aria-label={`Select ${t.title}`}
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/titles/${t.id}/edit`}
                        className="font-semibold text-text hover:text-primary transition-colors line-clamp-1"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-text-muted">{t.year}</td>
                    <td className="px-3 py-3 text-text-muted">{t.totalEpisodes}</td>
                    <td className="px-3 py-3 text-text-muted">{t.channel}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-pill border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[t.status]}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/admin/titles/${t.id}/edit`}
                        aria-label={`Edit ${t.title}`}
                        className="inline-flex p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-surface transition-colors"
                      >
                        <Pencil size={15} strokeWidth={2} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {pageItems.map((t) => (
              <div
                key={t.id}
                className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden"
              >
                <div className="relative aspect-[2/3]">
                  <Image
                    src={t.poster}
                    alt={t.title}
                    fill
                    sizes="(min-width: 1024px) 18vw, (min-width: 640px) 22vw, 45vw"
                    className="object-cover"
                  />
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => toggleOne(t.id)}
                    aria-label={`Select ${t.title}`}
                    className="absolute top-2 left-2 h-4 w-4 accent-primary"
                  />
                  <Link
                    href={`/admin/titles/${t.id}/edit`}
                    aria-label={`Edit ${t.title}`}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-text-light hover:bg-black/75 transition-colors"
                  >
                    <Pencil size={13} strokeWidth={2} />
                  </Link>
                </div>
                <div className="p-3">
                  <Link
                    href={`/admin/titles/${t.id}/edit`}
                    className="text-sm font-semibold text-text hover:text-primary transition-colors line-clamp-2 leading-snug"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-1 text-xs text-text-muted">
                    {t.year} · {t.totalEpisodes} eps
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-pill border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[t.status]}`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
      </main>
    </div>
  );
}
