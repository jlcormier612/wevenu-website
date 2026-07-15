/**
 * Contract → package → inventory → timeline — connected, not departmental.
 */
export function ContractWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / booking / elena-james · confirmed
        </div>
      </div>

      <div className="space-y-0 p-5 md:p-6">
        <div className="border-b border-[var(--taupe-medium)]/40 pb-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
            Contract
          </p>
          <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
            Elena & James
          </h3>
          <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
            Confirmed · October 2026 · Garden Ceremony & Reception
          </p>
        </div>

        <div className="border-b border-[var(--taupe-medium)]/40 py-5">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
            Accepted package
          </p>
          <p className="mt-2 font-heading text-xl text-[var(--forest-sage)]">
            Garden Ceremony & Reception
          </p>
          <p className="mt-1 text-sm text-[var(--forest-sage)]/60">
            Willow lawn · Oak cocktail hour · Barn dinner
          </p>
        </div>

        <div className="border-b border-[var(--taupe-medium)]/40 py-5">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
            Inventory
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/75">
            <li className="flex justify-between gap-4">
              <span>Ceremony chairs</span>
              <span className="text-[var(--forest-sage)]/45">120</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Reception tables</span>
              <span className="text-[var(--forest-sage)]/45">12 × round</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Cocktail furniture</span>
              <span className="text-[var(--forest-sage)]/45">High-tops · lounge</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Decor selections</span>
              <span className="text-[var(--forest-sage)]/45">Soft florals · soft gold</span>
            </li>
          </ul>
        </div>

        <div className="pt-5">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
            Timeline foundation
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--forest-sage)]/70">
            Package inclusions already seeding setup, load-in, and run of show—ready for
            planning.
          </p>
        </div>
      </div>
    </div>
  );
}
