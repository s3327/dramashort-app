"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Layers,
  Link2,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Clock,
  Unlock,
  Lock,
  Save,
  Loader2,
  Film,
  Search,
  ExternalLink,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import type { Drama, AdminEpisode } from "@/types/content";
import {
  getDramaById,
  getAdminEpisodes,
  createAdminEpisode,
  bulkCreateAdminEpisodes,
  bulkAssignMedia,
  reorderAdminEpisodes,
  updateFreeEpisodesCount,
  updateAdminEpisode,
  deleteAdminEpisode,
} from "@/lib/services/content.service";

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function AdminEpisodeManagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: dramaId } = use(params);
  const { message: toastMessage, show: showToast } = useToast();

  const [drama, setDrama] = useState<Drama | null>(null);
  const [episodes, setEpisodes] = useState<AdminEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Freemium configuration state
  const [freeCountInput, setFreeCountInput] = useState<number>(5);
  const [isUpdatingFreeCount, setIsUpdatingFreeCount] = useState(false);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [editingEpisode, setEditingEpisode] = useState<AdminEpisode | null>(null);
  const [deletingEpisode, setDeletingEpisode] = useState<AdminEpisode | null>(null);

  // Form states
  const [singleForm, setSingleForm] = useState({
    episodeNumber: "",
    title: "",
    durationSeconds: "",
    isFree: true,
    hlsUrl: "",
    mp4Url: "",
    thumbnailUrl: "",
  });

  const [bulkForm, setBulkForm] = useState({
    startNumber: 1,
    endNumber: 40,
    titleTemplate: "Episode {n}",
    autoFree: true,
  });

  const [mediaPasteText, setMediaPasteText] = useState("");
  const [isActionPending, setIsActionPending] = useState(false);

  // Load drama & episodes
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dramaData, epResult] = await Promise.all([
        getDramaById(dramaId),
        getAdminEpisodes(dramaId),
      ]);

      if (dramaData) {
        setDrama(dramaData);
        setFreeCountInput(dramaData.freeEpisodesCount ?? 5);
      }
      if (epResult.success && epResult.data) {
        setEpisodes(epResult.data);
      }
    } catch (err) {
      console.error("Failed to load drama/episodes:", err);
      showToast("Error loading episodes. Please refresh.");
    } finally {
      setIsLoading(false);
    }
  }, [dramaId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered episodes
  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) return episodes;
    const q = searchQuery.toLowerCase().trim();
    return episodes.filter(
      (ep) =>
        ep.episodeNumber.toString() === q ||
        ep.title.toLowerCase().includes(q) ||
        ep.mediaStatus.toLowerCase().includes(q)
    );
  }, [episodes, searchQuery]);

  // Save free episodes count
  const handleSaveFreeCount = async () => {
    if (freeCountInput < 0) {
      showToast("Free episodes count must be 0 or greater.");
      return;
    }
    setIsUpdatingFreeCount(true);
    const res = await updateFreeEpisodesCount(dramaId, freeCountInput, true);
    setIsUpdatingFreeCount(false);

    if (res.success) {
      showToast(`Free episodes threshold updated to ${freeCountInput}.`);
      await loadData();
    } else {
      showToast(res.error || "Failed to update free episodes count.");
    }
  };

  // Create single episode
  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsActionPending(true);

    const epNum = singleForm.episodeNumber.trim()
      ? Number(singleForm.episodeNumber)
      : undefined;
    const durSec = singleForm.durationSeconds.trim()
      ? Number(singleForm.durationSeconds)
      : 0;

    const res = await createAdminEpisode(dramaId, {
      episodeNumber: epNum,
      title: singleForm.title.trim() || undefined,
      durationSeconds: durSec,
      isFree: singleForm.isFree,
      hlsUrl: singleForm.hlsUrl.trim() || undefined,
      mp4Url: singleForm.mp4Url.trim() || undefined,
      thumbnailUrl: singleForm.thumbnailUrl.trim() || undefined,
    });

    setIsActionPending(false);

    if (res.success) {
      showToast("Episode created successfully.");
      setIsAddModalOpen(false);
      setSingleForm({
        episodeNumber: "",
        title: "",
        durationSeconds: "",
        isFree: true,
        hlsUrl: "",
        mp4Url: "",
        thumbnailUrl: "",
      });
      await loadData();
    } else {
      showToast(res.error || "Failed to create episode.");
    }
  };

  // Bulk create episodes
  const handleBulkCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkForm.endNumber < bulkForm.startNumber) {
      showToast("End number must be greater than or equal to start number.");
      return;
    }

    setIsActionPending(true);
    const res = await bulkCreateAdminEpisodes(dramaId, {
      startNumber: bulkForm.startNumber,
      endNumber: bulkForm.endNumber,
      titleTemplate: bulkForm.titleTemplate.trim() || undefined,
      autoFree: bulkForm.autoFree,
    });
    setIsActionPending(false);

    if (res.success) {
      showToast(`Created ${res.count ?? 0} episodes successfully.`);
      setIsBulkModalOpen(false);
      await loadData();
    } else {
      showToast(res.error || "Failed to bulk create episodes.");
    }
  };

  // Bulk media assign
  const handleBulkMediaAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mediaPasteText.trim()) {
      showToast("Please paste URLs or asset IDs.");
      return;
    }

    const lines = mediaPasteText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const items: Array<{ episodeNumber: number; urlOrAssetId: string }> = [];

    lines.forEach((line, index) => {
      // Check if line contains comma or tab delimiter: "1,https://..."
      if (line.includes(",") || line.includes("\t")) {
        const delimiter = line.includes(",") ? "," : "\t";
        const [epPart, ...urlParts] = line.split(delimiter);
        const epNum = Number(epPart.trim());
        const url = urlParts.join(delimiter).trim();
        if (Number.isInteger(epNum) && url) {
          items.push({ episodeNumber: epNum, urlOrAssetId: url });
        }
      } else {
        // Sequential 1-based: Line 1 -> Episode 1, Line 2 -> Episode 2
        items.push({ episodeNumber: index + 1, urlOrAssetId: line });
      }
    });

    if (items.length === 0) {
      showToast("No valid episode media rows parsed.");
      return;
    }

    setIsActionPending(true);
    const res = await bulkAssignMedia(dramaId, items);
    setIsActionPending(false);

    if (res.success) {
      showToast(`Assigned media to ${res.count ?? 0} episodes.`);
      setIsMediaModalOpen(false);
      setMediaPasteText("");
      await loadData();
    } else {
      showToast(res.error || "Failed to assign media.");
    }
  };

  // Update existing episode
  const handleUpdateEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEpisode) return;

    setIsActionPending(true);
    const res = await updateAdminEpisode(editingEpisode.id, {
      title: editingEpisode.title.trim(),
      durationSeconds: editingEpisode.durationSeconds,
      isFree: editingEpisode.isFree,
      thumbnailUrl: editingEpisode.thumbnailUrl,
      hlsUrl: editingEpisode.media?.hlsUrl || null,
      mp4Url: editingEpisode.media?.mp4Url || null,
    });
    setIsActionPending(false);

    if (res.success) {
      showToast(`Episode ${editingEpisode.episodeNumber} updated.`);
      setEditingEpisode(null);
      await loadData();
    } else {
      showToast(res.error || "Failed to update episode.");
    }
  };

  // Delete episode
  const handleDeleteEpisode = async () => {
    if (!deletingEpisode) return;

    setIsActionPending(true);
    const res = await deleteAdminEpisode(deletingEpisode.id);
    setIsActionPending(false);

    if (res.success) {
      showToast(`Episode ${deletingEpisode.episodeNumber} deleted. Remaining episodes renumbered.`);
      setDeletingEpisode(null);
      await loadData();
    } else {
      showToast(res.error || "Failed to delete episode.");
    }
  };

  // Reorder single step (move up or down)
  const handleMoveEpisode = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= episodes.length) return;

    const newOrder = [...episodes];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    // Optimistic update
    setEpisodes(newOrder);

    const orderedIds = newOrder.map((e) => e.id);
    const res = await reorderAdminEpisodes(dramaId, orderedIds);
    if (res.success) {
      showToast("Episode order updated.");
      await loadData();
    } else {
      showToast(res.error || "Failed to reorder episodes.");
      await loadData();
    }
  };

  // Quick toggle isFree
  const handleToggleFree = async (ep: AdminEpisode) => {
    const nextVal = !ep.isFree;
    const res = await updateAdminEpisode(ep.id, { isFree: nextVal });
    if (res.success) {
      setEpisodes((prev) =>
        prev.map((e) => (e.id === ep.id ? { ...e, isFree: nextVal } : e))
      );
      showToast(`Episode ${ep.episodeNumber} marked as ${nextVal ? "Free" : "Locked"}.`);
    } else {
      showToast(res.error || "Failed to update episode access mode.");
    }
  };

  if (isLoading && !drama) {
    return (
      <div data-theme="light" className="min-h-screen bg-bg text-text flex">
        <AdminSidebar />
        <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
          <div className="h-4 w-48 bg-border/60 rounded animate-pulse mb-6" />
          <div className="h-10 w-80 bg-border/40 rounded animate-pulse mb-6" />
          <div className="bg-surface border border-border rounded-lg p-6 animate-pulse space-y-4">
            <div className="h-8 bg-border/30 rounded w-1/3" />
            <div className="h-24 bg-border/20 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (!drama) {
    return (
      <div data-theme="light" className="min-h-screen bg-bg text-text flex">
        <AdminSidebar />
        <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin/dashboard" },
              { label: "Dramas", href: "/admin/dramas" },
              { label: "Not Found" },
            ]}
          />
          <div className="bg-surface border border-border rounded-lg p-8 text-center mt-6">
            <h1 className="text-xl font-bold mb-2">Drama Not Found</h1>
            <p className="text-sm text-text-muted mb-6">The drama could not be found.</p>
            <Link
              href="/admin/dramas"
              className="inline-flex items-center gap-2 rounded-md bg-primary text-text-light px-4 py-2 text-sm font-semibold hover:bg-primary-hover"
            >
              <ArrowLeft size={16} /> Back to Dramas
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const readyCount = episodes.filter((e) => e.mediaStatus === "ready").length;

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Dramas", href: "/admin/dramas" },
            { label: drama.title, href: `/admin/dramas/${drama.id}/edit` },
            { label: "Manage Episodes" },
          ]}
        />

        {/* Drama Overview Card & Freemium Controls */}
        <div className="bg-surface border border-border rounded-lg p-5 mt-4 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-24 rounded border border-border overflow-hidden bg-surface-raised flex-shrink-0">
                {drama.poster ? (
                  <Image
                    src={drama.poster}
                    alt={drama.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <Film className="w-8 h-8 text-text-muted m-auto" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display font-bold text-xl sm:text-2xl text-text">
                    {drama.title}
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full border border-border bg-surface-raised font-medium text-text-muted">
                    {drama.status}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Channel: <span className="font-medium text-text">{drama.channel}</span> • Total Episodes in DB:{" "}
                  <span className="font-semibold text-text">{episodes.length}</span> • Ready for Playback:{" "}
                  <span className={readyCount > 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-500"}>
                    {readyCount} / {episodes.length}
                  </span>
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <Link
                    href={`/admin/dramas/${drama.id}/edit`}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <Pencil size={12} /> Edit Metadata
                  </Link>
                  <Link
                    href={`/drama/${drama.slug}`}
                    target="_blank"
                    className="text-xs text-text-muted hover:text-text inline-flex items-center gap-1"
                  >
                    <ExternalLink size={12} /> View Public Page
                  </Link>
                </div>
              </div>
            </div>

            {/* Freemium Configuration Gate */}
            <div className="bg-surface-raised border border-border rounded-lg p-3.5 md:w-80 flex-shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-text uppercase tracking-wide">
                  Freemium Paywall Gate
                </span>
                <span className="text-[11px] text-text-muted">
                  Episodes 1–{freeCountInput} Free
                </span>
              </div>
              <p className="text-[11px] text-text-muted mb-3">
                Episodes beyond this limit default to coin-locked status.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-1">
                  <span className="text-xs text-text-muted whitespace-nowrap">Free Count:</span>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={freeCountInput}
                    onChange={(e) => setFreeCountInput(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-16 rounded border border-border bg-surface px-2 py-1 text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSaveFreeCount}
                  disabled={isUpdatingFreeCount}
                  className="inline-flex items-center gap-1 rounded bg-primary text-text-light px-3 py-1 text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isUpdatingFreeCount ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Save & Sync
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
            <input
              type="text"
              placeholder="Filter by episode number or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsMediaModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised transition-colors shadow-sm cursor-pointer"
            >
              <Link2 size={14} />
              Bulk Paste Media
            </button>

            <button
              type="button"
              onClick={() => setIsBulkModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised transition-colors shadow-sm cursor-pointer"
            >
              <Layers size={14} />
              Bulk Range Generator
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-text-light px-3 py-1.5 text-xs font-semibold hover:bg-primary-hover transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              Add Episode
            </button>
          </div>
        </div>

        {/* Episodes Table */}
        <div className="bg-surface border border-border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-raised text-text-muted font-semibold">
                <th className="px-3 py-2.5 w-16 text-center">Order</th>
                <th className="px-3 py-2.5 w-14">#</th>
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5 w-24">Duration</th>
                <th className="px-3 py-2.5 w-32">Media Status</th>
                <th className="px-3 py-2.5 w-28">Access Mode</th>
                <th className="px-3 py-2.5 w-32 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredEpisodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-muted">
                    {searchQuery
                      ? "No episodes match your search query."
                      : "No episodes in this drama yet. Click 'Add Episode' or 'Bulk Range Generator' to begin."}
                  </td>
                </tr>
              ) : (
                filteredEpisodes.map((ep, idx) => (
                  <tr
                    key={ep.id}
                    className="hover:bg-surface-raised/50 transition-colors"
                  >
                    {/* Reorder Arrows */}
                    <td className="px-2 py-2 text-center">
                      <div className="inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveEpisode(idx, "up")}
                          aria-label={`Move Episode ${ep.episodeNumber} Up`}
                          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === episodes.length - 1}
                          onClick={() => handleMoveEpisode(idx, "down")}
                          aria-label={`Move Episode ${ep.episodeNumber} Down`}
                          className="p-1 rounded text-text-muted hover:text-text hover:bg-surface disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </td>

                    {/* Episode Number */}
                    <td className="px-3 py-2 font-bold text-text">
                      {ep.episodeNumber}
                    </td>

                    {/* Title */}
                    <td className="px-3 py-2">
                      <span className="font-medium text-text line-clamp-1">
                        {ep.title}
                      </span>
                      {ep.media?.assetRef && (
                        <span className="text-[10px] text-text-muted font-mono block">
                          Asset: {ep.media.assetRef}
                        </span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-3 py-2 text-text-muted font-mono">
                      {formatDuration(ep.durationSeconds)}
                    </td>

                    {/* Media Status Badge */}
                    <td className="px-3 py-2">
                      {ep.mediaStatus === "ready" ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                          <CheckCircle2 size={11} /> Ready
                        </span>
                      ) : ep.mediaStatus === "processing" ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                          <Clock size={11} /> Processing
                        </span>
                      ) : ep.mediaStatus === "error" ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-rose-500/15 text-rose-600 border border-rose-500/30">
                          <AlertCircle size={11} /> Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          <AlertCircle size={11} /> Missing
                        </span>
                      )}
                    </td>

                    {/* Access Mode Toggle */}
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggleFree(ep)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold border transition-colors cursor-pointer ${
                          ep.isFree
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                            : "bg-surface-raised text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-800"
                        }`}
                        title="Click to toggle Free / Locked"
                      >
                        {ep.isFree ? (
                          <>
                            <Unlock size={11} /> Free
                          </>
                        ) : (
                          <>
                            <Lock size={11} /> Locked
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingEpisode({ ...ep })}
                          aria-label={`Edit Episode ${ep.episodeNumber}`}
                          className="p-1 rounded text-text-muted hover:text-primary hover:bg-surface transition-colors cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingEpisode(ep)}
                          aria-label={`Delete Episode ${ep.episodeNumber}`}
                          className="p-1 rounded text-text-muted hover:text-rose-600 hover:bg-surface transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL: ADD SINGLE EPISODE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="font-display font-bold text-lg mb-1">Add Single Episode</h2>
            <p className="text-xs text-text-muted mb-4">
              Create an episode manually and assign its media URL or asset identifier.
            </p>

            <form onSubmit={handleCreateSingle} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text block mb-1">
                    Episode #
                  </label>
                  <input
                    type="number"
                    placeholder={`Next (${episodes.length + 1})`}
                    value={singleForm.episodeNumber}
                    onChange={(e) =>
                      setSingleForm({ ...singleForm, episodeNumber: e.target.value })
                    }
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text block mb-1">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 105"
                    value={singleForm.durationSeconds}
                    onChange={(e) =>
                      setSingleForm({ ...singleForm, durationSeconds: e.target.value })
                    }
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  Episode Title
                </label>
                <input
                  type="text"
                  placeholder="Defaults to 'Episode {n}' if empty"
                  value={singleForm.title}
                  onChange={(e) =>
                    setSingleForm({ ...singleForm, title: e.target.value })
                  }
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  HLS Video URL (.m3u8)
                </label>
                <input
                  type="url"
                  placeholder="https://.../video.m3u8"
                  value={singleForm.hlsUrl}
                  onChange={(e) =>
                    setSingleForm({ ...singleForm, hlsUrl: e.target.value })
                  }
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  MP4 Fallback URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://.../video.mp4"
                  value={singleForm.mp4Url}
                  onChange={(e) =>
                    setSingleForm({ ...singleForm, mp4Url: e.target.value })
                  }
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="singleIsFree"
                  checked={singleForm.isFree}
                  onChange={(e) =>
                    setSingleForm({ ...singleForm, isFree: e.target.checked })
                  }
                  className="h-4 w-4 accent-primary"
                />
                <label htmlFor="singleIsFree" className="text-xs text-text cursor-pointer">
                  Mark as free to watch (no coins required)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionPending}
                  className="rounded bg-primary text-text-light px-4 py-1.5 text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isActionPending && <Loader2 size={12} className="animate-spin" />}
                  Create Episode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK RANGE GENERATOR */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="font-display font-bold text-lg mb-1">Bulk Range Generator</h2>
            <p className="text-xs text-text-muted mb-4">
              Quickly provision a sequence of episodes (e.g. 1 to 80) for this drama.
            </p>

            <form onSubmit={handleBulkCreate} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-text block mb-1">
                    Start Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bulkForm.startNumber}
                    onChange={(e) =>
                      setBulkForm({
                        ...bulkForm,
                        startNumber: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-text block mb-1">
                    End Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={bulkForm.endNumber}
                    onChange={(e) =>
                      setBulkForm({
                        ...bulkForm,
                        endNumber: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                    className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  Title Template
                </label>
                <input
                  type="text"
                  value={bulkForm.titleTemplate}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, titleTemplate: e.target.value })
                  }
                  placeholder="Episode {n}"
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
                <span className="text-[11px] text-text-muted mt-1 block">
                  Use <code className="bg-surface-raised px-1 py-0.5 rounded">{"{n}"}</code> as placeholder for episode number.
                </span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bulkAutoFree"
                  checked={bulkForm.autoFree}
                  onChange={(e) =>
                    setBulkForm({ ...bulkForm, autoFree: e.target.checked })
                  }
                  className="h-4 w-4 accent-primary"
                />
                <label htmlFor="bulkAutoFree" className="text-xs text-text cursor-pointer">
                  Auto-set Free access for episodes ≤ {freeCountInput}
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="rounded px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionPending}
                  className="rounded bg-primary text-text-light px-4 py-1.5 text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isActionPending && <Loader2 size={12} className="animate-spin" />}
                  Generate {Math.max(0, bulkForm.endNumber - bulkForm.startNumber + 1)} Episodes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK MEDIA PASTE */}
      {isMediaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-lg w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="font-display font-bold text-lg mb-1">Bulk Paste Media URLs</h2>
            <p className="text-xs text-text-muted mb-3">
              Paste media URLs or Bunny video IDs line-by-line. Supports sequential lines (Line 1 = Ep 1) or CSV: <code className="bg-surface-raised px-1 py-0.5 rounded">1,https://...</code>
            </p>

            <form onSubmit={handleBulkMediaAssign} className="space-y-3.5">
              <div>
                <textarea
                  rows={8}
                  placeholder={`https://stream.example.com/ep1.m3u8\nhttps://stream.example.com/ep2.m3u8\nor:\n1,https://stream.example.com/ep1.m3u8\n2,https://stream.example.com/ep2.m3u8`}
                  value={mediaPasteText}
                  onChange={(e) => setMediaPasteText(e.target.value)}
                  className="w-full font-mono text-xs rounded border border-border bg-surface p-3 focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsMediaModalOpen(false)}
                  className="rounded px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionPending || !mediaPasteText.trim()}
                  className="rounded bg-primary text-text-light px-4 py-1.5 text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isActionPending && <Loader2 size={12} className="animate-spin" />}
                  Apply Media to Episodes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT EPISODE */}
      {editingEpisode && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-md w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="font-display font-bold text-lg mb-1">
              Edit Episode {editingEpisode.episodeNumber}
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Update episode title, duration, and media stream URLs.
            </p>

            <form onSubmit={handleUpdateEpisode} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingEpisode.title}
                  onChange={(e) =>
                    setEditingEpisode({ ...editingEpisode, title: e.target.value })
                  }
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editingEpisode.durationSeconds}
                  onChange={(e) =>
                    setEditingEpisode({
                      ...editingEpisode,
                      durationSeconds: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  HLS Video URL (.m3u8)
                </label>
                <input
                  type="url"
                  placeholder="https://.../video.m3u8"
                  value={editingEpisode.media?.hlsUrl || ""}
                  onChange={(e) =>
                    setEditingEpisode({
                      ...editingEpisode,
                      media: {
                        ...(editingEpisode.media || {
                          provider: "custom",
                          status: "ready",
                        }),
                        hlsUrl: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-text block mb-1">
                  MP4 Fallback URL
                </label>
                <input
                  type="url"
                  placeholder="https://.../video.mp4"
                  value={editingEpisode.media?.mp4Url || ""}
                  onChange={(e) =>
                    setEditingEpisode({
                      ...editingEpisode,
                      media: {
                        ...(editingEpisode.media || {
                          provider: "custom",
                          status: "ready",
                        }),
                        mp4Url: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded border border-border bg-surface px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsFree"
                  checked={editingEpisode.isFree}
                  onChange={(e) =>
                    setEditingEpisode({
                      ...editingEpisode,
                      isFree: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-primary"
                />
                <label htmlFor="editIsFree" className="text-xs text-text cursor-pointer">
                  Mark as free to stream (no coin paywall)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingEpisode(null)}
                  className="rounded px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionPending}
                  className="rounded bg-primary text-text-light px-4 py-1.5 text-xs font-semibold hover:bg-primary-hover disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isActionPending && <Loader2 size={12} className="animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingEpisode && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-lg max-w-sm w-full p-6 shadow-xl animate-in fade-in">
            <h2 className="font-display font-bold text-lg text-rose-600 mb-2">
              Delete Episode {deletingEpisode.episodeNumber}?
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Are you sure you want to delete <strong>{deletingEpisode.title}</strong>? All remaining episodes will be automatically renumbered to preserve sequential order.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingEpisode(null)}
                className="rounded px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface-raised border border-border"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteEpisode}
                disabled={isActionPending}
                className="rounded bg-rose-600 text-white px-4 py-1.5 text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isActionPending && <Loader2 size={12} className="animate-spin" />}
                Delete & Renumber
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && <Toast message={toastMessage} />}
    </div>
  );
}
