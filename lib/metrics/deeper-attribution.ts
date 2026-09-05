/**
 * Phase 2D — Deeper attribution metrics.
 *
 * Builds on Phase 2A frozen acquisition_source and Phase 2B cohort population.
 * Top-of-funnel UTM / landing / referrer / QR / Meta fields are evidence from
 * leads.source_data — never treated as authoritative HTC acquisition truth.
 */
import {
  computeMedianTimeToBookByKey,
  computeSourceCohortRates,
  groupEvidenceCounts,
  normalizeLandingPageForReporting,
  normalizeReferrerHost,
  readSourceDataString,
  type EvidenceCountRow,
  type SourceCohortRateRow,
  type TimeToBookByKeyRow,
} from "@/lib/attribution/evidence";
import {
  median,
  reportingSourceDisplayLabel,
  reportingSourceGroupKey,
  timeToBookDays,
  UNKNOWN_SOURCE_KEY,
} from "@/lib/attribution/source";
import { createClient } from "@/integrations/supabase/server";
import { eventTypeLabel } from "@/lib/event-types/canonical";
import { isSupabaseConfigured } from "@/lib/env";
import { isBusinessFunnelCohortLead } from "@/lib/metrics/cohort-population";
import { listLifecycleBookingsInPeriod } from "@/lib/lifecycle-bookings/service";
import { getCurrentVenue } from "@/lib/venue/service";

export type DateWindow = { from: string; to: string };

export const PHASE_2D_EVIDENCE_AUTHORITY_NOTE =
  "These are optional marketing clues captured when the lead arrived (UTMs, landing page, referrer, QR, Meta ads). They are not Hello to Cheers’ official acquisition source, and they do not mean a campaign caused a booking.";

export const PHASE_2D_EVIDENCE_CLOCK_NOTE =
  "Counts every lead created in this date range (including cancelled or lost). Blank clues stay Unknown / Unattributed. Cohort rates above use a stricter population.";

export type LeadTopOfFunnelEvidence = {
  leadsInWindow: number;
  withAnyUtm: number;
  withLandingPage: number;
  withReferrer: number;
  withQrCampaign: number;
  withMetaLeadgen: number;
  withMetaCampaign: number;
  utmSource: EvidenceCountRow[];
  utmMedium: EvidenceCountRow[];
  utmCampaign: EvidenceCountRow[];
  utmContent: EvidenceCountRow[];
  utmTerm: EvidenceCountRow[];
  landingPage: EvidenceCountRow[];
  referrerHost: EvidenceCountRow[];
  qrCampaign: EvidenceCountRow[];
  metaCampaign: EvidenceCountRow[];
  authorityNote: string;
  clockNote: string;
};

function emptyEvidence(): LeadTopOfFunnelEvidence {
  return {
    leadsInWindow: 0,
    withAnyUtm: 0,
    withLandingPage: 0,
    withReferrer: 0,
    withQrCampaign: 0,
    withMetaLeadgen: 0,
    withMetaCampaign: 0,
    utmSource: [],
    utmMedium: [],
    utmCampaign: [],
    utmContent: [],
    utmTerm: [],
    landingPage: [],
    referrerHost: [],
    qrCampaign: [],
    metaCampaign: [],
    authorityNote: PHASE_2D_EVIDENCE_AUTHORITY_NOTE,
    clockNote: PHASE_2D_EVIDENCE_CLOCK_NOTE,
  };
}

/**
 * Period lead inventory of top-of-funnel evidence keys in source_data.
 * Includes all leads created in the window (cancelled/lost still carried entry evidence).
 */
