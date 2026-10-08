import Link from "next/link";
import Image from "next/image";
import {
  Clapperboard,
  Users,
  Eye,
  LifeBuoy,
  Flame,
  ArrowRight,
  Tv,
  Tags,
  Upload,
} from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import RetentionCurveIsland from "@/components/admin/RetentionCurveIsland";
import { getAdminDashboardStats } from "@/lib/services/analytics.service";
import { formatCompactNumber } from "@/lib/format";

export const revalidate = 60;

/**
 * Server Component presenting live platform metrics, episode retention curves,
 * and trending title performance for DramaShort administrators (Task 15.4).
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const dramaSlug = typeof sp?.drama === "string" ? sp.drama : undefined;

  const stats = await getAdminDashboardStats(dramaSlug);

  const kpis = [
    {
      label: "Total Dramas",
      value: stats.titles.total.toLocaleString(),
      subtext: `${stats.titles.published} Published · ${stats.titles.draft} Drafts`,
      Icon: Clapperboard,
    },
    {
      label: "Audience & Reach",
      value: formatCompactNumber(stats.users.total),
      subtext: `+${stats.users.new7d} in 7d · DAU: ${stats.users.dau}`,
      Icon: Users,
    },
    {
      label: "Starts (Past 7 Days)",
      value: formatCompactNumber(stats.playback.starts7d),
      subtext: `${Math.round(stats.playback.avgCompletionRate * 100)}% avg completion`,
      Icon: Eye,
    },
    {
      label: "Support Tickets",
      value: stats.support.openTickets.toLocaleString(),
      subtext: stats.support.openTickets > 0 ? "Requires attention" : "All resolved",
      Icon: LifeBuoy,
      highlight: stats.support.openTickets > 0,
    },
  ];

  return (
    <div data-theme="light" className="min-h-screen bg-bg text-text flex">
      <AdminSidebar />

      <main className="flex-1 px-6 sm:px-8 py-8 max-w-[1240px] overflow-x-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl mb-1">Dashboard</h1>
            <p className="text-sm text-text-muted">
              Live platform metrics, viewer progression, and retention analytics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Live Telemetry
            </span>
          </div>
        </div>

        {/* 1. Platform KPI Summary Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {kpis.map(({ label, value, subtext, Icon, highlight }) => (
            <div
              key={label}
              className="bg-surface border border-border rounded-xl shadow-sm p-5 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between text-text-muted mb-2">
                <span className="text-xs font-semibold">{label}</span>
                <Icon
                  size={16}
                  strokeWidth={2}
                  className={highlight ? "text-amber-500" : "text-text-muted"}
                />
              </div>
              <p className="font-display font-bold text-2xl mb-1">{value}</p>
              <p
                className={`text-xs ${
                  highlight ? "text-amber-600 font-semibold" : "text-text-muted"
                }`}
              >
                {subtext}
              </p>
            </div>
          ))}
        </div>

        {/* 2. Interactive Episode Retention Curve Visualizer */}
        <RetentionCurveIsland
          initialSlug={stats.retention.activeDramaSlug}
          initialTitle={stats.retention.activeDramaTitle}
          initialEpisodes={stats.retention.episodes}
          availableDramas={stats.retention.availableDramas}
        />

        {/* 3. Top Trending Titles by Momentum */}
        <div className="bg-surface border border-border rounded-xl shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Flame size={20} className="text-primary" />
              <h2 className="font-display font-bold text-lg">
                Top Trending Dramas (7-Day Momentum)
              </h2>
            </div>
            <Link
              href="/trending"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              View Public Page <ArrowRight size={14} />
            </Link>
          </div>

          {stats.topTrending.length === 0 ? (
            <p className="text-xs text-text-muted py-6 text-center">
              No playback momentum data available yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-text-muted font-semibold">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Drama</th>
                    <th className="py-2.5 px-3">Channel</th>
                    <th className="py-2.5 px-3 text-right">Starts (7d)</th>
                    <th className="py-2.5 px-3 text-right">Completion Rate</th>
                    <th className="py-2.5 px-3 text-right">Trending Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.topTrending.map((item, index) => (
                    <tr key={item.slug} className="hover:bg-bg/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-text-muted">
                        {index + 1}
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          href={`/drama/${item.slug}`}
                          className="font-bold text-text hover:text-primary transition-colors flex items-center gap-2"
                        >
                          {item.poster && (
                            <div className="relative w-7 h-10 rounded overflow-hidden bg-surface-elevated shrink-0">
                              <Image
                                src={item.poster}
                                alt={item.title}
                                fill
                                sizes="28px"
                                className="object-cover"
                              />
                            </div>
                          )}
                          <span className="truncate max-w-[260px] sm:max-w-[360px]">
                            {item.title}
                          </span>
                        </Link>
                      </td>
                      <td className="py-3 px-3 text-text-muted">
                        {item.channel || "DramaShort"}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {formatCompactNumber(item.starts)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium">
                        {Math.round(item.avgCompletion * 100)}%
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-primary">
                        {Math.round(item.trendingScore).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Quick Admin Operations Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/admin/dramas"
            className="p-5 bg-surface border border-border rounded-xl shadow-sm hover:border-primary/50 transition-all flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Clapperboard size={20} />
            </div>
            <div>
              <p className="text-sm font-bold group-hover:text-primary transition-colors">
                Drama Catalog
              </p>
              <p className="text-xs text-text-muted">
                Manage titles, publish status & episodes
              </p>
            </div>
          </Link>

          <Link
            href="/admin/channels"
            className="p-5 bg-surface border border-border rounded-xl shadow-sm hover:border-primary/50 transition-all flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Tv size={20} />
            </div>
            <div>
              <p className="text-sm font-bold group-hover:text-primary transition-colors">
                Channel Operations
              </p>
              <p className="text-xs text-text-muted">
                Distribute content across producer channels
              </p>
            </div>
          </Link>

          <Link
            href="/admin/import"
            className="p-5 bg-surface border border-border rounded-xl shadow-sm hover:border-primary/50 transition-all flex items-center gap-3.5 group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Upload size={20} />
            </div>
            <div>
              <p className="text-sm font-bold group-hover:text-primary transition-colors">
                Content Ingestion
              </p>
              <p className="text-xs text-text-muted">
                Import media, metadata & bulk manifests
              </p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
