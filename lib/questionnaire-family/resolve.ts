/**
 * Resolve visible questionnaire fields for Library authoring + client render.
 * Masters stay in code; venue overrides / customs / order are snapshotted.
 */

import {
  getQuestionnaireMasterByKind,
  type QuestionnaireFieldDef,
  type QuestionnaireFieldType,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";

/** Venue-authored questions — always narrative answers in additional.family. */
export type CustomQuestionnaireFieldType =
  | "short_text"
  | "long_text"
  | "yes_no"
  | "single_choice"
  | "multiple_choice"
  | "date";

export type CustomQuestionnaireField = {
  id: string;
  section: string;
  label: string;
  helper?: string;
  required: boolean;
  type: CustomQuestionnaireFieldType;
  options?: { value: string; label: string }[];
  /** Always family — enforced in service validation. */
  destination: "family";
};

export type MasterFieldOverride = {
  label?: string;
  helper?: string | null;
};

export type MasterOverrides = Record<string, MasterFieldOverride>;

export type ResolvedQuestionnaireField = QuestionnaireFieldDef & {
  /** True when this field was authored by the venue (not a Hello to Cheers master). */
  isCustom?: boolean;
  /** True when the field is system-connected (destination !== family, or special types). */
  isSystemConnected?: boolean;
  /** Original custom type when isCustom — for couple renderer (yes_no, multiple_choice, date). */
  customType?: CustomQuestionnaireFieldType;
};

const CUSTOM_TYPES: CustomQuestionnaireFieldType[] = [
  "short_text", "long_text", "yes_no", "single_choice", "multiple_choice", "date",
];

export function isCustomQuestionType(t: string): t is CustomQuestionnaireFieldType {
  return (CUSTOM_TYPES as string[]).includes(t);
}

export function isSystemConnectedField(field: QuestionnaireFieldDef): boolean {
  if (field.destination !== "family") return true;
  return [
    "guest_count_confirm",
    "known_timing_confirm",
    "known_ceremony_confirm",
    "vendor_review",
    "people_notes",
  ].includes(field.type);
}

function customToResolved(c: CustomQuestionnaireField): ResolvedQuestionnaireField {
  const type: QuestionnaireFieldType =
    c.type === "yes_no" ? "single_choice"
      : c.type === "multiple_choice" ? "long_text"
        : c.type === "date" ? "short_text"
          : c.type;

  const options = c.type === "yes_no"
    ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]
    : c.options;

  return {
    id: c.id,
    section: c.section || "Your Questions",
    label: c.label,
    helper: c.helper,
    required: c.required,
    type,
    options,
    destination: "family",
    isCustom: true,
    isSystemConnected: false,
    customType: c.type,
  };
}

export type ResolveInput = {
  kind: QuestionnaireKind;
  includedFields?: string[] | null;
  requiredFields?: string[] | null;
  customFields?: CustomQuestionnaireField[] | null;
  masterOverrides?: MasterOverrides | null;
  fieldOrder?: string[] | null;
};

/**
 * Build the ordered field list the couple (and Preview) see.
 */
export function resolveQuestionnaireFields(input: ResolveInput): ResolvedQuestionnaireField[] {
  const master = getQuestionnaireMasterByKind(input.kind);
  const masterById = new Map(master.fields.map((f) => [f.id, f]));
  const customs = (input.customFields ?? []).filter((c) => c?.id && c.label?.trim());
  const customById = new Map(customs.map((c) => [c.id, c]));
  const overrides = input.masterOverrides ?? {};

  const masterIds = master.fields.map((f) => f.id);
  const snapshot = input.includedFields ?? [];
  const snapshotLooksLikeFamily = snapshot.some((id) => masterIds.includes(id) || customById.has(id));
  const included = new Set(
    snapshotLooksLikeFamily && snapshot.length
      ? snapshot
      : [...masterIds, ...customs.map((c) => c.id)],
  );
  const requiredSnap = input.requiredFields ?? [];
  const required = new Set(
    requiredSnap.length
      ? requiredSnap
      : master.fields.filter((f) => f.required).map((f) => f.id),
  );

  function resolveOne(id: string): ResolvedQuestionnaireField | null {
    if (!included.has(id)) return null;
    const custom = customById.get(id);
    if (custom) {
      const r = customToResolved(custom);
      return { ...r, required: required.has(id) || custom.required };
    }
    const base = masterById.get(id);
    if (!base) return null;
    const o = overrides[id];
    return {
      ...base,
      label: o?.label?.trim() || base.label,
      helper: o?.helper === null ? undefined : (o?.helper ?? base.helper),
      required: required.has(id),
      isCustom: false,
      isSystemConnected: isSystemConnectedField(base),
    };
  }

  const order = input.fieldOrder?.length
    ? input.fieldOrder
    : [...masterIds, ...customs.map((c) => c.id)];

  const seen = new Set<string>();
  const out: ResolvedQuestionnaireField[] = [];
  for (const id of order) {
    if (seen.has(id)) continue;
    const field = resolveOne(id);
    if (field) {
      out.push(field);
      seen.add(id);
    }
  }
  // Any included ids missing from order
  for (const id of included) {
    if (seen.has(id)) continue;
    const field = resolveOne(id);
    if (field) out.push(field);
  }
  return out;
}

