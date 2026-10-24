/**
 * Read-only display of a submitted questionnaire — same field resolution
 * as the couple form, no second answer store.
 */
import { kindLabel, type QuestionnaireKind } from "@/lib/questionnaire-family/definitions";
import {
  resolveQuestionnaireFields,
  type CustomQuestionnaireField,
  type MasterOverrides,
  type ResolvedQuestionnaireField,
} from "@/lib/questionnaire-family/resolve";

export type SubmittedQuestionnaireSource = {
  kind: QuestionnaireKind | string;
  status: string;
  final_guest_count?: number | null;
  event_guest_count?: number | null;
  meal_notes?: string | null;
  processional_song?: string | null;
  recessional_song?: string | null;
  first_dance_song?: string | null;
  parent_dances?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  special_requests?: string | null;
  ceremony_start_time?: string | null;
  reception_start_time?: string | null;
  ceremony_location?: string | null;
  reception_location?: string | null;
  vendor_notes?: string | null;
  included_fields?: string[] | null;
  required_fields?: string[] | null;
  custom_fields?: CustomQuestionnaireField[] | null;
  master_overrides?: MasterOverrides | null;
  field_order?: string[] | null;
  additional?: { family?: Record<string, string> } | null;
};

export type SubmittedAnswerRow = {
  id: string;
  section: string;
  label: string;
  value: string;
};

const COLUMN_KEYS = [
  "meal_notes",
  "processional_song",
  "recessional_song",
  "first_dance_song",
  "parent_dances",
  "emergency_contact_name",
  "emergency_contact_phone",
  "special_requests",
  "vendor_notes",
  "ceremony_start_time",
  "reception_start_time",
  "ceremony_location",
  "reception_location",
] as const;

function columnValue(data: SubmittedQuestionnaireSource, column: string): string {
  const map: Record<string, string | null | undefined> = {};
  for (const key of COLUMN_KEYS) {
    map[key] = data[key] ?? null;
  }
  return map[column] ?? "";
}

function parseMulti(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* comma-separated */
  }
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatChoiceLabel(field: ResolvedQuestionnaireField, raw: string): string {
  if (!raw.trim()) return "";
  if (field.customType === "multiple_choice" || field.type === "long_text") {
    const parts = parseMulti(raw);
    if (parts.length === 0) return raw;
    return parts
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  return field.options?.find((o) => o.value === raw)?.label ?? raw;
}

function answerForField(
  field: ResolvedQuestionnaireField,
  data: SubmittedQuestionnaireSource,
  family: Record<string, string>,
): string {
  if (field.type === "guest_count_confirm") {
    const count = data.final_guest_count ?? data.event_guest_count;
    return count != null ? String(count) : "";
  }
  if (field.destination === "display_only") {
    return "";
  }
  if (field.destination === "column" && field.column) {
    return columnValue(data, field.column).trim();
  }
  const raw = family[field.id] ?? "";
  return formatChoiceLabel(field, raw).trim();
}

function isVisible(
  field: ResolvedQuestionnaireField,
  fields: ResolvedQuestionnaireField[],
  family: Record<string, string>,
): boolean {
  const controller = fields.find((c) => c.followUpId === field.id);
  if (!controller?.showFollowUpWhen) return true;
  const choice = family[controller.id] ?? "";
  return controller.showFollowUpWhen.includes(choice);
}

/** Title for Documents / portal — questionnaire family name, not a hardcode. */
export function submittedQuestionnaireTitle(kind: string | null | undefined): string {
  return kindLabel((kind as QuestionnaireKind) || "final_details");
}

/**
 * Questions + submitted answers for read-only client Documents / portal review.
 * Skips empty display-only rows; keeps unanswered required fields as "—".
 */
export function buildSubmittedAnswerRows(
  data: SubmittedQuestionnaireSource,
): SubmittedAnswerRow[] {
  const kind = (data.kind || "final_details") as QuestionnaireKind;
  const fields = resolveQuestionnaireFields({
    kind,
    includedFields: data.included_fields ?? undefined,
    requiredFields: data.required_fields ?? undefined,
    customFields: data.custom_fields ?? undefined,
    masterOverrides: data.master_overrides ?? undefined,
    fieldOrder: data.field_order ?? undefined,
  });
  const family = data.additional?.family ?? {};
  const rows: SubmittedAnswerRow[] = [];
  for (const field of fields) {
    if (!isVisible(field, fields, family)) continue;
    if (field.destination === "display_only") continue;
    const value = answerForField(field, data, family);
    rows.push({
      id: field.id,
      section: field.section,
      label: field.label,
      value: value || "—",
    });
  }
  return rows;
}

export function isSubmittedQuestionnaireDocumentStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    status === "submitted"
    || status === "resubmitted"
    || status === "complete"
    || status === "completed"
    || status === "changes_requested"
  );
}
