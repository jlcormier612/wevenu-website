/**
 * Deterministic White Glove material parsers.
 * Uploading or parsing does not create venue records. The operator confirms apply.
 * Dates are taken only from explicit source timing — never guessed.
 */

import type { MessageTemplateCategory } from "@/lib/message-templates/types";

export const MESSAGE_TEMPLATE_CATEGORIES: readonly MessageTemplateCategory[] = [
  "inquiry_follow_up",
  "tour",
  "booking_confirmation",
  "planning_reminder",
  "payment_reminder",
  "vendor_coordination",
  "post_event",
  "general",
];

const SUPPORTED_MESSAGE_KEYS = new Set([
  "name",
  "category",
  "emailSubject",
  "emailBody",
  "smsBody",
  "channel",
  "subject",
  "body",
]);

export type MessageImportProposal = {
  include: boolean;
  name: string;
  category: MessageTemplateCategory;
  emailSubject: string;
  emailBody: string;
  smsBody: string;
  unsupported: string[];
  warnings: string[];
};

export type MessageImportParse =
  | { ok: true; proposals: MessageImportProposal[]; notes: string[] }
  | { ok: false; message: string };

export type PlanningTaskProposal = {
  include: boolean;
  milestone: string;
  title: string;
  instructions: string;
  /** Null when the source did not state a timing. Apply must not invent one. */
  daysOffset: number | null;
  timingKnown: boolean;
  sourceLine: string;
};

export type PlanningImportParse =
  | { ok: true; tasks: PlanningTaskProposal[]; notes: string[] }
  | { ok: false; message: string };

function isCategory(value: string): value is MessageTemplateCategory {
  return (MESSAGE_TEMPLATE_CATEGORIES as readonly string[]).includes(value);
}

function proposalFromRecord(raw: Record<string, unknown>, index: number): MessageImportProposal {
  const unsupported = Object.keys(raw).filter((k) => !SUPPORTED_MESSAGE_KEYS.has(k));
  const warnings: string[] = [];
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const categoryRaw = typeof raw.category === "string" ? raw.category.trim() : "";
  let category: MessageTemplateCategory = "general";
  if (!categoryRaw) warnings.push("Category was missing; left as general for review.");
  else if (!isCategory(categoryRaw)) {
    warnings.push(`Category “${categoryRaw}” is not a Hello to Cheers category and was not applied.`);
  } else category = categoryRaw;

  const emailSubject = typeof raw.emailSubject === "string"
    ? raw.emailSubject
    : typeof raw.subject === "string"
      ? raw.subject
      : "";
  const emailBody = typeof raw.emailBody === "string"
    ? raw.emailBody
    : typeof raw.body === "string"
      ? raw.body
      : "";
  const smsBody = typeof raw.smsBody === "string" ? raw.smsBody : "";
  const channel = typeof raw.channel === "string" ? raw.channel.trim().toLowerCase() : "";
  if (channel === "sms" && emailBody && !smsBody) {
    warnings.push("Channel is sms; email body was kept visible but will not be saved unless you clear the channel intent.");
  }
  if (!name) warnings.push(`Template ${index + 1} has no name.`);
  if (unsupported.length) {
    warnings.push(`Unsupported fields kept out of the template: ${unsupported.join(", ")}.`);
  }
  return {
    include: Boolean(name) && Boolean(emailBody.trim() || smsBody.trim() || emailSubject.trim()),
    name: name || `Untitled template ${index + 1}`,
    category,
    emailSubject: emailSubject.trim(),
    emailBody: channel === "sms" ? "" : emailBody.trim(),
    smsBody: channel === "email" ? "" : smsBody.trim() || (channel === "sms" ? emailBody.trim() : ""),
    unsupported,
    warnings,
  };
}

function parseJsonTemplates(text: string): MessageImportParse | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: "This file looks like JSON but is not valid. Nothing was imported." };
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  if (rows.some((r) => typeof r !== "object" || r === null || Array.isArray(r))) {
    return { ok: false, message: "Message template JSON must be an object or an array of objects. Nothing was imported." };
  }
  const proposals = rows.map((r, i) => proposalFromRecord(r as Record<string, unknown>, i));
  if (proposals.length === 0) {
    return { ok: false, message: "The JSON file did not contain any templates. Nothing was imported." };
  }
  return {
    ok: true,
    proposals,
    notes: ["Parsed as JSON. Confirm before any template is saved. Existing templates are not overwritten."],
  };
}

