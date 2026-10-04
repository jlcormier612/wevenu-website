/**
 * Shared contact enrichment for P-A1 / S3 unattended inquiry.
 *
 * last_contacted_at alone is never enough. Conversation + tour records are
 * loaded the same way for cluster sync, S3, and the Leads destination list.
 *
 * P-A1 first response ≠ Inbox needs_response:
 *   venue_staff outbound counts; system outbound does not; inbound does not;
 *   internal_note does not; completed/cancelled/no_show/walk-in tours count.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isVenueStaffFirstResponseMessage } from "@/lib/luv/observation-quality";
import {
  isAuthoritativeTourContactForUnattendedInquiry,
  UNATTENDED_INQUIRY_TOUR_CONTACT_STATUSES,
} from "@/lib/luv/pipeline-stage-evidence";
import { onlyBusinessReporting } from "@/lib/reporting/business-scope";
import {
  isQualifyingUnattendedInquiry,
  UNATTENDED_INQUIRY_WINDOW_DAYS,
  type UnattendedInquiryEvidence,
  type UnattendedInquiryWindow,
} from "@/lib/luv/unattended-inquiry";
import { UNATTENDED_INQUIRY_HOURS } from "@/lib/luv/contextual-signals";

export type UnattendedInquiryContactRow = {
  id: string;
  relationship_id: string | null;
};

export type UnattendedInquiryContactEvidence = {
  /** Lead IDs with venue_staff customer-facing outbound. */
  contactedLeadIds: Set<string>;
  tourStatusByLeadId: Map<string, string>;
  tourOriginByLeadId: Map<string, string | null>;
};

export async function loadUnattendedInquiryContactEvidence(
  supabase: SupabaseClient,
  venueId: string,
  rows: readonly UnattendedInquiryContactRow[],
): Promise<UnattendedInquiryContactEvidence> {
  const contactedLeadIds = new Set<string>();
  const tourStatusByLeadId = new Map<string, string>();
  const tourOriginByLeadId = new Map<string, string | null>();
  if (rows.length === 0) {
    return { contactedLeadIds, tourStatusByLeadId, tourOriginByLeadId };
  }

  const leadIds = rows.map((r) => r.id);
  const relIds = [...new Set(rows.map((r) => r.relationship_id).filter(Boolean))] as string[];

  if (leadIds.length > 0) {
    const statusList = UNATTENDED_INQUIRY_TOUR_CONTACT_STATUSES.join(",");
    const { data: tours } = await supabase
      .from("tour_appointments")
      .select("lead_id, status, origin")
      .eq("venue_id", venueId)
      .in("lead_id", leadIds)
      .or(`origin.eq.walk_in,status.in.(${statusList})`);
    for (const t of (tours ?? []) as {
      lead_id: string | null;
      status: string | null;
      origin: string | null;
    }[]) {
      if (!t.lead_id) continue;
      if (
        !isAuthoritativeTourContactForUnattendedInquiry({
          status: t.status,
          origin: t.origin,
        })
      ) {
        continue;
      }
      tourStatusByLeadId.set(t.lead_id, t.status ?? "");
      tourOriginByLeadId.set(t.lead_id, t.origin);
    }
  }

  if (relIds.length > 0) {
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, relationship_id")
      .eq("venue_id", venueId)
      .in("relationship_id", relIds);
    const convIds = (convs ?? []).map((c: { id: string }) => c.id);
    const relByConv = new Map(
      (convs ?? []).map((c: { id: string; relationship_id: string }) => [c.id, c.relationship_id]),
    );
    if (convIds.length > 0) {
      const { data: msgs } = await supabase
        .from("conversation_messages")
        .select("conversation_id, sender_type, channel")
        .eq("venue_id", venueId)
        .in("conversation_id", convIds);
      const relsWithStaffOutbound = new Set<string>();
      for (const m of (msgs ?? []) as {
        conversation_id: string;
        sender_type: string;
        channel: string;
      }[]) {
        if (!isVenueStaffFirstResponseMessage({ senderType: m.sender_type, channel: m.channel })) {
          continue;
        }
        const rel = relByConv.get(m.conversation_id);
        if (rel) relsWithStaffOutbound.add(rel);
      }
      for (const row of rows) {
        if (row.relationship_id && relsWithStaffOutbound.has(row.relationship_id)) {
          contactedLeadIds.add(row.id);
        }
      }
    }
  }

  return { contactedLeadIds, tourStatusByLeadId, tourOriginByLeadId };
}

