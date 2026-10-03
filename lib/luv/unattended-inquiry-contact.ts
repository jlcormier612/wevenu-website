/**
 * Shared authoritative contact enrichment for S3 unattended-inquiry
 * observations and Phase 5 P-A1 spot-pattern sync.
 *
 * last_contacted_at alone is never enough — load conversation_messages and
 * tour_appointments the same way for both surfaces.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isCustomerFacingContactMessage } from "@/lib/luv/observation-quality";

export type UnattendedInquiryContactRow = {
  id: string;
  relationship_id: string | null;
};

export type UnattendedInquiryContactEvidence = {
  /** Lead IDs with at least one customer-facing conversation message. */
  contactedLeadIds: Set<string>;
  /** Lead ID → tour status (scheduled / confirmed / completed when present). */
  tourStatusByLeadId: Map<string, string>;
};

/**
 * Enrich candidate leads with the same communication + tour evidence S3 uses.
 * Pipeline / sales stage is intentionally not consulted.
 */
export async function loadUnattendedInquiryContactEvidence(
  supabase: SupabaseClient,
  venueId: string,
  rows: readonly UnattendedInquiryContactRow[],
): Promise<UnattendedInquiryContactEvidence> {
  const contactedLeadIds = new Set<string>();
  const tourStatusByLeadId = new Map<string, string>();
  if (rows.length === 0) {
    return { contactedLeadIds, tourStatusByLeadId };
  }

  const leadIds = rows.map((r) => r.id);
  const relIds = [...new Set(rows.map((r) => r.relationship_id).filter(Boolean))] as string[];

  if (leadIds.length > 0) {
    const { data: tours } = await supabase
      .from("tour_appointments")
      .select("lead_id, status")
      .eq("venue_id", venueId)
      .in("lead_id", leadIds)
      .in("status", ["scheduled", "confirmed", "completed"]);
    for (const t of (tours ?? []) as { lead_id: string | null; status: string }[]) {
      if (t.lead_id) tourStatusByLeadId.set(t.lead_id, t.status);
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
      const relsWithMsg = new Set<string>();
      for (const m of (msgs ?? []) as {
        conversation_id: string;
        sender_type: string;
        channel: string;
      }[]) {
        if (!isCustomerFacingContactMessage({ senderType: m.sender_type, channel: m.channel })) {
          continue;
        }
        const rel = relByConv.get(m.conversation_id);
        if (rel) relsWithMsg.add(rel);
      }
      for (const row of rows) {
        if (row.relationship_id && relsWithMsg.has(row.relationship_id)) {
          contactedLeadIds.add(row.id);
        }
      }
    }
  }

  return { contactedLeadIds, tourStatusByLeadId };
}
