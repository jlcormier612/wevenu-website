/**
 * Venue-initiated SMS consent request for contacts who are not_opted_in.
 *
 * Uses the existing communication_permissions + START keyword model.
 * Sending this message does NOT grant opted_in — the contact must reply START.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  getCommunicationPermission,
  isHardBlocked,
  normalizeSmsAddressKey,
  upsertCommunicationPermission,
} from "@/lib/communication/permissions";
import {
  SMS_CONSENT_REQUEST_LANGUAGE_VERSION,
  SMS_PERMISSION_SOURCE_CONSENT_REQUEST,
  buildSmsConsentRequestText,
} from "@/lib/communication/sms-consent";
import { getLead } from "@/lib/leads/service";
import { isSmsConfigured, sendSms } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { getCurrentVenue } from "@/lib/venue/service";

export type RequestSmsConsentResult =
  | { ok: true; providerId: string; pending: true }
  | { ok: false; message: string };

export async function requestSmsConsentForLead(leadId: string): Promise<RequestSmsConsentResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, message: "Backend not configured." };
  }
  const venue = await getCurrentVenue();
  if (!venue) {
    return { ok: false, message: "No venue found. Complete setup first." };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Session expired. Please sign in again." };
  }

  const lead = await getLead(leadId);
  if (!lead || lead.venueId !== venue.id) {
    return { ok: false, message: "Lead not found." };
  }

  const phone = lead.phone?.trim() ?? "";
  if (!phone) {
    return { ok: false, message: "Add a phone number before requesting text permission." };
  }
  const e164 = toE164(phone);
  if (!e164) {
    return { ok: false, message: "This phone number isn't valid for texting." };
  }

  const addressKey = normalizeSmsAddressKey(e164);
  if (!addressKey) {
    return { ok: false, message: "This phone number isn't valid for texting." };
  }

  const current = await getCommunicationPermission(supabase, {
    venueId: venue.id,
    channel: "sms",
    addressKey,
  });
  if (current === "opted_in") {
    return {
      ok: false,
      message: "This contact already has texting permission. You can message them from Conversation.",
    };
  }
  if (isHardBlocked(current)) {
    return {
      ok: false,
      message:
        current === "opted_out"
          ? "This contact has opted out of texts. They must reply START themselves before you can text them."
          : "Texting isn't available for this number — delivery was blocked.",
    };
  }

  if (!(await isSmsConfigured(venue.id))) {
    return {
      ok: false,
      message: "Texting isn’t set up yet for your venue. Enable it in Settings → Communications.",
    };
  }

  const requestText = buildSmsConsentRequestText(venue.name);
  const sendResult = await sendSms({
    to: e164,
    body: requestText,
    venueId: venue.id,
    purpose: "sms_consent_request",
  });
  if (!sendResult.ok) {
    return { ok: false, message: sendResult.message };
  }

  const requestedAt = new Date().toISOString();
  const upsert = await upsertCommunicationPermission(supabase, {
    venueId: venue.id,
    channel: "sms",
    rawAddress: e164,
    status: "not_opted_in",
    source: SMS_PERMISSION_SOURCE_CONSENT_REQUEST,
    consentText: null,
    relationshipId: lead.relationshipId ?? null,
    evidence: {
      languageVersion: SMS_CONSENT_REQUEST_LANGUAGE_VERSION,
      requestText,
      requestedAt,
      leadId: lead.id,
      relationshipId: lead.relationshipId ?? null,
      providerId: sendResult.providerId,
      providerAccountSid: sendResult.providerAccountSid,
      sandboxRedirectedFrom: sendResult.sandboxRedirectedFrom ?? null,
      requestedByUserId: user.id,
    },
  });
  if (!upsert.ok) {
    return {
      ok: false,
      message: upsert.message ?? "Permission request was sent, but the pending record could not be saved.",
    };
  }

  return { ok: true, providerId: sendResult.providerId, pending: true };
}
