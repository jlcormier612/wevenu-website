/**
 * Calm inquiry workspace mock — specific inquiry moments, not a full dashboard.
 */
export function InquiryWorkspaceMock({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        "overflow-hidden border border-[var(--taupe-medium)]/60 bg-[var(--true-white)] shadow-[0_20px_60px_-40px_rgba(47,55,47,0.35)]"
      }
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--taupe-medium)]/50 bg-[var(--linen)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--taupe-dark)]/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--taupe-dark)]/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--taupe-dark)]/40" />
        <div className="ml-3 flex-1 truncate rounded-full bg-[var(--true-white)] px-3 py-1 text-[10px] tracking-wide text-[var(--forest-sage)]/45">
          wevenu.app / inquiries / elena-james
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
        {/* Main column */}
        <div className="space-y-6 border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
              Inquiry received · Website form
            </p>
            <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
              Elena & James
            </h3>
            <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
              Saturday · October 2026 · ~120 guests
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Couple profile
            </p>
            <div className="space-y-2 text-sm text-[var(--forest-sage)]/75">
              <p>Garden ceremony preference · Soft florals · Outdoor cocktail hour</p>
              <p>Referral from the Hart wedding · Summer 2025</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Notes
            </p>
            <p className="border-l-2 border-[var(--soft-sage)] pl-3 text-sm leading-relaxed text-[var(--forest-sage)]/70">
              Looking for a venue that feels like home. Interested in barn + garden. First
              conversation warm—wants to walk the grounds next weekend.
            </p>
          </div>
        </div>

        {/* Side rail */}
        <div className="space-y-6 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Timeline
            </p>
            <ul className="mt-3 space-y-3 text-sm text-[var(--forest-sage)]/75">
              <li className="flex gap-3">
                <span className="w-14 shrink-0 text-[var(--forest-sage)]/40">Today</span>
                <span>Inquiry received</span>
              </li>
              <li className="flex gap-3">
                <span className="w-14 shrink-0 text-[var(--forest-sage)]/40">10:14</span>
                <span>Welcome note sent</span>
              </li>
              <li className="flex gap-3">
                <span className="w-14 shrink-0 text-[var(--forest-sage)]/40">Sat</span>
                <span>Tour scheduled · 11:00</span>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Communication
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Email · Welcome & availability</li>
              <li>Reply · Prefer Saturday morning</li>
            </ul>
          </div>

          <div className="border border-[var(--taupe-medium)]/50 bg-[var(--true-white)] px-4 py-3">
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]">
              Tour scheduling
            </p>
            <p className="mt-2 font-heading text-lg text-[var(--forest-sage)]">
              Saturday · 11:00
            </p>
            <p className="mt-1 text-xs text-[var(--forest-sage)]/55">Garden walk · confirmed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
