/**
 * Payments workspace — finances living with the booking, not bolted on.
 */
export function PaymentsWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / booking / elena-james · payments
        </div>
      </div>

      <div className="space-y-0 p-5 md:p-6">
        <div className="border-b border-[var(--taupe-medium)]/40 pb-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
            Booking
          </p>
          <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
            Elena & James
          </h3>
          <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
            October 2026 · Garden Ceremony & Reception
          </p>
        </div>

        <div className="border-b border-[var(--taupe-medium)]/40 py-5">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
            Payment schedule
          </p>
          <ul className="mt-3 space-y-3 text-sm text-[var(--forest-sage)]/75">
            <li className="flex items-baseline justify-between gap-4">
              <span>Paid deposit</span>
              <span className="text-[var(--heritage-sage)]">$5,000 · received</span>
            </li>
            <li className="flex items-baseline justify-between gap-4">
              <span>Remaining balance</span>
              <span>$23,400</span>
            </li>
            <li className="flex items-baseline justify-between gap-4">
              <span>Upcoming payment</span>
              <span className="text-[var(--forest-sage)]/50">Aug 15 · $11,700</span>
            </li>
          </ul>
        </div>

        <div className="pt-5">
          <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
            Invoice history
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
            <li className="flex justify-between gap-4">
              <span>Retainer invoice</span>
              <span className="text-[var(--heritage-sage)]">Paid</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Second installment</span>
              <span className="text-[var(--forest-sage)]/45">Scheduled</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
