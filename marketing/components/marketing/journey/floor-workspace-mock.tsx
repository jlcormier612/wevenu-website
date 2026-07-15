/**
 * Floor & seating workspace — room layout connected to guests, inventory, and placement.
 * Soft hospitality UI — not blueprints or CAD.
 */
export function FloorWorkspaceMock({ className }: { className?: string }) {
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
          wevenu.app / floor-plan / elena-james · barn reception
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[1.25fr_0.75fr]">
        <div className="border-b border-[var(--taupe-medium)]/40 p-5 md:border-b-0 md:border-r md:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--heritage-sage)]">
                Floor plan
              </p>
              <h3 className="mt-2 font-heading text-2xl text-[var(--forest-sage)]">
                Elena & James
              </h3>
              <p className="mt-1 text-sm text-[var(--forest-sage)]/55">
                Barn reception · Connected to booking
              </p>
            </div>
            <p className="shrink-0 text-right text-xs text-[var(--forest-sage)]/50">
              Guests
              <span className="mt-0.5 block font-heading text-xl text-[var(--forest-sage)]">
                142
              </span>
            </p>
          </div>

          {/* Soft room canvas — elegant placements, not a blueprint */}
          <div className="relative mt-6 aspect-[4/3] overflow-hidden bg-[var(--warm-gray)]/50">
            <div className="absolute inset-4 border border-dashed border-[var(--taupe-medium)]/50" />
            <p className="absolute top-6 left-1/2 -translate-x-1/2 text-[9px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/55">
              Section A · Dining
            </p>

            {/* Round tables */}
            <TableDot className="absolute top-[28%] left-[18%]" label="1" seats="10" />
            <TableDot className="absolute top-[28%] left-[42%]" label="2" seats="10" />
            <TableDot className="absolute top-[28%] left-[66%]" label="3" seats="10" />
            <TableDot className="absolute top-[52%] left-[18%]" label="4" seats="8" />
            <TableDot className="absolute top-[52%] left-[42%]" label="5" seats="10" />
            <TableDot className="absolute top-[52%] left-[66%]" label="6" seats="8" />

            {/* Lounge */}
            <div className="absolute bottom-[14%] left-[28%] h-10 w-24 rounded-sm border border-[var(--taupe-medium)]/70 bg-[var(--linen)]/90">
              <span className="flex h-full items-center justify-center text-[9px] tracking-wide text-[var(--forest-sage)]/55">
                Lounge
              </span>
            </div>
            <div className="absolute right-[14%] bottom-[14%] h-10 w-16 rounded-sm border border-[var(--taupe-medium)]/70 bg-[var(--linen)]/90">
              <span className="flex h-full items-center justify-center text-[9px] tracking-wide text-[var(--forest-sage)]/55">
                Bar
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-5 bg-[var(--warm-gray)]/60 p-5 md:p-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Inventory
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li className="flex justify-between gap-2">
                <span>Round tables</span>
                <span className="text-[var(--forest-sage)]/45">6</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Chairs</span>
                <span className="text-[var(--forest-sage)]/45">148</span>
              </li>
              <li className="flex justify-between gap-2">
                <span>Lounge pieces</span>
                <span className="text-[var(--forest-sage)]/45">4</span>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Placement
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>Head table · North wall</li>
              <li>Family · Tables 1–2</li>
              <li>Dance floor · Center aisle</li>
            </ul>
          </div>

          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--heritage-sage)]/80">
              Sections
            </p>
            <ul className="mt-3 space-y-2 text-sm text-[var(--forest-sage)]/70">
              <li>A · Dining · Ready</li>
              <li>B · Lounge · Ready</li>
              <li>C · Ceremony lawn · Set</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function TableDot({
  className,
  label,
  seats,
}: {
  className?: string;
  label: string;
  seats: string;
}) {
  return (
    <div
      className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border border-[var(--taupe-medium)]/80 bg-[var(--true-white)] shadow-sm ${className ?? ""}`}
    >
      <span className="font-heading text-sm text-[var(--forest-sage)]">{label}</span>
      <span className="text-[8px] text-[var(--forest-sage)]/45">{seats}</span>
    </div>
  );
}
