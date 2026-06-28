/**
 * Luv client draft generation — Phase 2.
 *
 * Generates Planning Luv drafts for the client stage of the relationship.
 * Coordinator reviews, edits, and sends manually. Luv never sends.
 */

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type ClientDraftType = "welcome_email" | "planning_kickoff" | "payment_reminder" | "final_details";

export type ClientDraft = {
  id: string;
  entityType: "client";
  entityId: string;
  draftType: ClientDraftType;
  subject: string | null;
  content: string;
  status: "pending_review" | "accepted" | "discarded";
  createdAt: string;
};

type ClientContext = {
  id: string;
  firstName: string;
  lastName: string;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  email: string | null;
  eventType: string | null;
  eventDate: string | null;
  guestCount: number | null;
};

const TONE_INSTRUCTION: Record<string, string> = {
  warm:         "Write in a warm, friendly, celebratory tone — this couple just made a significant decision and deserves to feel excited.",
  professional: "Write in a professional, polished, and welcoming tone.",
  formal:       "Write in a formal, gracious tone appropriate for a premium venue experience.",
};

function buildClientPrompt(
  client: ClientContext,
  draftType: ClientDraftType,
  venueName: string,
  ownerName: string | null,
  tone: string,
): string {
  const coupleName = [client.firstName, client.partnerFirstName].filter(Boolean).join(" and ");
  const eventDate = client.eventDate
    ? new Date(client.eventDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "not yet confirmed";
  const eventType = client.eventType?.replace(/_/g, " ") ?? "event";

  const coordinator = ownerName ?? `the team at ${venueName}`;

  const contextBlock = `
**The couple:**
- Names: ${coupleName}
- Event type: ${eventType}
- Event date: ${eventDate}
${client.guestCount ? `- Guest count: ${client.guestCount}` : ""}
- Venue: ${venueName}

**Tone:** ${TONE_INSTRUCTION[tone] ?? TONE_INSTRUCTION.warm}

**The coordinator signing:** ${coordinator}`;

  const instructions: Record<ClientDraftType, string> = {
    welcome_email: `Write a warm welcome email to send shortly after they've officially booked.
The email should:
- Celebrate the booking with genuine warmth
- Reassure them they've made a wonderful choice
- Set expectations for what happens next (planning process, next communication)
- Be 2-3 short paragraphs — celebratory but not overwhelming
- End with one clear next step (schedule a planning call, expect an email soon, etc.)`,

    planning_kickoff: `Write a planning kickoff email to send as the planning process begins.
The email should:
- Express excitement about working on the details together
- Give them a sense of the planning journey ahead
- Introduce any planning tools or questionnaires they'll receive
- Be warm and organized — help them feel prepared, not overwhelmed
- End with a specific next step`,

    payment_reminder: `Write a gentle, friendly payment reminder.
The email should:
- Be warm and non-confrontational — this is a reminder, not a demand
- Reference their upcoming event and how excited you are
- Clearly state that a payment is coming due (without stating the exact amount — the coordinator can fill that in)
- Make it easy to act (include a note that they can reach out with questions)
- Be very short — 2-3 sentences is enough`,

    final_details: `Write a "final details" outreach email to send a few weeks before the event.
The email should:
- Express excitement that the big day is approaching
- Let them know it's time to finalize any remaining details
- Mention that you want to ensure everything is perfect
- Ask them to review any outstanding items (the coordinator will fill in specifics)
- Be warm and reassuring — this should feel like a caring check-in, not a checklist`,
  };

  return `You are Luv, helping a coordinator at ${venueName} communicate with a booked client.
${contextBlock}

**Your task:**
${instructions[draftType]}

Format your response EXACTLY as:
Subject: [your subject line]

[email body]

Nothing else — no preamble, no closing notes.`;
}

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

  if (!res.ok) throw new Error(`Anthropic API error ${res.status}`);
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find((c) => c.type === "text")?.text.trim() ?? "";
}

