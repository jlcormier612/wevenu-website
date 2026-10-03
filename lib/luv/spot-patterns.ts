/**
 * Luv Phase 5 — Spot Patterns (L2 workflow intelligence).
 *
 * Initial set (product-locked):
 *   P-A1  unattended_inquiry_pattern
 *   P-A4  payment_attention_pattern
 *   P-P1  inquiry_volume_increase
 *
 * Reuses S3 / S2 semantics. Persists via luv_recommendations.
 * Never Dashboard L1 — see isDashboardLevel1Recommendation exclusions.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getInvoices } from "@/lib/invoices/repository";
import { getAllLineItems, getSchedules } from "@/lib/payments/repository";
import { computePaymentsReadiness } from "@/lib/readiness/compute";
import { onlyBusinessReporting } from "@/lib/reporting/business-scope";
import type { LuvObservation } from "@/lib/luv/types";
import { getCurrentVenue } from "@/lib/venue/service";
import { venueToday } from "@/lib/venue/timezone";
import {
  buildS2EventPaymentObservation,
  buildS3UnattendedInquiryObservation,
  type ContextualEvent,
  type ContextualLead,
  type ContextualPaymentAttention,
} from "./contextual-signals";
import type { RecommendationCta } from "./recommendation-types";
import {
  isRecommendationActiveForDisplay,
  type RecommendationVisibilityFields,
} from "./recommendation-visibility";
import {
  buildPA1ContextClauses,
  buildPA4ContextClauses,
  buildPP1ContextClauses,
  enrichSpotPatternWithContext,
  type UnattendedContextLead,
} from "./spot-pattern-context";
import { loadUnattendedInquiryContactEvidence } from "./unattended-inquiry-contact";

/** Shared cluster window / multiplicity (locked). */
export const SPOT_PATTERN_WINDOW_DAYS = 14;
export const SPOT_PATTERN_MIN_CLUSTER = 3;
/**
 * Small venues with almost no history must not get a "pattern" from
 * three coincidental records. Absolute floor on underlying activity.
 */
export const SPOT_PATTERN_MIN_VENUE_HISTORY = 5;

export const UNATTENDED_INQUIRY_PATTERN_TYPE = "unattended_inquiry_pattern";
export const PAYMENT_ATTENTION_PATTERN_TYPE = "payment_attention_pattern";
export const INQUIRY_VOLUME_INCREASE_TYPE = "inquiry_volume_increase";

export const PHASE5_SPOT_PATTERN_TYPES = [
  UNATTENDED_INQUIRY_PATTERN_TYPE,
  PAYMENT_ATTENTION_PATTERN_TYPE,
  INQUIRY_VOLUME_INCREASE_TYPE,
] as const;

export type Phase5SpotPatternType = (typeof PHASE5_SPOT_PATTERN_TYPES)[number];

export const SPOT_PATTERN_PRIORITY = 70;

/** P-P1 evidence floors (locked). */
export const INQUIRY_VOLUME_MIN_CURRENT = 5;
export const INQUIRY_VOLUME_MIN_PCT = 25;
export const INQUIRY_VOLUME_MIN_ABSOLUTE = 2;

export type SpotPatternRecommendation = {
  type: Phase5SpotPatternType;
  title: string;
  body: string;
  priority: number;
  ctas: RecommendationCta[];
  metadata: Record<string, unknown>;
};

export function isPhase5SpotPatternType(type: string): type is Phase5SpotPatternType {
  return (PHASE5_SPOT_PATTERN_TYPES as readonly string[]).includes(type);
}

export function isPhase5SpotPatternRecommendation(
  rec: { type: string },
): boolean {
  return isPhase5SpotPatternType(rec.type);
}

// ── P-A1: unattended inquiry cluster ─────────────────────────────────────────

export function isQualifyingUnattendedInquiryForCluster(
  lead: ContextualLead,
  opts: {
    venueId: string;
    nowMs?: number;
    windowDays?: number;
  },
): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const windowDays = opts.windowDays ?? SPOT_PATTERN_WINDOW_DAYS;
  // Same authoritative S3 semantics (messages + tours + last_contacted_at).
  // Sync must enrich candidates before calling this — do not invent a second definition.
  if (!buildS3UnattendedInquiryObservation(lead, { venueId: opts.venueId, nowMs })) {
    return false;
  }
  const createdMs = Date.parse(lead.createdAt);
  if (Number.isNaN(createdMs)) return false;
  const windowStart = nowMs - windowDays * 24 * 60 * 60 * 1000;
  return createdMs >= windowStart;
}

