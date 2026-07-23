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

import type { EntityType, FieldMapping, ImportFieldDef } from "@/lib/import/types";
import { ENTITY_FIELDS } from "@/lib/import/types";

export type LuvImportProposal =
  // aiStructured distinguishes a real Luv proposal (headers are actual field
  // keys, rows reviewed for scrutiny — the wizard's "Luv helped structure
  // this" banner) from the non-AI splitDelimitedRows fallback (headers are
  // generic "Column N" placeholders the coordinator maps themselves, same
  // as any other headerless import) — they land in very different states
  // downstream and must not be labeled the same way.
  | { ok: true; headers: string[]; rows: Record<string, string>[]; aiStructured: boolean }
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

/**
 * Plain, deterministic fallback with no AI involved at all — used whenever
 * ANTHROPIC_API_KEY isn't configured (bug report, 2026-07-22: a coordinator
 * pasting a plain list of inquiries/vendors saw nothing happen at all, since
 * this used to hard-fail with "Luv isn't configured" the moment a paste
 * didn't parse as clean CSV). Splits on whichever delimiter (tab, comma, or
 * 2+ spaces) is most consistent across the pasted lines and hands the result
 * to the same generic "Column 1, Column 2, …" map-your-columns step a
 * headerless CSV already goes through — no field-guessing attempted here,
 * the coordinator maps columns themselves same as any other headerless
 * import. Doesn't invent structure Luv's AI path would otherwise infer (e.g.
 * a paragraph with no delimiters at all still becomes one column, one row
 * per line) — it's a safety net, not a replacement for real structuring.
 */
function splitDelimitedRows(rawText: string): LuvImportProposal {
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, message: "There's no readable text to work with." };

  const countOf = (line: string, re: RegExp) => (line.match(re) ?? []).length;
  const tabTotal = lines.reduce((sum, l) => sum + countOf(l, /\t/g), 0);
  const commaTotal = lines.reduce((sum, l) => sum + countOf(l, /,/g), 0);
  const multiSpaceTotal = lines.reduce((sum, l) => sum + countOf(l, /\s{2,}/g), 0);

  let splitter: RegExp;
  if (tabTotal >= commaTotal && tabTotal >= multiSpaceTotal && tabTotal > 0) splitter = /\t/;
  else if (commaTotal >= multiSpaceTotal && commaTotal > 0) splitter = /,/;
  else if (multiSpaceTotal > 0) splitter = /\s{2,}/;
  else splitter = /$^/; // never matches — each line stays a single column

  const splitLines = lines.map((l) => l.split(splitter).map((c) => c.trim()));
  const columnCount = Math.max(1, ...splitLines.map((c) => c.length));
  const headers = Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);
  const rows = splitLines.map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = cells[i] ?? ""; });
    return row;
  });

  return { ok: true, headers, rows, aiStructured: false };
}

export async function proposeStructuredRows(rawText: string, entity: EntityType): Promise<LuvImportProposal> {
  if (!rawText.trim()) {
    return { ok: false, message: "There's no readable text to work with." };
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return splitDelimitedRows(rawText);
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
    return { ok: true, headers: fields.map((f) => f.key), rows, aiStructured: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Luv couldn't process this text." };
  }
}

export type LuvFieldMappingProposal =
  | { ok: true; mapping: FieldMapping }
  | { ok: false; message: string };

function buildFieldMappingPrompt(headers: string[], fields: ImportFieldDef[]): string {
  const headerList = headers.map((h) => `- "${h}"`).join("\n");
  const fieldList = fields.map((f) => `- ${f.key}${f.required ? " (required)" : ""}: ${f.label}`).join("\n");

  return `You are helping a venue coordinator import a spreadsheet into their software. Below are the column headers from their file, and the fields their software needs filled in.

Column headers in their file:
${headerList}

Fields to fill in (key: what it means):
${fieldList}

For each field, name the ONE column header that most likely contains that data, or null if none of the headers are a good match. Only propose a mapping you're reasonably confident about — an unfamiliar or ambiguous header is better left unmapped than guessed wrong; the coordinator reviews every suggestion before anything is imported.

Return ONLY a JSON object with one entry per field key above, each value either one of the exact header strings shown (copied exactly, including punctuation/capitalization) or null. No prose, no markdown fences — just the JSON object.`;
}

/**
 * Migration Center §2.1 item 4 (2026-07-22) — extends Luv's existing
 * import-assist family from "structure this unstructured text"
 * (proposeStructuredRows above) to "suggest which of my columns maps to
 * which of your fields," for genuinely unfamiliar competitor-export column
 * headers the field-mapping step's own lowercase-similarity auto-match
 * can't confidently resolve. A proposal only — the wizard merges this into
 * its own mapping state as pre-filled *suggestions*, never auto-committed,
 * matching every other Luv-assist surface's rule.
 */
export async function proposeFieldMapping(headers: string[], entity: EntityType): Promise<LuvFieldMappingProposal> {
  if (headers.length === 0) return { ok: false, message: "There are no columns to map." };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: false, message: "Luv's mapping assist isn't configured in this environment." };
  }

  const fields = ENTITY_FIELDS[entity];
  const headerSet = new Set(headers);
  const fieldKeys = new Set(fields.map((f) => f.key));

  try {
    const raw = await callClaude(buildFieldMappingPrompt(headers, fields));
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, message: "Luv couldn't suggest a mapping for these columns." };

    const parsed = JSON.parse(jsonMatch[0]) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return { ok: false, message: "Luv couldn't suggest a mapping for these columns." };
    }

    // Defensive: only accept a proposed header that's actually one of the
    // real headers we sent — never trust a hallucinated column name — and
    // only for a field key that's actually part of this entity's schema.
    const mapping: FieldMapping = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!fieldKeys.has(key)) continue;
      if (typeof value === "string" && headerSet.has(value)) mapping[key] = value;
    }

    if (Object.keys(mapping).length === 0) {
      return { ok: false, message: "Luv couldn't confidently match any of these columns — you'll need to map them yourself." };
    }
    return { ok: true, mapping };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Luv couldn't process this text." };
  }
}
