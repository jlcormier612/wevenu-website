/**
 * Persist inquiry-form communication preferences + first-party SMS permission.
 * Uses existing communication_permissions; does not change STOP/START rules.
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import {
  getCommunicationPermission,
  normalizeSmsAddressKey,
  upsertCommunicationPermission,
} from "@/lib/communication/permissions";
import {
  SMS_INQUIRY_CONSENT_LANGUAGE_VERSION,
  SMS_PERMISSION_SOURCE_INQUIRY_FORM,
  SMS_PERMISSION_SOURCE_TOUR_FORM,
  buildInquirySmsConsentText,
  parsePreferredCommunicationChannels,
  type PreferredCommunicationChannel,
} from "@/lib/communication/sms-consent";

/** Phone + explicit checkbox only. Preference of Text is not consent. */
export function shouldRecordInquirySmsConsent(
  smsPermissionGranted: boolean,
  phone: string | null | undefined,
): boolean {
  return smsPermissionGranted === true && !!phone?.trim();
}

/**
 * Prefer the submitted form phone; when the checkbox is checked but the form
 * phone is blank, use the lead's on-file phone (existing-lead tour links).
 */
export function resolveConsentPhone(
  formPhone: string | null | undefined,
  fallbackPhone: string | null | undefined,
): string {
  const fromForm = formPhone?.trim() ?? "";
  if (fromForm) return fromForm;
  return fallbackPhone?.trim() ?? "";
}

export type ApplyInquiryCommunicationCaptureResult =
  | { ok: true; consentRecorded: boolean }
  | { ok: false; consentRecorded: false; message: string };

export async function applyInquiryCommunicationCapture(input: {
  venueId: string;
  venueName: string;
  leadId: string;
  relationshipId: string | null;
  phone: string | null;
  /** Lead/on-file phone when the public form field was left blank. */
  fallbackPhone?: string | null;
  preferredChannels: unknown;
  smsPermissionGranted: boolean;
  embedKey?: string | null;
  /** Where the checkbox was shown — inquiry vs tour. */
  source?: typeof SMS_PERMISSION_SOURCE_INQUIRY_FORM | typeof SMS_PERMISSION_SOURCE_TOUR_FORM;
}): Promise<ApplyInquiryCommunicationCaptureResult> {
  const admin = createAdminClient();
  const prefs = parsePreferredCommunicationChannels(input.preferredChannels);

  {
    const { error: prefsError } = await admin
      .from("leads")
      .update({ preferred_communication_channels: prefs })
      .eq("id", input.leadId)
      .eq("venue_id", input.venueId);
    if (prefsError && process.env.NODE_ENV === "development") {
      console.warn("[applyInquiryCommunicationCapture] prefs update skipped:", prefsError.message);
    }
  }

  const phone = resolveConsentPhone(input.phone, input.fallbackPhone);
  if (!shouldRecordInquirySmsConsent(input.smsPermissionGranted, phone)) {
    if (input.smsPermissionGranted === true) {
      return {
        ok: false,
        consentRecorded: false,
        message: "SMS consent was selected but no usable phone number was available to record it.",
      };
    }
    return { ok: true, consentRecorded: false };
  }

  const addressKey = normalizeSmsAddressKey(phone);
  if (!addressKey) {
    return {
      ok: false,
      consentRecorded: false,
      message: "SMS consent was selected but the phone number is not valid for texting.",
    };
  }

  const current = await getCommunicationPermission(admin, {
    venueId: input.venueId,
    channel: "sms",
    addressKey,
  });
  // Never clear a provider block via a form checkbox.
  if (current === "provider_blocked") {
    return {
      ok: false,
      consentRecorded: false,
      message: "SMS consent could not be recorded because texting is blocked for this number.",
    };
  }

  const consentText = buildInquirySmsConsentText(input.venueName);
  const upsert = await upsertCommunicationPermission(admin, {
    venueId: input.venueId,
    channel: "sms",
    rawAddress: phone,
    status: "opted_in",
    source: input.source ?? SMS_PERMISSION_SOURCE_INQUIRY_FORM,
    consentText,
    relationshipId: input.relationshipId,
    evidence: {
      languageVersion: SMS_INQUIRY_CONSENT_LANGUAGE_VERSION,
      venueName: input.venueName,
      leadId: input.leadId,
      relationshipId: input.relationshipId,
      embedKey: input.embedKey ?? null,
      preferredChannels: prefs,
      capturedAt: new Date().toISOString(),
    },
  });

  if (!upsert.ok) {
    return {
      ok: false,
      consentRecorded: false,
      message: upsert.message ?? "Could not save SMS consent.",
    };
  }

  return { ok: true, consentRecorded: true };
}

export function preferredChannelsFromBody(raw: unknown): PreferredCommunicationChannel[] {
  return parsePreferredCommunicationChannels(raw);
}