export function evaluateUnattendedInquiryPattern(
  leads: Array<ContextualLead & Partial<Pick<UnattendedContextLead, "acquisitionSource">>>,
  opts: {
    venueId: string;
    nowMs?: number;
    windowDays?: number;
    minCluster?: number;
    /** Total business leads for this venue (history floor). */
    venueLeadHistoryCount: number;
  },
): SpotPatternRecommendation | null {
  const minCluster = opts.minCluster ?? SPOT_PATTERN_MIN_CLUSTER;
  if (opts.venueLeadHistoryCount < SPOT_PATTERN_MIN_VENUE_HISTORY) return null;

  const qualifying = leads.filter((l) =>
    isQualifyingUnattendedInquiryForCluster(l, {
      venueId: opts.venueId,
      nowMs: opts.nowMs,
      windowDays: opts.windowDays,
    }),
  );
  const count = new Set(qualifying.map((l) => l.id)).size;
  if (count < minCluster) return null;

  const windowDays = opts.windowDays ?? SPOT_PATTERN_WINDOW_DAYS;
  const base: SpotPatternRecommendation = {
    type: UNATTENDED_INQUIRY_PATTERN_TYPE,
    title: `${count} recent inquiries still need a first response`,
    body: `These new inquiries have had no recorded contact for over 48 hours (last ${windowDays} days).`,
    priority: SPOT_PATTERN_PRIORITY,
    // Help on /leads — a same-surface navigate CTA is not a next action.
    ctas: [],
    metadata: {
      lead_count: count,
      window_days: windowDays,
      pattern: "P-A1",
    },
  };

  // Phase 6 — enrich AFTER qualification. Never affects detection.
  const contextLeads: UnattendedContextLead[] = qualifying.map((l) => ({
    id: l.id,
    venueId: l.venueId,
    createdAt: l.createdAt,
    acquisitionSource: l.acquisitionSource ?? null,
  }));
  return enrichSpotPatternWithContext(
    base,
    buildPA1ContextClauses(contextLeads, {
      venueId: opts.venueId,
      nowMs: opts.nowMs,
    }),
  );
}

// ── P-A4: payment-attention cluster ──────────────────────────────────────────

export type PaymentAttentionEventInput = {
  event: ContextualEvent;
  payment: ContextualPaymentAttention;
};

/**
 * Cluster membership uses the locked 14-day window for event proximity.
 * Payment status still comes from the same readiness computation S2 uses.
 */
export function isQualifyingPaymentAttentionForCluster(
  input: PaymentAttentionEventInput,
  opts: { venueId: string; nowMs?: number; windowDays?: number },
): boolean {
  const nowMs = opts.nowMs ?? Date.now();
  const windowDays = opts.windowDays ?? SPOT_PATTERN_WINDOW_DAYS;
  // Authoritative S2 semantics first (payment readiness + upcoming event rules).
  const s2 = buildS2EventPaymentObservation(input.event, input.payment, {
    venueId: opts.venueId,
    nowMs,
  });
  if (!s2) return false;
  // Cluster window is the locked 14-day proximity (tighter than S2's 21d).
  const eventMs = new Date(`${input.event.eventDate}T12:00:00`).getTime();
  const days = Math.round((eventMs - nowMs) / 86_400_000);
  return days >= 0 && days <= windowDays;
}

