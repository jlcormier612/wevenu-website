/**
 * Luv — Bring Your Existing Timeline (Timeline Templates import, 2026-07-10).
 *
 * Same "system proposes, human confirms" pattern as lib/luv/playbook-import.ts:
 * read a venue's existing run-of-show once and propose a flat list of items
 * that lands directly in the Timeline Template Editor. Not AI-generation —
 * transcription of a document the venue already trusts.
 */

export type ProposedTimelineItem = {
  title: string;
  description: string;
  minutesOffset: number; // minutes relative to the event's start time; negative = before
  guessed: boolean;      // true when the source text didn't state a timing and Luv estimated one
};

export type LuvTimelineProposal =
  | { ok: true; items: ProposedTimelineItem[] }
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
      max_tokens: 4096,
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

function buildPrompt(rawText: string): string {
  const truncated = rawText.length > 20_000 ? rawText.slice(0, 20_000) : rawText;

  return `You are helping a venue coordinator bring their existing day-of run-of-show into their software instead of re-typing it by hand. Your job is to organize and transcribe, not to invent or redesign — this document is the source of truth, and the coordinator should recognize it when they see it in the editor.

For each item, provide:
- title: short, in the venue's own words — copy it, don't paraphrase it
- description: any extra detail from the source text (empty string if there's none)
- minutesOffset: a signed integer number of minutes relative to the event's start time (negative = before start, 0 = at start, positive = after start). If the source text states an explicit or relative time ("6:00 PM", "30 minutes before ceremony"), convert that to an offset from the event's start time and set guessed to false. If no timing is stated for an item, make a reasonable estimate based on typical event run-of-show ordering and set guessed to true.

Rules:
- Keep items in the order the source text presents them.
- Never invent an item that isn't in the source text, and never merge, split, or reword an item beyond fixing obvious transcription noise (bullet characters, stray whitespace).
- Preserve the coordinator's own wording exactly where you can; don't rewrite for style or tone.
- When in doubt between reorganizing and transcribing as-is, transcribe as-is.
- Return ONLY a JSON object of this exact shape, no prose, no markdown fences, no explanation:
{"items":[{"title":"...","description":"...","minutesOffset":-30,"guessed":true}]}
- If you can't find any real timeline content in this text, return {"items":[]}

Source text:
"""
${truncated}
"""`;
}

function isValidItem(t: unknown): t is ProposedTimelineItem {
  if (typeof t !== "object" || t === null) return false;
  const r = t as Record<string, unknown>;
  return typeof r.title === "string" && r.title.trim().length > 0
    && (typeof r.description === "string" || r.description === undefined)
    && typeof r.minutesOffset === "number" && Number.isFinite(r.minutesOffset)
    && (typeof r.guessed === "boolean" || r.guessed === undefined);
}

export async function proposeTimelineDraft(rawText: string): Promise<LuvTimelineProposal> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Luv isn't configured for this venue yet — you can still build your timeline by hand in the Template Editor." };
  }
  if (!rawText.trim()) {
    return { ok: false, message: "There's no text to work with — paste or upload your timeline first." };
  }

  try {
    const raw = await callClaude(buildPrompt(rawText));
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, message: "Luv couldn't find a timeline structure in this text." };

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>).items)) {
      return { ok: false, message: "Luv couldn't find a timeline structure in this text." };
    }

    const items = ((parsed as { items: unknown[] }).items)
      .filter(isValidItem)
      .map((t) => ({
        title: t.title.trim(),
        description: typeof t.description === "string" ? t.description.trim() : "",
        minutesOffset: Math.round(t.minutesOffset),
        guessed: t.guessed === true,
      }));

    if (items.length === 0) return { ok: false, message: "Luv couldn't find any items in this text — try pasting more of the timeline, or build it by hand instead." };
    return { ok: true, items };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Luv couldn't process this text." };
  }
}
