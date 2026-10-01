/**
 * Luv Draft Generation — Phase 2.
 *
 * Uses the OpenAI Chat Completions API to generate coordinator-ready
 * email drafts. No streaming — waits for the full response before
 * returning so the textarea populates at once.
 *
 * The coordinator reviews, edits, and sends manually.
 * Luv never sends anything.
 *
 * Factuality: pipeline/stage is workflow context only. Completed-action
 * language requires authoritative verified facts (e.g. commercial_proposals
 * status=sent + offered_at), never sales_stage alone.
 */

import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isOpenAiConfigured, openAiChatCompletion } from "@/lib/ai/openai";
import { isSupabaseConfigured } from "@/lib/env";
import {
  customerFacingInquiryMessage,
  inquiryOriginFromTrustTier,
  resolveDraftDeleteDecision,
  type InquiryOrigin,
} from "@/lib/luv/draft-context-boundary";
import { getLuvSettings, isLuvDraftingEnabled, luvToneInstruction } from "@/lib/luv/settings";
import { getCurrentVenue } from "@/lib/venue/service";
import type { Lead } from "@/lib/leads/types";

export type LuvDraft = {
  id: string;
  entityType: "lead" | "client" | "event";
  entityId: string;
  draftType: "follow_up_email" | "follow_up_text" | "next_steps" | "timeline";
  subject: string | null;
  content: string;
  status: "pending_review" | "accepted" | "discarded";
  createdAt: string;
};

export type FollowUpVerifiedFacts = {
  /** commercial_proposals.status = sent AND offered_at set */
  proposalSent: boolean;
  /**
   * Provenance of leads.inquiry_message. Default venue (fail closed):
   * only "customer" may place the message in generation context.
   */
  inquiryOrigin?: InquiryOrigin;
};

type DraftRow = {
  id: string; entity_type: string; entity_id: string; draft_type: string;
  subject: string | null; content: string; status: string; created_at: string;
};

function mapDraft(r: DraftRow): LuvDraft {
  return {
    id: r.id,
    entityType: r.entity_type as LuvDraft["entityType"],
    entityId: r.entity_id,
    draftType: r.draft_type as LuvDraft["draftType"],
    subject: r.subject,
    content: r.content,
    status: r.status as LuvDraft["status"],
    createdAt: r.created_at,
  };
}

/** Authoritative proposal-send: status sent + offered_at (markProposalSent). */
export function isAuthoritativeProposalSent(row: {
  status: string | null | undefined;
  offeredAt: string | null | undefined;
} | null | undefined): boolean {
  if (!row) return false;
  return row.status === "sent" && Boolean(row.offeredAt);
}

// ---- Prompt builder --------------------------------------------------------

