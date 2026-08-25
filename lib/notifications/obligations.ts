/**
 * Payment/contract reminder scheduling — the same task_reminders table and
 * processing engine tasks and tours already use (lib/playbooks/repository.ts,
 * lib/notifications/engine.ts), extended with two new source columns
 * (payment_line_item_id, contract_id) rather than a second reminder system.
 *
 * Cadence is venue-configurable via venue_reminder_cadence (a small set of
 * named presets — see the migration for why this isn't a raw interval
 * input). "Before due" reminders are a fixed batch created once, when the
 * obligation is created/sent, exactly like event_tasks.reminder_before_days
 * already works. "After due" reminders are different: only the first
 * occurrence is created here (by the overdue/attention detector in
 * engine.ts), and the engine itself schedules each next occurrence at send
 * time via after_due_recur_interval_days — see that file's
 * processReminders() for the recurring half of this.
 */
import { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type CadenceLabel = "weekly" | "every_3_days" | "daily" | "none";

export type ReminderCadence = {
  paymentBeforeDueCadence: Extract<CadenceLabel, "weekly" | "none">;
  paymentAfterDueCadence: CadenceLabel;
  contractBeforeDueCadence: Extract<CadenceLabel, "weekly" | "none">;
  taskAfterDueCadence: CadenceLabel;
};

const CADENCE_DEFAULTS: ReminderCadence = {
  paymentBeforeDueCadence: "weekly",
  paymentAfterDueCadence: "daily",
  contractBeforeDueCadence: "weekly",
  taskAfterDueCadence: "every_3_days",
};

/** Interval in days for a recurring ("after due") cadence label. null = don't recur. */
export function cadenceIntervalDays(label: CadenceLabel): number | null {
  switch (label) {
    case "daily": return 1;
    case "every_3_days": return 3;
    case "weekly": return 7;
    case "none": return null;
  }
}

/** Fixed offsets (days before due date) for a "before due" batch. Empty = don't schedule any. */
function beforeDueOffsets(label: Extract<CadenceLabel, "weekly" | "none">): number[] {
  return label === "weekly" ? [21, 14, 7] : [];
}

export async function getReminderCadence(): Promise<ReminderCadence> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_reminder_cadence");
  const result = data as Partial<ReminderCadence> & { error?: string } | null;
  if (!result || result.error) return CADENCE_DEFAULTS;
  return { ...CADENCE_DEFAULTS, ...result };
}

function offsetDatetime(datetimeStr: string, days: number): string {
  const d = new Date(datetimeStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/**
 * Pre-due reminders for a payment line item — a fixed batch, created once
 * when the line item's due date is known. Never creates the after-due
 * (overdue) reminder; that's created by the overdue-detection sweep in
 * engine.ts, the same moment the line item's status actually flips.
 */
export async function createRemindersForPaymentLineItem(
  client: DbClient,
  venueId: string,
  lineItemId: string,
  dueDate: string, // "YYYY-MM-DD"
  cadence: Pick<ReminderCadence, "paymentBeforeDueCadence">,
): Promise<void> {
  if (!dueDate) return;
  const offsets = beforeDueOffsets(cadence.paymentBeforeDueCadence);
  if (offsets.length === 0) return;

  const dueMidnight = dueDate + "T08:00:00Z";
  const reminders = offsets
    .map((days) => ({
      venue_id: venueId,
      payment_line_item_id: lineItemId,
      reminder_type: "upcoming",
      notify_role: "couple",
      scheduled_for: offsetDatetime(dueMidnight, -days),
    }))
    .filter((r) => new Date(r.scheduled_for) > new Date());

  if (!reminders.length) return;
  await client.from("task_reminders").insert(reminders);
}

/** Cancel all pending reminders for a payment line item — called once it's paid or cancelled. */
export async function cancelRemindersForPaymentLineItem(
  client: DbClient,
  venueId: string,
  lineItemId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("task_reminders") as any)
    .update({ status: "cancelled" })
    .eq("payment_line_item_id", lineItemId)
    .eq("venue_id", venueId)
    .eq("status", "pending");
}

/**
 * Pre-expiry "please sign" reminders for a contract — a fixed batch,
 * created once when the contract is sent. Contracts don't get a recurring
 * after-due phase the way payments do: an expired, unsigned contract needs
 * the venue's attention (see the detector in engine.ts), not more client
 * emails past a date the couple can no longer act on.
 */
export async function createRemindersForContract(
  client: DbClient,
  venueId: string,
  contractId: string,
  expiresAt: string | null, // "YYYY-MM-DD"
  cadence: Pick<ReminderCadence, "contractBeforeDueCadence">,
): Promise<void> {
  if (!expiresAt) return;
  const offsets = beforeDueOffsets(cadence.contractBeforeDueCadence);
  if (offsets.length === 0) return;

  const expiresMidnight = expiresAt + "T08:00:00Z";
  const reminders = offsets
    .map((days) => ({
      venue_id: venueId,
      contract_id: contractId,
      reminder_type: "upcoming",
      notify_role: "couple",
      scheduled_for: offsetDatetime(expiresMidnight, -days),
    }))
    .filter((r) => new Date(r.scheduled_for) > new Date());

  if (!reminders.length) return;
  await client.from("task_reminders").insert(reminders);
}
