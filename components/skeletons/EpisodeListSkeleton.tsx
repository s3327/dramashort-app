export function EpisodeListSkeleton({
  count = 20,
  className = "",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Range tabs skeleton */}
      <div className="flex gap-2">
        <div className="h-7 w-16 rounded bg-surface border border-border/40 animate-pulse" />
        <div className="h-7 w-16 rounded bg-surface border border-border/30 animate-pulse" />
      </div>
      {/* Episode tiles grid */}
      <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-lg bg-surface border border-border/40 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
