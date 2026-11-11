/**
 * Luv Phase 6 — Understand Context (narrow first slice).
 *
 * Enriches EXISTING Phase 5 patterns (P-A1, P-P1, P-A4) with 0–2
 * authoritative, evidence-backed factual clauses AFTER the pattern qualifies.
 *
 * Not a context engine. Does not change Phase 5 detection, L1, or S1–S4.
 * Booking clock: leads.first_booked_at only.
 * Acquisition: frozen acquisition_source only (never mutable leads.source).
 */

import {
  reportingSourceDisplayLabel,
  reportingSourceGroupKey,
  UNKNOWN_SOURCE_KEY,
} from "@/lib/attribution/source";
import { UNATTENDED_INQUIRY_HOURS } from "@/lib/luv/contextual-signals";
/** Mirrors Phase 5 inquiry floors — duplicated here to avoid circular imports. */
const SECONDARY_MIN_ABSOLUTE = 2;
const SECONDARY_MIN_PCT = 25;
const PATTERN_WINDOW_DAYS = 14;

type EnrichableSpotPattern = {
  type: string;
  title: string;
  body: string;
  priority: number;
  ctas: unknown[];
  metadata: Record<string, unknown>;
};

/** Substantially older than the S3 48h response-age threshold. */
export const PA1_SUBSTANTIALLY_OLDER_HOURS = 7 * 24;

/** Independent floor: at least this many cluster leads must clear the age clause. */
export const PA1_AGE_MIN_COUNT = 2;

/**
 * Source concentration: one known acquisition group must be a strict majority
 * of the cluster, with at least this many leads in that group.
 */
export const PA1_SOURCE_MIN_COUNT = 2;
export const PA1_SOURCE_MIN_SHARE = 0.5; // exclusive majority → share > 0.5

/**
 * Secondary P-P1 metrics (tours / bookings) — independent floors.
 * Prior window must have enough sample; absolute + % match inquiry increase floors.
 * Min current is lower than inquiry (tours/bookings are scarcer) but prior≥2.
 */
export const PP1_SECONDARY_MIN_PRIOR = 2;
export const PP1_SECONDARY_MIN_ABSOLUTE = SECONDARY_MIN_ABSOLUTE;
export const PP1_SECONDARY_MIN_PCT = SECONDARY_MIN_PCT;

export type SpotPatternContextClause = {
  id: string;
  text: string;
  evidence: Record<string, unknown>;
};

export type UnattendedContextLead = {
  id: string;
  venueId: string;
  createdAt: string;
  /** Frozen acquisition — never operational leads.source. */
  acquisitionSource?: string | null;
};

function hoursOld(createdAt: string, nowMs: number): number | null {
  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return null;
  return (nowMs - createdMs) / 3_600_000;
}

function daysUntilEventDate(eventDate: string, nowMs: number): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  const eventMs = new Date(`${eventDate}T12:00:00`).getTime();
  if (Number.isNaN(eventMs)) return null;
  return Math.round((eventMs - nowMs) / 86_400_000);
}

function nearestEventPhrase(days: number): string {
  if (days === 0) return "The nearest event is today.";
  if (days === 1) return "The nearest event is tomorrow.";
  return `The nearest event is ${days} days away.`;
}

function sourceConcentrationPhrase(groupKey: string): string {
  if (groupKey === "website") return "Most came from your website.";
  const label = reportingSourceDisplayLabel(groupKey);
  return `Most came from ${label}.`;
}

/** Shared increase floor used for sustained / tours / bookings secondary checks. */
export function meetsIndependentIncreaseFloor(opts: {
  current: number;
  prior: number;
  minPrior?: number;
  minAbsolute?: number;
  minPct?: number;
}): boolean {
  const minPrior = opts.minPrior ?? PP1_SECONDARY_MIN_PRIOR;
  const minAbsolute = opts.minAbsolute ?? PP1_SECONDARY_MIN_ABSOLUTE;
  const minPct = opts.minPct ?? PP1_SECONDARY_MIN_PCT;
  if (opts.prior < minPrior) return false;
  if (opts.prior <= 0) return false;
  const absolute = opts.current - opts.prior;
  if (absolute < minAbsolute) return false;
  const pct = Math.round((absolute / opts.prior) * 100);
  return pct >= minPct;
}

/**
 * P-A1 age mix — only when a meaningful portion are substantially older than 48h.
 * Restating that every member is ≥48h is omitted (already in Phase 5 body).
 */
