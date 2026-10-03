export function DramaCardSkeleton({
  hasSubtitle = false,
  className = "",
}: {
  hasSubtitle?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="aspect-[2/3] w-full rounded-md bg-surface border border-border/40 animate-pulse" />
      <div className="h-4 w-3/4 rounded bg-surface border border-border/30 animate-pulse" />
      {hasSubtitle ? (
        <div className="h-3 w-1/2 rounded bg-surface border border-border/20 animate-pulse" />
      ) : null}
    </div>
  );
}

export function DramaGridSkeleton({
  count = 12,
  columnsClassName = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-6",
  hasSubtitle = false,
}: {
  count?: number;
  columnsClassName?: string;
  hasSubtitle?: boolean;
}) {
  return (
    <div className={columnsClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <DramaCardSkeleton key={i} hasSubtitle={hasSubtitle} />
      ))}
    </div>
  );
}
