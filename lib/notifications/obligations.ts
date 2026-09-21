/**
 * Payment/contract reminder scheduling — the same task_reminders table and
 * processing engine tasks and tours already use (lib/playbooks/repository.ts,
 * lib/notifications/engine.ts), extended with two new source columns
 * (payment_line_item_id, contract_id) rather than a second reminder system.
 *
 * Before-due cadence is venue-configurable as an explicit multi-select of
 * day offsets (21 / 14 / 7 / 0) relative to the obligation due/expiration
 * date — stored on venue_reminder_cadence.payment_before_due_offsets and
 * contract_before_due_offsets. Empty array = don't send. "Before due"
 * reminders are a fixed batch created once, when the obligation is
 * created/sent, exactly like event_tasks.reminder_before_days already works.
 * "After due" reminders are different: only the first occurrence is created
 * here (by the overdue/attention detector in engine.ts), and the engine
 * itself schedules each next occurrence at send time via
 * after_due_recur_interval_days — see that file's processReminders() for the
 * recurring half of this.
 */
import { createClient } from "@/integrations/supabase/server";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export type AfterDueCadenceLabel = "weekly" | "every_3_days" | "daily" | "none";

/**
 * Allowed before-due offsets as days relative to the due/expiration date.
 * Negative = before; 0 = on the due/expiration date.
 */
export const BEFORE_DUE_OFFSET_OPTIONS = [-21, -14, -7, 0] as const;
export type BeforeDueOffsetDays = (typeof BEFORE_DUE_OFFSET_OPTIONS)[number];

/**
 * Legacy named presets — kept only for migration mapping / tests.
 * Live storage is explicit offset arrays.
 */
export type BeforeDueCadenceLabel =
  | "weekly"          // 21, 14, 7 days before
  | "once_week"       // 7 days before
  | "once_two_weeks"  // 14 days before
  | "on_due"          // morning of the due date
  | "none";

/** @deprecated Prefer AfterDueCadenceLabel. Kept for call sites. */
export type CadenceLabel = AfterDueCadenceLabel;

export type ReminderCadence = {
  paymentBeforeDueOffsets: number[];
  paymentAfterDueCadence: AfterDueCadenceLabel;
  contractBeforeDueOffsets: number[];
  taskAfterDueCadence: AfterDueCadenceLabel;
};

const CADENCE_DEFAULTS: ReminderCadence = {
  paymentBeforeDueOffsets: [-21, -14, -7],
  paymentAfterDueCadence: "daily",
  contractBeforeDueOffsets: [-21, -14, -7],
  taskAfterDueCadence: "every_3_days",
};

const ALLOWED_BEFORE_DUE = new Set<number>(BEFORE_DUE_OFFSET_OPTIONS);

/**
 * Normalize a before-due selection: only allowed offsets, unique, descending.
 * Empty input → empty (don't send).
 */
export function normalizeBeforeDueOffsets(offsets: readonly number[]): number[] {
  const unique = new Set<number>();
  for (const d of offsets) {
    if (ALLOWED_BEFORE_DUE.has(d)) unique.add(d);
  }
  return [...unique].sort((a, b) => a - b);
}

/**
 * Map a legacy named preset to its equivalent offset selection.
 * Used by migration tests — do not invent new preset behavior.
 */
export function presetToBeforeDueOffsets(label: BeforeDueCadenceLabel): number[] {
  switch (label) {
    case "weekly": return [-21, -14, -7];
    case "once_two_weeks": return [-14];
    case "once_week": return [-7];
    case "on_due": return [0];
    case "none": return [];
  }
}

/** @deprecated Prefer normalizeBeforeDueOffsets / presetToBeforeDueOffsets. */
export function beforeDueOffsets(label: BeforeDueCadenceLabel): number[] {
  return presetToBeforeDueOffsets(label);
}

/** Interval in days for a recurring ("after due") cadence label. null = don't recur. */
export function cadenceIntervalDays(label: AfterDueCadenceLabel): number | null {
  switch (label) {
    case "daily": return 1;
    case "every_3_days": return 3;
    case "weekly": return 7;
    case "none": return null;
  }
}

function coerceOffsetArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((n) => typeof n === "number" && Number.isInteger(n))) return null;
  return normalizeBeforeDueOffsets(value as number[]);
}

export async function getReminderCadence(): Promise<ReminderCadence> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_reminder_cadence");
  const result = data as Partial<ReminderCadence> & { error?: string } | null;
  if (!result || result.error) return { ...CADENCE_DEFAULTS };

  const paymentOffsets = coerceOffsetArray(result.paymentBeforeDueOffsets);
  const contractOffsets = coerceOffsetArray(result.contractBeforeDueOffsets);

  return {
    paymentBeforeDueOffsets: paymentOffsets ?? CADENCE_DEFAULTS.paymentBeforeDueOffsets,
    paymentAfterDueCadence: result.paymentAfterDueCadence ?? CADENCE_DEFAULTS.paymentAfterDueCadence,
    contractBeforeDueOffsets: contractOffsets ?? CADENCE_DEFAULTS.contractBeforeDueOffsets,
    taskAfterDueCadence: result.taskAfterDueCadence ?? CADENCE_DEFAULTS.taskAfterDueCadence,
  };
}

