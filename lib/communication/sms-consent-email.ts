/**
 * Email-based SMS consent request for manually added leads.
 *
 * Architecture basis (not a legal opinion):
 * - HTC already sends relationship emails without an email opt-in gate
 *   (assertChannelAllowed hard-blocks only for email).
 * - SMS consent is NEVER granted by sending or opening this email.
 * - Consent is recorded only after the recipient actively opts in on the
 *   public token page → communication_permissions (source email_sms_consent).
 * - Same SoT as inquiry checkbox / START — no second consent system.
 * - Trust email-boundary (promotional vs transactional) remains a separate
 *   OPEN; this flow is a relationship preference request with affirmative
 *   first-party capture, matching inquiry_form / tour_form patterns.
 */

import { createHash, randomBytes } from "crypto";

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured, publicAppOrigin } from "@/lib/env";
import {
  getCommunicationPermission,
  isHardBlocked,
  normalizeEmailAddressKey,
  normalizeSmsAddressKey,
  upsertCommunicationPermission,
} from "@/lib/communication/permissions";
import {
  SMS_EMAIL_CONSENT_LANGUAGE_VERSION,
  SMS_PERMISSION_SOURCE_EMAIL_CONSENT,
  SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST,
} from "@/lib/communication/sms-consent";
import { sendEmail, isEmailConfigured } from "@/lib/email/send";
import { getLead } from "@/lib/leads/service";
import { isSmsConfigured } from "@/lib/sms/send";
import { toE164 } from "@/lib/sms/phone";
import { getCurrentVenue } from "@/lib/venue/service";

const TOKEN_TTL_HOURS = 72;

export type RequestSmsConsentEmailResult =
  | { ok: true; expiresAt: string }
  | { ok: false; message: string };