export function evaluatePaymentAttentionPattern(
  inputs: PaymentAttentionEventInput[],
  opts: {
    venueId: string;
    nowMs?: number;
    windowDays?: number;
    minCluster?: number;
    venueEventHistoryCount: number;
  },
): SpotPatternRecommendation | null {
  const minCluster = opts.minCluster ?? SPOT_PATTERN_MIN_CLUSTER;
  if (opts.venueEventHistoryCount < SPOT_PATTERN_MIN_VENUE_HISTORY) return null;

  const qualifyingIds = new Set<string>();
  for (const input of inputs) {
    if (
      isQualifyingPaymentAttentionForCluster(input, {
        venueId: opts.venueId,
        nowMs: opts.nowMs,
        windowDays: opts.windowDays,
      })
    ) {
      qualifyingIds.add(input.event.id);
    }
  }
  const count = qualifyingIds.size;
  if (count < minCluster) return null;

  const windowDays = opts.windowDays ?? SPOT_PATTERN_WINDOW_DAYS;
  const qualifyingDates: string[] = [];
  for (const input of inputs) {
    if (!qualifyingIds.has(input.event.id)) continue;
    if (input.event.venueId !== opts.venueId) continue;
    qualifyingDates.push(input.event.eventDate);
  }

  const base: SpotPatternRecommendation = {
    type: PAYMENT_ATTENTION_PATTERN_TYPE,
    title: `${count} upcoming events need payment attention`,
    body: `These events are within the next ${windowDays} days and their payment schedules still need attention.`,
    priority: SPOT_PATTERN_PRIORITY,
    ctas: [
      {
        label: "Review payments",
        target: "/payments?filter=attention",
        type: "navigate",
      },
    ],
    metadata: {
      event_count: count,
      window_days: windowDays,
      pattern: "P-A4",
    },
  };

  return enrichSpotPatternWithContext(
    base,
    buildPA4ContextClauses(qualifyingDates, { nowMs: opts.nowMs }),
  );
}

// ── P-P1: inquiry volume increase ────────────────────────────────────────────

export function evaluateInquiryVolumeIncrease(
  opts: {
    venueId: string;
    currentCount: number;
    priorCount: number;
    windowDays?: number;
    /** Phase 6 optional — third adjacent window for sustained context. */
    priorPriorCount?: number | null;
    /** Phase 6 optional — tours in same windows (independent floor). */
    tourCurrentCount?: number | null;
    tourPriorCount?: number | null;
    /** Phase 6 optional — bookings via first_booked_at (independent floor). */
    bookingCurrentCount?: number | null;
    bookingPriorCount?: number | null;
  },
): SpotPatternRecommendation | null {
  const windowDays = opts.windowDays ?? SPOT_PATTERN_WINDOW_DAYS;
  const current = opts.currentCount;
  const prior = opts.priorCount;
  if (current < INQUIRY_VOLUME_MIN_CURRENT) return null;
  const absolute = current - prior;
  if (absolute < INQUIRY_VOLUME_MIN_ABSOLUTE) return null;
  if (prior <= 0) {
    // No prior baseline — require absolute floor only is not enough for a %.
    // Without a prior period, do not claim an "increase".
    return null;
  }
  const pct = Math.round((absolute / prior) * 100);
  if (pct < INQUIRY_VOLUME_MIN_PCT) return null;

  const base: SpotPatternRecommendation = {
    type: INQUIRY_VOLUME_INCREASE_TYPE,
    title: "Inquiry volume is picking up",
    body: `You received ${current} inquiries in the last ${windowDays} days, compared with ${prior} in the previous ${windowDays} days.`,
    priority: SPOT_PATTERN_PRIORITY - 5,
    // Informational on /leads — a same-surface navigate CTA would only reload this page.
    ctas: [],
    metadata: {
      current_count: current,
      prior_count: prior,
      absolute_increase: absolute,
      percent_increase: pct,
      window_days: windowDays,
      pattern: "P-P1",
    },
  };

  // Phase 6 — enrichment only; secondary metrics never create the pattern.
  return enrichSpotPatternWithContext(
    base,
    buildPP1ContextClauses({
      priorCount: prior,
      priorPriorCount: opts.priorPriorCount,
      tourCurrentCount: opts.tourCurrentCount,
      tourPriorCount: opts.tourPriorCount,
      bookingCurrentCount: opts.bookingCurrentCount,
      bookingPriorCount: opts.bookingPriorCount,
      windowDays,
    }),
  );
}