export function buildPA1AgeContextClause(
  leads: UnattendedContextLead[],
  opts: { venueId: string; nowMs?: number },
): SpotPatternContextClause | null {
  const nowMs = opts.nowMs ?? Date.now();
  const venueLeads = leads.filter((l) => l.venueId === opts.venueId);
  let substantiallyOlder = 0;
  for (const lead of venueLeads) {
    const ageH = hoursOld(lead.createdAt, nowMs);
    if (ageH == null) continue;
    // Sanity: members should already clear S3; still require ≥48h here.
    if (ageH < UNATTENDED_INQUIRY_HOURS) continue;
    if (ageH >= PA1_SUBSTANTIALLY_OLDER_HOURS) substantiallyOlder += 1;
  }
  if (substantiallyOlder < PA1_AGE_MIN_COUNT) return null;
  return {
    id: "pa1_age_mix",
    text: `${substantiallyOlder} of these inquiries are more than 7 days old.`,
    evidence: {
      substantially_older_count: substantiallyOlder,
      substantially_older_hours: PA1_SUBSTANTIALLY_OLDER_HOURS,
      cluster_size: venueLeads.length,
    },
  };
}

/**
 * P-A1 acquisition-source concentration — frozen acquisition_source only.
 * Emits “Most came from …” only on a strict majority of known sources.
 */
export function buildPA1SourceContextClause(
  leads: UnattendedContextLead[],
  opts: { venueId: string },
): SpotPatternContextClause | null {
  const venueLeads = leads.filter((l) => l.venueId === opts.venueId);
  const total = venueLeads.length;
  if (total < PA1_SOURCE_MIN_COUNT) return null;

  const counts = new Map<string, number>();
  for (const lead of venueLeads) {
    const key = reportingSourceGroupKey(lead.acquisitionSource);
    if (key === UNKNOWN_SOURCE_KEY) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let bestKey: string | null = null;
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }
  if (!bestKey) return null;
  if (bestCount < PA1_SOURCE_MIN_COUNT) return null;
  const share = bestCount / total;
  // Strict majority — do not say “most” at exactly 50%.
  if (!(share > PA1_SOURCE_MIN_SHARE)) return null;

  return {
    id: "pa1_source_concentration",
    text: sourceConcentrationPhrase(bestKey),
    evidence: {
      source_key: bestKey,
      source_count: bestCount,
      cluster_size: total,
      share,
      // Prove we never used mutable operational source in this builder.
      acquisition_field: "acquisition_source",
    },
  };
}

export function buildPA1ContextClauses(
  leads: UnattendedContextLead[],
  opts: { venueId: string; nowMs?: number },
): SpotPatternContextClause[] {
  const clauses: SpotPatternContextClause[] = [];
  const age = buildPA1AgeContextClause(leads, opts);
  if (age) clauses.push(age);
  const source = buildPA1SourceContextClause(leads, opts);
  if (source) clauses.push(source);
  return clauses;
}

export function buildPP1SustainedContextClause(opts: {
  /** Middle window count (the “prior” of the Phase 5 comparison). */
  priorCount: number;
  /** Window before prior (third 14-day slice). */
  priorPriorCount: number;
  windowDays?: number;
}): SpotPatternContextClause | null {
  const windowDays = opts.windowDays ?? PATTERN_WINDOW_DAYS;
  // Sustained = the prior window itself rose vs the window before it,
  // using the same relative floors as secondary metrics.
  if (
    !meetsIndependentIncreaseFloor({
      current: opts.priorCount,
      prior: opts.priorPriorCount,
    })
  ) {
    return null;
  }
  return {
    id: "pp1_sustained",
    text: `This rise follows an increase in the previous ${windowDays}-day window as well.`,
    evidence: {
      prior_count: opts.priorCount,
      prior_prior_count: opts.priorPriorCount,
      window_days: windowDays,
    },
  };
}

export function buildPP1ToursAlsoUpClause(opts: {
  tourCurrentCount: number;
  tourPriorCount: number;
}): SpotPatternContextClause | null {
  if (
    !meetsIndependentIncreaseFloor({
      current: opts.tourCurrentCount,
      prior: opts.tourPriorCount,
    })
  ) {
    return null;
  }
  return {
    id: "pp1_tours_also_up",
    text: "In the same period, tours were also up.",
    evidence: {
      tour_current_count: opts.tourCurrentCount,
      tour_prior_count: opts.tourPriorCount,
      absolute_increase: opts.tourCurrentCount - opts.tourPriorCount,
    },
  };
}

