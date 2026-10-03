import Image from "next/image";
import { MoreHorizontal } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { channels } from "@/data/channels.mock";
import { titles } from "@/data/titles.mock";
import { adminChannelMeta } from "@/data/admin-channel-meta.mock";
import { formatRelativeTime } from "@/lib/format";

export default function AdminChannelsPage() {
  const rows = channels.map((c) => {
    const meta = adminChannelMeta[c.slug];
    const titleCount = titles.filter((t) => t.channel === c.name).length;
    return { ...c, ...meta, titleCount };
  });

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1200px]">
        <h1 className="font-display font-bold text-2xl mb-1">Channels</h1>
        <p className="text-sm text-text-muted mb-6">
          All channels in the database.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((c) => (
            <div
              key={c.slug}
              className="bg-surface border border-border rounded-lg shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Logo if the channel has one synced, otherwise initials */}
                  {c.logo ? (
                    <Image
                      src={c.logo}
                      alt={c.name}
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-md object-cover border border-border"
                    />
                  ) : (
                    <div className="h-11 w-11 shrink-0 rounded-md bg-primary/10 text-primary flex items-center justify-center font-display font-bold text-sm">
                      {c.name
                        .split(" ")
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                  )}
                  <p className="font-semibold text-text truncate">{c.name}</p>
                </div>
                {/* More actions — placeholder for now */}
                <button
                  type="button"
                  aria-label="More actions"
                  className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors shrink-0"
                >
                  <MoreHorizontal size={16} strokeWidth={2} />
                </button>
              </div>

              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Titles</dt>
                  <dd className="font-semibold text-text">{c.titleCount}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Status</dt>
                  <dd>
                    <span
                      className={`inline-flex rounded-pill border px-2.5 py-0.5 text-xs font-semibold ${
                        c.status === "Active"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-surface text-text-muted border-border"
                      }`}
                    >
                      {c.status}
                    </span>
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-text-muted">Last synced</dt>
                  <dd className="text-text-muted">
                    {c.lastSyncedAt ? formatRelativeTime(c.lastSyncedAt) : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
