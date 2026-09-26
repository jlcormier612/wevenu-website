/**
 * Couple-facing proposal email.
 *
 * Send proposal publishes the offer, then submits this email through the
 * existing sendEmail + conversation history path (same shape as invoice
 * and tour emails). Provider acceptance is "submitted", not "delivered".
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { recordExternalClientOutbound } from "@/lib/conversations/record-external-outbound";
import { sendEmail } from "@/lib/email/send";
import { publicAppOrigin } from "@/lib/env";

export type ProposalEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function buildProposalCoupleEmail(input: {
  venueName: string;
  recipientFirstName: string | null;
  offerUrl: string;
  offerMessage?: string | null;
  optionNames: string[];
}): ProposalEmailContent {
  const venue = input.venueName.trim() || "Your venue";
  const name = input.recipientFirstName?.trim() || "there";
  const note = input.offerMessage?.trim();
  const options = input.optionNames.map((n) => n.trim()).filter(Boolean);
  const optionLines = options.length > 0
    ? ["Options in this proposal:", ...options.map((n) => `• ${n}`), ""]
    : [];

  const text = [
    `Hi ${name},`,
    "",
    `${venue} sent you a proposal.`,
    "",
    "Open it to review the options and choose the one you want:",
    input.offerUrl,
    "",
    ...optionLines,
    ...(note ? [`A note from ${venue}:`, note, ""] : []),
    "Choosing an option does not sign a contract. After you choose, your venue continues with the next step.",
    "",
    venue,
  ].join("\n");

  const htmlOptions = options.length > 0
    ? `<ul>${options.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
    : "";
  const html = [
    `<p>Hi ${escapeHtml(name)},</p>`,
    `<p><strong>${escapeHtml(venue)}</strong> sent you a proposal.</p>`,
    `<p>Open it to review the options and choose the one you want.</p>`,
    `<p><a href="${escapeHtml(input.offerUrl)}">Review your proposal</a></p>`,
    `<p style="font-size:12px;color:#666">${escapeHtml(input.offerUrl)}</p>`,
    htmlOptions,
    note ? `<p>A note from ${escapeHtml(venue)}:</p><p>${escapeHtml(note)}</p>` : "",
    `<p>Choosing an option does not sign a contract. After you choose, your venue continues with the next step.</p>`,
    `<p>${escapeHtml(venue)}</p>`,
  ].filter(Boolean).join("\n");

  return {
    subject: `${venue} sent you a proposal`,
    text,
    html,
  };
}

export type ProposalEmailSubmitResult = {
  submitted: boolean;
  /** What the system actually knows. Never "delivered" from provider accept. */
  state: "submitted" | "not_submitted";
  message?: string;
  recipient?: string;
};

type Recipient = {
  email: string | null;
  firstName: string | null;
  relationshipId: string | null;
  leadId: string | null;
  clientId: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function resolveRecipient(
  supabase: Db,
  venueId: string,
  leadId: string | null,
  clientId: string | null,
): Promise<Recipient> {
  if (leadId) {
    const { data } = await supabase
      .from("leads")
      .select("email, first_name, relationship_id")
      .eq("id", leadId)
      .eq("venue_id", venueId)
      .maybeSingle();
    return {
      email: data?.email ?? null,
      firstName: data?.first_name ?? null,
      relationshipId: data?.relationship_id ?? null,
      leadId,
      clientId,
    };
  }
  if (clientId) {
    const { data } = await supabase
      .from("clients")
      .select("email, first_name, relationship_id, lead_id")
      .eq("id", clientId)
      .eq("venue_id", venueId)
      .maybeSingle();
    return {
      email: data?.email ?? null,
      firstName: data?.first_name ?? null,
      relationshipId: data?.relationship_id ?? null,
      leadId: data?.lead_id ?? null,
      clientId,
    };
  }
  return { email: null, firstName: null, relationshipId: null, leadId: null, clientId: null };
}

/**
 * Submit the couple proposal email. Does not change proposal status.
 * Records the attempt in conversation_messages whether or not the provider accepts.
 */
export async function submitProposalCoupleEmail(input: {
  supabase: Db;
  venueId: string;
  proposalId: string;
  acceptToken: string;
  leadId: string | null;
  clientId: string | null;
  offerMessage?: string | null;
  optionNames: string[];
}): Promise<ProposalEmailSubmitResult> {
  const { data: venue } = await input.supabase
    .from("venues")
    .select("name, business_name, email")
    .eq("id", input.venueId)
    .maybeSingle();
  const venueName = (venue?.business_name as string | null)?.trim()
    || (venue?.name as string | null)?.trim()
    || "Your venue";

  const recipient = await resolveRecipient(input.supabase, input.venueId, input.leadId, input.clientId);
  const email = recipient.email?.trim() || "";
  if (!email) {
    return {
      submitted: false,
      state: "not_submitted",
      message: "This proposal was published, but there is no email address on file, so the proposal email was not sent.",
    };
  }

  const offerUrl = `${publicAppOrigin()}/offer/${input.acceptToken}`;
  const content = buildProposalCoupleEmail({
    venueName,
    recipientFirstName: recipient.firstName,
    offerUrl,
    offerMessage: input.offerMessage,
    optionNames: input.optionNames,
  });

  const emailResult = await sendEmail({
    to: email,
    subject: content.subject,
    text: content.text,
    html: content.html,
    replyTo: (venue?.email as string | null) ?? undefined,
    threadId: undefined,
  });

  const submitted = emailResult.ok && emailResult.method === "resend";
  const failureReason = !emailResult.ok
    ? emailResult.message
    : emailResult.method === "mailto"
      ? "Email isn't fully configured for this venue yet."
      : emailResult.method === "disabled"
        ? "Sending is turned off in this environment."
        : null;

  const admin = createAdminClient();
  await recordExternalClientOutbound(admin, {
    venueId: input.venueId,
    leadId: recipient.leadId,
    clientId: recipient.clientId,
    relationshipId: recipient.relationshipId,
    channel: "email",
    body: content.text,
    providerId: emailResult.ok && emailResult.method === "resend" ? (emailResult.providerId ?? null) : null,
    status: submitted ? "accepted" : "failed",
    failureReason,
    sourceType: "proposal_email",
    sourceId: input.proposalId,
  });

  if (!submitted) {
    return {
      submitted: false,
      state: "not_submitted",
      recipient: email,
      message: failureReason
        ? `The proposal is published, but the email was not submitted: ${failureReason}`
        : "The proposal is published, but the email was not submitted.",
    };
  }

  return {
    submitted: true,
    state: "submitted",
    recipient: email,
    message: `Proposal email submitted to ${email}. Delivery is confirmed separately.`,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
