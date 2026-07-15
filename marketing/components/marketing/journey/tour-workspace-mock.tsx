/**
 * Calm Tour workspace mock — tour memory, not a scheduling calendar.
 */
export function TourWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / tours / elena-james · sat 11:00
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6 border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
              Tour scheduled
            </p>
            <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
              Elena & James
            </h3>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
              Saturday · 11:00 · Garden walk
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Couple preferences
            </p>
            <div className="space-y-2 text-sm text-[var(--forest-sage)]/75">
              <p>Outdoor ceremony · Soft florals · Cocktail hour under the oaks</p>
              <p>~120 guests · Family arriving from out of state</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Favorite ceremony locations
            </p>
            <ul className="space-y-2 text-sm text-[var(--forest-sage)]/75">
              <li>Willow lawn — loved the light at noon</li>
              <li>Stone courtyard — quiet for vows</li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Notes
            </p>
            <p className="border-l-2 border-[var(--soft-sage)] pl-3 text-sm leading-relaxed text-[var(--forest-sage)]/70">
              Asked about rain plan and barn capacity. Smiled at the bridge walk. Partner
              lingered by the terrace—show again at the proposal visit.
            </p>
          </div>
        </div>

        <div className="space-y-6 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div className="border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] px-4 py-3">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
              Assigned venue host
            </p>
            <p className="mt-2 font-heading text-lg text-[var(--forest-sage)]">Maya Chen</p>
            <p className="mt-1 text-xs text-[var(--forest-sage)]/55">Estate director</p>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Follow-up reminder
            </p>
            <p className="mt-3 text-sm text-[var(--forest-sage)]/75">
              Monday · Thank-you note + preferred dates package
            </p>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Next actions
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Share rain-plan overview</li>
              <li>Hold Willow lawn tentatively</li>
              <li>Draft proposal for favorite spaces</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
