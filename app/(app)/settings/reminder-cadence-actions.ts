"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/integrations/supabase/server";
import {
  getReminderCadence,
  normalizeBeforeDueOffsets,
  reconcileVenueBeforeDueReminders,
  type ReminderCadence,
} from "@/lib/notifications/obligations";

export async function updateReminderCadenceAction(
  patch: Partial<ReminderCadence>,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();

  const paymentOffsets =
    patch.paymentBeforeDueOffsets !== undefined
      ? normalizeBeforeDueOffsets(patch.paymentBeforeDueOffsets)
      : null;
  const contractOffsets =
    patch.contractBeforeDueOffsets !== undefined
      ? normalizeBeforeDueOffsets(patch.contractBeforeDueOffsets)
      : null;

  const { data, error } = await supabase.rpc("update_reminder_cadence", {
    p_payment_before_due_offsets: paymentOffsets,
    p_payment_after_due_cadence: patch.paymentAfterDueCadence ?? null,
    p_contract_before_due_offsets: contractOffsets,
    p_task_after_due_cadence: patch.taskAfterDueCadence ?? null,
  });
  if (error) return { ok: false };
  const ok = (data as { ok: boolean } | null)?.ok ?? false;
  if (!ok) return { ok: false };

  // When before-due selections change, reconcile pending upcoming reminders
  // for still-open obligations so the live schedule matches the new set.
  if (paymentOffsets !== null || contractOffsets !== null) {
    const { data: venueId } = await supabase.rpc("current_user_venue_id");
    if (venueId) {
      const cadence = await getReminderCadence();
      await reconcileVenueBeforeDueReminders(supabase, venueId as string, cadence);
    }
  }

  revalidatePath("/settings/communications");
  return { ok: true };
}
