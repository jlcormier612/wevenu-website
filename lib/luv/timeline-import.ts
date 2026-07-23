/**
 * Luv — Bring Your Existing Timeline (Timeline Templates import, 2026-07-10).
 *
 * Same "system proposes, human confirms" pattern as lib/luv/playbook-import.ts:
 * read a venue's existing run-of-show once and propose a flat list of items
 * that lands directly in the Timeline Template Editor. Not AI-generation —
 * transcription of a document the venue already trusts.
 */

const CLOCK_TIME = /\b(1[0-2]|0?[1-9]):([0-5]\d)\s*([AaPp]\.?[Mm]\.?)?\b/;

export type ProposedTimelineItem = {
  title: string;
  description: string;
  // An absolute clock anchor ("HH:MM", 24-hour) — set whenever the source
  // text stated a literal time ("6:00 PM"). Preferred over minutesOffset
  // whenever both could apply: it needs no assumption about the event's
  // actual start time to be correct, where an offset always does.
  timeOfDay: string | null;
  // Minutes relative to the event's start time; negative = before. Only
  // used when the source stated a genuinely relative timing ("30 minutes
  // before ceremony") or when no timing at all was stated and one is
  // estimated (guessed = true in that case).
  minutesOffset: number | null;
  guessed: boolean;      // true when the source text didn't state a timing and Luv estimated one
};

export type LuvTimelineProposal =
  | { ok: true; items: ProposedTimelineItem[]; aiStructured: boolean }
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
- timeOfDay: if the source states an explicit clock time for this item ("6:00 PM", "18:00"), convert it to 24-hour "HH:MM" and set this field, leaving minutesOffset null and guessed false. You do NOT know the event's actual start time — never estimate this field, only fill it in when the source literally states a clock time.
- minutesOffset: use this instead of timeOfDay only when the source states a timing relative to the event itself ("30 minutes before ceremony", "right after dinner") — a signed integer number of minutes relative to the event's start time (negative = before, 0 = at start, positive = after), with guessed set to false. If the item has no timing stated at all, estimate a reasonable minutesOffset based on typical event run-of-show ordering and set guessed to true.
- Exactly one of timeOfDay/minutesOffset should be non-null for every item (never both, never neither).

Rules:
- Keep items in the order the source text presents them.
- Never invent an item that isn't in the source text, and never merge, split, or reword an item beyond fixing obvious transcription noise (bullet characters, stray whitespace).
- Preserve the coordinator's own wording exactly where you can; don't rewrite for style or tone.
- When in doubt between reorganizing and transcribing as-is, transcribe as-is.
- Return ONLY a JSON object of this exact shape, no prose, no markdown fences, no explanation:
{"items":[{"title":"...","description":"...","timeOfDay":"18:00","minutesOffset":null,"guessed":false}]}
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
    && (r.timeOfDay === null || r.timeOfDay === undefined || typeof r.timeOfDay === "string")
    && (r.minutesOffset === null || r.minutesOffset === undefined || (typeof r.minutesOffset === "number" && Number.isFinite(r.minutesOffset)))
    && (typeof r.guessed === "boolean" || r.guessed === undefined);
}

/**
 * Plain, deterministic fallback with no AI involved at all — used whenever
 * ANTHROPIC_API_KEY isn't configured (template-import review, 2026-07-22:
 * this used to hard-fail with "Luv isn't configured," leaving a coordinator
 * with nothing at all). One line becomes one item; a literal clock time
 * found anywhere in the line is preserved as timeOfDay (a plain regex, no
 * offset math or guessing involved — "6:00 PM Ceremony" trivially becomes
 * timeOfDay "18:00" without needing to know the event's start time at all).
 * A line with no clock time gets no timing at all rather than a guessed
 * one — this fallback doesn't attempt the kind of ordering-based estimate
 * only the AI path can reasonably make — and is flagged guessed so it's
 * impossible to miss in the editor that timing still needs to be set.
 */
function splitTimelineLines(rawText: string): LuvTimelineProposal {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, message: "There's no text to work with — paste or upload your timeline first." };

  const items = lines.map((line): ProposedTimelineItem => {
    const match = line.match(CLOCK_TIME);
    const timeOfDay = match ? to24Hour(match[1], match[2], match[3]) : null;
    const title = (timeOfDay ? line.replace(CLOCK_TIME, "").replace(/[-–—:]+/g, " ") : line).trim() || line;
    return { title, description: "", timeOfDay, minutesOffset: null, guessed: !timeOfDay };
  });

  return { ok: true, items, aiStructured: false };
}

function to24Hour(hourStr: string, minuteStr: string, meridiem: string | undefined): string {
  let hour = parseInt(hourStr, 10);
  const meridiemLower = meridiem?.toLowerCase().replace(/\./g, "");
  if (meridiemLower === "pm" && hour !== 12) hour += 12;
  if (meridiemLower === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minuteStr}`;
}

export async function proposeTimelineDraft(rawText: string): Promise<LuvTimelineProposal> {
  if (!rawText.trim()) {
    return { ok: false, message: "There's no text to work with — paste or upload your timeline first." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return splitTimelineLines(rawText);
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
        timeOfDay: typeof t.timeOfDay === "string" && t.timeOfDay.trim() ? t.timeOfDay.trim() : null,
        minutesOffset: typeof t.minutesOffset === "number" ? Math.round(t.minutesOffset) : null,
        guessed: t.guessed === true,
      }));

    if (items.length === 0) return { ok: false, message: "Luv couldn't find any items in this text — try pasting more of the timeline, or build it by hand instead." };
    return { ok: true, items, aiStructured: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Luv couldn't process this text." };
  }
}
