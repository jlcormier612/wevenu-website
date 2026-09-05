/**
 * Phase 2D — Top-of-funnel evidence helpers (source_data).
 *
 * These dimensions are lead-entry evidence only. They never overwrite or
 * reinterpret leads.acquisition_source / lifecycle_booking_events.acquisition_source.
 * Blank / missing values stay Unknown / Unattributed — never invented.
 */

import { UNKNOWN_SOURCE_KEY, UNKNOWN_SOURCE_LABEL } from "@/lib/attribution/source";

export const EVIDENCE_UNKNOWN_KEY = UNKNOWN_SOURCE_KEY;
export const EVIDENCE_UNKNOWN_LABEL = UNKNOWN_SOURCE_LABEL;

export type EvidenceCountRow = {
  key: string;
  label: string;
  count: number;
};

/** Read a non-empty string from JSONB-like source_data. */
export function readSourceDataString(
  sourceData: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!sourceData || typeof sourceData !== "object") return null;
  const raw = sourceData[key];
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t || null;
}

/**
 * Aggregate landing pages without query/hash noise.
 * Invalid URLs fall back to the trimmed raw string (still evidence, not invented).
 */
export function normalizeLandingPageForReporting(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return `${u.origin}${u.pathname}`.replace(/\/$/, "") || u.origin;
  } catch {
    // Relative or malformed — keep a bounded raw form.
    return t.split(/[?#]/)[0]?.trim() || null;
  }
}

/** Referrer host only — full URLs are too sparse for trustworthy grouping. */
export function normalizeReferrerHost(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  try {
    return new URL(t).host || null;
  } catch {
    // Bare host-like strings
    const host = t.replace(/^https?:\/\//i, "").split(/[/?#]/)[0]?.trim();
    return host || null;
  }
}

export function evidenceGroupKey(raw: string | null | undefined): string {
  const t = raw?.trim();
  return t ? t : EVIDENCE_UNKNOWN_KEY;
}

export function evidenceDisplayLabel(key: string, labelOverride?: string | null): string {
  if (key === EVIDENCE_UNKNOWN_KEY) return EVIDENCE_UNKNOWN_LABEL;
  const o = labelOverride?.trim();
  return o || key;
}

/**
 * Group counts; Unknown always last. Optional label map for QR/campaign names.
 * Caps to topN non-unknown rows + Unknown when present (cardinality safety).
 */
export function groupEvidenceCounts(
  values: Array<string | null | undefined>,
  opts?: { labelByKey?: Map<string, string>; topN?: number },
): EvidenceCountRow[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = evidenceGroupKey(v);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const topN = opts?.topN ?? 15;
  const unknownCount = map.get(EVIDENCE_UNKNOWN_KEY) ?? 0;
  map.delete(EVIDENCE_UNKNOWN_KEY);

  const ranked = [...map.entries()]
    .map(([key, count]) => ({
      key,
      label: evidenceDisplayLabel(key, opts?.labelByKey?.get(key)),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const top = ranked.slice(0, topN);
  const overflow = ranked.slice(topN);
  const overflowCount = overflow.reduce((s, r) => s + r.count, 0);

  const out = [...top];
  if (overflowCount > 0) {
    out.push({
      key: "__other_evidence__",
      label: `Other (${overflow.length} values)`,
      count: overflowCount,
    });
  }
  if (unknownCount > 0 || values.length === 0) {
    // Always surface Unknown when any blanks existed; skip empty-universe Unknown noise.
    if (unknownCount > 0) {
      out.push({
        key: EVIDENCE_UNKNOWN_KEY,
        label: EVIDENCE_UNKNOWN_LABEL,
        count: unknownCount,
      });
    }
  }
  return out;
}

export type SourceCohortRateRow = {
  key: string;
  label: string;
  leads: number;
  eventuallyToured: number;
  eventuallyBooked: number;
  touredAndBooked: number;
  leadToTourRate: number;
  leadToBookingRate: number;
  tourToBookingRate: number;
};

export function computeSourceCohortRates(
  rows: Array<{
    sourceKey: string;
    label: string;
    eventuallyToured: boolean;
    eventuallyBooked: boolean;
  }>,
): SourceCohortRateRow[] {
  type Acc = {
    label: string;
    leads: number;
    eventuallyToured: number;
    eventuallyBooked: number;
    touredAndBooked: number;
  };
  const map = new Map<string, Acc>();
  for (const r of rows) {
    const cur = map.get(r.sourceKey) ?? {
      label: r.label,
      leads: 0,
      eventuallyToured: 0,
      eventuallyBooked: 0,
      touredAndBooked: 0,
    };
    cur.leads += 1;
    if (r.eventuallyToured) cur.eventuallyToured += 1;
    if (r.eventuallyBooked) cur.eventuallyBooked += 1;
    if (r.eventuallyToured && r.eventuallyBooked) cur.touredAndBooked += 1;
    map.set(r.sourceKey, cur);
  }

  const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);

  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      leads: v.leads,
      eventuallyToured: v.eventuallyToured,
      eventuallyBooked: v.eventuallyBooked,
      touredAndBooked: v.touredAndBooked,
      leadToTourRate: pct(v.eventuallyToured, v.leads),
      leadToBookingRate: pct(v.eventuallyBooked, v.leads),
      tourToBookingRate: pct(v.touredAndBooked, v.eventuallyToured),
    }))
    .sort((a, b) => {
      if (a.key === EVIDENCE_UNKNOWN_KEY) return 1;
      if (b.key === EVIDENCE_UNKNOWN_KEY) return -1;
      return b.leads - a.leads;
    });
}

export type TimeToBookByKeyRow = {
  key: string;
  label: string;
  medianDays: number | null;
  sampleSize: number;
};

export function computeMedianTimeToBookByKey(
  rows: Array<{ key: string; label: string; days: number }>,
  medianFn: (values: number[]) => number | null,
): TimeToBookByKeyRow[] {
  const map = new Map<string, { label: string; days: number[] }>();
  for (const r of rows) {
    const cur = map.get(r.key) ?? { label: r.label, days: [] };
    cur.days.push(r.days);
    map.set(r.key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      medianDays: medianFn(v.days),
      sampleSize: v.days.length,
    }))
    .sort((a, b) => {
      if (a.key === EVIDENCE_UNKNOWN_KEY) return 1;
      if (b.key === EVIDENCE_UNKNOWN_KEY) return -1;
      return b.sampleSize - a.sampleSize;
    });
}