/** Count leads created in [startMs, endMs). Venue-scoped caller supplies rows. */
export function countLeadsCreatedInRange(
  leads: { venueId: string; createdAt: string }[],
  opts: { venueId: string; startMs: number; endMs: number },
): number {
  let n = 0;
  for (const lead of leads) {
    if (lead.venueId !== opts.venueId) continue;
    const t = Date.parse(lead.createdAt);
    if (Number.isNaN(t)) continue;
    if (t >= opts.startMs && t < opts.endMs) n += 1;
  }
  return n;
}

/** Count timestamps in [startMs, endMs) for the active venue only. */
export function countTimestampsInRange(
  rows: { venueId: string; at: string }[],
  opts: { venueId: string; startMs: number; endMs: number },
): number {
  let n = 0;
  for (const row of rows) {
    if (row.venueId !== opts.venueId) continue;
    const t = Date.parse(row.at);
    if (Number.isNaN(t)) continue;
    if (t >= opts.startMs && t < opts.endMs) n += 1;
  }
  return n;
}

// ── Supersession of global L3 when L2 pattern is active / cooldown ────────────

export function shouldSuppressUnattendedInquiryObservations(
  recommendations: readonly (RecommendationVisibilityFields & { type: string })[],
): boolean {
  return recommendations.some((rec) => {
    if (rec.type !== UNATTENDED_INQUIRY_PATTERN_TYPE) return false;
    return (
      isRecommendationActiveForDisplay(rec) ||
      Boolean(rec.dismissedAt && !isRecommendationActiveForDisplay(rec))
    );
  });
}

export function shouldSuppressPaymentAttentionObservations(
  recommendations: readonly (RecommendationVisibilityFields & { type: string })[],
): boolean {
  return recommendations.some((rec) => {
    if (rec.type !== PAYMENT_ATTENTION_PATTERN_TYPE) return false;
    return (
      isRecommendationActiveForDisplay(rec) ||
      Boolean(rec.dismissedAt && !isRecommendationActiveForDisplay(rec))
    );
  });
}

/** Global Dashboard observation list only — record surfaces keep L3. */
export function filterGlobalObservationsForSpotPatterns<T extends Pick<LuvObservation, "id">>(
  observations: readonly T[],
  recommendations: readonly (RecommendationVisibilityFields & { type: string })[],
): T[] {
  const suppressS3 = shouldSuppressUnattendedInquiryObservations(recommendations);
  const suppressS2 = shouldSuppressPaymentAttentionObservations(recommendations);
  if (!suppressS3 && !suppressS2) return [...observations];
  return observations.filter((obs) => {
    if (suppressS3 && obs.id.startsWith("inquiry-unattended-")) return false;
    if (suppressS2 && obs.id.startsWith("event-payment-attention-")) return false;
    return true;
  });
}

// ── Sync (load + evaluate + RPC) ─────────────────────────────────────────────

async function syncOne(
  supabase: SupabaseClient,
  type: Phase5SpotPatternType,
  active: SpotPatternRecommendation | null,
): Promise<void> {
  const { error } = await supabase.rpc("sync_luv_spot_pattern_recommendation", {
    p_type: type,
    p_rec: active,
  });
  if (error) {
    console.error(`sync_luv_spot_pattern_recommendation(${type}) failed:`, error.message);
  }
}

