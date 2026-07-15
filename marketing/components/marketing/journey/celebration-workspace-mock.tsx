/**
 * Completed event workspace — finished celebration preserved as lasting history.
 */
export function CelebrationWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / events / elena-james · complete
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-5 border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
              Completed event
            </p>
            <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
              Elena & James
            </h3>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
              Saturday, June 14 · 142 guests · Complete
            </p>
          </div>

          <div className="border border-[var(--taupe-medium)]/50 bg-[var(--warm-gray)]/40 p-4">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Financial summary
            </p>
            <p className="mt-2 font-heading text-lg text-[var(--forest-sage)]">
              Settled in full
            </p>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/60">
              Invoices paid · Contract fulfilled
            </p>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Finished
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/75">
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Timeline</span>
                <span className="text-[var(--forest-sage)]/45">Complete</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Vendors</span>
                <span className="text-[var(--forest-sage)]/45">Complete</span>
              </li>
              <li className="flex justify-between gap-3 border-t border-[var(--taupe-medium)]/40 pt-2">
                <span>Floor plan</span>
                <span className="text-[var(--forest-sage)]/45">Archived</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-5 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Reviews
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>“Felt like home from the first tour.”</li>
              <li>Google · Shared with team</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Gallery & notes
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>48 photos · Shared album</li>
              <li>Barn layout worked beautifully</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Continues
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Referral · Sister inquiring</li>
              <li>Anniversary note · Year one</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
