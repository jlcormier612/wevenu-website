/**
 * Couple Tasks Impl 7 — Final Payment obligation (Option B).
 *
 * Durable identity: event_tasks.payment_line_item_id → payment_line_items.id.
 * Verification = that specific line has status=paid. Never infer from label.
 * Never complete tasks from React completed-state / navigation / refresh.
 */
import type { createClient } from "@/integrations/supabase/server";
import { completeEventTask } from "@/lib/playbooks/repository";
import type { PaymentObligationKind } from "@/lib/payments/types";

export {
  FINAL_PAYMENT_OBLIGATION_TRIGGER,
  FINAL_PAYMENT_OBLIGATION_CELEBRATION,
  PAYMENT_OBLIGATION_KINDS,
  isPaymentObligationKind,
} from "@/lib/payments/obligation-constants";
import { FINAL_PAYMENT_OBLIGATION_TRIGGER, FINAL_PAYMENT_OBLIGATION_CELEBRATION } from "@/lib/payments/obligation-constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

/**
 * When a line with obligation_kind=final is inserted, bind the first unbound
 * open couple Final Payment task on that event (sort_order, then id).
 * Multiple finals ⇒ each newly created final binds the next unbound task.
 * Tasks already bound (including to deleted→null lines after regenerate)
 * are eligible when payment_line_item_id is null.
 */
export async function bindFinalPaymentTaskToLine(
  client: DbClient,
  venueId: string,
  eventId: string | null | undefined,
  lineItemId: string,
  obligationKind: PaymentObligationKind | null | undefined,
): Promise<string | null> {
  if (!eventId || obligationKind !== "final") return null;

  const { data: tasks } = await client
    .from("event_tasks")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("auto_complete_trigger", FINAL_PAYMENT_OBLIGATION_TRIGGER)
    .is("payment_line_item_id", null)
    .in("status", ["pending", "blocked", "overdue"])
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);

  const taskId = (tasks as { id: string }[] | null)?.[0]?.id;
  if (!taskId) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("event_tasks") as any)
    .update({ payment_line_item_id: lineItemId })
    .eq("id", taskId)
    .eq("venue_id", venueId)
    .is("payment_line_item_id", null);
  if (error) throw error;
  return taskId;
}

/**
 * Complete open Final Payment tasks bound to this specific paid line.
 * Does not use the broad payment_received trigger for proof.
 */
export async function completeFinalPaymentTasksBoundToLine(
  client: DbClient,
  venueId: string,
  lineItemId: string,
): Promise<string[]> {
  const { data } = await client
    .from("event_tasks")
    .select("id")
    .eq("venue_id", venueId)
    .eq("payment_line_item_id", lineItemId)
    .eq("auto_complete_trigger", FINAL_PAYMENT_OBLIGATION_TRIGGER)
    .in("status", ["pending", "blocked", "overdue"]);

  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  for (const id of ids) {
    // source_type must match event_tasks_source_type_check (payment, not payment_line_item).
    await completeEventTask(client, venueId, id, "system", "payment", lineItemId);
  }
  return ids;
}

/**
 * Insert one-shot obligation celebration when a typed final line is paid.
 * Unique (client_id, celebration_type) is the first-win gate.
 */
export async function celebrateFinalPaymentObligationIfNeeded(
  client: DbClient,
  venueId: string,
  eventId: string,
  lineItemId: string,
  obligationKind: PaymentObligationKind | null | undefined,
): Promise<boolean> {
  if (obligationKind !== "final") return false;

  const { data: ev } = await client
    .from("events")
    .select("client_id")
    .eq("id", eventId)
    .maybeSingle<{ client_id: string | null }>();
  if (!ev?.client_id) return false;

  const { error } = await client.from("luv_celebrations").insert({
    venue_id: venueId,
    client_id: ev.client_id,
    event_id: eventId,
    celebration_type: FINAL_PAYMENT_OBLIGATION_CELEBRATION,
    entity_id: lineItemId,
  });
  // 23505 = already celebrated — expected on repeats / redelivery
  return !error;
}
