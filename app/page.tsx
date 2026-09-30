import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="relative overflow-hidden min-h-screen">
      {/* ambient glow */}
      <div
        className="pointer-events-none fixed -top-[20%] -inset-x-[10%] h-[70%] z-0"
        style={{
          background:
            "radial-gradient(60% 60% at 30% 20%, rgb(var(--primary) / 0.28), transparent 70%), radial-gradient(50% 50% at 80% 10%, rgb(var(--tertiary) / 0.14), transparent 70%)",
        }}
      />

      <nav className="relative z-10 max-w-[1100px] mx-auto px-6 pt-7">
        <span className="font-display font-bold text-xl">
          <b className="text-primary">Drama</b>Short
        </span>
      </nav>

      <main className="relative z-10 max-w-[1100px] mx-auto px-6 py-14 grid grid-cols-1 md:grid-cols-2 gap-6 items-center min-h-[78vh]">
        {/* Copy column */}
        <div className="max-w-[480px]">
          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-tertiary bg-tertiary/10 border border-tertiary/35 px-3.5 py-1.5 rounded-full mb-6">
            ★ new episodes daily
          </span>

          <h1 className="font-display font-bold text-[clamp(34px,5vw,52px)] leading-[1.06] -tracking-wide mb-2">
            One more episode.
            <br />
            Then bed.
            <span className="block text-[0.5em] font-semibold text-text-muted mt-2.5">
              (You said that at ep. 4, too.)
            </span>
          </h1>

          <p className="text-base leading-relaxed text-text-muted my-5 max-w-[420px]">
            Vertical dramas built for a 12-minute break — revenge, rebirth,
            forbidden marriages, repeat. No app required, just a thumb.
          </p>

          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/home"
              className="group inline-flex items-center gap-2.5 font-extrabold text-base text-btn-primary-text bg-btn-primary px-7 py-4 rounded-full shadow-[0_10px_30px_rgb(var(--primary)/0.35)] transition-all hover:-translate-y-0.5 hover:bg-btn-primary-hover hover:shadow-[0_14px_34px_rgb(var(--primary)/0.45)]"
            >
              Enter DramaShort
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="transition-transform group-hover:translate-x-1"
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <span className="text-xs text-text-muted/70">
              Free to start · No credit card
            </span>
          </div>
        </div>

        {/* Signature element: fanned vertical episode stack */}
        <div className="relative h-[440px] flex items-center justify-center">
          <div
            className="absolute w-[280px] h-[280px] rounded-full blur-[70px] z-0"
            style={{ background: "rgb(var(--primary) / 0.35)" }}
          />
          <div className="relative w-[230px] h-[380px]">
            <FanCard
              className="w-[170px] h-[302px] top-[38px] left-0 z-[1]"
              gradient="linear-gradient(155deg, rgb(var(--secondary)), rgb(var(--primary-dark)) 70%)"
              badge="NEW"
              episode="EP 3"
              title="Marrying My Rival's Husband"
              delay="0.05s"
              rotate="-13deg"
              shiftX="-64px"
            />
            <FanCard
              className="w-[170px] h-[302px] top-[30px] left-0 z-[1]"
              gradient="linear-gradient(155deg, rgb(var(--tertiary)), rgb(var(--secondary-hover)) 75%)"
              episode="EP 18"
              title="Reborn as the CEO's Enemy"
              delay="0.15s"
              rotate="9deg"
              shiftX="58px"
            />
            <FanCard
              className="w-[190px] h-[340px] top-0 left-5 z-[2]"
              gradient="linear-gradient(160deg, rgb(var(--primary)), rgb(var(--tertiary)) 120%)"
              badge="TRENDING"
              episode="EP 12 / 62"
              title="Fated Marriage"
              delay="0.28s"
              rotate="0deg"
              shiftX="0px"
            />
          </div>
        </div>
      </main>

      <footer className="relative z-10 text-center px-6 pb-10 text-xs text-text-muted/40">
        DramaShort · content for 16+ · vertical dramas from partner studios
        worldwide
      </footer>
    </div>
  );
}

function FanCard({
  className,
  gradient,
  badge,
  episode,
  title,
  delay,
  rotate,
  shiftX,
}: {
  className: string;
  gradient: string;
  badge?: string;
  episode: string;
  title: string;
  delay: string;
  rotate: string;
  shiftX: string;
}) {
  return (
    <div
      className={`absolute rounded-[20px] overflow-hidden shadow-[0_20px_40px_rgb(0,0,0,0.45)] border border-white/10 flex flex-col justify-end p-3 animate-riseIn opacity-0 ${className}`}
      style={
        {
          background: gradient,
          animationDelay: delay,
          "--fan-r": rotate,
          "--fan-x": shiftX,
        } as React.CSSProperties
      }
    >
      {badge && (
        <span className="absolute top-2.5 left-2.5 bg-tertiary text-text-dark text-[10px] font-extrabold px-2.5 py-1 rounded-full">
          {badge}
        </span>
      )}
      <span className="self-start bg-black/40 text-white text-[10.5px] font-bold px-2 py-1 rounded-full mb-1.5">
        {episode}
      </span>
      <span className="text-white font-display font-semibold text-sm leading-tight">
        {title}
      </span>
    </div>
  );
}
