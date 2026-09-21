/**
 * Persist / load venue_twilio_accounts rows for self-service provisioning.
 * Credentials never land here — Secrets Manager only.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import type { VenueTwilioAccount, VenueTwilioAccountStatus } from "@/lib/sms/venue-twilio-config";
import { assertNotProtectedTwilioSid } from "@/lib/sms/twilio-protected-resources";

export type VenueTwilioAccountWrite = {
  venueId: string;
  twilioAccountSid?: string | null;
  messagingServiceSid?: string | null;
  defaultFromE164?: string | null;
  phoneNumberSid?: string | null;
  secondaryProfileSid?: string | null;
  a2pTrustProductSid?: string | null;
  a2pBrandSid?: string | null;
  a2pCampaignSid?: string | null;
  a2pBrandStatus?: string | null;
  a2pCampaignStatus?: string | null;
  phoneA2pStatus?: string | null;
  complianceSubmittedAt?: string | null;
  provisioningGeneration?: number;
  status?: VenueTwilioAccountStatus;
  statusDetail?: string | null;
};

type Row = {
  venue_id: string;
  twilio_account_sid: string;
  messaging_service_sid: string | null;
  default_from_e164: string | null;
  phone_number_sid: string | null;
  secondary_profile_sid: string | null;
  a2p_trust_product_sid: string | null;
  a2p_brand_sid: string | null;
  a2p_campaign_sid: string | null;
  a2p_brand_status: string | null;
  a2p_campaign_status: string | null;
  phone_a2p_status: string | null;
  compliance_submitted_at: string | null;
  provisioning_generation: number;
  status: VenueTwilioAccountStatus;
  status_detail: string | null;
};

const SELECT_COLS = [
  "venue_id",
  "twilio_account_sid",
  "messaging_service_sid",
  "default_from_e164",
  "phone_number_sid",
  "secondary_profile_sid",
  "a2p_trust_product_sid",
  "a2p_brand_sid",
  "a2p_campaign_sid",
  "a2p_brand_status",
  "a2p_campaign_status",
  "phone_a2p_status",
  "compliance_submitted_at",
  "provisioning_generation",
  "status",
  "status_detail",
].join(", ");

export type VenueTwilioAccountExtended = VenueTwilioAccount & {
  a2pTrustProductSid: string | null;
  a2pBrandStatus: string | null;
  a2pCampaignStatus: string | null;
  phoneA2pStatus: string | null;
  complianceSubmittedAt: string | null;
  provisioningGeneration: number;
};

function mapRow(row: Row): VenueTwilioAccountExtended {
  return {
    venueId: row.venue_id,
    twilioAccountSid: row.twilio_account_sid,
    messagingServiceSid: row.messaging_service_sid ?? "",
    defaultFromE164: row.default_from_e164,
    phoneNumberSid: row.phone_number_sid,
    secondaryProfileSid: row.secondary_profile_sid,
    a2pBrandSid: row.a2p_brand_sid,
    a2pCampaignSid: row.a2p_campaign_sid,
    status: row.status,
    statusDetail: row.status_detail,
    a2pTrustProductSid: row.a2p_trust_product_sid,
    a2pBrandStatus: row.a2p_brand_status,
    a2pCampaignStatus: row.a2p_campaign_status,
    phoneA2pStatus: row.phone_a2p_status,
    complianceSubmittedAt: row.compliance_submitted_at,
    provisioningGeneration: row.provisioning_generation ?? 1,
  };
}

function guardSids(patch: VenueTwilioAccountWrite, owningAccountSid: string): void {
  for (const sid of [
    patch.twilioAccountSid,
    patch.messagingServiceSid,
    patch.phoneNumberSid,
    patch.secondaryProfileSid,
    patch.a2pTrustProductSid,
    patch.a2pBrandSid,
    patch.a2pCampaignSid,
  ]) {
    assertNotProtectedTwilioSid(sid, "venue_twilio_accounts write", {
      owningAccountSid,
    });
  }
}

export async function getVenueTwilioAccountExtended(
  venueId: string,
): Promise<VenueTwilioAccountExtended | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venue_twilio_accounts")
    .select(SELECT_COLS)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (error) {
    const msg = error.message ?? "";
    if (/does not exist|schema cache|PGRST205|42P01/i.test(msg)) return null;
    throw new Error(error.message);
  }
  return data ? mapRow(data as unknown as Row) : null;
}

export async function upsertVenueTwilioAccount(
  patch: VenueTwilioAccountWrite,
): Promise<VenueTwilioAccountExtended> {
  if (!patch.twilioAccountSid?.trim() && !patch.venueId) {
    throw new Error("venue Twilio account upsert requires venueId.");
  }

  const existing = await getVenueTwilioAccountExtended(patch.venueId);
  const admin = createAdminClient();
  const row: Record<string, unknown> = {
    venue_id: patch.venueId,
    updated_at: new Date().toISOString(),
  };

  const accountSid = patch.twilioAccountSid ?? existing?.twilioAccountSid;
  if (!accountSid?.trim()) {
    throw new Error("twilio_account_sid is required to persist venue Twilio account.");
  }
  assertNotProtectedTwilioSid(accountSid, "upsertVenueTwilioAccount");
  guardSids(patch, accountSid);
  row.twilio_account_sid = accountSid;

  if (patch.messagingServiceSid !== undefined) {
    row.messaging_service_sid = patch.messagingServiceSid;
  } else if (!existing) {
    row.messaging_service_sid = null;
  }

  if (patch.defaultFromE164 !== undefined) row.default_from_e164 = patch.defaultFromE164;
  if (patch.phoneNumberSid !== undefined) row.phone_number_sid = patch.phoneNumberSid;
  if (patch.secondaryProfileSid !== undefined) row.secondary_profile_sid = patch.secondaryProfileSid;
  if (patch.a2pTrustProductSid !== undefined) row.a2p_trust_product_sid = patch.a2pTrustProductSid;
  if (patch.a2pBrandSid !== undefined) row.a2p_brand_sid = patch.a2pBrandSid;
  if (patch.a2pCampaignSid !== undefined) row.a2p_campaign_sid = patch.a2pCampaignSid;
  if (patch.a2pBrandStatus !== undefined) row.a2p_brand_status = patch.a2pBrandStatus;
  if (patch.a2pCampaignStatus !== undefined) row.a2p_campaign_status = patch.a2pCampaignStatus;
  if (patch.phoneA2pStatus !== undefined) row.phone_a2p_status = patch.phoneA2pStatus;
  if (patch.complianceSubmittedAt !== undefined) {
    row.compliance_submitted_at = patch.complianceSubmittedAt;
  }
  if (patch.provisioningGeneration !== undefined) {
    row.provisioning_generation = patch.provisioningGeneration;
  }
  if (patch.status !== undefined) row.status = patch.status;
  else if (!existing) row.status = "provisioning";
  if (patch.statusDetail !== undefined) row.status_detail = patch.statusDetail;

  const { data, error } = await admin
    .from("venue_twilio_accounts")
    .upsert(row, { onConflict: "venue_id" })
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as unknown as Row);
}
