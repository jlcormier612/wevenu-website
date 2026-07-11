/**
 * Luv Import Assist — Vendor Management, Next Iteration (2026-07-10).
 *
 * Turns messy source material (a pasted list, or text extracted from a Word
 * doc / PDF that has no real columns) into structured rows a coordinator can
 * review in the same map → preview → import flow already used for CSV/Excel.
 * Same pattern as every other Luv capability: direct Anthropic call, gated
 * behind ANTHROPIC_API_KEY, and — critically — nothing is ever saved from
 * this on its own. It only ever produces a *proposal* that lands in the
 * existing Import wizard for a coordinator to review, edit, and confirm.
 */

import type { EntityType, ImportFieldDef } from "@/lib/import/types";
import { ENTITY_FIELDS } from "@/lib/import/types";

export type LuvImportProposal =
  | { ok: true; headers: string[]; rows: Record<string, string>[] }
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

function buildPrompt(rawText: string, fields: ImportFieldDef[]): string {
  const fieldList = fields.map((f) => `- ${f.key}${f.required ? " (required)" : ""}: ${f.label}`).join("\n");
  // Cap input length — this is meant for a pasted list or one document's
  // worth of text, not an arbitrarily large upload.
  const truncated = rawText.length > 20_000 ? rawText.slice(0, 20_000) : rawText;

  return `You are helping a venue coordinator import a list of records from a document into their software. Read the text below and extract every distinct record you can find, mapping each one to these fields:

${fieldList}

Rules:
- Only include a field if the source text actually states it — never invent a value.
- If a record is missing a required field, still include the row with that field left as an empty string; the coordinator will fix it.
- Preserve the source text's own values verbatim (don't reformat phone numbers, names, etc.).
- Return ONLY a JSON array of objects, one per record, using exactly the field keys above as object keys. No prose, no markdown fences, no explanation — just the JSON array. If you find no records at all, return an empty array: []

Source text:
"""
${truncated}
"""`;
}

export async function proposeStructuredRows(rawText: string, entity: EntityType): Promise<LuvImportProposal> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Luv isn't configured for this venue yet — try Copy/Paste with a clearly columned list, or CSV/Excel instead." };
  }
  if (!rawText.trim()) {
    return { ok: false, message: "There's no readable text to work with." };
  }

  const fields = ENTITY_FIELDS[entity];
  try {
    const raw = await callClaude(buildPrompt(rawText, fields));
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { ok: false, message: "Luv couldn't find any structured records in this text." };

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { ok: false, message: "Luv couldn't find any structured records in this text." };
    }

    const fieldKeys = new Set(fields.map((f) => f.key));
    const rows: Record<string, string>[] = parsed
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .map((r) => {
        const row: Record<string, string> = {};
        for (const key of Object.keys(r)) {
          if (fieldKeys.has(key)) row[key] = typeof r[key] === "string" ? r[key] : String(r[key] ?? "");
        }
        return row;
      });

    if (rows.length === 0) return { ok: false, message: "Luv couldn't find any structured records in this text." };
    return { ok: true, headers: fields.map((f) => f.key), rows };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Luv couldn't process this text." };
  }
}
