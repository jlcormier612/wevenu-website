/**
 * Work Package D5D — Questionnaire Templates, extended for the Questionnaire
 * Family (Client Planning / Final Details / Post-Event Feedback).
 *
 * Applying a template SNAPSHOTS kind + included/required field ids + custom
 * fields / wording overrides / field order onto the event's working
 * questionnaire for that kind. Editing a template afterward never changes a
 * questionnaire already in flight.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  getQuestionnaireMasterByKind,
  masterIncludedFieldIds,
  masterRequiredFieldIds,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";
import {
  sanitizeCustomFields,
  sanitizeFieldOrder,
  sanitizeMasterOverrides,
  type CustomQuestionnaireField,
  type MasterOverrides,
} from "@/lib/questionnaire-family/resolve";

export type QuestionnaireTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  kind: QuestionnaireKind;
  sourceMasterKey: string | null;
  includedFields: string[];
  requiredFields: string[];
  customFields: CustomQuestionnaireField[];
  masterOverrides: MasterOverrides;
  fieldOrder: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type QuestionnaireAuthoringInput = {
  name: string;
  description: string;
  includedFields: string[];
  requiredFields: string[];
  customFields?: unknown;
  masterOverrides?: unknown;
  fieldOrder?: unknown;
};

type Row = {
  id: string; venue_id: string; name: string; description: string | null;
  kind: string; source_master_key: string | null;
  included_fields: string[] | null; required_fields: string[] | null;
  custom_fields?: unknown; master_overrides?: unknown; field_order?: string[] | null;
  is_archived: boolean;
  created_at: string; updated_at: string;
};

function normalizeAuthoring(kind: QuestionnaireKind, input: {
  includedFields: string[];
  requiredFields: string[];
  customFields?: unknown;
  masterOverrides?: unknown;
  fieldOrder?: unknown;
}) {
  const master = getQuestionnaireMasterByKind(kind);
  const masterIds = new Set(master.fields.map((f) => f.id));
  const customs = sanitizeCustomFields(kind, input.customFields);
  const customIds = new Set(customs.map((c) => c.id));
  const included = [...new Set(input.includedFields.filter((id) => masterIds.has(id) || customIds.has(id)))];
  const required = input.requiredFields.filter((id) => included.includes(id));
  const masterOverrides = sanitizeMasterOverrides(kind, input.masterOverrides);
  const fieldOrder = sanitizeFieldOrder(kind, included, customs, input.fieldOrder);
  return { included, required, customs, masterOverrides, fieldOrder };
}

function mapTemplate(r: Row): QuestionnaireTemplate {
  const kind = (r.kind || "final_details") as QuestionnaireKind;
  const customs = sanitizeCustomFields(kind, r.custom_fields ?? []);
  const included = r.included_fields ?? [];
  return {
    id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
    kind,
    sourceMasterKey: r.source_master_key ?? null,
    includedFields: included,
    requiredFields: r.required_fields ?? [],
    customFields: customs,
    masterOverrides: sanitizeMasterOverrides(kind, r.master_overrides ?? {}),
    fieldOrder: sanitizeFieldOrder(kind, included.length ? included : [
      ...getQuestionnaireMasterByKind(kind).fields.map((f) => f.id),
      ...customs.map((c) => c.id),
    ], customs, r.field_order),
    isArchived: r.is_archived,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getTemplates(includeArchived = false): Promise<QuestionnaireTemplate[]> {
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  let query = supabase.from("questionnaire_templates").select("*").eq("venue_id", venue.id).order("name");
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data } = await query.returns<Row[]>();
  return (data ?? []).map(mapTemplate);
}

export async function getTemplate(id: string): Promise<QuestionnaireTemplate | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("questionnaire_templates").select("*")
    .eq("id", id).eq("venue_id", venue.id).maybeSingle<Row>();
  return data ? mapTemplate(data) : null;
}

export async function createTemplate(
  name: string,
  description: string,
  kind: QuestionnaireKind,
  includedFields: string[],
  requiredFields: string[],
  authoring?: {
    customFields?: unknown;
    masterOverrides?: unknown;
    fieldOrder?: unknown;
  },
): Promise<{ ok: true; template: QuestionnaireTemplate } | { ok: false; message: string }> {
  if (!name.trim()) return { ok: false, message: "Name is required." };
  const { included, required, customs, masterOverrides, fieldOrder } = normalizeAuthoring(kind, {
    includedFields,
    requiredFields,
    customFields: authoring?.customFields,
    masterOverrides: authoring?.masterOverrides,
    fieldOrder: authoring?.fieldOrder,
  });
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("questionnaire_templates")
    .insert({
      venue_id: venue.id, name: name.trim(), description: description.trim() || null,
      kind, included_fields: included, required_fields: required,
      custom_fields: customs,
      master_overrides: masterOverrides,
      field_order: fieldOrder,
    } as never)
    .select("*").single<Row>();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not create template." };
  return { ok: true, template: mapTemplate(data) };
}

/**
 * Persist Library authoring (name, purpose, include/require, wording, customs, order).
 * Kind is immutable once created (especially for starters).
 */
