export function CarouselSkeleton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <section
      className={`relative h-[54svh] max-h-[440px] sm:max-h-none sm:h-[65svh] md:h-[72vh] lg:h-[78vh] min-h-[350px] md:min-h-[520px] w-full overflow-hidden bg-surface animate-pulse ${className}`}
      aria-label="Loading featured drama carousel..."
    >
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
      <div className="relative z-10 h-full max-w-[1200px] mx-auto px-6 flex flex-col justify-end pb-8 sm:pb-12 md:pb-16 space-y-4">
        <div className="h-6 w-32 rounded-full bg-border/60" />
        <div className="h-10 sm:h-14 w-3/4 max-w-lg rounded-md bg-border/60" />
        <div className="h-4 sm:h-5 w-full max-w-md rounded bg-border/40" />
        <div className="h-4 sm:h-5 w-2/3 max-w-sm rounded bg-border/30" />
        <div className="flex items-center gap-3 pt-4">
          <div className="h-11 w-32 rounded-full bg-border/60" />
          <div className="h-11 w-36 rounded-full bg-border/40" />
        </div>
      </div>
    </section>
  );
}
