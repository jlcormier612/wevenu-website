/**
 * Tour customer emails — platform system transactional copy.
 *
 * Lifecycle:
 *   scheduled  →  (client or staff confirms)  →  confirmed
 *
 * Three sends, one semantic rule:
 *   1. Schedule / book / reschedule (status stays scheduled)
 *      → scheduled-language email with Confirm my tour CTA
 *   2. Explicit "Send Confirmation Request" (status stays scheduled)
 *      → please-confirm email with Confirm my tour CTA
 *   3. Actual confirmation (status becomes confirmed)
 *      → confirmed-language email with Add to Calendar CTA
 *
 * Never claim "confirmed" while status is still scheduled.
 *
 * All three go through sendEmail() + conversation_messages (system),
 * with venue primaryColor branding — same TR-M7 admin-client pattern.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  brandButtonHtml,
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
  type EmailVenueBrand,
} from "@/lib/email/venue-brand";
import { publicAppOrigin } from "@/lib/env";
import { findOrCreateVenueCoupleConversation } from "@/lib/conversations/venue-couple-conversation";
import { formatVenueLocalTourDisplay } from "@/lib/venue/timezone";
import type { TourCustomerSendPreview } from "@/lib/tours/types";

type AdminClient = ReturnType<typeof createAdminClient>;

export type TourScheduledParams = {
  venueId: string;
  leadId: string;
  relationshipId: string | null;
  contactEmail: string | null;
  contactName: string | null;
  venueName: string;
  primaryColor?: string | null;
  brand?: EmailVenueBrand;
  scheduledAt: string;
  durationMinutes: number;
  /** tour_appointments.confirm_token — Confirm my tour CTA credential. */
  confirmToken: string;
  timezone?: string | null;
};

export type TourConfirmationParams = {
  venueId: string;
  leadId: string;
  relationshipId: string | null;
  contactEmail: string | null;
  contactName: string | null;
  venueName: string;
  /** Venue Brand Experience Phase 1 — falls back to Hello to Cheers' own default if the caller doesn't have it handy. */
  primaryColor?: string | null;
  brand?: EmailVenueBrand;
  scheduledAt: string;
  durationMinutes: number;
  /** IANA zone for the printed date/time. Defaults to Eastern if omitted. */
  timezone?: string | null;
};

export type TourConfirmationRequestParams = {
  venueId: string;
  relationshipId: string | null;
  contactEmail: string | null;
  contactName: string | null;
  venueName: string;
  primaryColor?: string | null;
  brand?: EmailVenueBrand;
  scheduledAt: string;
  durationMinutes: number;
  /** tour_appointments.confirm_token — the public confirm link's only credential. */
  confirmToken: string;
  timezone?: string | null;
};

function resolveTourEmailBrand(params: {
  venueName: string;
  primaryColor?: string | null;
  brand?: EmailVenueBrand;
}): EmailVenueBrand {
  return params.brand ?? emailBrandFromVenue({
    name: params.venueName,
    primaryColor: params.primaryColor,
  });
}

function formatTourWhen(scheduledAt: string, timezone?: string | null): { dateStr: string; timeStr: string } {
  const { dateLabel, timeLabel } = formatVenueLocalTourDisplay(scheduledAt, timezone ?? null);
  return { dateStr: dateLabel, timeStr: timeLabel };
}

function confirmUrlForToken(confirmToken: string): string {
  return `${publicAppOrigin()}/confirm/${confirmToken}`;
}

