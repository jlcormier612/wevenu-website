/**
 * Reporting doughnut display helpers — stable source colors + Other grouping.
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
 * Permanent identities for standard acquisition sources.
 * Same key → same color across every Reporting chart, period, and filter.
 * Do not reassign these based on rank, count, or chart membership.
 */
export const STANDARD_SOURCE_COLORS: Readonly<Record<string, string>> = {
  website: "#F0DFA6", // buttery yellow
  instagram: "#A9C9DA", // powder blue
  the_knot: "#D8A7AA", // dusty rose
  referral: "#5D6F5D", // heritage sage
  facebook: "#7B5EA0", // calendar purple
  google: "#A7C2AF", // eucalyptus
  phone: "#63819A", // calm slate blue
  phone_call: "#63819A", // alias — same identity as phone
};

/**
 * Supplemental palette for venue-defined custom sources.
 * Deterministic by key hash. Excludes reserved standard identities and neutrals.
 * Length ≥ 20 so typical venues rarely wrap within one chart.
 */
export const COMPOSITION_PALETTE = [
  "var(--cal-tour)", // #4A7EA8
  "var(--htc-blush)", // #d99a9e
  "var(--soft-sage)", // #b9d1c2
  "var(--cal-contract-expiration)", // #8E6B8E
  "var(--cal-planning-activity)", // #7A8FA6
  "var(--htc-soft-rose)", // #e8c5c8
  "var(--htc-leaf-muted)", // #7e9e88
  "var(--cal-other)", // #9C9690
  "var(--htc-soft-sage)", // #c9d9ce
  "var(--htc-petal)", // #f0d8db
  "var(--htc-eucalyptus-surface)", // #dce8e0
  "var(--htc-calm-blue-deep)", // #dfe9f1
  "var(--cal-document-expiration)", // #9C7A5B
  "var(--forest-sage)", // #4f5f4f
  "var(--htc-botanical)", // #446b56
  "var(--htc-eucalyptus)", // #a7c2af — ok for custom; Google owns exact hex identity
  "var(--cal-follow-up)", // taupe-dark token
  "var(--taupe-medium)", // #d2cbbf
  "var(--taupe-light)", // #ded6ca
  "var(--htc-border-calm)", // #d5e1eb
] as const;

/** Reserved neutral — Not recorded only. Never assigned to a real source. */
export const NOT_RECORDED_COLOR = "#C9C0B3";

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

/** Normalize aliases so standard identities stay stable. */
export function normalizeCompositionSourceKey(key: string): string {
  const t = key.trim().toLowerCase();
  if (t === "phone_call") return "phone";
  if (t === "tour_scheduling") return "website";
  return t;
}

export function isStandardCompositionSource(key: string): boolean {
  const n = normalizeCompositionSourceKey(key);
  return Object.prototype.hasOwnProperty.call(STANDARD_SOURCE_COLORS, n);
}

/**
 * Canonical color for a source key — independent of count, rank, or chart mates.
 * Standard sources use permanent identities. Custom sources use a deterministic
 * supplemental-palette slot from the key hash (collision walk within the chart).
 */
export function compositionColorForSourceKey(
  key: string,
  usedInChart?: Set<string>,
): string {
  if (key === UNKNOWN_SOURCE_KEY) return NOT_RECORDED_COLOR;
  if (key === OTHER_SOURCE_KEY) return OTHER_COLOR;

  const normalized = normalizeCompositionSourceKey(key);
  const standard = STANDARD_SOURCE_COLORS[normalized];
  if (standard) return standard;

  const used = usedInChart ?? new Set<string>();
  // Never steal a reserved standard/neutral color for a custom source.
  const reserved = new Set<string>([
    ...Object.values(STANDARD_SOURCE_COLORS),
    NOT_RECORDED_COLOR,
    OTHER_COLOR,
  ]);
  const start = hashKey(normalized) % COMPOSITION_PALETTE.length;
  for (let step = 0; step < COMPOSITION_PALETTE.length; step++) {
    const candidate = COMPOSITION_PALETTE[(start + step) % COMPOSITION_PALETTE.length]!;
    if (reserved.has(candidate)) continue;
    if (used.has(candidate)) continue;
    return candidate;
  }
  // Documented fallback when the supplemental palette is exhausted in-chart.
  return COMPOSITION_PALETTE[start]!;
}

/**
 * Assign colors so each visible slice gets a unique in-chart color when possible.
 * Standard sources keep permanent identities even if a custom source collides —
 * custom sources walk the supplemental palette instead.
 */
export function assignUniqueCompositionColors(
  slices: { key: string; count?: number }[],
): string[] {
  const colors: string[] = new Array(slices.length);
  const used = new Set<string>();

  // Pass 1 — reserved + permanent standard identities (never displaced).
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
    if (isStandardCompositionSource(key)) {
      const color = compositionColorForSourceKey(key);
      colors[i] = color;
      used.add(color);
    }
  }

  // Pass 2 — custom sources, deterministic by key, avoiding used/reserved slots.
  for (let i = 0; i < slices.length; i++) {
    if (colors[i]) continue;
    const key = slices[i]!.key;
    const color = compositionColorForSourceKey(key, used);
    colors[i] = color;
    used.add(color);
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