export async function getLeadTopOfFunnelEvidence(window: DateWindow): Promise<LeadTopOfFunnelEvidence> {
  if (!isSupabaseConfigured) return emptyEvidence();
  const venue = await getCurrentVenue();
  if (!venue) return emptyEvidence();
  const supabase = await createClient();

  const { data } = await supabase
    .from("leads")
    .select("id, source_data")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);

  type Row = { id: string; source_data: Record<string, unknown> | null };
  const rows = (data ?? []) as Row[];

  const utmSource: Array<string | null> = [];
  const utmMedium: Array<string | null> = [];
  const utmCampaign: Array<string | null> = [];
  const utmContent: Array<string | null> = [];
  const utmTerm: Array<string | null> = [];
  const landing: Array<string | null> = [];
  const referrer: Array<string | null> = [];
  const qr: Array<string | null> = [];
  const metaCampaign: Array<string | null> = [];

  let withAnyUtm = 0;
  let withLandingPage = 0;
  let withReferrer = 0;
  let withQrCampaign = 0;
  let withMetaLeadgen = 0;
  let withMetaCampaign = 0;

  for (const r of rows) {
    const sd = r.source_data;
    const us = readSourceDataString(sd, "utm_source");
    const um = readSourceDataString(sd, "utm_medium");
    const uc = readSourceDataString(sd, "utm_campaign");
    const ucontent = readSourceDataString(sd, "utm_content");
    const ut = readSourceDataString(sd, "utm_term");
    const lp = normalizeLandingPageForReporting(readSourceDataString(sd, "landing_page"));
    const rh = normalizeReferrerHost(readSourceDataString(sd, "referrer"));
    const qrId = readSourceDataString(sd, "qr_campaign_id");
    const camp = readSourceDataString(sd, "campaign_id");
    const leadgen = readSourceDataString(sd, "leadgen_id");

    utmSource.push(us);
    utmMedium.push(um);
    utmCampaign.push(uc);
    utmContent.push(ucontent);
    utmTerm.push(ut);
    landing.push(lp);
    referrer.push(rh);
    qr.push(qrId);
    metaCampaign.push(camp);

    if (us || um || uc || ucontent || ut) withAnyUtm += 1;
    if (lp) withLandingPage += 1;
    if (rh) withReferrer += 1;
    if (qrId) withQrCampaign += 1;
    if (leadgen) withMetaLeadgen += 1;
    if (camp) withMetaCampaign += 1;
  }

  const qrCodes = [...new Set(qr.filter((v): v is string => !!v))];
  const qrLabelByKey = new Map<string, string>();
  if (qrCodes.length > 0) {
    const { data: campaigns } = await supabase
      .from("qr_campaigns")
      .select("code, name")
      .eq("venue_id", venue.id)
      .in("code", qrCodes);
    for (const c of (campaigns ?? []) as { code: string; name: string }[]) {
      qrLabelByKey.set(c.code, c.name);
    }
  }

  const metaLabelByKey = new Map<string, string>();
  for (const r of rows) {
    const id = readSourceDataString(r.source_data, "campaign_id");
    const name = readSourceDataString(r.source_data, "campaign_name");
    if (id && name) metaLabelByKey.set(id, name);
  }

  return {
    leadsInWindow: rows.length,
    withAnyUtm,
    withLandingPage,
    withReferrer,
    withQrCampaign,
    withMetaLeadgen,
    withMetaCampaign,
    utmSource: groupEvidenceCounts(utmSource),
    utmMedium: groupEvidenceCounts(utmMedium),
    utmCampaign: groupEvidenceCounts(utmCampaign),
    utmContent: groupEvidenceCounts(utmContent),
    utmTerm: groupEvidenceCounts(utmTerm),
    landingPage: groupEvidenceCounts(landing),
    referrerHost: groupEvidenceCounts(referrer),
    qrCampaign: groupEvidenceCounts(qr, { labelByKey: qrLabelByKey }),
    metaCampaign: groupEvidenceCounts(metaCampaign, { labelByKey: metaLabelByKey }),
    authorityNote: PHASE_2D_EVIDENCE_AUTHORITY_NOTE,
    clockNote: PHASE_2D_EVIDENCE_CLOCK_NOTE,
  };
}

/**
 * Business Funnel cohort rates broken down by frozen acquisition_source.
 * Same population as Phase 2B (excludes cancelled / lost).
 */
