/**
 * Smart Import — propose an Active Commitment from contract / booking text
 * or from an uploaded PDF/DOCX (text extracted via the same file-parsing
 * helpers the Import wizard already uses).
 *
 * Extraction only produces a proposal. The original file is retained in the
 * documents bucket and attached on commit as a real Event document.
 */

import type { NormalizedActiveCommitment, ActiveCommitmentScheduleLine, ActiveCommitmentDocument } from "@/lib/migration/active-commitment";
import { validateActiveCommitment } from "@/lib/migration/active-commitment";
import { extractDocxText, extractPdfText } from "@/lib/import/file-parsing";

export type SmartActiveCommitmentProposal =
  | {
      ok: true;
      proposal: NormalizedActiveCommitment;
      confidenceNotes: string[];
      extractedTextPreview: string;
      retainedDocument: ActiveCommitmentDocument | null;
    }
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
  return (data.content.find((c) => c.type === "text")?.text ?? "").trim();
}

function buildPrompt(rawText: string): string {
  const truncated = rawText.length > 40_000 ? rawText.slice(0, 40_000) : rawText;
  return `You extract a venue's already-booked event financial commitment from a contract or booking document so it can be reviewed and imported into Hello to Cheers.

Return ONLY a JSON object (no markdown fences) with this shape:
{
  "clientEmail": string | null,
  "eventDate": "YYYY-MM-DD" | null,
  "contractedTotal": "18500.00",
  "packageName": string | null,
  "lines": [{ "description": string, "quantity": "1", "unitPrice": "18500.00" }] | null,
  "scheduleLines": [
    {
      "label": string,
      "amount": "5000.00",
      "dueDate": "YYYY-MM-DD" | null,
      "obligationKind": "deposit" | "installment" | "final" | "other" | null,
      "alreadyPaid": boolean,
      "paidDate": "YYYY-MM-DD" | null,
      "paymentMethod": string | null,
      "referenceNumber": string | null
    }
  ],
  "contractTitle": string | null,
  "contractSignedAt": "YYYY-MM-DD" | null,
  "contractSignerName": string | null,
  "bookedAt": "YYYY-MM-DD" | null,
  "confidenceNotes": string[]
}

Rules:
- Never invent amounts, dates, or emails. Use null when unknown.
- bookedAt is the historical booking commitment date only when the document clearly states when they booked. Do not copy contractSignedAt into bookedAt.
- scheduleLines must include both already-paid amounts and remaining obligations.
- The sum of scheduleLines amounts MUST equal contractedTotal when both are known.
- If only a package name and total are clear, put one line with that package and total.
- alreadyPaid=true only when the document clearly states that installment was collected.
- confidenceNotes: short human-readable caveats (e.g. "Payment dates inferred from installment language").

Document text:
"""
${truncated}
"""`;
}

function parseProposal(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function asScheduleLines(raw: unknown): ActiveCommitmentScheduleLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      label: asString(r.label) ?? "Payment",
      amount: asString(r.amount) ?? "0",
      dueDate: asString(r.dueDate),
      obligationKind: (asString(r.obligationKind) as ActiveCommitmentScheduleLine["obligationKind"]) ?? null,
      alreadyPaid: r.alreadyPaid === true,
      paidDate: asString(r.paidDate),
      paymentMethod: asString(r.paymentMethod),
      referenceNumber: asString(r.referenceNumber),
    };
  });
}

function buildProposalFromParsed(
  parsed: Record<string, unknown>,
  retainedDocument: ActiveCommitmentDocument | null,
): { proposal: NormalizedActiveCommitment; confidenceNotes: string[] } {
  const linesRaw = Array.isArray(parsed.lines) ? parsed.lines as Record<string, unknown>[] : null;
  const proposal: NormalizedActiveCommitment = {
    clientEmail: asString(parsed.clientEmail),
    eventDate: asString(parsed.eventDate),
    contractedTotal: asString(parsed.contractedTotal) ?? "",
    packageName: asString(parsed.packageName),
    lines: linesRaw?.map((l) => ({
      description: asString(l.description) ?? "Package",
      quantity: asString(l.quantity) ?? "1",
      unitPrice: asString(l.unitPrice) ?? asString(parsed.contractedTotal) ?? "0",
      packageId: null,
    })),
    scheduleLines: asScheduleLines(parsed.scheduleLines),
    contractTitle: asString(parsed.contractTitle) ?? "Externally executed agreement",
    contractSignedAt: asString(parsed.contractSignedAt),
    contractSignerName: asString(parsed.contractSignerName),
    bookedAt: asString(parsed.bookedAt) ?? asString(parsed.bookingDate),
    documents: retainedDocument ? [retainedDocument] : [],
    shareSignedAgreementWithCouple: false,
  };

  const confidenceNotes = Array.isArray(parsed.confidenceNotes)
    ? parsed.confidenceNotes.filter((n): n is string => typeof n === "string")
    : [];

  const validationError = validateActiveCommitment(proposal);
  if (validationError) {
    confidenceNotes.push(`Needs review before commit: ${validationError}`);
  }
  if (retainedDocument) {
    confidenceNotes.push(`Original file retained: ${retainedDocument.fileName}`);
  }

  return { proposal, confidenceNotes };
}

/** Extract a reviewable proposal from pasted/OCR text. */
export async function proposeActiveCommitmentFromDocument(
  rawText: string,
  retainedDocument: ActiveCommitmentDocument | null = null,
): Promise<SmartActiveCommitmentProposal> {
  if (!rawText.trim()) {
    return { ok: false, message: "Paste or upload a signed contract / booking document first." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      message: "Smart Import needs ANTHROPIC_API_KEY. You can still enter the commitment fields manually in the review form.",
    };
  }

  let text: string;
  try {
    text = await callClaude(buildPrompt(rawText));
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not extract commitment details.",
    };
  }

  const parsed = parseProposal(text);
  if (!parsed) {
    return { ok: false, message: "Smart Import could not structure this document. Enter the commitment manually for review." };
  }

  const { proposal, confidenceNotes } = buildProposalFromParsed(parsed, retainedDocument);
  return {
    ok: true,
    proposal,
    confidenceNotes,
    extractedTextPreview: rawText.slice(0, 500),
    retainedDocument,
  };
}

export async function extractTextFromCommitmentFile(
  buffer: Buffer,
  fileName: string,
): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const lower = fileName.toLowerCase();
  try {
    if (lower.endsWith(".docx")) {
      const text = await extractDocxText(buffer);
      if (!text.trim()) return { ok: false, message: "We couldn't read text from this Word document." };
      return { ok: true, text };
    }
    if (lower.endsWith(".pdf")) {
      const text = await extractPdfText(buffer);
      if (!text.trim()) {
        return { ok: false, message: "We couldn't read text from this PDF — it may be a scanned image. Try pasting the text, or upload a text-based PDF." };
      }
      return { ok: true, text };
    }
    if (lower.endsWith(".txt") || lower.endsWith(".md")) {
      return { ok: true, text: buffer.toString("utf8") };
    }
    return { ok: false, message: "Supported files: PDF, DOCX, TXT, or MD." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't read this file." };
  }
}
