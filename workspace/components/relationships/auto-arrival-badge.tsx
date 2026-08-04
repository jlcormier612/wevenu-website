/** Soft accent for unacknowledged automated pipeline arrivals. */
export function AutoArrivalBadge({
  count,
  active,
}: {
  count: number;
  /** When the parent chip/column is selected (invert contrast). */
  active?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={`ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium tabular-nums leading-none ${
        active
          ? "bg-[color-mix(in_srgb,var(--true-white)_88%,transparent)] text-[var(--forest-sage)]"
          : "bg-[color-mix(in_srgb,var(--heritage-sage)_22%,var(--true-white))] text-[var(--forest-sage)]"
      }`}
      title={`${count} new auto-arrival${count === 1 ? "" : "s"}`}
      aria-label={`${count} new`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Dot variant for column headers when space is tight. */
export function AutoArrivalDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-1 text-[0.7rem] font-medium text-[var(--heritage-sage)]"
      title={`${count} new auto-arrival${count === 1 ? "" : "s"}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--heritage-sage)]"
        aria-hidden
      />
      {count > 9 ? "9+" : count}
    </span>
  );
}