export type RedeemSmsConsentEmailResult =
  | { ok: true; venueName: string }
  | { ok: false; message: string; code?: "expired" | "used" | "invalid" | "blocked" };

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function buildSmsConsentEmailBodies(input: {
  venueName: string;
  firstName: string;
  consentUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${input.venueName} — text message permission request`;
  const text = [
    `Hi ${input.firstName},`,
    "",
    `${input.venueName} is asking whether you would like to receive text messages from them about your event.`,
    "",
    "You are not opted in yet. Texts will only be sent if you choose to allow them.",
    "",
    `To opt in, open this link and confirm:`,
    input.consentUrl,
    "",
    "If you did not expect this, you can ignore this email — nothing will change.",
    "",
    `— ${input.venueName}`,
  ].join("\n");

  const html = [
    `<p>Hi ${escapeHtml(input.firstName)},</p>`,
    `<p><strong>${escapeHtml(input.venueName)}</strong> is asking whether you would like to receive text messages from them about your event.</p>`,
    `<p>You are <strong>not opted in yet</strong>. Texts will only be sent if you choose to allow them.</p>`,
    `<p><a href="${escapeHtml(input.consentUrl)}" style="display:inline-block;padding:12px 20px;background:#5D6F5D;color:#fff;text-decoration:none;border-radius:6px">Review text permission</a></p>`,
    `<p style="font-size:12px;color:#666">If you did not expect this, you can ignore this email — nothing will change.</p>`,
    `<p>— ${escapeHtml(input.venueName)}</p>`,
  ].join("\n");

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function requestSmsConsentEmailForLead(
  leadId: string,
): Promise<RequestSmsConsentEmailResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (!isEmailConfigured()) {
    return { ok: false, message: "Email sending isn't configured for this environment." };
  }

  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found. Complete setup first." };

  const textingReady = await isSmsConfigured(venue.id);
  if (!textingReady) {
    return {
      ok: false,
      message: "Texting isn't set up for this venue yet, so a text-permission request can't be sent.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired. Please sign in again." };

  const lead = await getLead(leadId);
  if (!lead || lead.venueId !== venue.id) {
    return { ok: false, message: "Lead not found." };
  }

  const email = lead.email?.trim() ?? "";
  const emailKey = normalizeEmailAddressKey(email);
  if (!emailKey) {
    return { ok: false, message: "Add an email address before requesting text permission by email." };
  }

  const phone = lead.phone?.trim() ?? "";
  const e164 = toE164(phone);
  const addressKey = e164 ? normalizeSmsAddressKey(e164) : null;
  if (!e164 || !addressKey) {
    return { ok: false, message: "Add a valid phone number before requesting text permission." };
  }

  const admin = createAdminClient();
  const current = await getCommunicationPermission(admin, {
    venueId: venue.id,
    channel: "sms",
    addressKey,
  });
  if (isHardBlocked(current)) {
    return {
      ok: false,
      message:
        current === "opted_out"
          ? "This contact has opted out of text messages."
          : "Texting isn't available for this contact — delivery was blocked for this number.",
    };
  }
  if (current === "opted_in") {
    return {
      ok: false,
      message: "This contact already has texting permission. You can message them from Conversation.",
    };
  }

  const emailStatus = await getCommunicationPermission(admin, {
    venueId: venue.id,
    channel: "email",
    addressKey: emailKey,
  });
  if (isHardBlocked(emailStatus)) {
    return {
      ok: false,
      message:
        emailStatus === "opted_out"
          ? "This email address is unsubscribed — a permission request can't be emailed."
          : "This email address previously bounced — a permission request can't be emailed.",
    };
  }

  // Revoke unused prior tokens for this lead (idempotent re-request).
  await admin
    .from("sms_consent_email_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("venue_id", venue.id)
    .eq("lead_id", leadId)
    .is("used_at", null)
    .is("revoked_at", null);

  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { error: insertErr } = await admin.from("sms_consent_email_tokens").insert({
    venue_id: venue.id,
    lead_id: leadId,
    relationship_id: lead.relationshipId ?? null,
    token_hash: hashToken(rawToken),
    email_address: emailKey,
    phone_e164: e164,
    expires_at: expiresAt,
    created_by: user.id,
  });
  if (insertErr) {
    return { ok: false, message: insertErr.message || "Could not create the permission request." };
  }

  const consentUrl = `${publicAppOrigin()}/sms-consent/${rawToken}`;
  const bodies = buildSmsConsentEmailBodies({
    venueName: venue.name,
    firstName: lead.firstName || "there",
    consentUrl,
  });

  const sent = await sendEmail({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html,
    replyTo: venue.email ?? undefined,
  });
  if (!sent.ok) {
    await admin
      .from("sms_consent_email_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(rawToken));
    return { ok: false, message: sent.message || "Could not send the email." };
  }

  // Evidence only — does NOT grant opted_in. Ordinary SMS stays blocked.
  await upsertCommunicationPermission(admin, {
    venueId: venue.id,
    channel: "sms",
    rawAddress: e164,
    status: "not_opted_in",
    source: SMS_PERMISSION_SOURCE_EMAIL_CONSENT_REQUEST,
    relationshipId: lead.relationshipId ?? null,
    evidence: {
      language_version: SMS_EMAIL_CONSENT_LANGUAGE_VERSION,
      requested_at: new Date().toISOString(),
      email_address: emailKey,
      expires_at: expiresAt,
    },
  });

  return { ok: true, expiresAt };
}

export async function getSmsConsentEmailTokenPreview(rawToken: string): Promise<{
  ok: true;
  venueName: string;
  alreadyUsed: boolean;
  expired: boolean;
} | { ok: false; message: string }> {
  if (!isSupabaseConfigured || !rawToken.trim()) {
    return { ok: false, message: "This link is invalid." };
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("sms_consent_email_tokens")
    .select("expires_at, used_at, revoked_at, venue_id, venues(name)")
    .eq("token_hash", hashToken(rawToken.trim()))
    .maybeSingle();
  if (!data || data.revoked_at) return { ok: false, message: "This link is invalid or no longer available." };
  const venueName =
    (data.venues as { name?: string } | null)?.name?.trim() || "Your venue";
  return {
    ok: true,
    venueName,
    alreadyUsed: Boolean(data.used_at),
    expired: new Date(data.expires_at).getTime() < Date.now(),
  };
}

export async function redeemSmsConsentEmailToken(
  rawToken: string,
  optedIn: boolean,
): Promise<RedeemSmsConsentEmailResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured.", code: "invalid" };
  if (!optedIn) {
    return { ok: false, message: "Confirm that you want to receive text messages to continue." };
  }

  const admin = createAdminClient();
  const tokenHash = hashToken(rawToken.trim());
  const { data: row } = await admin
    .from("sms_consent_email_tokens")
    .select("id, venue_id, lead_id, relationship_id, phone_e164, email_address, expires_at, used_at, revoked_at, venues(name)")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!row || row.revoked_at) {
    return { ok: false, message: "This link is invalid or no longer available.", code: "invalid" };
  }
  if (row.used_at) {
    return { ok: false, message: "This permission request was already completed.", code: "used" };
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { ok: false, message: "This permission request has expired.", code: "expired" };
  }

  const venueName =
    (row.venues as { name?: string } | null)?.name?.trim() || "Your venue";
  const addressKey = normalizeSmsAddressKey(row.phone_e164);
  if (!addressKey) {
    return { ok: false, message: "This permission request is invalid.", code: "invalid" };
  }

  const current = await getCommunicationPermission(admin, {
    venueId: row.venue_id,
    channel: "sms",
    addressKey,
  });
  if (isHardBlocked(current)) {
    return {
      ok: false,
      message:
        current === "opted_out"
          ? "This number has opted out of text messages."
          : "Texting isn't available for this number.",
      code: "blocked",
    };
  }

  const consentText =
    `Yes, I'd like to receive text messages from ${venueName} about my inquiry, tour, or event. ` +
    `Message and data rates may apply. Reply STOP to opt out.`;

  const saved = await upsertCommunicationPermission(admin, {
    venueId: row.venue_id,
    channel: "sms",
    rawAddress: row.phone_e164,
    status: "opted_in",
    source: SMS_PERMISSION_SOURCE_EMAIL_CONSENT,
    consentText,
    relationshipId: row.relationship_id,
    evidence: {
      language_version: SMS_EMAIL_CONSENT_LANGUAGE_VERSION,
      token_id: row.id,
      lead_id: row.lead_id,
      email_address: row.email_address,
      captured_at: new Date().toISOString(),
    },
  });
  if (!saved.ok) {
    return { ok: false, message: saved.message || "Could not save your preference." };
  }

  const { error: useErr } = await admin
    .from("sms_consent_email_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("used_at", null);
  if (useErr) {
    // Permission already written — treat as success (idempotent).
    console.error("[sms-consent-email] mark used failed", useErr.message);
  }

  return { ok: true, venueName };
}