export function sanitizeCustomFields(
  kind: QuestionnaireKind,
  raw: unknown,
): CustomQuestionnaireField[] {
  if (!Array.isArray(raw)) return [];
  const masterIds = new Set(getQuestionnaireMasterByKind(kind).fields.map((f) => f.id));
  const out: CustomQuestionnaireField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const label = typeof r.label === "string" ? r.label.trim() : "";
    if (!id || !label || masterIds.has(id) || !id.startsWith("custom_")) continue;
    const type = typeof r.type === "string" && isCustomQuestionType(r.type) ? r.type : "long_text";
    let options: { value: string; label: string }[] | undefined;
    if (type === "single_choice" || type === "multiple_choice") {
      const opts = Array.isArray(r.options) ? r.options : [];
      options = opts
        .map((o) => {
          if (!o || typeof o !== "object") return null;
          const oo = o as Record<string, unknown>;
          const value = typeof oo.value === "string" ? oo.value.trim() : "";
          const olabel = typeof oo.label === "string" ? oo.label.trim() : "";
          if (!value || !olabel) return null;
          return { value, label: olabel };
        })
        .filter((x): x is { value: string; label: string } => !!x);
      if (!options.length) options = [{ value: "option_1", label: "Option 1" }];
    }
    out.push({
      id,
      section: typeof r.section === "string" && r.section.trim() ? r.section.trim() : "Your Questions",
      label,
      helper: typeof r.helper === "string" && r.helper.trim() ? r.helper.trim() : undefined,
      required: r.required === true,
      type,
      options,
      destination: "family",
    });
  }
  return out;
}

export function sanitizeMasterOverrides(kind: QuestionnaireKind, raw: unknown): MasterOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const masterIds = new Set(getQuestionnaireMasterByKind(kind).fields.map((f) => f.id));
  const out: MasterOverrides = {};
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!masterIds.has(id) || !val || typeof val !== "object") continue;
    const v = val as Record<string, unknown>;
    const entry: MasterFieldOverride = {};
    if (typeof v.label === "string" && v.label.trim()) entry.label = v.label.trim();
    if (v.helper === null) entry.helper = null;
    else if (typeof v.helper === "string") entry.helper = v.helper;
    if (entry.label !== undefined || entry.helper !== undefined) out[id] = entry;
  }
  return out;
}

export function sanitizeFieldOrder(
  kind: QuestionnaireKind,
  included: string[],
  customs: CustomQuestionnaireField[],
  order: unknown,
): string[] {
  const allowed = new Set([...included, ...customs.map((c) => c.id)]);
  const masterIds = getQuestionnaireMasterByKind(kind).fields.map((f) => f.id);
  const base = Array.isArray(order)
    ? order.filter((id): id is string => typeof id === "string" && allowed.has(id))
    : [...masterIds.filter((id) => allowed.has(id)), ...customs.map((c) => c.id).filter((id) => allowed.has(id))];
  const seen = new Set(base);
  for (const id of allowed) {
    if (!seen.has(id)) base.push(id);
  }
  return base;
}

export function newCustomFieldId(): string {
  return `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
