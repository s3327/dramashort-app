"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, List, LayoutGrid, Pencil, Plus, Loader2, Film } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import type { Channel } from "@/types/content";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import {
  getAdminDramas,
  getChannels,
  createDrama,
  type Drama,
  type TitleStatus,
} from "@/lib/services/content.service";

const ALL_CHANNELS = "All Channels";
const ALL_STATUSES = "all";
const ROWS_PER_PAGE_OPTIONS = [20, 50, 75, 100, 250];

const STATUS_STYLES: Record<TitleStatus, string> = {
  Published: "bg-green-50 text-green-700 border-green-200",
  Draft: "bg-surface text-text-muted border-border",
  Scheduled: "bg-tertiary-soft text-text border-tertiary",
  Archived: "bg-danger-soft text-danger border-danger-light",
};

function AdminTitlesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialQ = searchParams?.get("q") ?? "";
  const initialChannel = searchParams?.get("channel") ?? ALL_CHANNELS;
  const initialStatus = searchParams?.get("status") ?? ALL_STATUSES;
  const initialPage = parseInt(searchParams?.get("page") ?? "1", 10);
  const initialRows = parseInt(searchParams?.get("pageSize") ?? "20", 10);

  const [dramas, setDramas] = useState<Drama[]>([]);
  const [totalDramas, setTotalDramas] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [channelList, setChannelList] = useState<Channel[]>([]);
  const [searchInput, setSearchInput] = useState(initialQ);
  const [query, setQuery] = useState(initialQ);
  const [selectedChannel, setSelectedChannel] = useState(initialChannel);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [view, setView] = useState<"list" | "card">("list");
  const [rowsPerPage, setRowsPerPage] = useState(
    ROWS_PER_PAGE_OPTIONS.includes(initialRows) ? initialRows : 20
  );
  const [page, setPage] = useState(Math.max(1, isNaN(initialPage) ? 1 : initialPage));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { message: toastMessage, show: showToast } = useToast();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmittingDrama, setIsSubmittingDrama] = useState(false);
  const [dramaFormError, setDramaFormError] = useState("");
  const [newDrama, setNewDrama] = useState({
    title: "",
    synopsis: "",
    genre: "Romance",
    tags: "",
    channel: "",
    totalEpisodes: 40,
    poster: "",
    status: "Draft" as TitleStatus,
  });

  // Load distinct channels from Content DB
  useEffect(() => {
    let mounted = true;
    async function loadChannels() {
      try {
        const dbChannels = await getChannels();
        if (mounted && dbChannels && dbChannels.length > 0) {
          setChannelList(dbChannels);
        } else if (mounted && ENABLE_MOCK_FALLBACK) {
          const { channels } = await import("@/data/channels.mock");
          setChannelList(channels);
        }
      } catch {
        if (mounted && ENABLE_MOCK_FALLBACK) {
          const { channels } = await import("@/data/channels.mock");
          setChannelList(channels);
        }
      }
    }
    loadChannels();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch admin catalog from authenticated service API
  const fetchCatalog = useCallback(
    async (
      qVal: string,
      chanVal: string,
      statVal: string,
      pageVal: number,
      rowsVal: number
    ) => {
      setIsLoading(true);
      try {
        const res = await getAdminDramas({
          q: qVal.trim() || undefined,
          channel: chanVal !== ALL_CHANNELS ? chanVal : undefined,
          status: statVal !== ALL_STATUSES ? statVal : undefined,
          page: pageVal,
          pageSize: rowsVal,
        });
        setDramas(res.items);
        setTotalDramas(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        console.error("Failed to load admin catalog:", err);
        setDramas([]);
        setTotalDramas(0);
        setTotalPages(1);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== query) {
        setQuery(searchInput);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, query]);

  // Execute fetch when filters or pagination change and sync URL
  useEffect(() => {
    fetchCatalog(query, selectedChannel, selectedStatus, page, rowsPerPage);

    // Synchronize query parameters to URL
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (selectedChannel !== ALL_CHANNELS) params.set("channel", selectedChannel);
    if (selectedStatus !== ALL_STATUSES) params.set("status", selectedStatus);
    if (page > 1) params.set("page", String(page));
    if (rowsPerPage !== 20) params.set("pageSize", String(rowsPerPage));

    const newQueryString = params.toString() ? `?${params.toString()}` : "";
    if (typeof window !== "undefined") {
      const targetUrl = `${window.location.pathname}${newQueryString}`;
      window.history.replaceState(null, "", targetUrl);
    }
  }, [fetchCatalog, query, selectedChannel, selectedStatus, page, rowsPerPage]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput);
    setPage(1);
  };

  const allOnPageSelected = dramas.length > 0 && dramas.every((t) => selectedIds.has(t.id));

  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        dramas.forEach((t) => next.delete(t.id));
      } else {
        dramas.forEach((t) => next.add(t.id));
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

  const handleCreateDrama = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrama.title.trim()) {
      setDramaFormError("Drama title cannot be empty");
      return;
    }

    setIsSubmittingDrama(true);
    setDramaFormError("");

    const chosenChannel =
      newDrama.channel || channelList[0]?.name || "DramaShort Originals";

    const res = await createDrama({
      title: newDrama.title.trim(),
      synopsis: newDrama.synopsis.trim() || undefined,
      genre: newDrama.genre,
      tags: newDrama.tags,
      channel: chosenChannel,
      totalEpisodes: Number(newDrama.totalEpisodes) || 40,
      poster: newDrama.poster.trim() || undefined,
      status: newDrama.status,
    });

    setIsSubmittingDrama(false);

    if (res.success && res.data) {
      setIsAddModalOpen(false);
      setNewDrama({
        title: "",
        synopsis: "",
        genre: "Romance",
        tags: "",
        channel: channelList[0]?.name || "",
        totalEpisodes: 40,
        poster: "",
        status: "Draft",
      });
      showToast("Drama created successfully");
      // Direct navigation to the newly created drama's edit page
      router.push(`/admin/dramas/${res.data.id}/edit`);
    } else {
      setDramaFormError(res.error || "Failed to create drama");
    }
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl mb-1">Dramas</h1>
            <p className="text-sm text-text-muted">
              All dramas in the catalog.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDramaFormError("");
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-full bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text font-semibold text-sm px-4 py-2 shadow-sm transition-colors cursor-pointer"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Drama
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[220px]">
            <Search
              size={16}
              strokeWidth={2}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search dramas..."
              className="w-full rounded-md border border-border bg-surface pl-9 pr-3.5 py-2.5 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            />
          </div>

          <select
            value={selectedChannel}
            onChange={(e) => {
              setSelectedChannel(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface text-sm text-text px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value={ALL_CHANNELS}>{ALL_CHANNELS}</option>
            {channelList.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-surface text-sm text-text px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          >
            <option value={ALL_STATUSES}>All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Archived">Archived</option>
          </select>

          <button
            type="submit"
            aria-label="Search"
            className="flex items-center justify-center rounded-md bg-btn-primary hover:bg-btn-primary-hover text-btn-primary-text p-2.5 shadow-sm transition-colors cursor-pointer"
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
              className={`p-2.5 transition-colors cursor-pointer ${
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
              className={`p-2.5 border-l border-border transition-colors cursor-pointer ${
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
              : `${totalDramas} drama${totalDramas === 1 ? "" : "s"}`}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor="rowsPerPage" className="text-xs text-text-muted">
              Show
            </label>
            <select
              id="rowsPerPage"
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setPage(1);
              }}
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

        {/* Dynamic content rendering: Skeleton vs Empty vs Data */}
        {isLoading ? (
          view === "list" ? (
            <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-text-muted">
                    <th className="w-10 px-4 py-3">
                      <div className="h-4 w-4 bg-border/40 rounded animate-pulse" />
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
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="h-4 w-4 bg-border/40 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-4 w-48 bg-border/40 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-4 w-12 bg-border/40 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-4 w-12 bg-border/40 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-4 w-28 bg-border/40 rounded animate-pulse" />
                      </td>
                      <td className="px-3 py-3">
                        <div className="h-5 w-20 bg-border/40 rounded-full animate-pulse" />
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="h-4 w-6 bg-border/40 rounded ml-auto animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden animate-pulse"
                >
                  <div className="aspect-[2/3] bg-border/30" />
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-border/40 rounded w-3/4" />
                    <div className="h-3 bg-border/30 rounded w-1/2" />
                    <div className="h-4 bg-border/40 rounded-full w-16" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : dramas.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg shadow-sm p-12 text-center">
            <p className="text-sm text-text-muted">
              {query || selectedChannel !== ALL_CHANNELS || selectedStatus !== ALL_STATUSES
                ? "No dramas match your search or filters."
                : "No dramas in catalog yet. Click 'Add Drama' to create one."}
            </p>
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
                {dramas.map((t) => (
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
                        href={`/admin/dramas/${t.id}/edit`}
                        className="font-semibold text-text hover:text-primary transition-colors line-clamp-1"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-text-muted">{t.year}</td>
                    <td className="px-3 py-3 text-text-muted">
                      {t.episodesAvailable !== undefined ? `${t.episodesAvailable} / ${t.totalEpisodes}` : t.totalEpisodes}
                    </td>
                    <td className="px-3 py-3 text-text-muted">{t.channel}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[t.status]}`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Link
                          href={`/admin/dramas/${t.id}/episodes`}
                          aria-label={`Manage episodes for ${t.title}`}
                          title="Manage Episodes"
                          className="inline-flex p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-surface transition-colors"
                        >
                          <Film size={15} strokeWidth={2} />
                        </Link>
                        <Link
                          href={`/admin/dramas/${t.id}/edit`}
                          aria-label={`Edit ${t.title}`}
                          title="Edit Drama"
                          className="inline-flex p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-surface transition-colors"
                        >
                          <Pencil size={15} strokeWidth={2} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
            {dramas.map((t) => (
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
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <Link
                      href={`/admin/dramas/${t.id}/episodes`}
                      aria-label={`Manage episodes for ${t.title}`}
                      title="Manage Episodes"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-text-light hover:bg-black/75 transition-colors"
                    >
                      <Film size={13} strokeWidth={2} />
                    </Link>
                    <Link
                      href={`/admin/dramas/${t.id}/edit`}
                      aria-label={`Edit ${t.title}`}
                      title="Edit Drama"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-text-light hover:bg-black/75 transition-colors"
                    >
                      <Pencil size={13} strokeWidth={2} />
                    </Link>
                  </div>
                </div>
                <div className="p-3">
                  <Link
                    href={`/admin/dramas/${t.id}/edit`}
                    className="text-sm font-semibold text-text hover:text-primary transition-colors line-clamp-2 leading-snug"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-1 text-xs text-text-muted">
                    {t.year} · {t.episodesAvailable !== undefined ? `${t.episodesAvailable}/${t.totalEpisodes}` : t.totalEpisodes} eps
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[t.status]}`}
                  >
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />

        {/* Add Drama Creation Modal */}
        <Modal
          open={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add New Drama"
        >
          <form onSubmit={handleCreateDrama} className="space-y-4">
            <div>
              <label htmlFor="drama-title" className="block text-xs font-semibold text-text mb-1">
                Drama Title <span className="text-danger">*</span>
              </label>
              <input
                id="drama-title"
                type="text"
                required
                value={newDrama.title}
                onChange={(e) => setNewDrama({ ...newDrama, title: e.target.value })}
                placeholder="e.g. My Secret Billionaire Husband"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label htmlFor="drama-synopsis" className="block text-xs font-semibold text-text mb-1">
                Synopsis / Description
              </label>
              <textarea
                id="drama-synopsis"
                rows={3}
                value={newDrama.synopsis}
                onChange={(e) => setNewDrama({ ...newDrama, synopsis: e.target.value })}
                placeholder="Brief synopsis of the drama storyline..."
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="drama-genre" className="block text-xs font-semibold text-text mb-1">
                  Genre
                </label>
                <select
                  id="drama-genre"
                  value={newDrama.genre}
                  onChange={(e) => setNewDrama({ ...newDrama, genre: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  <option value="Romance">Romance</option>
                  <option value="CEO">CEO</option>
                  <option value="Revenge">Revenge</option>
                  <option value="Werewolf">Werewolf</option>
                  <option value="Urban">Urban</option>
                  <option value="Fantasy">Fantasy</option>
                  <option value="Drama">Drama</option>
                  <option value="Action">Action</option>
                  <option value="Thriller">Thriller</option>
                  <option value="Comedy">Comedy</option>
                </select>
              </div>

              <div>
                <label htmlFor="drama-channel" className="block text-xs font-semibold text-text mb-1">
                  Channel
                </label>
                <select
                  id="drama-channel"
                  value={newDrama.channel || (channelList[0]?.name || "")}
                  onChange={(e) => setNewDrama({ ...newDrama, channel: e.target.value })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  {channelList.map((c) => (
                    <option key={c.slug} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="drama-tags" className="block text-xs font-semibold text-text mb-1">
                Taxonomy / Tags (comma separated)
              </label>
              <input
                id="drama-tags"
                type="text"
                value={newDrama.tags}
                onChange={(e) => setNewDrama({ ...newDrama, tags: e.target.value })}
                placeholder="Billionaire, Secret Identity, Love Triangle"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="drama-episodes" className="block text-xs font-semibold text-text mb-1">
                  Total Episodes
                </label>
                <input
                  id="drama-episodes"
                  type="number"
                  min={1}
                  value={newDrama.totalEpisodes}
                  onChange={(e) => setNewDrama({ ...newDrama, totalEpisodes: Number(e.target.value) || 1 })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>

              <div>
                <label htmlFor="drama-status" className="block text-xs font-semibold text-text mb-1">
                  Status
                </label>
                <select
                  id="drama-status"
                  value={newDrama.status}
                  onChange={(e) => setNewDrama({ ...newDrama, status: e.target.value as TitleStatus })}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  <option value="Draft">Draft</option>
                  <option value="Published">Published</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="drama-poster" className="block text-xs font-semibold text-text mb-1">
                Poster Image URL (optional)
              </label>
              <input
                id="drama-poster"
                type="url"
                value={newDrama.poster}
                onChange={(e) => setNewDrama({ ...newDrama, poster: e.target.value })}
                placeholder="https://images.unsplash.com/... or Supabase storage URL"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            {dramaFormError && (
              <p className="text-xs font-semibold text-danger">{dramaFormError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingDrama}
                className="rounded-md bg-btn-primary hover:bg-btn-primary-hover disabled:opacity-50 text-btn-primary-text font-semibold text-sm px-4 py-2 shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmittingDrama ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  "Create Drama"
                )}
              </button>
            </div>
          </form>
        </Modal>

        <Toast message={toastMessage} />
      </main>
    </div>
  );
}

export default function AdminTitlesPage() {
  return (
    <Suspense
      fallback={
        <div data-theme="light" className="min-h-screen bg-bg text-text flex">
          <AdminSidebar />
          <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-surface-raised rounded w-48 mb-6" />
              <div className="h-10 bg-surface-raised rounded w-full mb-6" />
              <div className="h-64 bg-surface-raised rounded w-full" />
            </div>
          </main>
        </div>
      }
    >
      <AdminTitlesContent />
    </Suspense>
  );
}
