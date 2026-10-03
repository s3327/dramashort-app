export function DramaDetailSkeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Breadcrumb skeleton */}
      <div className="h-4 w-48 rounded bg-surface border border-border/30 animate-pulse" />

      {/* Main hero flex */}
      <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start animate-pulse">
        {/* Poster */}
        <div className="w-40 sm:w-56 shrink-0 mx-auto sm:mx-0">
          <div className="aspect-[2/3] rounded-lg bg-surface border border-border/40 shadow-md" />
        </div>

        {/* Info */}
        <div className="flex-1 w-full space-y-4">
          <div className="h-8 sm:h-10 w-3/4 rounded bg-surface border border-border/40" />
          <div className="flex gap-4">
            <div className="h-4 w-28 rounded bg-surface border border-border/30" />
            <div className="h-4 w-24 rounded bg-surface border border-border/30" />
            <div className="h-4 w-16 rounded bg-surface border border-border/30" />
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-pill bg-surface border border-border/40" />
            <div className="h-6 w-16 rounded-pill bg-surface border border-border/30" />
            <div className="h-6 w-24 rounded-pill bg-surface border border-border/30" />
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-4 w-full rounded bg-surface border border-border/30" />
            <div className="h-4 w-5/6 rounded bg-surface border border-border/30" />
            <div className="h-4 w-4/6 rounded bg-surface border border-border/20" />
          </div>
          <div className="flex gap-3 pt-4">
            <div className="h-11 w-36 rounded-full bg-surface border border-border/40" />
            <div className="h-11 w-11 rounded-full bg-surface border border-border/30" />
            <div className="h-11 w-32 rounded-full bg-surface border border-border/30" />
          </div>
        </div>
      </div>
    </div>
  );
}
