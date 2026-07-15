/**
 * Proposal preview mock — venue-branded hospitality surface, not a PDF or spreadsheet.
 */
export function ProposalWorkspaceMock({ className }: { className?: string }) {
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
          willowandhearth.com / proposal / elena-james
        </div>
      </div>

      <div className="bg-[var(--warm-gray)]/40 p-5 md:p-7">
        <div className="border border-[var(--taupe-medium)]/40 bg-[var(--true-white)] px-6 py-8 md:px-8 md:py-10">
          <p className="text-[10px] tracking-[0.28em] uppercase text-[var(--heritage-sage)]">
            Willow & Hearth
          </p>
          <h3 className="mt-3 font-heading text-3xl text-[var(--forest-sage)] md:text-4xl">
            For Elena & James
          </h3>
          <p className="mt-2 text-sm italic text-[var(--forest-sage)]/55">
            October 2026 · A celebration on the grounds you loved
          </p>

          <div className="mt-8 aspect-[16/9] bg-[var(--linen)]">
            <div className="flex h-full items-end p-4">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/70">
                Venue photography
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-5">
            <div className="border-t border-[var(--taupe-medium)]/50 pt-4">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
                Package
              </p>
              <p className="mt-2 font-heading text-xl text-[var(--forest-sage)]">
                Garden Ceremony & Reception
              </p>
              <p className="mt-1 text-sm text-[var(--forest-sage)]/60">
                Willow lawn · Cocktail under the oaks · Barn dinner
              </p>
            </div>

            <div className="border-t border-[var(--taupe-medium)]/50 pt-4">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
                Investment
              </p>
              <p className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">$28,400</p>
              <p className="mt-1 text-xs text-[var(--forest-sage)]/50">Inclusive of venue, staffing & preferred timing</p>
            </div>

            <div className="border-t border-[var(--taupe-medium)]/50 pt-4">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
                Optional enhancements
              </p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--forest-sage)]/70">
                <li>Champagne terrace welcome</li>
                <li>Late-night lawn sparklers</li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <span className="inline-flex rounded-full bg-[var(--heritage-sage)] px-5 py-2.5 text-xs tracking-wide text-[var(--true-white)]">
              Accept proposal
            </span>
            <span className="text-xs tracking-wide text-[var(--forest-sage)]/45">
              Ask a question
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