export async function saveQuestionnaireAuthoring(
  id: string,
  input: QuestionnaireAuthoringInput,
): Promise<{ ok: boolean; message?: string }> {
  if (!input.name.trim()) return { ok: false, message: "Name is required." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("questionnaire_templates").select("*")
    .eq("id", id).eq("venue_id", venue.id).maybeSingle<Row>();
  if (!existing) return { ok: false, message: "Template not found." };
  const kind = (existing.kind || "final_details") as QuestionnaireKind;
  const { included, required, customs, masterOverrides, fieldOrder } = normalizeAuthoring(kind, input);

  const { error } = await supabase.from("questionnaire_templates")
    .update({
      name: input.name.trim(),
      description: input.description.trim() || null,
      included_fields: included,
      required_fields: required,
      custom_fields: customs,
      master_overrides: masterOverrides,
      field_order: fieldOrder,
    } as never)
    .eq("id", id).eq("venue_id", venue.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

/** @deprecated Prefer saveQuestionnaireAuthoring for full-page editor. */
export async function updateTemplate(
  id: string,
  name: string,
  description: string,
  kind: QuestionnaireKind,
  includedFields: string[],
  requiredFields: string[],
  authoring?: {
    customFields?: unknown;
    masterOverrides?: unknown;
    fieldOrder?: unknown;
  },
): Promise<{ ok: boolean; message?: string }> {
  void kind; // kind changes blocked — use existing row kind via saveQuestionnaireAuthoring path
  return saveQuestionnaireAuthoring(id, {
    name,
    description,
    includedFields,
    requiredFields,
    customFields: authoring?.customFields,
    masterOverrides: authoring?.masterOverrides,
    fieldOrder: authoring?.fieldOrder,
  });
}

export async function setTemplateArchived(id: string, isArchived: boolean): Promise<{ ok: boolean; message?: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { error } = await supabase.from("questionnaire_templates").update({ is_archived: isArchived }).eq("id", id).eq("venue_id", venue.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function duplicateTemplate(id: string, newName: string): Promise<{ ok: true; templateId: string } | { ok: false; message: string }> {
  const source = await getTemplate(id);
  if (!source) return { ok: false, message: "Template not found." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("questionnaire_templates").insert({
    venue_id: venue.id,
    name: newName.trim() || `${source.name} (Copy)`,
    description: source.description,
    kind: source.kind,
    source_master_key: null,
    included_fields: source.includedFields,
    required_fields: source.requiredFields,
    custom_fields: source.customFields,
    master_overrides: source.masterOverrides,
    field_order: source.fieldOrder,
  } as never).select("id").single<{ id: string }>();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not duplicate." };
  return { ok: true, templateId: data.id };
}

/**
 * Snapshots template config onto the event's working questionnaire for this
 * template's kind. Creates the row if needed; only touches draft (unsent).
 */
export async function applyTemplateToEvent(
  templateId: string, eventId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data: template } = await supabase.from("questionnaire_templates").select("*")
    .eq("id", templateId).eq("venue_id", venue.id).maybeSingle<Row>();
  if (!template) return { ok: false, message: "Template not found." };
  if (template.is_archived) {
    return { ok: false, message: "This questionnaire is archived. Restore it in the Library before using it on an event." };
  }
  const kind = (template.kind || "final_details") as QuestionnaireKind;
  const mapped = mapTemplate(template);

  const { data: existing } = await supabase.from("event_questionnaires").select("id, status")
    .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .maybeSingle<{ id: string; status: string }>();

  if (existing && existing.status !== "draft") {
    return { ok: false, message: "This questionnaire has already been sent — its field configuration can't be changed anymore." };
  }

  const patch = {
    template_id: template.id,
    kind,
    included_fields: mapped.includedFields.length
      ? mapped.includedFields
      : masterIncludedFieldIds(getQuestionnaireMasterByKind(kind)),
    required_fields: mapped.requiredFields.length
      ? mapped.requiredFields
      : masterRequiredFieldIds(getQuestionnaireMasterByKind(kind)),
    custom_fields: mapped.customFields,
    master_overrides: mapped.masterOverrides,
    field_order: mapped.fieldOrder,
  };
  if (existing) {
    const { error } = await supabase.from("event_questionnaires").update(patch as never).eq("id", existing.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase.from("event_questionnaires")
      .insert({ venue_id: venue.id, event_id: eventId, ...patch } as never);
    if (error) return { ok: false, message: error.message };
  }
  return { ok: true };
}
