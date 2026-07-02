"use server";

import { createClient } from "@/integrations/supabase/server";

export async function sendAnniversaryMessageAction(
  eventId: string,
  message: string,
  yearNumber: number,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_anniversary_message", {
    p_event_id: eventId,
    p_message:  message,
    p_year:     yearNumber,
  });
  if (error) return { ok: false };
  const result = data as { ok: boolean } | null;
  return { ok: result?.ok ?? false };
}