export type UnattendedInquiryCandidateRow = {
  id: string;
  first_name: string;
  last_name: string;
  sales_stage: string;
  created_at: string;
  last_contacted_at: string | null;
  acquisition_source: string | null;
  first_booked_at: string | null;
  lost_at: string | null;
  relationship_id: string | null;
  inquiry_message_origin: string | null;
};

function toEvidence(
  venueId: string,
  row: UnattendedInquiryCandidateRow,
  evidence: UnattendedInquiryContactEvidence,
): UnattendedInquiryEvidence {
  return {
    id: row.id,
    venueId,
    createdAt: row.created_at,
    inquiryMessageOrigin: row.inquiry_message_origin,
    firstBookedAt: row.first_booked_at,
    lostAt: row.lost_at,
    lastContactedAt: row.last_contacted_at,
    hasVenueStaffOutbound: evidence.contactedLeadIds.has(row.id),
    tourStatus: evidence.tourStatusByLeadId.get(row.id) ?? null,
    tourOrigin: evidence.tourOriginByLeadId.get(row.id) ?? null,
    relationshipId: row.relationship_id,
    acquisitionSource: row.acquisition_source,
  };
}

/**
 * Candidate fetch for the cluster window. last_contacted_at IS NULL is an
 * optimization only — populated last_contacted_at would fail the evaluator
 * anyway, so this cannot create false negatives.
 */
export async function loadUnattendedInquiryClusterCandidates(
  supabase: SupabaseClient,
  venueId: string,
  opts: { nowMs?: number } = {},
): Promise<UnattendedInquiryEvidence[]> {
  const nowMs = opts.nowMs ?? Date.now();
  const windowStart = new Date(nowMs - UNATTENDED_INQUIRY_WINDOW_DAYS * 86_400_000).toISOString();
  const fortyEightHoursAgo = new Date(nowMs - UNATTENDED_INQUIRY_HOURS * 3_600_000).toISOString();
  const res = await onlyBusinessReporting(
    supabase
      .from("leads")
      .select(
        "id, first_name, last_name, sales_stage, created_at, last_contacted_at, acquisition_source, first_booked_at, lost_at, relationship_id, inquiry_message_origin",
      )
      .eq("venue_id", venueId)
      .is("first_booked_at", null)
      .is("lost_at", null)
      .is("last_contacted_at", null)
      .lte("created_at", fortyEightHoursAgo)
      .gte("created_at", windowStart),
  );
  const rows = (res.data ?? []) as UnattendedInquiryCandidateRow[];
  const contact = await loadUnattendedInquiryContactEvidence(supabase, venueId, rows);
  return rows.map((row) => toEvidence(venueId, row, contact));
}

export function qualifyingUnattendedInquiryIdsFromEvidence(
  leads: UnattendedInquiryEvidence[],
  opts: { venueId: string; nowMs?: number; window?: UnattendedInquiryWindow },
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const lead of leads) {
    if (!isQualifyingUnattendedInquiry(lead, opts)) continue;
    if (seen.has(lead.id)) continue;
    seen.add(lead.id);
    ids.push(lead.id);
  }
  return ids;
}

export async function loadQualifyingUnattendedInquiryLeadIds(
  supabase: SupabaseClient,
  venueId: string,
  opts: { nowMs?: number } = {},
): Promise<string[]> {
  const leads = await loadUnattendedInquiryClusterCandidates(supabase, venueId, opts);
  return qualifyingUnattendedInquiryIdsFromEvidence(leads, {
    venueId,
    nowMs: opts.nowMs,
    window: "cluster",
  });
}
