/**
 * Timeline workspace — run of show built through planning, not the night before.
 */
export function TimelineWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / timeline / elena-james · event day
        </div>
      </div>

      <div className="p-5 md:p-6">
        <div className="border-b border-[var(--taupe-medium)]/40 pb-5">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
            Run of show
          </p>
          <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
            Elena & James
          </h3>
          <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
            Saturday · Shared with staff & vendors
          </p>
        </div>

        <ul className="mt-5 space-y-0 text-sm text-[var(--forest-sage)]/75">
          {[
            ["10:00", "Setup · Barn & Willow lawn"],
            ["1:00", "Florist arrival · Load-in"],
            ["2:30", "Photo team arrival"],
            ["3:30", "Guest seating"],
            ["4:00", "Ceremony · Willow lawn"],
            ["4:45", "Cocktail hour · Under the oaks"],
            ["6:00", "Dinner · Barn"],
            ["10:30", "Breakdown begins"],
          ].map(([time, label]) => (
            <li
              key={time}
              className="flex gap-4 border-t border-[var(--taupe-medium)]/40 py-3 first:border-t-0"
            >
              <span className="w-12 shrink-0 font-heading text-[var(--heritage-sage)]/70">
                {time}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
