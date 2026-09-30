"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import Breadcrumbs from "@/components/Breadcrumbs";
import Toast from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { channels } from "@/data/channels.mock";
import { titles, type TitleStatus } from "@/data/titles.mock";

const STATUS_OPTIONS: TitleStatus[] = ["Published", "Draft", "Scheduled", "Archived"];

export default function AdminTitleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const titleItem = titles.find((t) => t.id === id);

  const { message: toastMessage, show: showToast } = useToast();

  const [form, setForm] = useState({
    title: titleItem?.title ?? "",
    channel: titleItem?.channel ?? (channels[0]?.name || "DramaShort Originals"),
    genre: titleItem?.genre ?? "Romance",
    tags: titleItem?.tags.join(", ") ?? "",
    status: titleItem?.status ?? ("Draft" as TitleStatus),
    totalEpisodes: titleItem?.totalEpisodes ?? 40,
    synopsis: titleItem?.synopsis ?? "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!titleItem) {
    return (
      <div data-theme="light" className="min-h-screen bg-bg text-text flex">
        <AdminSidebar />
        <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/admin/dashboard" },
              { label: "Titles", href: "/admin/titles" },
              { label: "Not Found" },
            ]}
          />
          <div className="bg-surface border border-border rounded-lg shadow-sm p-8 text-center mt-6">
            <h1 className="font-display font-bold text-xl mb-2">Title Not Found</h1>
            <p className="text-sm text-text-muted mb-6">
              The title you are trying to edit does not exist or has been removed.
            </p>
            <Link
              href="/admin/titles"
              className="inline-flex items-center gap-2 rounded-md bg-primary text-text-light px-4 py-2 text-sm font-semibold hover:bg-primary-hover transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Titles
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Stand-in for real PUT/PATCH /admin/titles/:id API
    setTimeout(() => {
      setIsSubmitting(false);
      showToast("Changes saved successfully");
    }, 400);
  };

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <Breadcrumbs
          items={[
            { label: "Dashboard", href: "/admin/dashboard" },
            { label: "Titles", href: "/admin/titles" },
            { label: `Edit: ${titleItem.title}` },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display font-bold text-2xl mb-1">Edit Title</h1>
            <p className="text-sm text-text-muted">
              Update metadata, channel affiliation, and publication status.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/admin/titles"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-4 py-2 text-sm font-semibold text-text hover:bg-surface-raised transition-colors"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary text-text-light px-4 py-2 text-sm font-semibold hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
            >
              <Save size={16} />
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main edit fields */}
          <div className="lg:col-span-2 space-y-5 bg-surface border border-border rounded-lg shadow-sm p-6">
            <div>
              <label htmlFor="title" className="block text-sm font-semibold mb-1.5">
                Title Name
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="channel" className="block text-sm font-semibold mb-1.5">
                  Channel
                </label>
                <select
                  id="channel"
                  value={form.channel}
                  onChange={(e) => setForm((prev) => ({ ...prev, channel: e.target.value }))}
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                >
                  {channels.map((c) => (
                    <option key={c.slug} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-semibold mb-1.5">
                  Status
                </label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as TitleStatus }))
                  }
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
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
                  Genre
                </label>
                <input
                  id="genre"
                  type="text"
                  value={form.genre}
                  onChange={(e) => setForm((prev) => ({ ...prev, genre: e.target.value }))}
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
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
                      totalEpisodes: parseInt(e.target.value, 10) || 1,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-semibold mb-1.5">
                Tags (comma separated)
              </label>
              <input
                id="tags"
                type="text"
                value={form.tags}
                onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="Revenge, CEO, Romance..."
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label htmlFor="synopsis" className="block text-sm font-semibold mb-1.5">
                Synopsis
              </label>
              <textarea
                id="synopsis"
                rows={5}
                value={form.synopsis}
                onChange={(e) => setForm((prev) => ({ ...prev, synopsis: e.target.value }))}
                className="w-full rounded-md border border-border bg-bg px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors leading-relaxed"
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
                <Image
                  src={titleItem.poster}
                  alt={titleItem.title}
                  fill
                  sizes="(min-width: 1024px) 300px, 100vw"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg shadow-sm p-5 space-y-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                Catalog Info
              </p>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Title ID</span>
                <span className="font-mono font-medium">{titleItem.id}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Slug</span>
                <span className="font-mono font-medium">{titleItem.slug}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                <span className="text-text-muted">Created Date</span>
                <span>{titleItem.createdAt}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-text-muted">Views</span>
                <span className="font-semibold">{titleItem.views.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Toast message={toastMessage} />
    </div>
  );
}
