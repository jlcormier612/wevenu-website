/**
 * Lead/Client Contact-card SMS evidence.
 *
 * Outbound send remains phone-scoped (venue + address_key) via
 * assertChannelAllowed / getCommunicationPermission.
 *
 * Contact Information must not claim website/tour form consent for a lead
 * that did not capture it — shared test phones previously made Rebecca's
 * inquiry_form opt-in appear on Betty's manually created lead.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  normalizeEmailAddressKey,
  normalizeSmsAddressKey,
  type CommunicationPermissionStatus,
} from "@/lib/communication/permissions";
import {
  SMS_PERMISSION_SOURCE_EMAIL_CONSENT,
  SMS_PERMISSION_SOURCE_INQUIRY_FORM,
  SMS_PERMISSION_SOURCE_TOUR_FORM,
} from "@/lib/communication/sms-consent";
import type { SmsPermissionEvidenceView } from "@/components/leads/relationship-communication-summary";

/** Form captures are lead/relationship-attributed; keyword/email opt-ins are number-level. */
const FORM_ATTRIBUTED_SOURCES = new Set([
  SMS_PERMISSION_SOURCE_INQUIRY_FORM,
  SMS_PERMISSION_SOURCE_TOUR_FORM,
]);

export type SmsPermissionRowForAttribution = {
  status: CommunicationPermissionStatus;
  source: string | null;
  updatedAt: string | null;
  consentText: string | null;
  relationshipId: string | null;
  evidenceLeadId: string | null;
};

/**
 * Whether Contact Information may present this permission as belonging to
 * this lead/person. Hard blocks always apply. Form opt-ins require matching
 * lead or relationship evidence. Other sources (START, email consent, …)
 * remain number-scoped.
 */
export function smsPermissionAttributedToLead(
  row: SmsPermissionRowForAttribution,
  opts: { leadId: string; relationshipId: string | null },
): boolean {
  if (row.status === "opted_out" || row.status === "provider_blocked") {
    return true;
  }
  if (row.status !== "opted_in") {
    return true;
  }
  const source = (row.source ?? "").trim();
  if (!FORM_ATTRIBUTED_SOURCES.has(source as typeof SMS_PERMISSION_SOURCE_INQUIRY_FORM)) {
    return true;
  }
  if (row.evidenceLeadId && row.evidenceLeadId === opts.leadId) return true;
  if (row.relationshipId && opts.relationshipId && row.relationshipId === opts.relationshipId) {
    return true;
  }
  return false;
}

function unattributedNotOptedIn(): SmsPermissionEvidenceView {
  return { status: "not_opted_in", source: null, updatedAt: null, consentText: null };
}

export async function getSmsPermissionEvidenceForContact(input: {
  venueId: string;
  phone: string | null;
  /** When set, form consent from another lead/relationship is not shown on this card. */
  leadId?: string | null;
  relationshipId?: string | null;
}): Promise<SmsPermissionEvidenceView | null> {
  if (!isSupabaseConfigured || !input.phone?.trim()) return null;
  const addressKey = normalizeSmsAddressKey(input.phone);
  if (!addressKey) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("communication_permissions")
    .select("status, source, updated_at, consent_text, relationship_id, evidence")
    .eq("venue_id", input.venueId)
    .eq("channel", "sms")
    .eq("address_key", addressKey)
    .maybeSingle<{
      status: CommunicationPermissionStatus;
      source: string | null;
      updated_at: string | null;
      consent_text: string | null;
      relationship_id: string | null;
      evidence: { leadId?: string } | null;
    }>();
  if (!data) {
    return unattributedNotOptedIn();
  }

  const evidenceLeadId =
    data.evidence && typeof data.evidence === "object" && typeof data.evidence.leadId === "string"
      ? data.evidence.leadId
      : null;

  const view: SmsPermissionEvidenceView = {
    status: data.status,
    source: data.source,
    updatedAt: data.updated_at,
    consentText: data.consent_text,
  };

  if (input.leadId) {
    const attributed = smsPermissionAttributedToLead(
      {
        status: data.status,
        source: data.source,
        updatedAt: data.updated_at,
        consentText: data.consent_text,
        relationshipId: data.relationship_id,
        evidenceLeadId,
      },
      { leadId: input.leadId, relationshipId: input.relationshipId ?? null },
    );
    if (!attributed) return unattributedNotOptedIn();
  }

  return view;
}

export async function getEmailPermissionEvidenceForContact(input: {
  venueId: string;
  email: string | null;
}): Promise<SmsPermissionEvidenceView | null> {
  if (!isSupabaseConfigured || !input.email?.trim()) return null;
  const addressKey = normalizeEmailAddressKey(input.email);
  if (!addressKey) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("communication_permissions")
    .select("status, source, updated_at, consent_text")
    .eq("venue_id", input.venueId)
    .eq("channel", "email")
    .eq("address_key", addressKey)
    .maybeSingle<{
      status: CommunicationPermissionStatus;
      source: string | null;
      updated_at: string | null;
      consent_text: string | null;
    }>();
  if (!data) return null;
  return {
    status: data.status,
    source: data.source,
    updatedAt: data.updated_at,
    consentText: data.consent_text,
  };
}