export async function syncPhase5SpotPatternRecommendations(
  supabase: SupabaseClient,
): Promise<void> {
  try {
    const venue = await getCurrentVenue();
    if (!venue) return;
    const venueId = venue.id;
    const nowMs = Date.now();
    const windowDays = SPOT_PATTERN_WINDOW_DAYS;
    const windowStart = new Date(nowMs - windowDays * 86_400_000).toISOString();
    const priorStart = new Date(nowMs - 2 * windowDays * 86_400_000).toISOString();
    // Phase 6 sustained context needs a third adjacent window (42d lookback).
    const priorPriorStart = new Date(nowMs - 3 * windowDays * 86_400_000).toISOString();
    const today = venueToday(venue.timezone ?? null);
    const soon14 = new Date(nowMs + windowDays * 86_400_000).toISOString().slice(0, 10);
    const fortyEightHoursAgo = new Date(nowMs - 48 * 3_600_000).toISOString();

    const [
      historyLeadsRes,
      historyEventsRes,
      unattendedRes,
      volumeLeadsRes,
      bookingLeadsRes,
      tourApptsRes,
      upcomingEventsRes,
      paymentInvoices,
      paymentSchedules,
      paymentLineItems,
    ] = await Promise.all([
      onlyBusinessReporting(
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("venue_id", venueId),
      ),
      onlyBusinessReporting(
        supabase
          .from("events")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", venueId)
          .not("status", "in", "(cancelled)"),
      ),
      onlyBusinessReporting(
        supabase
          .from("leads")
          .select(
            "id, first_name, last_name, sales_stage, created_at, last_contacted_at, acquisition_source, first_booked_at, lost_at, relationship_id",
          )
          .eq("venue_id", venueId)
          .is("first_booked_at", null)
          .is("lost_at", null)
          .is("last_contacted_at", null)
          .lte("created_at", fortyEightHoursAgo)
          .gte("created_at", windowStart),
      ),
      onlyBusinessReporting(
        supabase
          .from("leads")
          .select("id, created_at")
          .eq("venue_id", venueId)
          .gte("created_at", priorPriorStart),
      ),
      // Booking clock — first_booked_at only (never contract/payment/client-create).
      onlyBusinessReporting(
        supabase
          .from("leads")
          .select("id, first_booked_at")
          .eq("venue_id", venueId)
          .not("first_booked_at", "is", null)
          .gte("first_booked_at", priorStart),
      ),
      supabase
        .from("tour_appointments")
        .select("id, scheduled_at")
        .eq("venue_id", venueId)
        .gte("scheduled_at", priorStart),
      onlyBusinessReporting(
        supabase
          .from("events")
          .select("id, name, event_date, client_id, status")
          .eq("venue_id", venueId)
          .not("status", "in", "(cancelled,complete)")
          .gte("event_date", today)
          .lte("event_date", soon14)
          .order("event_date"),
      ),
      getInvoices(supabase, venueId),
      getSchedules(supabase, venueId),
      getAllLineItems(supabase, venueId),
    ]);

    const venueLeadHistoryCount = historyLeadsRes.count ?? 0;
    const venueEventHistoryCount = historyEventsRes.count ?? 0;

    // P-A1 — candidate window uses last_contacted_at null for efficiency;
    // qualification still requires the same S3 communication + tour enrichment.
    const unattendedRows = (unattendedRes.data ?? []) as {
      id: string;
      first_name: string;
      last_name: string;
      sales_stage: string;
      created_at: string;
      last_contacted_at: string | null;
      acquisition_source: string | null;
      relationship_id: string | null;
    }[];
    const { contactedLeadIds, tourStatusByLeadId } = await loadUnattendedInquiryContactEvidence(
      supabase,
      venueId,
      unattendedRows,
    );
    const unattendedLeads = unattendedRows.map((row) => ({
      id: row.id,
      venueId,
      firstName: row.first_name,
      lastName: row.last_name,
      salesStage: row.sales_stage,
      createdAt: row.created_at,
      lastContactedAt: row.last_contacted_at,
      acquisitionSource: row.acquisition_source,
      hasCustomerFacingMessage: contactedLeadIds.has(row.id),
      tourStatus: tourStatusByLeadId.get(row.id) ?? null,
    }));

    const pA1 = evaluateUnattendedInquiryPattern(unattendedLeads, {
      venueId,
      nowMs,
      venueLeadHistoryCount,
    });
    await syncOne(supabase, UNATTENDED_INQUIRY_PATTERN_TYPE, pA1);

    // P-P1
    const volumeRows = (
      (volumeLeadsRes.data ?? []) as { id: string; created_at: string }[]
    ).map((r) => ({ venueId, createdAt: r.created_at }));
    const currentStart = nowMs - windowDays * 86_400_000;
    const priorEnd = currentStart;
    const priorStartMs = nowMs - 2 * windowDays * 86_400_000;
    const priorPriorStartMs = nowMs - 3 * windowDays * 86_400_000;
    const currentCount = countLeadsCreatedInRange(volumeRows, {
      venueId,
      startMs: currentStart,
      endMs: nowMs + 1,
    });
    const priorCount = countLeadsCreatedInRange(volumeRows, {
      venueId,
      startMs: priorStartMs,
      endMs: priorEnd,
    });
    const priorPriorCount = countLeadsCreatedInRange(volumeRows, {
      venueId,
      startMs: priorPriorStartMs,
      endMs: priorStartMs,
    });

    const tourRows = (
      (tourApptsRes.data ?? []) as { id: string; scheduled_at: string }[]
    ).map((r) => ({ venueId, at: r.scheduled_at }));
    const tourCurrentCount = countTimestampsInRange(tourRows, {
      venueId,
      startMs: currentStart,
      endMs: nowMs + 1,
    });
    const tourPriorCount = countTimestampsInRange(tourRows, {
      venueId,
      startMs: priorStartMs,
      endMs: priorEnd,
    });

    const bookingRows = (
      (bookingLeadsRes.data ?? []) as { id: string; first_booked_at: string }[]
    ).map((r) => ({ venueId, at: r.first_booked_at }));
    const bookingCurrentCount = countTimestampsInRange(bookingRows, {
      venueId,
      startMs: currentStart,
      endMs: nowMs + 1,
    });
    const bookingPriorCount = countTimestampsInRange(bookingRows, {
      venueId,
      startMs: priorStartMs,
      endMs: priorEnd,
    });

    const pP1 = evaluateInquiryVolumeIncrease({
      venueId,
      currentCount,
      priorCount,
      priorPriorCount,
      tourCurrentCount,
      tourPriorCount,
      bookingCurrentCount,
      bookingPriorCount,
    });
    await syncOne(supabase, INQUIRY_VOLUME_INCREASE_TYPE, pP1);

    // P-A4 — same payment readiness path as S2
    const upcomingEvents = (upcomingEventsRes.data ?? []) as {
      id: string;
      name: string;
      event_date: string;
      client_id: string | null;
      status: string;
    }[];
    const linesByScheduleId = new Map<string, { status: string; dueDate: string | null; amount: number }[]>();
    for (const line of paymentLineItems) {
      const list = linesByScheduleId.get(line.scheduleId) ?? [];
      list.push({ status: line.status, dueDate: line.dueDate, amount: line.amount });
      linesByScheduleId.set(line.scheduleId, list);
    }
    const scheduleLinesByEventId = new Map<
      string,
      { status: string; dueDate: string | null; amount: number }[]
    >();
    for (const schedule of paymentSchedules) {
      if (!schedule.eventId) continue;
      const lines = (linesByScheduleId.get(schedule.id) ?? []);
      const existing = scheduleLinesByEventId.get(schedule.eventId) ?? [];
      scheduleLinesByEventId.set(schedule.eventId, existing.concat(lines));
    }
    const invoicesByEventId = new Map<string, typeof paymentInvoices>();
    for (const inv of paymentInvoices) {
      if (!inv.eventId) continue;
      const list = invoicesByEventId.get(inv.eventId) ?? [];
      list.push(inv);
      invoicesByEventId.set(inv.eventId, list);
    }

    const paymentInputs: PaymentAttentionEventInput[] = [];
    for (const ev of upcomingEvents) {
      if (!ev.client_id) continue;
      const eventInvoices = invoicesByEventId.get(ev.id) ?? [];
      const eventScheduleLines = scheduleLinesByEventId.get(ev.id) ?? [];
      if (eventInvoices.length === 0 && eventScheduleLines.length === 0) continue;
      const section = computePaymentsReadiness(eventInvoices, eventScheduleLines);
      paymentInputs.push({
        event: {
          id: ev.id,
          venueId,
          name: ev.name,
          eventDate: ev.event_date,
          status: ev.status,
          clientId: ev.client_id,
        },
        payment: {
          eventId: ev.id,
          venueId,
          status: section.status,
          detail: section.detail,
          href: "/payments?filter=attention",
        },
      });
    }

    const pA4 = evaluatePaymentAttentionPattern(paymentInputs, {
      venueId,
      nowMs,
      venueEventHistoryCount,
    });
    await syncOne(supabase, PAYMENT_ATTENTION_PATTERN_TYPE, pA4);
  } catch (err) {
    console.error("syncPhase5SpotPatternRecommendations error:", err);
  }
}
