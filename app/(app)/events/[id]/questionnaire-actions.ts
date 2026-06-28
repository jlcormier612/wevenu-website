"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/integrations/supabase/server";
import { saveQuestionnaire, sendQuestionnaireToCouple, type Questionnaire } from "@/lib/events/questionnaire";

export async function saveQuestionnaireAction(
  eventId: string,
  fields: Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt">>,
  submit = false,
): Promise<{ ok: boolean; message?: string }> {
  const result = await saveQuestionnaire(eventId, fields, submit);
  if (result.ok) {
    revalidatePath(`/events/${eventId}`);
    // Questionnaire submitted = commitment milestone — refresh linked lead's scores
    if (submit) {
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
): Promise<{ ok: boolean; formUrl?: string; message?: string }> {
  const result = await sendQuestionnaireToCouple(eventId, coupleEmail, coupleName, eventName, threadId);
  if (result.ok) revalidatePath(`/events/${eventId}`);
  return result;
}
