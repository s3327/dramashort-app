"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  Film,
  Calendar,
  Clock,
  Eye,
  Copy,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { ArtworkUploader } from "@/components/admin/ArtworkUploader";
import Modal from "@/components/Modal";
import Breadcrumbs from "@/components/Breadcrumbs";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import type { Channel, TitleStatus } from "@/types/content";
import { ENABLE_MOCK_FALLBACK } from "@/lib/config";
import {
  getDramaById,
  updateDrama,
  getChannels,
  getDistinctGenres,
  duplicateDrama,
  getDramaPreviewUrl,
  deleteDrama,
  archiveDrama,
  type Drama,
} from "@/lib/services/content.service";

const STATUS_OPTIONS: TitleStatus[] = [
  "Published",
  "Draft",
  "Scheduled",
  "Archived",
];

export default function AdminTitleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const { message: toastMessage, show: showToast } = useToast();

  const [drama, setDrama] = useState<Drama | null>(null);
  const [channelsList, setChannelsList] = useState<Channel[]>([]);
  const [genreList, setGenreList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [typedDeleteConfirm, setTypedDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const [form, setForm] = useState({
    title: "",
    channel: "DramaShort Originals",
    genre: "Romance",
    tags: "",
    status: "Draft" as TitleStatus,
    totalEpisodes: 40,
    synopsis: "",
    poster: "",
    banner: "",
    publishAt: "",
  });

  // 1. Fetch dynamic Drama data & Channels catalog on mount
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [dramaData, fetchedChannels, fetchedGenres] = await Promise.all([
          getDramaById(id),
          getChannels().catch(async () => {
            if (ENABLE_MOCK_FALLBACK) {
              const { channels } = await import("@/data/channels.mock");
              return channels;
            }
            return [];
          }),
          getDistinctGenres().catch(() => []),
        ]);

        if (!mounted) return;

        if (fetchedChannels && fetchedChannels.length > 0) {
          setChannelsList(fetchedChannels);
        }

        if (fetchedGenres && fetchedGenres.length > 0) {
          setGenreList(fetchedGenres);
        }

        if (dramaData) {
          setDrama(dramaData);
          const rawPublishAt = dramaData.publishAt;
          const formattedPublish = rawPublishAt
            ? new Date(rawPublishAt).toISOString().slice(0, 16)
            : "";

          setForm({
            title: dramaData.title || "",
            channel: dramaData.channel || fetchedChannels[0]?.name || "DramaShort Originals",
            genre: dramaData.genre || "Romance",
            tags: Array.isArray(dramaData.tags) ? dramaData.tags.join(", ") : "",
            status: (dramaData.status as TitleStatus) || "Draft",
            totalEpisodes: dramaData.totalEpisodes || 1,
            synopsis: dramaData.synopsis || "",
            poster: dramaData.poster || "",
            banner: dramaData.bannerUrl || "",
            publishAt: formattedPublish,
          });
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const msg =
          err instanceof Error ? err.message : "Failed to load drama details";
        setErrorMessage(msg);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
  }, [id]);

  // Handle Form Submission with Real Supabase Mutation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setErrorMessage("Drama title cannot be empty");
      return;
    }

    if (form.status === "Scheduled" && !form.publishAt) {
      setErrorMessage("Scheduled release requires a valid target date and time.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const publishAtPayload =
      form.status === "Scheduled"
        ? (form.publishAt ? new Date(form.publishAt).toISOString() : undefined)
        : form.publishAt
        ? new Date(form.publishAt).toISOString()
        : null;

    const result = await updateDrama(id, {
      title: form.title.trim(),
      channel: form.channel,
      genre: form.genre.trim(),
      tags: tagsArray,
      status: form.status,
      totalEpisodes: Math.max(1, Number(form.totalEpisodes) || 1),
      synopsis: form.synopsis.trim(),
      poster: form.poster.trim() || undefined,
      banner: form.banner.trim() || undefined,
      publishAt: publishAtPayload,
    });

    setIsSubmitting(false);

    if (result.success) {
      if (result.data) {
        setDrama(result.data);
      }
      showToast("Changes saved successfully");

      // Seamless redirect back to admin list after verified confirmation
      setTimeout(() => {
        router.push("/admin/dramas");
      }, 800);
    } else {
      setErrorMessage(
        result.error || "Failed to save changes. Please try again."
      );
    }
  };

  const handlePreview = async () => {
    if (!drama) return;
    if (drama.status === "Published") {
      window.open(`/drama/${drama.slug}`, "_blank");
      return;
    }
    setIsPreviewing(true);
    const res = await getDramaPreviewUrl(drama.id);
    setIsPreviewing(false);
    if (res.success && res.previewUrl) {
      window.open(res.previewUrl, "_blank");
    } else {
      showToast(res.error || "Failed to generate preview URL.");
    }
  };

  const handleDuplicate = async () => {
    if (!drama) return;
    setIsDuplicating(true);
    const res = await duplicateDrama(drama.id);
    setIsDuplicating(false);
    if (res.success && res.data) {
      showToast(`Duplicated '${drama.title}' successfully.`);
      router.push(`/admin/dramas/${res.data.id}/edit`);
    } else {
      showToast(res.error || "Failed to duplicate drama.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!drama) return;
    setIsDeleting(true);
    if (drama.hasBeenPublished || drama.status === "Published") {
      const res = await archiveDrama(drama.id);
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      if (res.success) {
        showToast("Drama archived successfully.");
        setForm((prev) => ({ ...prev, status: "Archived" }));
        setDrama((prev) => (prev ? { ...prev, status: "Archived" } : null));
      } else {
        showToast(res.error || "Failed to archive drama.");
      }
    } else {
      const res = await deleteDrama(drama.id, { hard: true });
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      if (res.success) {
        showToast("Draft permanently deleted.");
        router.push("/admin/dramas");
      } else {
        showToast(res.error || "Failed to delete draft.");
      }
    }
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <div data-theme="light" className="min-h-screen bg-bg text-text flex">
        <AdminSidebar />
        <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
          <div className="h-4 w-48 bg-border/60 rounded animate-pulse mb-6" />
          <div className="flex items-center justify-between mb-8">
            <div className="space-y-2">
              <div className="h-8 w-64 bg-border/60 rounded animate-pulse" />
              <div className="h-4 w-96 bg-border/40 rounded animate-pulse" />
            </div>
            <div className="h-9 w-28 bg-border/60 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4 bg-surface border border-border rounded-lg p-6">
              <div className="h-10 bg-border/30 rounded animate-pulse" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-border/30 rounded animate-pulse" />
                <div className="h-10 bg-border/30 rounded animate-pulse" />
              </div>
              <div className="h-32 bg-border/30 rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="aspect-[2/3] bg-surface border border-border rounded-lg animate-pulse" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Not Found State
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
          <div className="bg-surface border border-border rounded-lg shadow-sm p-8 text-center mt-6">
            <h1 className="font-display font-bold text-xl mb-2">Drama Not Found</h1>
            <p className="text-sm text-text-muted mb-6">
              The drama you are trying to edit does not exist or has been removed from the catalog.
            </p>
            <Link
              href="/admin/dramas"
              className="inline-flex items-center gap-2 rounded-md bg-primary text-text-light px-4 py-2 text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Dramas
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Dramas", href: "/admin/dramas" },
            { label: `Edit: ${drama.title}` },
          ]}
        />

        {/* Top Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 mt-2">
          <div>
            <h1 className="font-display font-bold text-2xl mb-1">Edit Drama</h1>
            <p className="text-sm text-text-muted">
              Update metadata, channel affiliation, taxonomy tropes, and publication status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={isPreviewing}
              title="Preview drama as user"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors shadow-sm cursor-pointer"
            >
              {isPreviewing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={isDuplicating}
              title="Duplicate drama metadata"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors shadow-sm cursor-pointer"
            >
              {isDuplicating ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
              <span>Duplicate</span>
            </button>
            <Link
              href={`/admin/dramas/${id}/episodes`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors shadow-sm"
            >
              <Film size={16} />
              <span>Episodes</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setTypedDeleteConfirm("");
                setIsDeleteModalOpen(true);
              }}
              title={drama.hasBeenPublished || drama.status === "Published" ? "Archive drama" : "Delete draft"}
              className="inline-flex items-center gap-1.5 rounded-md border border-danger/30 bg-surface px-3 py-2 text-sm font-semibold text-danger hover:bg-danger-soft transition-colors shadow-sm cursor-pointer"
            >
              <Trash2 size={16} />
              <span>{drama.hasBeenPublished || drama.status === "Published" ? "Archive" : "Delete"}</span>
            </button>
            <Link
              href="/admin/dramas"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-text-light px-4 py-2 text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error notification banner if mutation fails */}
        {errorMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-danger text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <strong className="font-semibold">Unable to save changes: </strong>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main edit fields */}
          <div className="lg:col-span-2 space-y-5 bg-surface border border-border rounded-lg shadow-sm p-6">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold mb-1.5">
                Drama Title
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="channel" className="block text-sm font-semibold mb-1.5">
                  Channel Affiliation
                </label>
                <select
                  id="channel"
                  value={form.channel}
                  onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
                >
                  {channelsList.map((c) => (
                    <option key={c.slug} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-semibold mb-1.5">
                  Publication Status
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as TitleStatus }))
                  }
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.status === "Scheduled" && (
              <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-1.5 animate-fadeIn">
                <label htmlFor="publishAt" className="block text-xs font-semibold text-text flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" />
                  <span>Scheduled Release Date & Time</span>
                </label>
                <input
                  id="publishAt"
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(e) => setForm((prev) => ({ ...prev, publishAt: e.target.value }))}
                  required={form.status === "Scheduled"}
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
                />
                <p className="text-[11px] text-text-muted flex items-center gap-1">
                  <Clock size={12} className="shrink-0" />
                  <span>The drama will automatically flip to &quot;Published&quot; once this scheduled target time passes.</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="genre" className="block text-sm font-semibold mb-1.5">
                  Primary Genre
                </label>
                <input
                  id="genre"
                  type="text"
                  list="genre-datalist"
                  value={form.genre}
                  onChange={(e) => setForm((prev) => ({ ...prev, genre: e.target.value }))}
                  disabled={isSubmitting}
                  placeholder="Romance, Fantasy, Revenge..."
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
                />
                <datalist id="genre-datalist">
                  {genreList.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div>
                <label htmlFor="totalEpisodes" className="block text-sm font-semibold mb-1.5">
                  Total Episodes
                </label>
                <input
                  id="totalEpisodes"
                  type="number"
                  min={1}
                  value={form.totalEpisodes}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      totalEpisodes: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  disabled={isSubmitting}
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
                />
                {drama.episodesAvailable !== undefined && (
                  <p className="text-xs text-text-muted mt-1">
                    Available in catalog: {drama.episodesAvailable} / {form.totalEpisodes}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-semibold mb-1.5">
                Taxonomy & Tropes (comma separated)
              </label>
              <input
                id="tags"
                type="text"
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="Revenge, CEO, Fake Marriage, Second Chance..."
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
              />
              <p className="text-xs text-text-muted mt-1">
                Tags help readers discover this drama across genre collections and recommendations.
              </p>
            </div>

            <div>
              <label htmlFor="synopsis" className="block text-sm font-semibold mb-1.5">
                Synopsis / Narrative Description
              </label>
              <textarea
                id="synopsis"
                rows={5}
                value={form.synopsis}
                onChange={(e) => setForm((prev) => ({ ...prev, synopsis: e.target.value }))}
                disabled={isSubmitting}
                placeholder="Enter storyline description and premise..."
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors leading-relaxed disabled:opacity-60"
              />
            </div>

            <div className="pt-4 border-t border-border space-y-6">
              <ArtworkUploader
                type="poster"
                value={form.poster}
                onChange={(url) => setForm((prev) => ({ ...prev, poster: url || "" }))}
                label="Poster Artwork"
                description="Primary key art displayed in drama listings, cards, and catalog carousels."
                disabled={isSubmitting}
              />

              <ArtworkUploader
                type="banner"
                value={form.banner}
                onChange={(url) => setForm((prev) => ({ ...prev, banner: url || "" }))}
                label="Banner Artwork"
                description="Wide horizontal artwork displayed in the hero carousel and watch pages."
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Right sidebar preview & metadata */}
          <div className="space-y-5">
            <div className="bg-surface border border-border rounded-lg shadow-sm p-5">
              <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
                Poster Preview (2:3)
              </p>
              <div className="relative aspect-[2/3] w-full rounded-md overflow-hidden bg-bg border border-border shadow-inner">
                {form.poster || drama.poster ? (
                  <Image
                    src={form.poster || drama.poster}
                    alt={form.title || drama.title}
                    fill
                    sizes="(min-width: 1024px) 300px, 100vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                    No Poster Available
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg shadow-sm p-5">
              <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
                Banner Preview (16:9)
              </p>
              <div className="relative aspect-[16/9] w-full rounded-md overflow-hidden bg-bg border border-border shadow-inner">
                {form.banner || drama.bannerUrl ? (
                  <Image
                    src={form.banner || drama.bannerUrl || ""}
                    alt={form.title || drama.title}
                    fill
                    sizes="(min-width: 1024px) 300px, 100vw"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-muted text-xs">
                    No Banner Available
                  </div>
                )}
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg shadow-sm p-5 space-y-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Catalog Info
              </p>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Drama ID</span>
                <span className="font-mono font-medium truncate max-w-[160px]" title={drama.id}>
                  {drama.id}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Slug</span>
                <div className="flex items-center gap-1.5 max-w-[170px]">
                  <span className="font-mono font-medium truncate" title={drama.slug}>
                    {drama.slug}
                  </span>
                  {drama.status === "Published" && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] bg-surface-raised border border-border text-text-muted shrink-0"
                      title="Published drama slugs are immutable"
                    >
                      Locked
                    </span>
                  )}
                </div>
              </div>
              {form.status === "Scheduled" && (form.publishAt || drama.publishAt) && (
                <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                  <span className="text-text-muted">Target Release</span>
                  <span className="font-medium text-amber-500 font-mono text-[11px]">
                    {new Date(form.publishAt || drama.publishAt || "").toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Episodes Available</span>
                <span className="font-medium">
                  {drama.episodesAvailable ?? 0} / {drama.totalEpisodes}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Created Date</span>
                <span>{new Date(drama.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Views</span>
                <span className="font-semibold">{drama.views.toLocaleString()}</span>
              </div>
              {drama.rating && (
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-text-muted">Rating</span>
                  <span className="font-semibold">★ {drama.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Delete / Archive Confirmation Modal */}
        <Modal
          open={isDeleteModalOpen}
          onClose={() => {
            if (!isDeleting) {
              setIsDeleteModalOpen(false);
            }
          }}
          title={
            drama.hasBeenPublished || drama.status === "Published"
              ? "Archive Drama"
              : "Permanently Delete Draft"
          }
        >
          <div className="space-y-4">
            {drama.hasBeenPublished || drama.status === "Published" ? (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs">
                  <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Published dramas cannot be permanently deleted.</strong>
                    <p className="mt-0.5 text-amber-800">
                      This drama has been published before. To protect user watch history, bookmarks, and transactional integrity, it must be Archived instead.
                    </p>
                  </div>
                </div>
                <p className="text-sm text-text">
                  Archiving <strong>{drama.title}</strong> will remove it from all public browsing and search pages immediately. You can restore it to Draft or Published status at any time.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                  >
                    {isDeleting && <Loader2 size={14} className="animate-spin" />}
                    Archive Drama
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger-soft p-3 text-danger text-xs">
                  <AlertTriangle size={18} className="shrink-0 text-danger mt-0.5" />
                  <div>
                    <strong className="font-semibold">Permanent deletion cannot be undone.</strong>
                    <p className="mt-0.5 text-danger/80">
                      Because this draft has never been published, it will be completely removed from the catalog.
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-text-muted mb-2">
                    To confirm permanent deletion, please type the title below: <br />
                    <span className="font-mono font-bold text-text select-all">{drama.title}</span>
                  </p>
                  <input
                    type="text"
                    value={typedDeleteConfirm}
                    onChange={(e) => setTypedDeleteConfirm(e.target.value)}
                    placeholder={drama.title}
                    className="w-full rounded-md border border-border bg-surface text-sm text-text px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-danger/50 focus:border-danger transition-colors font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting || typedDeleteConfirm.trim() !== drama.title.trim()}
                    onClick={handleConfirmDelete}
                    className="inline-flex items-center gap-1.5 rounded-md bg-danger hover:bg-danger-hover text-white px-4 py-2 text-sm font-semibold transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
                  >
                    {isDeleting && <Loader2 size={14} className="animate-spin" />}
                    Delete Permanently
                  </button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}