export async function getAcquisitionSourceCohortBreakdown(
  window: DateWindow,
): Promise<SourceCohortRateRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, acquisition_source, first_booked_at, sales_stage, status")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);

  type LeadRow = {
    id: string;
    acquisition_source: string | null;
    first_booked_at: string | null;
    sales_stage: string | null;
    status: string | null;
  };
  const cohort = ((leads ?? []) as LeadRow[]).filter(isBusinessFunnelCohortLead);
  if (cohort.length === 0) return [];

  const leadIds = cohort.map((l) => l.id);
  const { data: tours } = await supabase
    .from("tour_appointments")
    .select("lead_id")
    .eq("venue_id", venue.id)
    .in("lead_id", leadIds);
  const touredIds = new Set(
    ((tours ?? []) as { lead_id: string | null }[])
      .map((t) => t.lead_id)
      .filter((id): id is string => !!id),
  );

  return computeSourceCohortRates(
    cohort.map((l) => {
      const key = reportingSourceGroupKey(l.acquisition_source);
      return {
        sourceKey: key,
        label: reportingSourceDisplayLabel(key === UNKNOWN_SOURCE_KEY ? null : key),
        eventuallyToured: touredIds.has(l.id),
        eventuallyBooked: !!l.first_booked_at,
      };
    }),
  );
}

/**
 * Median lead→lifecycle-booking days for period first_booked rows, by frozen
 * acquisition_source on the booking event (fallback: originating lead).
 * Leadless / incalculable rows are excluded from samples (not invented).
 */
export async function getMedianTimeToBookByAcquisitionSource(
  window: DateWindow,
): Promise<TimeToBookByKeyRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const bookings = await listLifecycleBookingsInPeriod(supabase, venue.id, {
    from: window.from,
    to: window.to,
  });
  const leadIds = [...new Set(bookings.map((b) => b.leadId).filter((v): v is string => !!v))];
  if (leadIds.length === 0) return [];

  const { data: leads } = await supabase
    .from("leads")
    .select("id, created_at, acquisition_source")
    .eq("venue_id", venue.id)
    .in("id", leadIds);
  type LeadRow = { id: string; created_at: string; acquisition_source: string | null };
  const leadById = new Map(((leads ?? []) as LeadRow[]).map((l) => [l.id, l]));

  const samples: Array<{ key: string; label: string; days: number }> = [];
  for (const b of bookings) {
    if (!b.leadId) continue;
    const lead = leadById.get(b.leadId);
    if (!lead) continue;
    const days = timeToBookDays(lead.created_at, b.occurredAt);
    if (days == null) continue;
    const raw = b.acquisitionSource ?? lead.acquisition_source;
    const key = reportingSourceGroupKey(raw);
    samples.push({
      key,
      label: reportingSourceDisplayLabel(key === UNKNOWN_SOURCE_KEY ? null : key),
      days,
    });
  }
  return computeMedianTimeToBookByKey(samples, median);
}

export type EventTypeCohortRow = {
  key: string;
  label: string;
  leads: number;
  eventuallyBooked: number;
  rate: number;
};

/**
 * Business Funnel cohort Lead→Booking by leads.event_type (deterministic column).
 * Missing/blank event type → Unknown / Unattributed.
 */
export async function getEventTypeCohortBreakdown(
  window: DateWindow,
): Promise<EventTypeCohortRow[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("leads")
    .select("id, event_type, first_booked_at, sales_stage, status")
    .eq("venue_id", venue.id)
    .gte("created_at", `${window.from}T00:00:00.000Z`)
    .lte("created_at", `${window.to}T23:59:59.999Z`);

  type LeadRow = {
    id: string;
    event_type: string | null;
    first_booked_at: string | null;
    sales_stage: string | null;
    status: string | null;
  };
  const cohort = ((leads ?? []) as LeadRow[]).filter(isBusinessFunnelCohortLead);
  const map = new Map<string, { label: string; leads: number; booked: number }>();
  for (const l of cohort) {
    const raw = l.event_type?.trim() || null;
    const key = raw || UNKNOWN_SOURCE_KEY;
    const label = raw ? eventTypeLabel(raw) || raw : reportingSourceDisplayLabel(null);
    const cur = map.get(key) ?? { label, leads: 0, booked: 0 };
    cur.leads += 1;
    if (l.first_booked_at) cur.booked += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      leads: v.leads,
      eventuallyBooked: v.booked,
      rate: v.leads > 0 ? Math.round((100 * v.booked) / v.leads) : 0,
    }))
    .sort((a, b) => {
      if (a.key === UNKNOWN_SOURCE_KEY) return 1;
      if (b.key === UNKNOWN_SOURCE_KEY) return -1;
      return b.leads - a.leads;
    });
}
