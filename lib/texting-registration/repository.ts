/**
 * Venue texting registration repository.
 * Never selects support_debug or registration_number_ciphertext for authenticated clients.
 * Ciphertext writes go through the service-role admin client only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/integrations/supabase/admin";
import type {
  TextingPhase,
  TextingRegistrationView,
} from "@/lib/texting-registration/types";
import { isTextingPhase } from "@/lib/texting-registration/lifecycle";

/** Columns readable by authenticated venue sessions (no ciphertext, no support_debug). */
const VIEW_COLUMNS = [
  "venue_id",
  "phase",
  "attention_code",
  "attention_message",
  "attention_fix_hint",
  "business_name",
  "website_url",
  "address_line1",
  "address_line2",
  "city",
  "state_region",
  "postal_code",
  "country",
  "contact_email",
  "contact_phone",
  "business_confirmed_at",
  "business_type",
  "business_industry",
  "registration_id_type",
  "registration_number_last4",
  "regions_of_operation",
  "rep_first_name",
  "rep_last_name",
  "rep_email",
  "rep_phone",
  "rep_business_title",
  "rep_job_position",
  "messaging_purpose",
  "sample_message_1",
  "sample_message_2",
  "opt_in_description",
  "privacy_policy_url",
  "terms_url",
  "submitted_at",
  "approved_at",
  "last_synced_at",
  "created_at",
  "updated_at",
].join(", ");

type Row = {
  venue_id: string;
  phase: string;
  attention_code: string | null;
  attention_message: string | null;
  attention_fix_hint: string | null;
  business_name: string | null;
  website_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_region: string | null;
  postal_code: string | null;
  country: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_confirmed_at: string | null;
  business_type: string | null;
  business_industry: string | null;
  registration_id_type: string | null;
  registration_number_last4: string | null;
  regions_of_operation: string | null;
  rep_first_name: string | null;
  rep_last_name: string | null;
  rep_email: string | null;
  rep_phone: string | null;
  rep_business_title: string | null;
  rep_job_position: string | null;
  messaging_purpose: string | null;
  sample_message_1: string | null;
  sample_message_2: string | null;
  opt_in_description: string | null;
  privacy_policy_url: string | null;
  terms_url: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapTextingRegistrationRow(row: Row): TextingRegistrationView {
  const phase: TextingPhase = isTextingPhase(row.phase) ? row.phase : "details_needed";
  return {
    venueId: row.venue_id,
    phase,
    attentionCode: row.attention_code,
    attentionMessage: row.attention_message,
    attentionFixHint: row.attention_fix_hint,
    businessName: row.business_name,
    websiteUrl: row.website_url,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    stateRegion: row.state_region,
    postalCode: row.postal_code,
    country: row.country,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    businessConfirmedAt: row.business_confirmed_at,
    businessType: row.business_type,
    businessIndustry: row.business_industry,
    registrationIdType: row.registration_id_type,
    hasRegistrationNumber: !!row.registration_number_last4,
    registrationNumberLast4: row.registration_number_last4,
    regionsOfOperation: row.regions_of_operation,
    repFirstName: row.rep_first_name,
    repLastName: row.rep_last_name,
    repEmail: row.rep_email,
    repPhone: row.rep_phone,
    repBusinessTitle: row.rep_business_title,
    repJobPosition: row.rep_job_position,
    messagingPurpose: row.messaging_purpose,
    sampleMessage1: row.sample_message_1,
    sampleMessage2: row.sample_message_2,
    optInDescription: row.opt_in_description,
    privacyPolicyUrl: row.privacy_policy_url,
    termsUrl: row.terms_url,
    submittedAt: row.submitted_at,
    approvedAt: row.approved_at,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getTextingRegistration(
  client: SupabaseClient,
  venueId: string,
): Promise<TextingRegistrationView | null> {
  const { data, error } = await client
    .from("venue_texting_registrations")
    .select(VIEW_COLUMNS)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    // Soft-fail when migration isn't applied yet — don't crash Settings.
    const msg = error.message ?? "";
    if (
      /does not exist|schema cache|Could not find the table|PGRST205|42P01/i.test(msg)
      || error.code === "PGRST205"
      || error.code === "42P01"
    ) {
      return null;
    }
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapTextingRegistrationRow(data as unknown as Row);
}

export type TextingRegistrationWrite = {
  phase: TextingPhase;
  attention_code?: string | null;
  attention_message?: string | null;
  attention_fix_hint?: string | null;
  business_name?: string | null;
  website_url?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  business_confirmed_at?: string | null;
  business_type?: string | null;
  business_industry?: string | null;
  registration_id_type?: string | null;
  registration_number_last4?: string | null;
  regions_of_operation?: string | null;
  rep_first_name?: string | null;
  rep_last_name?: string | null;
  rep_email?: string | null;
  rep_phone?: string | null;
  rep_business_title?: string | null;
  rep_job_position?: string | null;
  messaging_purpose?: string | null;
  sample_message_1?: string | null;
  sample_message_2?: string | null;
  opt_in_description?: string | null;
  privacy_policy_url?: string | null;
  terms_url?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  last_synced_at?: string | null;
  updated_at?: string;
};

export async function upsertTextingRegistration(
  client: SupabaseClient,
  venueId: string,
  patch: TextingRegistrationWrite,
): Promise<TextingRegistrationView> {
  const row = {
    venue_id: venueId,
    ...patch,
    updated_at: patch.updated_at ?? new Date().toISOString(),
  };
  const { data, error } = await client
    .from("venue_texting_registrations")
    .upsert(row, { onConflict: "venue_id" })
    .select(VIEW_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapTextingRegistrationRow(data as unknown as Row);
}

/**
 * Persist encrypted registration number via service role only.
 * Authenticated sessions cannot INSERT/UPDATE/SELECT ciphertext.
 */
export async function storeRegistrationNumberCiphertext(input: {
  venueId: string;
  ciphertext: string;
  last4: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("venue_texting_registrations")
    .update({
      registration_number_ciphertext: input.ciphertext,
      registration_number_last4: input.last4,
      updated_at: new Date().toISOString(),
    })
    .eq("venue_id", input.venueId);
  if (error) throw new Error(error.message);
}

/** Ciphertext for future provider submit — service-role only. Never pass to client. */
export async function getRegistrationNumberCiphertext(
  venueId: string,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venue_texting_registrations")
    .select("registration_number_ciphertext")
    .eq("venue_id", venueId)
    .maybeSingle<{ registration_number_ciphertext: string | null }>();
  if (error) throw new Error(error.message);
  return data?.registration_number_ciphertext ?? null;
}
