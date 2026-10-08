"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingDown, HelpCircle, ShieldAlert, Award } from "lucide-react";
import type { DramaRetentionPoint } from "@/types/analytics";
import { formatCompactNumber } from "@/lib/format";

interface RetentionCurveIslandProps {
  initialSlug: string;
  initialTitle: string;
  initialEpisodes: DramaRetentionPoint[];
  availableDramas: Array<{ slug: string; title: string }>;
}

export default function RetentionCurveIsland({
  initialSlug,
  initialTitle,
  initialEpisodes,
  availableDramas,
}: RetentionCurveIslandProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);

  const handleDramaChange = (slug: string) => {
    setSelectedSlug(slug);
    startTransition(() => {
      router.push(`/admin/dashboard?drama=${encodeURIComponent(slug)}`);
    });
  };

  // Find the episode with the most severe drop-off (hotspot)
  let maxDropEpisode: DramaRetentionPoint | null = null;
  let maxDropVal = 0;
  for (let i = 1; i < initialEpisodes.length; i++) {
    const pt = initialEpisodes[i];
    if (pt.dropOffFromPrev > maxDropVal) {
      maxDropVal = pt.dropOffFromPrev;
      maxDropEpisode = pt;
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm p-6 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
        <div>
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            Episode Retention & Drop-off Curve
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Viewer progression from Episode 1 to N. Essential for tuning the Phase 8 Freemium Paywall threshold.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="drama-selector" className="text-xs font-semibold text-text-muted shrink-0">
            Select Drama:
          </label>
          <select
            id="drama-selector"
            value={selectedSlug}
            onChange={(e) => handleDramaChange(e.target.value)}
            disabled={isPending}
            className="text-xs font-medium bg-bg border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          >
            {availableDramas.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Paywall Placement Recommendation Banner */}
      {maxDropEpisode && (
        <div className="mb-6 p-4 rounded-lg bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert size={20} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-primary">
                Hotspot Drop-off Detected at Episode {maxDropEpisode.episodeNumber} ({Math.round(maxDropVal * 100)}% drop)
              </p>
              <p className="text-xs text-text-muted mt-0.5">
                Viewers drop off significantly between Episode {maxDropEpisode.episodeNumber - 1} and Episode {maxDropEpisode.episodeNumber}. 
                Placing the Phase 8 coin lock at or immediately preceding Episode {Math.min(5, maxDropEpisode.episodeNumber)} will maximize monetization conversion before drop-off occurs.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-extrabold uppercase px-2.5 py-1 rounded bg-primary text-white text-center">
            Paywall Cut-Off: Ep {Math.min(5, maxDropEpisode.episodeNumber)}
          </span>
        </div>
      )}

      {/* Visual Retention Bars */}
      <div className="space-y-3.5 mb-6">
        {initialEpisodes.map((ep) => {
          const retentionPct = Math.round(ep.retentionFromEp1 * 100);
          const compPct = Math.round(ep.avgCompletion * 100);
          const isHotspot = maxDropEpisode?.episodeNumber === ep.episodeNumber;

          return (
            <div key={ep.episodeNumber} className="group">
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-text w-12 shrink-0">
                    Ep {ep.episodeNumber}
                  </span>
                  <span className="text-[11px] text-text-muted">
                    {formatCompactNumber(ep.starts)} starts ({formatCompactNumber(ep.completes)} completes)
                  </span>
                  {ep.dropOffFromPrev > 0 && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        isHotspot
                          ? "bg-red-500/10 text-red-600 font-bold border border-red-500/20"
                          : "bg-surface-elevated text-text-muted"
                      }`}
                    >
                      -{Math.round(ep.dropOffFromPrev * 100)}% drop
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-text-muted">
                    Comp: <b className="text-text">{compPct}%</b>
                  </span>
                  <span className="font-extrabold text-xs text-text w-12 text-right">
                    {retentionPct}%
                  </span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="w-full h-3 bg-bg border border-border rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-500 ${
                    isHotspot
                      ? "bg-gradient-to-r from-primary to-red-500"
                      : "bg-primary"
                  }`}
                  style={{ width: `${Math.max(2, retentionPct)}%` }}
                  role="progressbar"
                  aria-valuenow={retentionPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Episode ${ep.episodeNumber} retention: ${retentionPct}%`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-text-muted pt-3 border-t border-border">
        <span>Retention calculated relative to Episode 1 starts (100%).</span>
        <span>Showing {initialEpisodes.length} tracked episodes</span>
      </div>
    </div>
  );
}
