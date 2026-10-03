"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, AlertCircle } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { channels as initialChannels, type Channel } from "@/data/channels.mock";
import { type TitleStatus } from "@/data/titles.mock";
import {
  getDramaById,
  updateDrama,
  getChannels,
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
  const [channelsList, setChannelsList] = useState<Channel[]>(initialChannels);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    channel: initialChannels[0]?.name || "DramaShort Originals",
    genre: "Romance",
    tags: "",
    status: "Draft" as TitleStatus,
    totalEpisodes: 40,
    synopsis: "",
    poster: "",
  });

  // 1. Fetch dynamic Drama data & Channels catalog on mount
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [dramaData, fetchedChannels] = await Promise.all([
          getDramaById(id),
          getChannels().catch(() => initialChannels),
        ]);

        if (!mounted) return;

        if (fetchedChannels && fetchedChannels.length > 0) {
          setChannelsList(fetchedChannels);
        }

        if (dramaData) {
          setDrama(dramaData);
          setForm({
            title: dramaData.title || "",
            channel: dramaData.channel || (fetchedChannels[0]?.name || initialChannels[0]?.name),
            genre: dramaData.genre || "Romance",
            tags: Array.isArray(dramaData.tags) ? dramaData.tags.join(", ") : "",
            status: (dramaData.status as TitleStatus) || "Draft",
            totalEpisodes: dramaData.totalEpisodes || 1,
            synopsis: dramaData.synopsis || "",
            poster: dramaData.poster || "",
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

    setIsSubmitting(true);
    setErrorMessage(null);

    const tagsArray = form.tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const result = await updateDrama(id, {
      title: form.title.trim(),
      channel: form.channel,
      genre: form.genre.trim(),
      tags: tagsArray,
      status: form.status,
      totalEpisodes: Math.max(1, Number(form.totalEpisodes) || 1),
      synopsis: form.synopsis.trim(),
      poster: form.poster.trim() || undefined,
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

          <div className="flex items-center gap-2.5">
            <Link
              href="/admin/dramas"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="genre" className="block text-sm font-semibold mb-1.5">
                  Primary Genre
                </label>
                <input
                  id="genre"
                  type="text"
                  value={form.genre}
                  onChange={(e) => setForm((prev) => ({ ...prev, genre: e.target.value }))}
                  disabled={isSubmitting}
                  placeholder="Romance, Fantasy, Revenge..."
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
                />
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

            <div>
              <label htmlFor="poster" className="block text-sm font-semibold mb-1.5">
                Poster Image URL
              </label>
              <input
                id="poster"
                type="url"
                value={form.poster}
                onChange={(e) => setForm((prev) => ({ ...prev, poster: e.target.value }))}
                placeholder="https://..."
                disabled={isSubmitting}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-60"
              />
            </div>
          </div>

          {/* Right sidebar preview & metadata */}
          <div className="space-y-5">
            <div className="bg-surface border border-border rounded-lg shadow-sm p-5">
              <p className="text-xs font-semibold text-text-muted mb-3 uppercase tracking-wider">
                Poster Preview
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
                <span className="font-mono font-medium truncate max-w-[160px]" title={drama.slug}>
                  {drama.slug}
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
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}
