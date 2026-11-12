/**
 * Reporting doughnut display helpers — unique hospitality colors + Other grouping.
 * Presentation only; does not change backend aggregation.
 */
import { allocateIntegerPercents } from "@/lib/attribution/bookings-by-source";
import { UNKNOWN_SOURCE_KEY } from "@/lib/attribution/source";

export type CompositionSlice = {
  key: string;
  label: string;
  count: number;
  percent: number;
};

export const OTHER_SOURCE_KEY = "__other__";
export const OTHER_SOURCE_LABEL = "Other";

/** Soft cap for readable doughnut arcs (Other + Not recorded excluded from this count). */
export const COMPOSITION_MAX_INDIVIDUAL = 7;

/**
 * HTC + calendar-balanced Reporting palette (Proposal B, adjusted).
 * Exact existing tokens where possible; two approved Reporting accents:
 * soft buttery yellow (#F0DFA6) and soft calm blue (#A9C9DA).
 * One dark green only (heritage sage, late). No mustard / burnt orange / mauve.
 * Length ≥ 20 so typical venues never wrap within one chart.
 */
export const COMPOSITION_PALETTE = [
  "#F0DFA6", // soft buttery yellow — approved Reporting accent
  "var(--dusty-rose)", // #d8a7aa
  "#A9C9DA", // soft calm blue — approved lighter blue
  "var(--cal-tour)", // #4A7EA8
  "var(--cal-event)", // #7B5EA0 lavender
  "var(--htc-eucalyptus)", // #a7c2af soft green
  "var(--htc-blush)", // #d99a9e
  "var(--soft-sage)", // #b9d1c2
  "var(--cal-contract-expiration)", // #8E6B8E plum
  "var(--cal-planning-activity)", // #7A8FA6 slate
  "var(--htc-soft-rose)", // #e8c5c8
  "var(--htc-leaf-muted)", // #7e9e88
  "var(--heritage-sage)", // #5d6f5d — sole dark green
  "var(--cal-other)", // #9C9690
  "var(--htc-soft-sage)", // #c9d9ce
  "var(--htc-petal)", // #f0d8db
  "var(--htc-calm-accent)", // #63819a — later blue (soft #A9C9DA preferred first)
  "var(--htc-eucalyptus-surface)", // #dce8e0
  "var(--htc-calm-blue-deep)", // #dfe9f1
  "var(--cal-document-expiration)", // #9C7A5B clay
] as const;

/** Reserved neutral — Not recorded only. Never assigned to a real source. */
export const NOT_RECORDED_COLOR = "color-mix(in oklch, var(--taupe-dark) 55%, var(--taupe-light))";

/** Reserved for the Other rollup — distinct from Not recorded and source hues. */
export const OTHER_COLOR = "color-mix(in oklch, var(--taupe-medium) 70%, var(--heading))";

export type DisplayCompositionSlice = CompositionSlice & {
  color: string;
  /** When key is Other, the folded source rows (counts preserved). */
  members?: CompositionSlice[];
};

/**
 * Assign colors so each visible slice in this chart gets a unique color.
 * Not recorded → fixed neutral. Other → fixed Other color.
 * Real sources: claim curated palette from the front in count-descending
 * order (stable key tie-break), so prominent categories receive the
 * soft yellow / rose / blue accents without hardcoding source names.
 */
export function assignUniqueCompositionColors(
  slices: { key: string; count?: number }[],
): string[] {
  const colors: string[] = new Array(slices.length);
  const used = new Set<string>();

  const realIdx: number[] = [];
  for (let i = 0; i < slices.length; i++) {
    const key = slices[i]!.key;
    if (key === UNKNOWN_SOURCE_KEY) {
      colors[i] = NOT_RECORDED_COLOR;
      used.add(NOT_RECORDED_COLOR);
      continue;
    }
    if (key === OTHER_SOURCE_KEY) {
      colors[i] = OTHER_COLOR;
      used.add(OTHER_COLOR);
      continue;
    }
    realIdx.push(i);
  }

  realIdx.sort((a, b) => {
    const ca = slices[a]!.count ?? 0;
    const cb = slices[b]!.count ?? 0;
    if (cb !== ca) return cb - ca;
    return slices[a]!.key.localeCompare(slices[b]!.key);
  });

  let paletteCursor = 0;
  for (const i of realIdx) {
    let chosen: string | null = null;
    while (paletteCursor < COMPOSITION_PALETTE.length) {
      const candidate = COMPOSITION_PALETTE[paletteCursor]!;
      paletteCursor += 1;
      if (used.has(candidate)) continue;
      chosen = candidate;
      break;
    }
    if (!chosen) {
      // Palette exhausted — should not happen for ≤20 visible sources.
      chosen = COMPOSITION_PALETTE[paletteCursor % COMPOSITION_PALETTE.length]!;
    }
    used.add(chosen);
    colors[i] = chosen;
  }

  return colors;
}

/**
 * Keep top individual sources (by count), fold the rest into Other.
 * Not recorded stays its own slice when present (never folded into Other).
 * Totals and percents are recomputed from counts (largest-remainder → sum 100).
 */
export function groupCompositionSlicesForDisplay(
  slices: CompositionSlice[],
  maxIndividual: number = COMPOSITION_MAX_INDIVIDUAL,
): { display: CompositionSlice[]; membersByOther: CompositionSlice[] } {
  const positive = slices.filter((s) => s.count > 0);
  if (positive.length === 0) return { display: [], membersByOther: [] };

  const unknown = positive.filter((s) => s.key === UNKNOWN_SOURCE_KEY);
  const known = positive.filter((s) => s.key !== UNKNOWN_SOURCE_KEY);

  if (known.length <= maxIndividual) {
    const ordered = [...known, ...unknown];
    const percents = allocateIntegerPercents(ordered.map((s) => s.count));
    return {
      display: ordered.map((s, i) => ({ ...s, percent: percents[i]! })),
      membersByOther: [],
    };
  }

  const ranked = [...known].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const head = ranked.slice(0, maxIndividual);
  const tail = ranked.slice(maxIndividual);
  const otherCount = tail.reduce((a, s) => a + s.count, 0);
  const other: CompositionSlice = {
    key: OTHER_SOURCE_KEY,
    label: OTHER_SOURCE_LABEL,
    count: otherCount,
    percent: 0,
  };

  const ordered = [...head, other, ...unknown].filter((s) => s.count > 0);
  const percents = allocateIntegerPercents(ordered.map((s) => s.count));
  return {
    display: ordered.map((s, i) => ({ ...s, percent: percents[i]! })),
    membersByOther: tail.map((s) => ({ ...s })),
  };
}

/** Full display path: group → unique colors → attach Other members. */
export function buildDisplayComposition(
  slices: CompositionSlice[],
  maxIndividual: number = COMPOSITION_MAX_INDIVIDUAL,
): DisplayCompositionSlice[] {
  const { display, membersByOther } = groupCompositionSlicesForDisplay(slices, maxIndividual);
  const colors = assignUniqueCompositionColors(display);
  return display.map((s, i) => ({
    ...s,
    color: colors[i]!,
    members: s.key === OTHER_SOURCE_KEY ? membersByOther : undefined,
  }));
}

/** Assert palette entries are unique (guard against accidental duplicates). */
export function compositionPaletteIsUnique(): boolean {
  return new Set(COMPOSITION_PALETTE).size === COMPOSITION_PALETTE.length;
}
