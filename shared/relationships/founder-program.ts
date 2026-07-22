/**
 * Founder Program capacity — shared by workspace dashboards and marketing display.
 *
 * Capacity comes from `FOUNDER_PROGRAM_CAPACITY` (default 100).
 * Remaining spots are preferably `capacity − foundingCount` (live relationships),
 * not a separately decremented counter. Marketing may still set
 * `FOUNDER_SPOTS_REMAINING` as a fallback when no live count is available.
 */

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

/** Program capacity (total founder seats). Default 100. */
export function getFounderProgramCapacity(): number {
  return parseNonNegativeInt(process.env.FOUNDER_PROGRAM_CAPACITY, 100);
}

/** Remaining seats from live founding count. Never negative. */
export function computeFounderRemaining(
  foundingCount: number,
  capacity: number = getFounderProgramCapacity(),
): number {
  return Math.max(0, capacity - Math.max(0, foundingCount));
}

/**
 * Resolve spots remaining for display.
 * - When `foundingCount` is provided: capacity − count (source of truth).
 * - Otherwise: `FOUNDER_SPOTS_REMAINING` env, falling back to full capacity.
 */
export function resolveFounderSpotsRemaining(opts?: {
  foundingCount?: number;
  capacity?: number;
}): number {
  const capacity = opts?.capacity ?? getFounderProgramCapacity();
  if (typeof opts?.foundingCount === "number") {
    return computeFounderRemaining(opts.foundingCount, capacity);
  }
  return parseNonNegativeInt(process.env.FOUNDER_SPOTS_REMAINING, capacity);
}