function offsetDatetime(datetimeStr: string, days: number): string {
  const d = new Date(datetimeStr);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function buildUpcomingReminderRows(opts: {
  venueId: string;
  dueDate: string;
  offsets: number[];
  paymentLineItemId?: string;
  contractId?: string;
}): Record<string, unknown>[] {
  const normalized = normalizeBeforeDueOffsets(opts.offsets);
  if (normalized.length === 0) return [];

  const dueMidnight = opts.dueDate + "T08:00:00Z";
  const now = new Date();
  return normalized
    .map((days) => {
      const row: Record<string, unknown> = {
        venue_id: opts.venueId,
        reminder_type: "upcoming",
        notify_role: "couple",
        scheduled_for: offsetDatetime(dueMidnight, days),
      };
      if (opts.paymentLineItemId) row.payment_line_item_id = opts.paymentLineItemId;
      if (opts.contractId) row.contract_id = opts.contractId;
      return row;
    })
    .filter((r) => new Date(r.scheduled_for as string) > now);
}

/**
 * Pre-due reminders for a payment line item — a fixed batch, created once
 * when the line item's due date is known. Never creates the after-due
 * (overdue) reminder; that's created by the overdue-detection sweep in
 * engine.ts, the same moment the line item's status actually flips.
 *
 * Cancels any pending upcoming reminders for this line item first so
 * re-scheduling (cadence change, due-date edit) cannot duplicate.
 */
export async function createRemindersForPaymentLineItem(
  client: DbClient,
  venueId: string,
  lineItemId: string,
  dueDate: string, // "YYYY-MM-DD"
  cadence: Pick<ReminderCadence, "paymentBeforeDueOffsets">,
): Promise<void> {
  await cancelUpcomingRemindersForPaymentLineItem(client, venueId, lineItemId);
  if (!dueDate) return;

  const reminders = buildUpcomingReminderRows({
    venueId,
    dueDate,
    offsets: cadence.paymentBeforeDueOffsets,
    paymentLineItemId: lineItemId,
  });
  if (!reminders.length) return;
  await client.from("task_reminders").insert(reminders);
}

/** Cancel pending upcoming (before-due) reminders for one payment line item. */
export async function cancelUpcomingRemindersForPaymentLineItem(
  client: DbClient,
  venueId: string,
  lineItemId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("task_reminders") as any)
    .update({ status: "cancelled" })
    .eq("payment_line_item_id", lineItemId)
    .eq("venue_id", venueId)
    .eq("reminder_type", "upcoming")
    .eq("status", "pending");
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
 *
 * Cancels any pending upcoming reminders for this contract first so
 * re-scheduling cannot duplicate.
 */
export async function createRemindersForContract(
  client: DbClient,
  venueId: string,
  contractId: string,
  expiresAt: string | null, // "YYYY-MM-DD"
  cadence: Pick<ReminderCadence, "contractBeforeDueOffsets">,
): Promise<void> {
  await cancelUpcomingRemindersForContract(client, venueId, contractId);
  if (!expiresAt) return;

  const reminders = buildUpcomingReminderRows({
    venueId,
    dueDate: expiresAt,
    offsets: cadence.contractBeforeDueOffsets,
    contractId,
  });
  if (!reminders.length) return;
  await client.from("task_reminders").insert(reminders);
}

/** Cancel pending upcoming signature reminders for one contract. */
export async function cancelUpcomingRemindersForContract(
  client: DbClient,
  venueId: string,
  contractId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("task_reminders") as any)
    .update({ status: "cancelled" })
    .eq("contract_id", contractId)
    .eq("venue_id", venueId)
    .eq("reminder_type", "upcoming")
    .eq("status", "pending");
}

/** Cancel all pending reminders for a contract — called once signed/cancelled. */
export async function cancelRemindersForContract(
  client: DbClient,
  venueId: string,
  contractId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("task_reminders") as any)
    .update({ status: "cancelled" })
    .eq("contract_id", contractId)
    .eq("venue_id", venueId)
    .eq("status", "pending");
}

/**
 * After a venue changes before-due selections, cancel pending upcoming
 * reminders and recreate them from the new offsets for still-open
 * obligations. Already-sent rows are left untouched. Paid/completed
 * payments and signed/cancelled/expired contracts are not rescheduled.
 */
export async function reconcileVenueBeforeDueReminders(
  client: DbClient,
  venueId: string,
  cadence: ReminderCadence,
): Promise<void> {
  // Payments — unpaid line items with a due date
  const { data: paymentItems } = await client
    .from("payment_line_items")
    .select("id, due_date, status")
    .eq("venue_id", venueId)
    .eq("status", "pending")
    .not("due_date", "is", null);

  for (const item of (paymentItems ?? []) as { id: string; due_date: string | null; status: string }[]) {
    if (!item.due_date) continue;
    await createRemindersForPaymentLineItem(client, venueId, item.id, item.due_date, {
      paymentBeforeDueOffsets: cadence.paymentBeforeDueOffsets,
    });
  }

  // Contracts — still awaiting signature
  const { data: contracts } = await client
    .from("contracts")
    .select("id, expires_at, status")
    .eq("venue_id", venueId)
    .eq("status", "sent")
    .not("expires_at", "is", null);

  for (const contract of (contracts ?? []) as { id: string; expires_at: string | null; status: string }[]) {
    if (!contract.expires_at) continue;
    await createRemindersForContract(client, venueId, contract.id, contract.expires_at, {
      contractBeforeDueOffsets: cadence.contractBeforeDueOffsets,
    });
  }
}