function googleCalendarUrl(params: {
  scheduledAt: string;
  durationMinutes: number;
  venueName: string;
}): string {
  const tourDate = new Date(params.scheduledAt);
  const dtStart = tourDate.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const dtEnd = new Date(tourDate.getTime() + params.durationMinutes * 60000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Tour at ${params.venueName}`)}&dates=${dtStart}/${dtEnd}&details=${encodeURIComponent(`Your ${params.durationMinutes}-minute venue tour at ${params.venueName}.`)}`;
}

/** Initial / reschedule email — status is still scheduled. */
function buildScheduledContent(params: TourScheduledParams): { subject: string; text: string; html: string } {
  const { dateStr, timeStr } = formatTourWhen(params.scheduledAt, params.timezone);
  const name = params.contactName?.split(/[\s&]+/)[0] ?? "there";
  const confirmUrl = confirmUrlForToken(params.confirmToken);

  const text = [
    `Hi ${name},`,
    "",
    `You're scheduled for a ${params.durationMinutes}-minute tour at ${params.venueName}.`,
    "",
    `📅 ${dateStr}`,
    `🕐 ${timeStr}`,
    `📍 ${params.venueName}`,
    "",
    `Confirm your tour: ${confirmUrl}`,
    "",
    "If you need to reschedule or have questions, just reply to this email.",
  ].join("\n");

  const brand = resolveTourEmailBrand(params);
  const venueHtml = escapeHtml(params.venueName);
  const inner = [
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>You're scheduled for a <strong>${params.durationMinutes}-minute tour</strong> at <strong>${venueHtml}</strong>.</p>`,
    `<table style="border:1px solid #E5E0D9;border-radius:12px;padding:16px 20px;margin:16px 0;border-spacing:0">`,
    `  <tr><td style="padding:4px 0;font-size:14px">📅 <strong>${escapeHtml(dateStr)}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">🕐 <strong>${escapeHtml(timeStr)}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">📍 ${venueHtml}</td></tr>`,
    `</table>`,
    `<p style="margin-top:16px">${brandButtonHtml(brand, confirmUrl, "Confirm my tour")}</p>`,
    `<p style="color:#888;font-size:13px;margin-top:24px">If you need to reschedule, just reply to this email.</p>`,
  ].join("\n");

  return {
    subject: `Your tour is scheduled — ${dateStr} at ${params.venueName}`,
    text,
    html: renderBrandedEmailHtml(brand, inner),
  };
}

/** Post-confirmation email — only after status becomes confirmed. */
function buildConfirmationContent(params: TourConfirmationParams): { subject: string; text: string; html: string } {
  const { dateStr, timeStr } = formatTourWhen(params.scheduledAt, params.timezone);
  const name = params.contactName?.split(/[\s&]+/)[0] ?? "there";
  const gcalUrl = googleCalendarUrl(params);

  const text = [
    `Hi ${name},`,
    "",
    `Your ${params.durationMinutes}-minute tour at ${params.venueName} is confirmed.`,
    "",
    `📅 ${dateStr}`,
    `🕐 ${timeStr}`,
    `📍 ${params.venueName}`,
    "",
    "We're looking forward to meeting you!",
    "",
    `Add to Google Calendar: ${gcalUrl}`,
    "",
    "If you need to reschedule or have questions, just reply to this email.",
  ].join("\n");

  const brand = resolveTourEmailBrand(params);
  const venueHtml = escapeHtml(params.venueName);
  const inner = [
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>Your <strong>${params.durationMinutes}-minute tour</strong> at <strong>${venueHtml}</strong> is confirmed.</p>`,
    `<table style="border:1px solid #E5E0D9;border-radius:12px;padding:16px 20px;margin:16px 0;border-spacing:0">`,
    `  <tr><td style="padding:4px 0;font-size:14px">📅 <strong>${escapeHtml(dateStr)}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">🕐 <strong>${escapeHtml(timeStr)}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">📍 ${venueHtml}</td></tr>`,
    `</table>`,
    `<p style="margin-top:16px">${brandButtonHtml(brand, gcalUrl, "Add to Calendar")}</p>`,
    `<p style="color:#888;font-size:13px;margin-top:24px">We're looking forward to meeting you! If you need to reschedule, just reply to this email.</p>`,
  ].join("\n");

  return {
    subject: `Tour confirmed — ${dateStr} at ${params.venueName}`,
    text,
    html: renderBrandedEmailHtml(brand, inner),
  };
}

function buildConfirmationRequestContent(params: TourConfirmationRequestParams): { subject: string; text: string; html: string } {
  const { dateStr, timeStr } = formatTourWhen(params.scheduledAt, params.timezone);
  const name = params.contactName?.split(/[\s&]+/)[0] ?? "there";
  const confirmUrl = confirmUrlForToken(params.confirmToken);

  const text = [
    `Hi ${name},`,
    "",
    `Please confirm your upcoming ${params.durationMinutes}-minute tour at ${params.venueName}:`,
    "",
    `📅 ${dateStr}`,
    `🕐 ${timeStr}`,
    `📍 ${params.venueName}`,
    "",
    `Confirm your tour: ${confirmUrl}`,
    "",
    "If you need to reschedule or have questions, just reply to this email.",
  ].join("\n");

  const brand = resolveTourEmailBrand(params);
  const venueHtml = escapeHtml(params.venueName);
  const inner = [
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p>Please confirm your upcoming <strong>${params.durationMinutes}-minute tour</strong> at <strong>${venueHtml}</strong>.</p>`,
    `<table style="border:1px solid #E5E0D9;border-radius:12px;padding:16px 20px;margin:16px 0;border-spacing:0">`,
    `  <tr><td style="padding:4px 0;font-size:14px">📅 <strong>${escapeHtml(dateStr)}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">🕐 <strong>${escapeHtml(timeStr)}</strong></td></tr>`,
    `  <tr><td style="padding:4px 0;font-size:14px">📍 ${venueHtml}</td></tr>`,
    `</table>`,
    `<p style="margin-top:16px">${brandButtonHtml(brand, confirmUrl, "Confirm my tour")}</p>`,
    `<p style="color:#888;font-size:13px;margin-top:24px">If you need to reschedule, just reply to this email.</p>`,
  ].join("\n");

  return {
    subject: `Please confirm your tour — ${dateStr} at ${params.venueName}`,
    text,
    html: renderBrandedEmailHtml(brand, inner),
  };
}

export function previewTourScheduled(
  params: TourScheduledParams,
  kind: "schedule" | "reschedule" = "schedule",
): TourCustomerSendPreview {
  const content = buildScheduledContent(params);
  return {
    who: params.contactEmail,
    channel: "Email",
    subject: content.subject,
    body: content.text,
    html: content.html,
    why: kind === "reschedule" ? "This shares the new scheduled tour time and asks the client to confirm." : "This shares the scheduled tour time and asks the client to confirm.",
    recipientAction: "The client can confirm from the secure link in the email, or reply to reschedule.",
    htcAfterward: kind === "reschedule"
      ? "The tour time changes and this updated scheduled email is added to the conversation. The tour stays Scheduled until the client confirms it or you mark it confirmed."
      : "The tour is saved on this lead and this email is added to the conversation. The tour stays Scheduled until the client confirms it or you mark it confirmed.",
  };
}

/** Preview of the post-confirmation (Add to Calendar) email. */
export function previewTourConfirmation(params: TourConfirmationParams): TourCustomerSendPreview {
  const content = buildConfirmationContent(params);
  return {
    who: params.contactEmail,
    channel: "Email",
    subject: content.subject,
    body: content.text,
    html: content.html,
    why: "This confirms the tour after the client or staff confirms it.",
    recipientAction: "The client can add the tour to their calendar, or reply to this email to reschedule.",
    htcAfterward: "The tour is Confirmed and this confirmation email is added to the conversation.",
  };
}

/** Same content builder the confirmation-request send uses. */
export function previewTourConfirmationRequest(params: TourConfirmationRequestParams): TourCustomerSendPreview {
  const content = buildConfirmationRequestContent(params);
  return {
    who: params.contactEmail,
    channel: "Email",
    subject: content.subject,
    body: content.text,
    html: content.html,
    why: "This asks the client to confirm the upcoming tour.",
    recipientAction: "The client can confirm from the secure link in the email.",
    htcAfterward: "Sending this does not change the tour status. When the client confirms, the tour becomes Confirmed, and this email is added to the conversation.",
  };
}

async function findOrCreateConversation(client: AdminClient, venueId: string, relationshipId: string): Promise<string | null> {
  return findOrCreateVenueCoupleConversation(client, venueId, relationshipId);
}

export type TourEmailSendResult = { ok: true } | { ok: false; message: string };

async function deliverTourSystemEmail(opts: {
  venueId: string;
  relationshipId: string | null;
  contactEmail: string;
  subject: string;
  text: string;
  html: string;
  missingEmailMessage: string;
  failedMessage: string;
}): Promise<TourEmailSendResult> {
  const supabase = createAdminClient();

  let conversationId: string | null = null;
  if (opts.relationshipId) {
    conversationId = await findOrCreateConversation(supabase, opts.venueId, opts.relationshipId);
  }

  const emailResult = await sendEmail({
    to: opts.contactEmail,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    threadId: conversationId ?? undefined,
  });
  const providerId = emailResult.ok && emailResult.method === "resend" ? emailResult.providerId : undefined;
  // A "mailto" fallback opens the *user's* mail client — meaningless in
  // this fully automated, backend-only send with nobody there to click
  // it, so it must not be reported as delivered. Same distinction already
  // established in lib/messaging/service.ts's Phase 3 fix: never claim
  // "accepted" for a send nothing actually attempted.
  const status = emailResult.ok && (emailResult.method === "resend" || emailResult.method === "disabled") ? "accepted" : "failed";
  const failureReason = !emailResult.ok ? emailResult.message
    : emailResult.method === "mailto" ? "Email isn't fully configured for this venue yet."
    : null;

  if (conversationId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("conversation_messages") as any).insert({
      conversation_id: conversationId,
      venue_id: opts.venueId,
      sender_type: "system",
      channel: "email",
      body: opts.text,
      body_html: opts.html,
      provider_id: providerId ?? null,
      status,
      failure_reason: failureReason,
    });
  }

  if (status !== "accepted") {
    return { ok: false, message: failureReason ?? opts.failedMessage };
  }
  return { ok: true };
}

