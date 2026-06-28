"use server";

import { revalidatePath } from "next/cache";
import { saveQuestionnaire, sendQuestionnaireToCouple, type Questionnaire } from "@/lib/events/questionnaire";

export async function saveQuestionnaireAction(
  eventId: string,
  fields: Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt">>,
  submit = false,
): Promise<{ ok: boolean; message?: string }> {
  const result = await saveQuestionnaire(eventId, fields, submit);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}

export async function sendQuestionnaireAction(
  eventId: string,
  coupleEmail: string,
  coupleName: string,
  eventName: string,
): Promise<{ ok: boolean; formUrl?: string; message?: string }> {
  const result = await sendQuestionnaireToCouple(eventId, coupleEmail, coupleName, eventName);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}
