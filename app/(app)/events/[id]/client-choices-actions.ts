"use server";

import { revalidatePath } from "next/cache";

import {
  createClientChoicesFromTemplate,
  finalizeClientChoices,
  requestClientChoicesChanges,
  reviseClientChoices,
  sendClientChoices,
  updateClientChoicesDraft,
} from "@/lib/client-choices/service";
import type { ChoicesAnswers, ChoicesDefinition } from "@/lib/client-choices/types";

function revalidateEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

export async function createClientChoicesFromTemplateAction(
  eventId: string,
  templateId: string,
  nameOverride?: string,
) {
  const result = await createClientChoicesFromTemplate(eventId, templateId, nameOverride);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function updateClientChoicesDraftAction(
  eventId: string,
  choicesId: string,
  input: { name?: string; definition?: ChoicesDefinition; answers?: ChoicesAnswers },
) {
  const result = await updateClientChoicesDraft(choicesId, input);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function sendClientChoicesAction(eventId: string, choicesId: string) {
  const result = await sendClientChoices(choicesId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function requestClientChoicesChangesAction(
  eventId: string,
  choicesId: string,
  note: string,
) {
  const result = await requestClientChoicesChanges(choicesId, note);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function finalizeClientChoicesAction(eventId: string, choicesId: string) {
  const result = await finalizeClientChoices(choicesId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}

export async function reviseClientChoicesAction(eventId: string, choicesId: string) {
  const result = await reviseClientChoices(choicesId);
  if (result.ok) revalidateEvent(eventId);
  return result;
}