/**
 * Fire-and-forget at most call sites — a failed scheduled send must never
 * fail the scheduling action itself.
 */
export async function sendTourScheduled(params: TourScheduledParams): Promise<TourEmailSendResult> {
  if (!params.contactEmail) {
    return { ok: false, message: "This lead has no email address, so no confirmation email was sent." };
  }
  const { subject, text, html } = buildScheduledContent(params);
  return deliverTourSystemEmail({
    venueId: params.venueId,
    relationshipId: params.relationshipId,
    contactEmail: params.contactEmail,
    subject,
    text,
    html,
    missingEmailMessage: "This lead has no email address, so no confirmation email was sent.",
    failedMessage: "The scheduled tour email was not sent.",
  });
}

/**
 * Post-confirmation email — only after status becomes confirmed
 * (prospect link or manual mark).
 */
export async function sendTourConfirmation(params: TourConfirmationParams): Promise<TourEmailSendResult> {
  if (!params.contactEmail) {
    return { ok: false, message: "This lead has no email address, so no confirmation email was sent." };
  }
  const { subject, text, html } = buildConfirmationContent(params);
  return deliverTourSystemEmail({
    venueId: params.venueId,
    relationshipId: params.relationshipId,
    contactEmail: params.contactEmail,
    subject,
    text,
    html,
    missingEmailMessage: "This lead has no email address, so no confirmation email was sent.",
    failedMessage: "The confirmation email was not sent.",
  });
}

/**
 * Send Confirmation Request — deliberate coordinator action; returns
 * whether the send worked. Does not change tour status.
 */
export async function sendTourConfirmationRequest(params: TourConfirmationRequestParams): Promise<{ ok: boolean; message?: string }> {
  if (!params.contactEmail) return { ok: false, message: "This tour has no contact email on file." };

  const { subject, text, html } = buildConfirmationRequestContent(params);
  return deliverTourSystemEmail({
    venueId: params.venueId,
    relationshipId: params.relationshipId,
    contactEmail: params.contactEmail,
    subject,
    text,
    html,
    missingEmailMessage: "This tour has no contact email on file.",
    failedMessage: "Could not send the confirmation request.",
  });
}
