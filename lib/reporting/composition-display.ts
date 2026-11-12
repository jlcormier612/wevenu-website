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
 * Hospitality palette — visually distinguishable, no neon.
 * Length ≥ 24 so typical venues never wrap within one chart.
 * Each string is unique; assignUniqueCompositionColors never reuses within a chart.
 */
export const COMPOSITION_PALETTE = [
  "var(--heritage-sage)", // eucalyptus dark
  "var(--dusty-rose)", // dusty rose
  "#6a87a8", // muted blue
  "#c4785a", // warm terracotta
  "#c9a84c", // soft gold
  "#8a7fa8", // lavender-gray
  "var(--soft-sage)", // light sage
  "#9a6b5c", // cocoa rose
  "#5b7d6a", // teal eucalyptus (distinct from heritage sage)
  "#b8a38a", // warm taupe
  "#7b6e9a", // muted violet
  "#d4a07a", // apricot sand
  "#4f6f8f", // slate blue
  "#a3b58a", // olive mist
  "#c9949c", // blush
  "#8c7a5c", // khaki brown
  "#6e9aa0", // dusty aqua
  "#b08968", // clay
  "#8f6f7c", // mauve taupe
  "#d2c08a", // pale gold
  "#5e6b7a", // blue-gray
  "#9c8f6e", // moss taupe
  "#c4a4b0", // soft plum
  "#7a8f7e", // gray-sage (light value, not dark green twin)
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

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function preferredPaletteIndex(key: string): number {
  return hashKey(key) % COMPOSITION_PALETTE.length;
}

/**
 * Assign colors so each visible slice in this chart gets a unique color.
 * Not recorded → fixed neutral. Other → fixed Other color.
 * Real sources: deterministic preferred index, then walk unused palette slots.
 */
export function assignUniqueCompositionColors(slices: { key: string }[]): string[] {
  const used = new Set<string>();
  const colors: string[] = [];

  for (const slice of slices) {
    if (slice.key === UNKNOWN_SOURCE_KEY) {
      colors.push(NOT_RECORDED_COLOR);
      used.add(NOT_RECORDED_COLOR);
      continue;
    }
    if (slice.key === OTHER_SOURCE_KEY) {
      colors.push(OTHER_COLOR);
      used.add(OTHER_COLOR);
      continue;
    }

    const start = preferredPaletteIndex(slice.key);
    let chosen: string | null = null;
    for (let step = 0; step < COMPOSITION_PALETTE.length; step++) {
      const candidate = COMPOSITION_PALETTE[(start + step) % COMPOSITION_PALETTE.length]!;
      // Reserved neutrals are not palette members — uniqueness is via `used` only.
      if (used.has(candidate)) continue;
      chosen = candidate;
      break;
    }
    if (!chosen) {
      // Palette exhausted — should not happen for ≤24 visible sources.
      chosen = COMPOSITION_PALETTE[start]!;
    }
    used.add(chosen);
    colors.push(chosen);
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
