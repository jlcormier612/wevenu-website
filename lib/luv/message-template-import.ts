/**
 * Luv — import an existing message template (Communication Platform Phase 1,
 * 2026-07-14). Same discipline as lib/luv/playbook-import.ts: the venue's
 * existing wording is the source of truth. Luv organizes it into a named
 * template and, if asked for both channels, proposes an SMS version — it
 * doesn't rewrite tone or invent content in either case.
 */

import type { MessageTemplateCategory } from "@/lib/message-templates/types";

export type ImportChannel = "email" | "sms" | "both";

export type LuvMessageTemplateProposal =
  | { ok: true; name: string; emailSubject: string; emailBody: string; smsBody: string }
  | { ok: false; message: string };

type AnthropicResponse = { content: { type: string; text: string }[] };

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
      max_tokens: 2048,
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

function buildPrompt(rawText: string, channel: ImportChannel, category: MessageTemplateCategory): string {
  const truncated = rawText.length > 8_000 ? rawText.slice(0, 8_000) : rawText;

  const channelInstructions = {
    email: `Produce only an email version: a short subject line and the body. Leave "smsBody" as an empty string.`,
    sms: `Produce only a text-message version: a short body, no subject. Leave "emailSubject" and "emailBody" as empty strings.`,
    both: `Produce both an email version (subject + body) and a text-message version (body only). If the source text reads like a full email, the SMS version should be a brief, plain condensation of the same message — never new content, never a different tone, just shorter. If the source text is already short enough to read as a text, use it for both with minimal changes.`,
  }[channel];

  return `You are helping a venue coordinator bring a message they already send into their software instead of retyping it. This is the source of truth — organize and transcribe it, don't rewrite it or invent new content.

${channelInstructions}

Also propose a short, plain template name (a few words, e.g. "New Inquiry Reply" or "Final Payment Reminder") — this template's category is "${category}", use that as context for the name, don't repeat it verbatim as the name.

Preserve the coordinator's own wording exactly where you can. If the source text already uses variable-like placeholders (a bracketed name, a date placeholder, etc.), you may express those as {{client_name}}, {{event_date}}, {{venue_name}}, {{coordinator_name}}, {{task_name}}, or {{days_until_event}} tokens where they clearly match one of those meanings — never invent a token for something the source doesn't actually reference.

Return ONLY a JSON object of this exact shape, no prose, no markdown fences, no explanation:
{"name": "...", "emailSubject": "...", "emailBody": "...", "smsBody": "..."}

Source text:
"""
${truncated}
"""`;
}

export async function proposeMessageTemplate(
  rawText: string,
  channel: ImportChannel,
  category: MessageTemplateCategory,
): Promise<LuvMessageTemplateProposal> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Luv isn't configured for this venue yet — you can still build the template by hand below." };
  }
  if (!rawText.trim()) {
    return { ok: false, message: "There's no text to work with — paste your message first." };
  }

  try {
    const raw = await callClaude(buildPrompt(rawText, channel, category));
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, message: "Luv couldn't structure this text into a template." };

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, message: "Luv couldn't structure this text into a template." };
    }
    const r = parsed as Record<string, unknown>;
    const asString = (v: unknown) => typeof v === "string" ? v.trim() : "";
    const name = asString(r.name);
    if (!name) return { ok: false, message: "Luv couldn't find a clear message to work with in this text." };

    return {
      ok: true,
      name,
      emailSubject: asString(r.emailSubject),
      emailBody: asString(r.emailBody),
      smsBody: asString(r.smsBody),
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Luv couldn't process this text." };
  }
}