export function buildFollowUpPrompt(
  lead: Lead,
  venueName: string,
  ownerName: string | null,
  tone = "warm",
  verified: FollowUpVerifiedFacts = { proposalSent: false },
): string {
  const coupleName = [lead.firstName, lead.partnerFirstName].filter(Boolean).join(" and ");
  const daysSinceContact = lead.lastContactedAt
    ? Math.floor((Date.now() - new Date(lead.lastContactedAt).getTime()) / 86_400_000)
    : null;
  const daysSinceInquiry = lead.inquiryDate
    ? Math.floor((Date.now() - new Date(lead.inquiryDate).getTime()) / 86_400_000)
    : null;
  const pipelineStage = (lead.salesStage ?? lead.status).replace(/_/g, " ");
  const origin: InquiryOrigin = verified.inquiryOrigin ?? "venue";
  const customerMessage = customerFacingInquiryMessage(lead.inquiryMessage, origin);

  const verifiedLines: string[] = [];
  if (verified.proposalSent) {
    verifiedLines.push("- The proposal was sent to this client.");
  }
  const verifiedBlock = verifiedLines.length > 0
    ? `**Verified facts (actions proven in the system — you may state these):**\n${verifiedLines.join("\n")}`
    : "**Verified facts:** none for completed actions on this lead.";

  const customerMessageBlock = customerMessage
    ? `**Customer-originated inquiry (they wrote this — eligible for personalization, not for mechanical repetition):**
- "${customerMessage}"

**Judgment (both gates required before using any detail from that inquiry):**
- GATE 1: Only use a detail if it is appropriate to say back to the customer in this email.
- GATE 2: Only use a detail if a thoughtful coordinator would naturally mention it in this specific follow-up. If it would sound like staff banter, teasing, speculation, relationship commentary, or an awkward callback, omit it.
- Prefer warm, natural, relevant, useful, restrained personalization. Do not force a callback. Do not repeat their message mechanically.
`
    : "";

  return `You are helping a venue coordinator at ${venueName} write a warm, personal follow-up email to a prospective client.

The coordinator signing the email is: ${ownerName ?? "the team at " + venueName}

**About the couple:**
- Names: ${coupleName || "the couple"}
- Event type: ${lead.eventType?.replace(/_/g, " ") ?? "not specified"}
- Event date: ${lead.eventDate ?? "not yet confirmed"}
- Guest count: ${lead.guestCount ?? "not specified"}
- Estimated budget: ${lead.estimatedBudget ? "$" + lead.estimatedBudget.toLocaleString() : "not specified"}
- Pipeline stage (venue workflow context; not proof that a document or message was sent): ${pipelineStage}
${daysSinceInquiry != null ? `- Days since initial inquiry: ${daysSinceInquiry}` : ""}
${daysSinceContact != null ? `- Days since last contact: ${daysSinceContact}` : ""}

${customerMessageBlock}
${verifiedBlock}

**Tone:** ${luvToneInstruction(tone)}

**How to write this email:**
- Address them by first name(s) — like you know them a little
- Keep it short: 2–3 paragraphs maximum
- Acknowledge where they are in the process naturally using workflow context, without inventing completed actions
- Offer one gentle, specific next step (schedule a tour, answer questions, arrange a call)
- Do NOT be pushy, salesy, or use corporate/template-sounding language
- The subject line should be friendly, not promotional
- Do not tell the client that the venue has sent, completed, confirmed, received, or otherwise performed an action unless that action appears under Verified facts. Pipeline stage alone is not proof. In particular: do not say a proposal was sent merely because the lead is in proposal_sent; do not claim a contract/invoice was sent, a payment was received, a tour was confirmed, or a message was sent from workflow position alone.
- Never invent or allude to venue-internal notes, staff observations, or operational commentary. Those are not in your context.

Format your response EXACTLY as:
Subject: [subject line]

[email body]

Nothing else — no preamble, no closing notes, just the subject and body.`;
}

// ---- OpenAI API call -------------------------------------------------------

