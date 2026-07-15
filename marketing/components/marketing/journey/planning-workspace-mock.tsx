/**
 * Planning workspace — shared calm, not project-management clutter.
 */
export function PlanningWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / planning / elena-james
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5 border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
              Planning progress
            </p>
            <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
              Elena & James
            </h3>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
              68% complete · Shared with couple
            </p>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Timeline
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/75">
              <li className="flex justify-between gap-3">
                <span>Ceremony · Willow lawn</span>
                <span className="text-[var(--forest-sage)]/45">4:00</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Cocktail · Under the oaks</span>
                <span className="text-[var(--forest-sage)]/45">4:45</span>
              </li>
              <li className="flex justify-between gap-3">
                <span>Reception · Barn</span>
                <span className="text-[var(--forest-sage)]/45">6:00</span>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Notes
            </p>
            <p className="mt-2 border-l-2 border-[var(--soft-sage)] pl-3 text-sm leading-relaxed text-[var(--forest-sage)]/70">
              Soft florals confirmed. Prefer garden path for portraits. Coordinator walking
              grounds Sunday with florist.
            </p>
          </div>
        </div>

        <div className="space-y-5 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Checklist
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/75">
              <li>✓ Ceremony location</li>
              <li>✓ Cocktail preference</li>
              <li>○ Final headcount</li>
              <li>○ Seating draft</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Tasks
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Share rain-plan overview</li>
              <li>Confirm florist load-in</li>
              <li>Couple: meal selections</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
