"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import type { ReminderCadence } from "@/lib/notifications/obligations";

export async function updateReminderCadenceAction(
  patch: Partial<ReminderCadence>,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_reminder_cadence", {
    p_payment_before_due_cadence: patch.paymentBeforeDueCadence ?? null,
    p_payment_after_due_cadence: patch.paymentAfterDueCadence ?? null,
    p_contract_before_due_cadence: patch.contractBeforeDueCadence ?? null,
    p_task_after_due_cadence: patch.taskAfterDueCadence ?? null,
  });
  if (error) return { ok: false };
  revalidatePath("/settings/communications");
  return (data as { ok: boolean } | null) ?? { ok: false };
}