function parseBlockTemplates(text: string): MessageImportParse {
  const chunks = text.split(/\n---\n/).map((c) => c.trim()).filter(Boolean);
  const proposals: MessageImportProposal[] = [];
  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const fields: Record<string, string> = {};
    const bodyLines: string[] = [];
    let inBody = false;
    for (const line of lines) {
      if (line.trim() === "---") continue;
      if (!inBody && /^(Name|Category|Subject|Channel):\s*/i.test(line)) {
        const idx = line.indexOf(":");
        const key = line.slice(0, idx).trim().toLowerCase();
        fields[key] = line.slice(idx + 1).trim();
        continue;
      }
      if (/^Body:\s*/i.test(line)) {
        inBody = true;
        const rest = line.replace(/^Body:\s*/i, "").trimEnd();
        if (rest) bodyLines.push(rest);
        continue;
      }
      if (inBody) bodyLines.push(line);
    }
    proposals.push(proposalFromRecord({
      name: fields.name ?? "",
      category: fields.category ?? "",
      subject: fields.subject ?? "",
      channel: fields.channel ?? "",
      body: bodyLines.join("\n").trim(),
    }, proposals.length));
  }
  if (proposals.length === 0) {
    return { ok: false, message: "No message templates were found in this file. Nothing was imported." };
  }
  return {
    ok: true,
    proposals,
    notes: ["Parsed as labeled template blocks. Review each one before confirming."],
  };
}

export function parseMessageTemplateSource(text: string): MessageImportParse {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: "The file has no text. Nothing was imported." };
  const json = parseJsonTemplates(trimmed);
  if (json) return json;
  if (/^---$/m.test(trimmed) || /^Name:/m.test(trimmed)) return parseBlockTemplates(trimmed);
  return {
    ok: true,
    proposals: [proposalFromRecord({
      name: "",
      category: "general",
      body: trimmed,
    }, 0)],
    notes: [
      "This file is unstructured text. One draft template was proposed from the full text. It is not saved until you confirm.",
    ],
  };
}

const BEFORE = /(\d+)\s*(day|days|week|weeks)\s+before/i;
const AFTER = /(\d+)\s*(day|days|week|weeks)\s+after/i;

export function timingFromLine(line: string): { daysOffset: number; timingKnown: true } | { daysOffset: null; timingKnown: false } {
  if (/\bday[- ]of\b/i.test(line)) return { daysOffset: 0, timingKnown: true };
  const before = line.match(BEFORE);
  if (before) {
    const n = Number(before[1]);
    const days = /week/i.test(before[2]) ? n * 7 : n;
    return { daysOffset: -days, timingKnown: true };
  }
  const after = line.match(AFTER);
  if (after) {
    const n = Number(after[1]);
    const days = /week/i.test(after[2]) ? n * 7 : n;
    return { daysOffset: days, timingKnown: true };
  }
  return { daysOffset: null, timingKnown: false };
}

export function parsePlanningChecklist(text: string): PlanningImportParse {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l && !/^--\s*\d+\s+of\s+\d+\s*--$/i.test(l));
  if (lines.length === 0) {
    return { ok: false, message: "No planning text could be read. Nothing was applied." };
  }
  let milestone = "Imported";
  const tasks: PlanningTaskProposal[] = [];
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      milestone = line.replace(/^#{1,3}\s+/, "").trim() || milestone;
      continue;
    }
    const title = line.replace(/^[-–—•*]\s*/, "").trim();
    if (!title) continue;
    const timing = timingFromLine(title);
    tasks.push({
      include: true,
      milestone,
      title,
      instructions: "",
      daysOffset: timing.daysOffset,
      timingKnown: timing.timingKnown,
      sourceLine: line,
    });
  }
  if (tasks.length === 0) {
    return { ok: false, message: "No checklist items were found. Nothing was applied." };
  }
  const missing = tasks.filter((t) => !t.timingKnown).length;
  return {
    ok: true,
    tasks,
    notes: [
      "Extracted for review only. Nothing is on the venue checklist until you apply.",
      missing
        ? `${missing} item(s) have no timing in the source. Set a days-before/after value or exclude them. A date will not be invented.`
        : "Every item had an explicit timing in the source.",
    ],
  };
}
