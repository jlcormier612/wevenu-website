/**
 * Couple-facing Client Choices (proposed selection) email.
 * Mirrors lib/commercial-proposals/couple-email.ts — sendEmail + conversation
 * outbound record. Does not use commercial_proposals tables.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { recordExternalClientOutbound } from "@/lib/conversations/record-external-outbound";
import { findOrCreateVenueCoupleConversation } from "@/lib/conversations/venue-couple-conversation";
import { sendEmail } from "@/lib/email/send";
import {
  brandButtonHtml,
  emailBrandFromVenue,
  escapeHtml,
  renderBrandedEmailHtml,
  type EmailVenueBrand,
  VENUE_EMAIL_BRAND_SELECT,
} from "@/lib/email/venue-brand";
import { choicesReviewUrl, pickChoicesPortalSession } from "@/lib/client-choices/choices-portal-link";
import { publicAppOrigin } from "@/lib/env";
import { customerFacingVenueName } from "@/lib/venue/identity";

export type ChoicesEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export type ChoicesEmailSubmitResult = {
  submitted: boolean;
  /** Provider accept only — never claim inbox delivery. */
  state: "submitted" | "not_submitted";
  message?: string;
  recipient?: string;
};

export function buildChoicesCoupleEmail(input: {
  venueName: string;
  recipientFirstName: string | null;
  choicesName: string;
  eventName: string | null;
  portalUrl: string;
  offerMessage?: string | null;
  brand?: EmailVenueBrand;
}): ChoicesEmailContent {
  const venue = input.venueName.trim() || "Your venue";
  const name = input.recipientFirstName?.trim() || "there";
  const note = input.offerMessage?.trim();
  const packet = input.choicesName.trim() || "your selections";
  const eventBit = input.eventName?.trim() ? ` for ${input.eventName.trim()}` : "";

  const text = [
    `Hi ${name},`,
    "",
    `${venue} asked you to review and submit ${packet}${eventBit}.`,
    "",
    "Open the link to choose the options they offered, then submit when you are ready:",
    input.portalUrl,
    "",
    ...(note ? [`A note from ${venue}:`, note, ""] : []),
    "Submitting your choices is not a payment and does not change your booking.",
    "",
    venue,
  ].join("\n");

  const brand: EmailVenueBrand = input.brand ?? emailBrandFromVenue({ name: venue });
  const body = [
    `<p style="margin:0 0 12px;font-size:15px;color:#374151">Hi ${escapeHtml(name)},</p>`,
    `<p style="margin:0 0 12px;font-size:15px;color:#374151"><strong>${escapeHtml(venue)}</strong> asked you to review and submit <strong>${escapeHtml(packet)}</strong>${eventBit ? escapeHtml(eventBit) : ""}.</p>`,
    `<p style="margin:0 0 20px;font-size:15px;color:#374151">Open the link to choose the options they offered, then submit when you are ready.</p>`,
    `<p style="margin:0 0 20px">${brandButtonHtml(brand, input.portalUrl, "Review your selections")}</p>`,
    note
      ? `<p style="margin:0 0 8px;font-size:15px;color:#374151">A note from ${escapeHtml(venue)}:</p><p style="margin:0 0 20px;font-size:15px;color:#374151">${escapeHtml(note)}</p>`
      : "",
    `<p style="margin:0 0 12px;font-size:15px;color:#374151">Submitting your choices is not a payment and does not change your booking.</p>`,
    `<p style="margin:0;font-size:15px;color:#374151">${escapeHtml(venue)}</p>`,
  ].filter(Boolean).join("");

  return {
    subject: `${venue} sent you selections to review`,
    text,
    html: renderBrandedEmailHtml(brand, body),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/**
 * Submit the selection-request email. Caller must already have made the
 * packet available in the portal (sendClientChoices). Does not change
 * Client Choices status. Records outbound whether or not the provider accepts.
 */
export async function submitClientChoicesCoupleEmail(input: {
  supabase: Db;
  venueId: string;
  choicesId: string;
  choicesName: string;
  eventId: string;
  eventName: string | null;
  clientId: string;
  customMessage?: string | null;
}): Promise<ChoicesEmailSubmitResult> {
  const { data: venue } = await input.supabase
    .from("venues")
    .select(VENUE_EMAIL_BRAND_SELECT)
    .eq("id", input.venueId)
    .maybeSingle();
  const venueName = customerFacingVenueName({
    name: (venue?.name as string | null) ?? null,
  });
  const brand = emailBrandFromVenue({
    name: venueName,
    logo_url: (venue?.logo_url as string | null) ?? null,
    primary_color: (venue?.primary_color as string | null) ?? null,
    email_signature: (venue?.email_signature as string | null) ?? null,
    email: (venue?.email as string | null) ?? null,
    phone: (venue?.phone as string | null) ?? null,
    email_footer_show_signature: (venue?.email_footer_show_signature as boolean | null) ?? null,
    email_footer_show_email: (venue?.email_footer_show_email as boolean | null) ?? null,
    email_footer_show_phone: (venue?.email_footer_show_phone as boolean | null) ?? null,
  });

  const { data: client } = await input.supabase
    .from("clients")
    .select("email, first_name, relationship_id, lead_id")
    .eq("id", input.clientId)
    .eq("venue_id", input.venueId)
    .maybeSingle();

  const email = (client?.email as string | null)?.trim() || "";
  if (!email) {
    return {
      submitted: false,
      state: "not_submitted",
      message:
        "The request is available in the portal, but there is no email address on file, so the selection email was not sent.",
    };
  }

  const { getPortalSessions, createPortalSession } = await import("@/lib/portal/service");
  const sessions = await getPortalSessions(input.clientId);
  // Never reuse the invoice financial token — that page is PaymentAccessShell
  // and ignores #choices, which is why "Review your selections" opened the invoice.
  const session =
    pickChoicesPortalSession(sessions)
    ?? (await createPortalSession(input.clientId, "Selections", "couple"));
  if (!session?.accessToken) {
    return {
      submitted: false,
      state: "not_submitted",
      recipient: email,
      message:
        "The request is available in the portal, but a portal link could not be created, so the selection email was not sent.",
    };
  }

  const portalUrl = choicesReviewUrl(publicAppOrigin(), session.accessToken);
  const content = buildChoicesCoupleEmail({
    venueName,
    recipientFirstName: (client?.first_name as string | null) ?? null,
    choicesName: input.choicesName,
    eventName: input.eventName,
    portalUrl,
    offerMessage: input.customMessage,
    brand,
  });

  const admin = createAdminClient();
  let conversationId: string | null = null;
  const relationshipId = (client?.relationship_id as string | null) ?? null;
  if (relationshipId) {
    conversationId = await findOrCreateVenueCoupleConversation(
      admin,
      input.venueId,
      relationshipId,
    );
  }

  const emailResult = await sendEmail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: (venue?.email as string | null) ?? undefined,
    threadId: conversationId ?? undefined,
  });

  const submitted = emailResult.ok && emailResult.method === "resend";
  const failureReason = !emailResult.ok
    ? emailResult.message
    : emailResult.method === "mailto"
      ? "Email isn't fully configured for this venue yet."
      : emailResult.method === "disabled"
        ? "Sending is turned off in this environment."
        : null;

  await recordExternalClientOutbound(admin, {
    venueId: input.venueId,
    leadId: (client?.lead_id as string | null) ?? null,
    clientId: input.clientId,
    relationshipId,
    channel: "email",
    body: content.text,
    providerId: emailResult.ok && emailResult.method === "resend" ? (emailResult.providerId ?? null) : null,
    status: submitted ? "accepted" : "failed",
    failureReason,
    sourceType: "client_choices_request",
    sourceId: input.choicesId,
  });

  if (!submitted) {
    return {
      submitted: false,
      state: "not_submitted",
      recipient: email,
      message: failureReason
        ? `The request is available in the portal, but the email was not submitted: ${failureReason}`
        : "The request is available in the portal, but the email was not submitted.",
    };
  }

  return {
    submitted: true,
    state: "submitted",
    recipient: email,
    message: `Selection request email submitted to ${email}. Delivery is confirmed separately.`,
  };
}
