/**
 * Luv Draft Generation — Phase 2.
 *
 * Uses the Anthropic Messages API (claude-sonnet-4-6) to generate
 * coordinator-ready email drafts. No streaming — waits for the full
 * response before returning so the textarea populates at once.
 *
 * The coordinator reviews, edits, and sends manually.
 * Luv never sends anything.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
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

// ---- Prompt builder --------------------------------------------------------

const TONE_INSTRUCTION: Record<string, string> = {
  warm:         "Write in a warm, friendly, personal tone — like a real person at a boutique venue who genuinely cares.",
  professional: "Write in a professional, polished, and respectful tone appropriate for a business context.",
  formal:       "Write in a formal, precise tone — best for corporate clients or high-profile events.",
};

function buildFollowUpPrompt(lead: Lead, venueName: string, ownerName: string | null, tone = "warm"): string {
  const coupleName = [lead.firstName, lead.partnerFirstName].filter(Boolean).join(" and ");
  const daysSinceContact = lead.lastContactedAt
    ? Math.floor((Date.now() - new Date(lead.lastContactedAt).getTime()) / 86_400_000)
    : null;
  const daysSinceInquiry = lead.inquiryDate
    ? Math.floor((Date.now() - new Date(lead.inquiryDate).getTime()) / 86_400_000)
    : null;

  return `You are helping a venue coordinator at ${venueName} write a warm, personal follow-up email to a prospective client.

The coordinator signing the email is: ${ownerName ?? "the team at " + venueName}

**About the couple:**
- Names: ${coupleName || "the couple"}
- Event type: ${lead.eventType?.replace(/_/g, " ") ?? "not specified"}
- Event date: ${lead.eventDate ?? "not yet confirmed"}
- Guest count: ${lead.guestCount ?? "not specified"}
- Estimated budget: ${lead.estimatedBudget ? "$" + lead.estimatedBudget.toLocaleString() : "not specified"}
- Pipeline status: ${lead.status.replace(/_/g, " ")}
${daysSinceInquiry != null ? `- Days since initial inquiry: ${daysSinceInquiry}` : ""}
${daysSinceContact != null ? `- Days since last contact: ${daysSinceContact}` : ""}
${lead.inquiryMessage ? `- Their original message: "${lead.inquiryMessage}"` : ""}

**Tone:** ${TONE_INSTRUCTION[tone] ?? TONE_INSTRUCTION.warm}

**How to write this email:**
- Address them by first name(s) — like you know them a little
- Keep it short: 2–3 paragraphs maximum
- Acknowledge where they are in the process naturally
- Offer one gentle, specific next step (schedule a tour, answer questions, arrange a call)
- Do NOT be pushy, salesy, or use corporate/template-sounding language
- The subject line should be friendly, not promotional

Format your response EXACTLY as:
Subject: [subject line]

[email body]

Nothing else — no preamble, no closing notes, just the subject and body.`;
}

// ---- Claude API call -------------------------------------------------------

type AnthropicResponse = {
  content: { type: string; text: string }[];
};

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as AnthropicResponse;
  const text = data.content.find((c) => c.type === "text")?.text ?? "";
  return text.trim();
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

// ---- Public service functions ---------------------------------------------

export async function generateFollowUpDraft(lead: Lead): Promise<
  { ok: true; draft: LuvDraft } | { ok: false; message: string }
> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, message: "Luv drafts are not enabled. Add ANTHROPIC_API_KEY to enable." };

  try {
    const venue = await getCurrentVenue();
    if (!venue) return { ok: false, message: "No venue found." };

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Session expired." };

    // Get owner name for the signature
    const { data: staff } = await supabase.from("venue_staff")
      .select("full_name").eq("venue_id", venue.id).eq("is_owner", true).maybeSingle<{ full_name: string }>();
    const ownerName = staff?.full_name?.split(" ")[0] ?? null;

    const { data: luvSettingsRow } = await supabase.from("luv_settings")
      .select("preferred_tone, drafting_enabled").eq("venue_id", venue.id).maybeSingle<{ preferred_tone: string; drafting_enabled: boolean }>();
    if (luvSettingsRow?.drafting_enabled === false) return { ok: false, message: "Luv drafting is disabled in Settings." };
    const prompt = buildFollowUpPrompt(lead, venue.name, ownerName, luvSettingsRow?.preferred_tone ?? "warm");
    const raw = await callClaude(prompt);
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
        context: { leadStatus: lead.status, leadName: `${lead.firstName} ${lead.lastName}` },
        status: "pending_review",
      })
      .select()
      .single<DraftRow>();

    if (error) throw error;
    return { ok: true, draft: mapDraft(data) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Draft generation failed.";
    return { ok: false, message };
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
    .order("created_at", { ascending: false });
  return (data as DraftRow[] ?? []).map(mapDraft);
}

export async function updateDraftStatus(
  draftId: string,
  status: "accepted" | "discarded",
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("luv_drafts") as any).update({ status }).eq("id", draftId).eq("venue_id", venue.id);
}