async function generateDraftText(prompt: string): Promise<string> {
  try {
    return await openAiChatCompletion({
      messages: [{ role: "user", content: prompt }],
      maxCompletionTokens: 1024,
      timeoutMs: 25_000,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "AI request timed out.") {
      throw new Error("Draft generation failed.");
    }
    throw err;
  }
}

// ---- Parse generated text --------------------------------------------------

function parseEmailDraft(raw: string): { subject: string | null; body: string } {
  const lines = raw.split("\n");
  const subjectLine = lines.find((l) => l.toLowerCase().startsWith("subject:"));
  const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : null;
  const bodyStart = subjectLine ? lines.indexOf(subjectLine) + 1 : 0;
  const body = lines.slice(bodyStart).join("\n").trim();
  return { subject, body };
}

async function loadProposalSentFact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  leadId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("commercial_proposals")
    .select("status, offered_at")
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .eq("status", "sent")
    .not("offered_at", "is", null)
    .order("offered_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string; offered_at: string }>();
  return isAuthoritativeProposalSent({
    status: data?.status,
    offeredAt: data?.offered_at ?? null,
  });
}

async function loadInquiryOrigin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  venueId: string,
  leadId: string,
): Promise<InquiryOrigin> {
  const { data } = await supabase
    .from("lead_intake_attempts")
    .select("trust_tier")
    .eq("venue_id", venueId)
    .eq("lead_id", leadId)
    .eq("status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ trust_tier: string }>();
  return inquiryOriginFromTrustTier(data?.trust_tier ?? null);
}

// ---- Public service functions ---------------------------------------------

export async function generateFollowUpDraft(lead: Lead): Promise<
  { ok: true; draft: LuvDraft } | { ok: false; message: string }
> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };

  try {
    const venue = await getCurrentVenue();
    if (!venue) return { ok: false, message: "No venue found." };

    const settings = await getLuvSettings();
    if (!isLuvDraftingEnabled(settings)) {
      return { ok: false, message: "Luv drafting is disabled in Settings." };
    }

    if (!isOpenAiConfigured()) {
      return { ok: false, message: "Luv drafts are not enabled. Add OPENAI_API_KEY to enable." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Session expired." };

    // Get owner name for the signature
    const { data: staff } = await supabase.from("venue_staff")
      .select("full_name").eq("venue_id", venue.id).eq("is_owner", true).maybeSingle<{ full_name: string }>();
    const ownerName = staff?.full_name?.split(" ")[0] ?? null;

    const [proposalSent, inquiryOrigin] = await Promise.all([
      loadProposalSentFact(supabase, venue.id, lead.id),
      loadInquiryOrigin(supabase, venue.id, lead.id),
    ]);
    const prompt = buildFollowUpPrompt(
      lead,
      venue.name,
      ownerName,
      settings.preferredTone,
      { proposalSent, inquiryOrigin },
    );
    const raw = await generateDraftText(prompt);
    const { subject, body } = parseEmailDraft(raw);

    // Persist the draft
    const { data, error } = await supabase.from("luv_drafts")
      .insert({
        venue_id: venue.id,
        entity_type: "lead",
        entity_id: lead.id,
        draft_type: "follow_up_email",
        subject,
        content: body,
        context: {
          leadStatus: lead.salesStage ?? lead.status,
          leadName: `${lead.firstName} ${lead.lastName}`,
          verifiedProposalSent: proposalSent,
          inquiryOrigin,
        },
        status: "pending_review",
      })
      .select()
      .single<DraftRow>();

    if (error) throw error;
    return { ok: true, draft: mapDraft(data) };
  } catch (err) {
    console.error("[luv/drafts] generateFollowUpDraft failed:", err);
    return { ok: false, message: "Luv couldn't generate a draft right now. Please try again." };
  }
}

export async function getDraftsForLead(leadId: string): Promise<LuvDraft[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("luv_drafts")
    .select("*")
    .eq("venue_id", venue.id)
    .eq("entity_type", "lead")
    .eq("entity_id", leadId)
    // Discarded rows are deleted; exclude any legacy discarded status from UI.
    .neq("status", "discarded")
    .order("created_at", { ascending: false });
  return (data as DraftRow[] ?? []).map(mapDraft);
}

export async function updateDraftStatus(
  draftId: string,
  status: "accepted",
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("luv_drafts") as any).update({ status }).eq("id", draftId).eq("venue_id", venue.id);
}

/**
 * Discard = permanent delete. Venue-scoped; never archives as status=discarded.
 * Admin delete after a user-session existence check so owner/manager restrictive
 * delete RLS does not block coordinators who can generate drafts.
 */
export async function deleteDraft(
  draftId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("luv_drafts")
    .select("id")
    .eq("id", draftId)
    .eq("venue_id", venue.id)
    .maybeSingle<{ id: string }>();
  const decision = resolveDraftDeleteDecision(existing, readError);
  if (!decision.proceed) {
    if (readError) console.error("[luv/drafts] deleteDraft read failed:", readError);
    return { ok: false, message: decision.message };
  }

  const admin = createAdminClient();
  const { error: deleteError } = await admin
    .from("luv_drafts")
    .delete()
    .eq("id", draftId)
    .eq("venue_id", venue.id);
  if (deleteError) {
    console.error("[luv/drafts] deleteDraft failed:", deleteError);
    return { ok: false, message: "Couldn't discard that draft. Please try again." };
  }
  return { ok: true };
}

export {
  applyDiscardResult,
  draftHistoryDrafts,
  draftStatusAfterSuccessfulSend,
  pendingReviewDrafts,
  withDraftStatus,
  withoutDraft,
} from "@/lib/luv/draft-status";
