/**
 * Luv — Bring Your Existing Checklist (Planning Templates import, 2026-07-10).
 *
 * A venue that has run events for years already has a real checklist — in a
 * Word doc, a spreadsheet, a note. This isn't an AI-parsing feature; it's
 * elimination of manual re-entry. Luv's only job is to read that text once
 * and propose a first-pass milestones-and-tasks structure that lands
 * directly in the same Template Editor used for every other template — the
 * same "system proposes, human confirms" pattern as every other Luv
 * capability, just with a nested output shape instead of flat rows.
 */

import type { PlaybookKind } from "@/lib/playbooks/types";

export type ProposedPlaybookTask = {
  title: string;
  instructions: string;
  daysOffset: number;   // negative = before the event, positive = after
  guessed: boolean;     // true when the source text didn't state a timing and Luv estimated one
};

export type ProposedPlaybookMilestone = {
  name: string;
  tasks: ProposedPlaybookTask[];
};

export type LuvPlaybookProposal =
  | { ok: true; milestones: ProposedPlaybookMilestone[] }
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

function buildPrompt(rawText: string, kind: PlaybookKind): string {
  // Cap input length — this is meant for one pasted checklist, not an
  // arbitrarily large document.
  const truncated = rawText.length > 20_000 ? rawText.slice(0, 20_000) : rawText;
  const audience = kind === "client"
    ? "the COUPLE to complete themselves (this is a Client Planning checklist)"
    : "the VENUE'S OWN TEAM to run internally (this is a Venue Planning checklist)";

  return `You are helping a venue coordinator bring their existing, real planning checklist into their software instead of re-typing it by hand. Your job is to organize and transcribe, not to invent or redesign — this document is the source of truth, and the coordinator should recognize it when they see it in the editor.

This checklist is for ${audience} — write task titles accordingly.

Structure:
- If the source text already has its own sections, headings, or groupings, use those as the milestones — keep their names and their order. Do not re-group or re-order tasks the source document already grouped.
- Only invent a section structure if the source text is a flat, ungrouped list with no organization of its own — in that case, and only that case, group it in the order tasks would naturally happen leading up to and after the event.
- Within a milestone, keep tasks in the order the source text presents them.

For each task, provide:
- title: short, in the venue's own words — copy it, don't paraphrase it
- instructions: any extra detail from the source text (empty string if there's none)
- daysOffset: a signed integer number of days relative to the event date (negative = before the event, positive = after, 0 = day-of). If the source text states an explicit relative timing ("send 2 weeks before", "due 30 days out"), convert that to a number and set guessed to false. If no timing is stated for a task, make a reasonable estimate based on typical event-planning timelines and set guessed to true.

Rules:
- Never invent a task that isn't in the source text, and never merge, split, or reword a task beyond fixing obvious transcription noise (e.g. bullet characters, stray whitespace).
- Preserve the coordinator's own wording exactly where you can; don't rewrite for style or tone.
- When in doubt between reorganizing and transcribing as-is, transcribe as-is.
- Return ONLY a JSON object of this exact shape, no prose, no markdown fences, no explanation:
{"milestones":[{"name":"Section name","tasks":[{"title":"...","instructions":"...","daysOffset":-30,"guessed":true}]}]}
- If you can't find any real checklist content in this text, return {"milestones":[]}

Source text:
"""
${truncated}
"""`;
}

function isValidTask(t: unknown): t is ProposedPlaybookTask {
  if (typeof t !== "object" || t === null) return false;
  const r = t as Record<string, unknown>;
  return typeof r.title === "string" && r.title.trim().length > 0
    && (typeof r.instructions === "string" || r.instructions === undefined)
    && typeof r.daysOffset === "number" && Number.isFinite(r.daysOffset)
    && (typeof r.guessed === "boolean" || r.guessed === undefined);
}

export async function proposePlaybookDraft(rawText: string, kind: PlaybookKind): Promise<LuvPlaybookProposal> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Luv isn't configured for this venue yet — you can still build your checklist by hand in the Template Editor." };
  }
  if (!rawText.trim()) {
    return { ok: false, message: "There's no text to work with — paste your checklist first." };
  }

  try {
    const raw = await callClaude(buildPrompt(rawText, kind));
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, message: "Luv couldn't find a checklist structure in this text." };

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>).milestones)) {
      return { ok: false, message: "Luv couldn't find a checklist structure in this text." };
    }

    const rawMilestones = (parsed as { milestones: unknown[] }).milestones;
    const milestones: ProposedPlaybookMilestone[] = rawMilestones
      .filter((m): m is Record<string, unknown> => {
        if (typeof m !== "object" || m === null) return false;
        const r = m as Record<string, unknown>;
        return typeof r.name === "string" && Array.isArray(r.tasks);
      })
      .map((m) => ({
        name: (m.name as string).trim(),
        tasks: (m.tasks as unknown[])
          .filter(isValidTask)
          .map((t) => ({
            title: t.title.trim(),
            instructions: typeof t.instructions === "string" ? t.instructions.trim() : "",
            daysOffset: Math.round(t.daysOffset),
            guessed: t.guessed === true,
          })),
      }))
      .filter((m) => m.tasks.length > 0);

    if (milestones.length === 0) return { ok: false, message: "Luv couldn't find any tasks in this text — try pasting more of the checklist, or build it by hand instead." };
    return { ok: true, milestones };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Luv couldn't process this text." };
  }
}