export function buildPP1BookingsAlsoUpClause(opts: {
  bookingCurrentCount: number;
  bookingPriorCount: number;
}): SpotPatternContextClause | null {
  if (
    !meetsIndependentIncreaseFloor({
      current: opts.bookingCurrentCount,
      prior: opts.bookingPriorCount,
    })
  ) {
    return null;
  }
  return {
    id: "pp1_bookings_also_up",
    text: "Bookings were also up.",
    evidence: {
      booking_current_count: opts.bookingCurrentCount,
      booking_prior_count: opts.bookingPriorCount,
      absolute_increase: opts.bookingCurrentCount - opts.bookingPriorCount,
      booking_clock: "first_booked_at",
    },
  };
}

export function buildPP1ContextClauses(opts: {
  priorCount: number;
  priorPriorCount?: number | null;
  tourCurrentCount?: number | null;
  tourPriorCount?: number | null;
  bookingCurrentCount?: number | null;
  bookingPriorCount?: number | null;
  windowDays?: number;
}): SpotPatternContextClause[] {
  const clauses: SpotPatternContextClause[] = [];

  if (opts.priorPriorCount != null) {
    const sustained = buildPP1SustainedContextClause({
      priorCount: opts.priorCount,
      priorPriorCount: opts.priorPriorCount,
      windowDays: opts.windowDays,
    });
    if (sustained) clauses.push(sustained);
  }

  // Cap at 2 context clauses on the card (product lock). Prefer sustained,
  // then tours, then bookings — omit later ones if already at 2.
  if (
    clauses.length < 2 &&
    opts.tourCurrentCount != null &&
    opts.tourPriorCount != null
  ) {
    const tours = buildPP1ToursAlsoUpClause({
      tourCurrentCount: opts.tourCurrentCount,
      tourPriorCount: opts.tourPriorCount,
    });
    if (tours) clauses.push(tours);
  }

  if (
    clauses.length < 2 &&
    opts.bookingCurrentCount != null &&
    opts.bookingPriorCount != null
  ) {
    const bookings = buildPP1BookingsAlsoUpClause({
      bookingCurrentCount: opts.bookingCurrentCount,
      bookingPriorCount: opts.bookingPriorCount,
    });
    if (bookings) clauses.push(bookings);
  }

  return clauses;
}

export function buildPA4NearestEventContextClause(
  eventDates: string[],
  opts: { nowMs?: number },
): SpotPatternContextClause | null {
  const nowMs = opts.nowMs ?? Date.now();
  let nearest: number | null = null;
  for (const date of eventDates) {
    const days = daysUntilEventDate(date, nowMs);
    if (days == null || days < 0) continue;
    if (nearest == null || days < nearest) nearest = days;
  }
  if (nearest == null) return null;
  return {
    id: "pa4_nearest_event",
    text: nearestEventPhrase(nearest),
    evidence: {
      nearest_days: nearest,
      qualifying_event_dates: eventDates.length,
    },
  };
}

export function buildPA4ContextClauses(
  eventDates: string[],
  opts: { nowMs?: number },
): SpotPatternContextClause[] {
  const nearest = buildPA4NearestEventContextClause(eventDates, opts);
  return nearest ? [nearest] : [];
}

const CAUSAL_COPY_RE =
  /\b(because|caused|causing|driving|driven by|converting better|marketing is working|better leads)\b/i;

export function assertNonCausalContextCopy(text: string): boolean {
  return !CAUSAL_COPY_RE.test(text);
}

/** Append 0–N context clauses to an already-qualified Phase 5 recommendation. */
export function enrichSpotPatternWithContext<T extends EnrichableSpotPattern>(
  rec: T,
  clauses: SpotPatternContextClause[],
): T {
  const safe = clauses.filter((c) => assertNonCausalContextCopy(c.text));
  if (safe.length === 0) {
    return {
      ...rec,
      metadata: {
        ...rec.metadata,
        context: [],
        context_phase: "phase6",
      },
    };
  }
  const extra = safe.map((c) => c.text).join(" ");
  return {
    ...rec,
    body: `${rec.body} ${extra}`.trim(),
    metadata: {
      ...rec.metadata,
      context: safe.map((c) => ({
        id: c.id,
        text: c.text,
        evidence: c.evidence,
      })),
      context_phase: "phase6",
    },
  };
}
