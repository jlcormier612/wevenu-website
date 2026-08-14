"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/integrations/supabase/server";
import {
  reopenQuestionnaire,
  saveQuestionnaire,
  sendQuestionnaireToCouple,
  withdrawQuestionnaireAccess,
  type Questionnaire,
} from "@/lib/events/questionnaire";
import {
  addQuestionnaireStarterAgain,
  ensureQuestionnaireFamilyForCurrentVenue,
  provisionMissingQuestionnaireStarters,
} from "@/lib/questionnaire-family/provision";
import type { QuestionnaireKind } from "@/lib/questionnaire-family/definitions";
import * as templates from "@/lib/questionnaire-templates/service";

export async function saveQuestionnaireAction(
  eventId: string,
  fields: Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt" | "templateId" | "includedFields" | "requiredFields" | "kind" | "additional">>,
  submit = false,
  options?: {
    requiredFields?: string[];
    expectedUpdatedAt?: string;
    kind?: QuestionnaireKind;
    additional?: { family?: Record<string, string> } | null;
  },
): Promise<{ ok: boolean; message?: string; reason?: "stale"; updatedAt?: string }> {
  const result = await saveQuestionnaire(eventId, fields, submit, options);
  if (result.ok) {
    revalidatePath(`/events/${eventId}`);
    if (submit) {
      void (async () => {
        try {
          const { createClient: mk } = await import("@/integrations/supabase/server");
          const { getCurrentVenue } = await import("@/lib/venue/service");
          const { triggerAutoComplete } = await import("@/lib/playbooks/service");
          const [sb, venue] = await Promise.all([mk(), getCurrentVenue()]);
          if (venue) await triggerAutoComplete(sb, venue.id, eventId, "questionnaire_submitted");
        } catch { /* non-blocking */ }
      })();
      void (async () => {
        try {
          const supabase = await createClient();
          const { data: ev } = await supabase.from("events")
            .select("client_id").eq("id", eventId).maybeSingle<{ client_id: string | null }>();
          if (!ev?.client_id) return;
          const { data: client } = await supabase.from("clients")
            .select("lead_id").eq("id", ev.client_id).maybeSingle<{ lead_id: string | null }>();
          if (!client?.lead_id) return;
          const { refreshLeadScore } = await import("@/lib/leads/scores");
          await refreshLeadScore(client.lead_id);
        } catch { /* non-blocking */ }
      })();
    }
  }
  return result;
}

export async function sendQuestionnaireAction(
  eventId: string,
  coupleEmail: string,
  coupleName: string,
  eventName: string,
  threadId?: string,
  customMessage?: string,
  kind: QuestionnaireKind = "final_details",
): Promise<{ ok: boolean; formUrl?: string; message?: string }> {
  const result = await sendQuestionnaireToCouple(eventId, coupleEmail, coupleName, eventName, threadId, customMessage, kind);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function reopenQuestionnaireAction(
  eventId: string,
  kind: QuestionnaireKind = "final_details",
): Promise<{ ok: boolean; message?: string }> {
  const result = await reopenQuestionnaire(eventId, kind);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function withdrawQuestionnaireAccessAction(
  eventId: string,
  kind: QuestionnaireKind = "final_details",
): Promise<{ ok: boolean; message?: string }> {
  const result = await withdrawQuestionnaireAccess(eventId, kind);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function applyQuestionnaireTemplateAction(templateId: string, eventId: string): Promise<{ ok: boolean; message?: string }> {
  const result = await templates.applyTemplateToEvent(templateId, eventId);
  if (result.ok) {
    revalidatePath(`/events/${eventId}`);
    revalidatePath("/library/questionnaire-templates");
  }
  return result;
}

export async function createQuestionnaireTemplateAction(
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
) {
  const result = await templates.createTemplate(name, description, kind, includedFields, requiredFields, authoring);
  if (result.ok) {
    revalidatePath("/library/questionnaire-templates");
    if (result.template?.id) revalidatePath(`/library/questionnaire-templates/${result.template.id}`);
  }
  return result;
}

export async function updateQuestionnaireTemplateAction(
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
) {
  const result = await templates.updateTemplate(id, name, description, kind, includedFields, requiredFields, authoring);
  if (result.ok) {
    revalidatePath("/library/questionnaire-templates");
    revalidatePath(`/library/questionnaire-templates/${id}`);
  }
  return result;
}

export async function saveQuestionnaireAuthoringAction(
  id: string,
  input: {
    name: string;
    description: string;
    includedFields: string[];
    requiredFields: string[];
    customFields?: unknown;
    masterOverrides?: unknown;
    fieldOrder?: unknown;
  },
) {
  const result = await templates.saveQuestionnaireAuthoring(id, input);
  if (result.ok) {
    revalidatePath("/library/questionnaire-templates");
    revalidatePath(`/library/questionnaire-templates/${id}`);
    revalidatePath(`/library/questionnaire-templates/${id}/preview`);
  }
  return result;
}

export async function setQuestionnaireTemplateArchivedAction(id: string, isArchived: boolean) {
  const result = await templates.setTemplateArchived(id, isArchived);
  if (result.ok) {
    revalidatePath("/library/questionnaire-templates");
    revalidatePath(`/library/questionnaire-templates/${id}`);
  }
  return result;
}

export async function duplicateQuestionnaireTemplateAction(id: string, newName: string) {
  const result = await templates.duplicateTemplate(id, newName);
  if (result.ok) {
    revalidatePath("/library/questionnaire-templates");
    if (result.templateId) revalidatePath(`/library/questionnaire-templates/${result.templateId}`);
  }
  return result;
}

export async function ensureQuestionnaireFamilyAction() {
  const result = await ensureQuestionnaireFamilyForCurrentVenue();
  if (result.ok) revalidatePath("/library/questionnaire-templates");
  return result;
}

export async function addQuestionnaireStarterAgainAction(masterKey: "QST-CP" | "QST-FD" | "QST-PE") {
  const result = await addQuestionnaireStarterAgain(masterKey);
  if (result.ok) revalidatePath("/library/questionnaire-templates");
  return result;
}

export async function provisionMissingQuestionnaireStartersAction() {
  const result = await provisionMissingQuestionnaireStarters();
  if (result.ok) revalidatePath("/library/questionnaire-templates");
  return result;
}
