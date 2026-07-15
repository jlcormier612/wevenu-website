/**
 * Vendor workspace — right information at the right moment, not another portal to learn.
 */
export function VendorsWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / vendors / elena-james
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
              Vendor list
            </p>
            <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
              Elena & James
            </h3>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
              6 partners · Shared celebration
            </p>
          </div>

          <ul className="space-y-3 text-sm text-[var(--forest-sage)]/75">
            <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-3">
              <span>Bloom Atelier · Florist</span>
              <span className="text-[var(--forest-sage)]/45">Arrive 1:00</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-3">
              <span>Northlight · Photo</span>
              <span className="text-[var(--forest-sage)]/45">Arrive 2:30</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-3">
              <span>Hearth & Table · Catering</span>
              <span className="text-[var(--forest-sage)]/45">Arrive 12:00</span>
            </li>
            <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-3">
              <span>Signal Sound · DJ</span>
              <span className="text-[var(--forest-sage)]/45">Arrive 3:00</span>
            </li>
          </ul>
        </div>

        <div className="space-y-5 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Assignments
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Ceremony florals · Willow lawn</li>
              <li>Reception tables · Barn</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Timeline · Florist view
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>1:00 Load-in · Barn dock</li>
              <li>2:15 Ceremony arch set</li>
              <li>5:30 Reception switch</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Documents
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Site map · shared</li>
              <li>Load-in notes · shared</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
