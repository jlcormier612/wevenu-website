import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  normalizeEmailAddressKey,
  normalizeSmsAddressKey,
  type CommunicationPermissionStatus,
} from "@/lib/communication/permissions";
import type { SmsPermissionEvidenceView } from "@/components/leads/relationship-communication-summary";

export async function getSmsPermissionEvidenceForContact(input: {
  venueId: string;
  phone: string | null;
}): Promise<SmsPermissionEvidenceView | null> {
  if (!isSupabaseConfigured || !input.phone?.trim()) return null;
  const addressKey = normalizeSmsAddressKey(input.phone);
  if (!addressKey) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("communication_permissions")
    .select("status, source, updated_at, consent_text")
    .eq("venue_id", input.venueId)
    .eq("channel", "sms")
    .eq("address_key", addressKey)
    .maybeSingle<{
      status: CommunicationPermissionStatus;
      source: string | null;
      updated_at: string | null;
      consent_text: string | null;
    }>();
  if (!data) {
    return { status: "not_opted_in", source: null, updatedAt: null, consentText: null };
  }
  return {
    status: data.status,
    source: data.source,
    updatedAt: data.updated_at,
    consentText: data.consent_text,
  };
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
