/**
 * Guest portal workspace — everything guests need before they arrive.
 */
export function GuestWorkspaceMock({ className }: { className?: string }) {
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
          willowandhearth.com / guests / elena-james
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
              You&apos;re invited
            </p>
            <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
              Elena & James
            </h3>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
              Saturday, June 14 · Willow & Hearth
            </p>
          </div>

          <div className="border border-[var(--taupe-medium)]/50 bg-[var(--warm-gray)]/40 p-4">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              RSVP
            </p>
            <p className="mt-2 font-heading text-lg text-[var(--forest-sage)]">
              Kindly reply by May 1
            </p>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/60">
              Meal preferences · Guest count · Notes
            </p>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Day of
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/75">
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Ceremony</span>
                <span className="text-[var(--forest-sage)]/45">4:00 · Willow lawn</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Cocktail hour</span>
                <span className="text-[var(--forest-sage)]/45">Under the oaks</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Dinner & dancing</span>
                <span className="text-[var(--forest-sage)]/45">Barn</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-5 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Travel
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Parking · Gravel lot by barn</li>
              <li>Shuttle · Inn lobby · 3:30</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Stay
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>The Meadow Inn · Block rate</li>
              <li>Farmhouse Suites · Nearby</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Helpful
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Venue map</li>
              <li>FAQ · Dress code, children</li>
              <li>Gallery · Share photos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