function parseEmailDraft(raw: string): { subject: string | null; body: string } {
  const lines = raw.split("\n");
  const subjectLine = lines.find((l) => l.toLowerCase().startsWith("subject:"));
  const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : null;
  const bodyStart = subjectLine ? lines.indexOf(subjectLine) + 1 : 0;
  return { subject, body: lines.slice(bodyStart).join("\n").trim() };
}

export async function generateClientDraft(
  clientId: string,
  draftType: ClientDraftType,
): Promise<{ ok: true; draft: ClientDraft } | { ok: false; message: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, message: "Luv drafts are not enabled. Add ANTHROPIC_API_KEY to enable." };

  try {
    const venue = await getCurrentVenue();
    if (!venue) return { ok: false, message: "No venue found." };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, message: "Session expired." };

    // Get Luv settings for tone
    const { data: luvSettings } = await supabase.from("luv_settings")
      .select("preferred_tone, drafting_enabled").eq("venue_id", venue.id).maybeSingle<{ preferred_tone: string; drafting_enabled: boolean }>();
    if (luvSettings?.drafting_enabled === false) return { ok: false, message: "Luv drafting is disabled in Settings." };

    // Get client data
    const { data: clientRow } = await supabase.from("clients")
      .select("id, first_name, last_name, partner_first_name, partner_last_name, email, event_type, event_date, guest_count")
      .eq("id", clientId).eq("venue_id", venue.id).maybeSingle<{
        id: string; first_name: string; last_name: string;
        partner_first_name: string | null; partner_last_name: string | null;
        email: string | null; event_type: string | null; event_date: string | null;
        guest_count: number | null;
      }>();
    if (!clientRow) return { ok: false, message: "Client not found." };

    // Get owner name
    const { data: staff } = await supabase.from("venue_staff")
      .select("full_name").eq("venue_id", venue.id).eq("is_owner", true).maybeSingle<{ full_name: string }>();
    const ownerName = staff?.full_name?.split(" ")[0] ?? null;

    const client: ClientContext = {
      id: clientRow.id, firstName: clientRow.first_name, lastName: clientRow.last_name,
      partnerFirstName: clientRow.partner_first_name, partnerLastName: clientRow.partner_last_name,
      email: clientRow.email, eventType: clientRow.event_type,
      eventDate: clientRow.event_date, guestCount: clientRow.guest_count,
    };

    const prompt = buildClientPrompt(client, draftType, venue.name, ownerName, luvSettings?.preferred_tone ?? "warm");
    const raw = await callClaude(prompt);
    const { subject, body } = parseEmailDraft(raw);

    const { data, error } = await supabase.from("luv_drafts")
      .insert({
        venue_id: venue.id, entity_type: "client", entity_id: clientId,
        draft_type: draftType, subject, content: body, status: "pending_review",
        context: { clientName: `${client.firstName} ${client.lastName}`, draftType },
      })
      .select().single<{ id: string; entity_type: string; entity_id: string; draft_type: string; subject: string | null; content: string; status: string; created_at: string }>();

    if (error) throw error;
    return {
      ok: true,
      draft: {
        id: data.id, entityType: "client", entityId: data.entity_id,
        draftType: data.draft_type as ClientDraftType, subject: data.subject,
        content: data.content, status: data.status as ClientDraft["status"], createdAt: data.created_at,
      },
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Draft generation failed." };
  }
}

export async function getClientDrafts(clientId: string): Promise<ClientDraft[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("luv_drafts")
    .select("id, entity_type, entity_id, draft_type, subject, content, status, created_at")
    .eq("venue_id", venue.id).eq("entity_type", "client").eq("entity_id", clientId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((d: { id: string; entity_type: string; entity_id: string; draft_type: string; subject: string | null; content: string; status: string; created_at: string }) => ({
    id: d.id, entityType: "client" as const, entityId: d.entity_id,
    draftType: d.draft_type as ClientDraftType, subject: d.subject,
    content: d.content, status: d.status as ClientDraft["status"], createdAt: d.created_at,
  }));
}
