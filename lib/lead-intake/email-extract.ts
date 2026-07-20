/**
 * Generic inquiry-email extraction — the Email Intake Engine's parsing
 * layer (Lead Acquisition & Intake, Work Stream D).
 *
 * Deliberately platform-agnostic: it extracts "an inquiry" from whatever
 * text arrives — a direct email from a couple, a notification forwarded
 * from The Knot, WeddingWire, or any other source — never anything
 * specific to one marketplace's template. If a new marketplace's
 * "Congratulations! A new inquiry..." format shows up tomorrow, this
 * already handles it; there is no per-platform detection logic anywhere
 * in this file, by design.
 *
 * Same direct-Anthropic-call pattern as Luv's CSV/PDF import assist
 * (lib/luv/import-assist.ts) — gated behind ANTHROPIC_API_KEY, produces a
 * proposal only. The Lead Intake pipeline (pipeline.ts) still owns
 * creation; this module never writes to the database.
 */
import type { RawIntakeInput } from "@/lib/lead-intake/types";

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
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as AnthropicResponse;
  return (data.content.find((c) => c.type === "text")?.text ?? "").trim();
}

function buildPrompt(subject: string, body: string): string {
  // Cap input length — one email's worth of text, not an arbitrary upload.
  const truncated = body.length > 8_000 ? body.slice(0, 8_000) : body;

  return `You are extracting a venue inquiry from an email. This email might be a direct inquiry from a couple, or a notification forwarded from a wedding marketplace (The Knot, WeddingWire, or any other source) announcing a new inquiry. You do not know which in advance — extract the actual inquiry details regardless of format.

Extract these fields if present in the text (never invent a value — use null if not stated):
- firstName, lastName: the inquiring person's name
- partnerFirstName, partnerLastName: their partner's name, if mentioned
- email: the inquiring person's email address
- phone: a phone number, if present
- eventType: the type of event (e.g. wedding, birthday), if stated
- eventDate: the event date in YYYY-MM-DD format, if a specific date is given
- guestCount: estimated guest count as a number, if given
- inquiryMessage: the substance of the inquiry — what they're asking about or interested in

Also return a confidence score from 0 to 100 reflecting how confident you are that you correctly identified a real inquiry with a real name and a real way to reach them (email or phone). A forwarded notification with clearly labeled fields should score high (80-100); an ambiguous or sparse email should score low (0-49).

Return ONLY a JSON object with exactly these keys: firstName, lastName, partnerFirstName, partnerLastName, email, phone, eventType, eventDate, guestCount, inquiryMessage, confidence. No prose, no markdown fences — just the JSON object.

Subject: ${subject}

Body:
"""
${truncated}
"""`;
}

export type EmailExtractResult =
  | { ok: true; input: RawIntakeInput }
  | { ok: false; message: string };

export async function extractInquiryFromEmail(subject: string, body: string): Promise<EmailExtractResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Email intake isn't configured for this venue yet." };
  }
  if (!body.trim()) {
    return { ok: false, message: "No readable text in this email." };
  }

  try {
    const raw = await callClaude(buildPrompt(subject, body));
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, message: "Could not find inquiry details in this email." };

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
    const num = (v: unknown): number | null => {
      if (typeof v === "number") return v;
      if (typeof v === "string" && v.trim()) { const n = Number(v); return Number.isFinite(n) ? n : null; }
      return null;
    };

    const firstName = str(parsed.firstName);
    const lastName = str(parsed.lastName);
    if (!firstName || !lastName) {
      return { ok: false, message: "Could not identify who this inquiry is from." };
    }

    const confidence = num(parsed.confidence);
    return {
      ok: true,
      input: {
        firstName,
        lastName,
        partnerFirstName: str(parsed.partnerFirstName),
        email: str(parsed.email),
        phone: str(parsed.phone),
        eventType: str(parsed.eventType),
        eventDate: str(parsed.eventDate),
        guestCount: num(parsed.guestCount),
        inquiryMessage: str(parsed.inquiryMessage),
        confidenceScore: confidence === null ? 50 : Math.max(0, Math.min(100, confidence)),
        sourceData: { extracted_subject: subject },
      },
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not process this email." };
  }
}
