/**
 * Client portal workspace — venue-branded planning home, not generic software.
 */
export function ClientWorkspaceMock({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "overflow-hidden border border-[var(--taupe-medium)]/60 bg-[var(--true-white)] shadow-[0_20px_60px_-40px_rgba(47,55,47,0.35)]"
      }
    >
      <div className="flex items-center gap-2 border-b border-[var(--taupe-medium)]/50 bg-[var(--linen)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--taupe-dark)]/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--taupe-dark)]/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--taupe-dark)]/40" />
        <div className="ml-3 flex-1 truncate rounded-full bg-[var(--true-white)] px-3 py-1 text-[10px] tracking-wide text-[var(--forest-sage)]/45">
          willowandhearth.com / planning / elena-james
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
              Willow & Hearth
            </p>
            <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
              Welcome back, Elena
            </h3>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
              Your celebration · Saturday, June 14
            </p>
          </div>

          <div className="border border-[var(--taupe-medium)]/50 bg-[var(--warm-gray)]/40 p-4">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Planning progress
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--taupe-medium)]/40">
              <div className="h-full w-[68%] rounded-full bg-[var(--forest-sage)]/70" />
            </div>
            <p className="mt-2 text-sm text-[var(--forest-sage)]/65">68% complete · Calm & on track</p>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Upcoming
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/75">
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Final guest count</span>
                <span className="text-[var(--forest-sage)]/45">Due May 1</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Menu tasting notes</span>
                <span className="text-[var(--forest-sage)]/45">Shared</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Payment · Balance</span>
                <span className="text-[var(--forest-sage)]/45">June 1</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-5 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Messages
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Venue · Floor plan ready for review</li>
              <li>You · Loved the lounge layout</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Timeline
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>4:00 Ceremony · Willow lawn</li>
              <li>6:00 Dinner · Barn</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Documents
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Contract · Signed</li>
              <li>Floor plan · Shared</li>
              <li>Day-of timeline · Draft</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
