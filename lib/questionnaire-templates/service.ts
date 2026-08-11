/**
 * Work Package D5D — Questionnaire Templates, extended for the Questionnaire
 * Family (Client Planning / Final Details / Post-Event Feedback).
 *
 * Applying a template SNAPSHOTS kind + included/required field ids onto the
 * event's working questionnaire for that kind. Editing a template afterward
 * never changes a questionnaire already in flight.
 */
import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  getQuestionnaireMasterByKind,
  masterIncludedFieldIds,
  masterRequiredFieldIds,
  type QuestionnaireKind,
} from "@/lib/questionnaire-family/definitions";

export type QuestionnaireTemplate = {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  kind: QuestionnaireKind;
  sourceMasterKey: string | null;
  includedFields: string[];
  requiredFields: string[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string; venue_id: string; name: string; description: string | null;
  kind: string; source_master_key: string | null;
  included_fields: string[]; required_fields: string[]; is_archived: boolean;
  created_at: string; updated_at: string;
};

function mapTemplate(r: Row): QuestionnaireTemplate {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, description: r.description,
    kind: (r.kind || "final_details") as QuestionnaireKind,
    sourceMasterKey: r.source_master_key ?? null,
    includedFields: r.included_fields ?? [],
    requiredFields: r.required_fields ?? [],
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
): Promise<{ ok: true; template: QuestionnaireTemplate } | { ok: false; message: string }> {
  if (!name.trim()) return { ok: false, message: "Name is required." };
  const master = getQuestionnaireMasterByKind(kind);
  const allowed = new Set(master.fields.map((f) => f.id));
  const included = includedFields.filter((f) => allowed.has(f));
  const required = requiredFields.filter((f) => included.includes(f));
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("questionnaire_templates")
    .insert({
      venue_id: venue.id, name: name.trim(), description: description.trim() || null,
      kind, included_fields: included, required_fields: required,
    })
    .select("*").single<Row>();
  if (error || !data) return { ok: false, message: error?.message ?? "Could not create template." };
  return { ok: true, template: mapTemplate(data) };
}

export async function updateTemplate(
  id: string,
  name: string,
  description: string,
  kind: QuestionnaireKind,
  includedFields: string[],
  requiredFields: string[],
): Promise<{ ok: boolean; message?: string }> {
  if (!name.trim()) return { ok: false, message: "Name is required." };
  const master = getQuestionnaireMasterByKind(kind);
  const allowed = new Set(master.fields.map((f) => f.id));
  const included = includedFields.filter((f) => allowed.has(f));
  const required = requiredFields.filter((f) => included.includes(f));
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { error } = await supabase.from("questionnaire_templates")
    .update({
      name: name.trim(), description: description.trim() || null,
      kind, included_fields: included, required_fields: required,
    })
    .eq("id", id).eq("venue_id", venue.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
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
  }).select("id").single<{ id: string }>();
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
  const kind = (template.kind || "final_details") as QuestionnaireKind;

  const { data: existing } = await supabase.from("event_questionnaires").select("id, status")
    .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .maybeSingle<{ id: string; status: string }>();

  if (existing && existing.status !== "draft") {
    return { ok: false, message: "This questionnaire has already been sent — its field configuration can't be changed anymore." };
  }

  const patch = {
    template_id: template.id,
    kind,
    included_fields: template.included_fields?.length
      ? template.included_fields
      : masterIncludedFieldIds(getQuestionnaireMasterByKind(kind)),
    required_fields: template.required_fields?.length
      ? template.required_fields
      : masterRequiredFieldIds(getQuestionnaireMasterByKind(kind)),
  };
  if (existing) {
    const { error } = await supabase.from("event_questionnaires").update(patch).eq("id", existing.id);
    if (error) return { ok: false, message: error.message };
  } else {
    const { error } = await supabase.from("event_questionnaires")
      .insert({ venue_id: venue.id, event_id: eventId, ...patch });
    if (error) return { ok: false, message: error.message };
  }
  return { ok: true };
}
