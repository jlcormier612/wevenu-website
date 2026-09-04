/**
 * Payments data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  LineItemInput,
  MarkPaidInput,
  PaymentActivity,
  PaymentLineItem,
  PaymentSchedule,
  PaymentScheduleWithDetails,
} from "@/lib/payments/types";
import { computeTotalPaid, deriveScheduleStatus } from "@/lib/payments/constants";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type ScheduleRow = {
  id: string; venue_id: string; client_id: string | null; event_id: string | null;
  invoice_id: string | null;
  title: string; total_amount: number; currency: string; notes: string | null;
  acknowledged_invoice_total: number | null;
  created_at: string; updated_at: string;
  clients?: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null } | null;
  events?: { event_date: string | null; booked_at: string | null } | null;
};

type ItemRow = {
  id: string; venue_id: string; schedule_id: string; label: string;
  amount: number; due_date: string | null; status: PaymentLineItem["status"];
  obligation_kind: PaymentLineItem["obligationKind"] | null;
  paid_at: string | null; paid_amount: number | null; payment_method: string | null;
  reference_number: string | null; notes: string | null; sort_order: number;
  refunded_amount: number | null; refunded_at: string | null; refund_reason: string | null;
  quickbooks_sync_status: "not_synced" | "pending" | "synced" | "failed";
  stripe_payment_intent_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_method_type: "card" | "us_bank_account" | null;
  created_at: string; updated_at: string;
};

type ActRow = {
  id: string; venue_id: string; schedule_id: string;
  type: string; title: string; description: string | null; created_at: string;
};

function mapSchedule(r: ScheduleRow): PaymentSchedule {
  const cn = r.clients
    ? [r.clients.first_name, r.clients.last_name].join(" ") +
      (r.clients.partner_first_name
        ? ` & ${[r.clients.partner_first_name, r.clients.partner_last_name].filter(Boolean).join(" ")}`
        : "")
    : null;
  return {
    id: r.id, venueId: r.venue_id, clientId: r.client_id, eventId: r.event_id,
    invoiceId: r.invoice_id,
    title: r.title, totalAmount: Number(r.total_amount), currency: r.currency, notes: r.notes,
    acknowledgedInvoiceTotal: r.acknowledged_invoice_total != null ? Number(r.acknowledged_invoice_total) : null,
    createdAt: r.created_at, updatedAt: r.updated_at,
    clientName: cn, eventDate: r.events?.event_date ?? null,
    bookedAt: r.events?.booked_at ?? null,
  };
}

function mapItem(r: ItemRow): PaymentLineItem {
  return {
    id: r.id, venueId: r.venue_id, scheduleId: r.schedule_id, label: r.label,
    amount: Number(r.amount), dueDate: r.due_date, status: r.status,
    obligationKind: r.obligation_kind ?? null,
    paidAt: r.paid_at, paidAmount: r.paid_amount != null ? Number(r.paid_amount) : null,
    paymentMethod: r.payment_method, referenceNumber: r.reference_number,
    notes: r.notes, sortOrder: r.sort_order,
    refundedAmount: r.refunded_amount != null ? Number(r.refunded_amount) : 0,
    refundedAt: r.refunded_at, refundReason: r.refund_reason,
    quickbooksSyncStatus: r.quickbooks_sync_status,
    stripePaymentIntentId: r.stripe_payment_intent_id ?? null,
    stripeCheckoutSessionId: r.stripe_checkout_session_id ?? null,
    stripePaymentMethodType: r.stripe_payment_method_type ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ---- queries ----------------------------------------------------------------

export async function getSchedules(client: DbClient, venueId: string): Promise<PaymentSchedule[]> {
  const { data, error } = await client.from("payment_schedules")
    .select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(event_date, booked_at)")
    .eq("venue_id", venueId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as ScheduleRow[]).map(mapSchedule);
}

export async function getAllLineItems(client: DbClient, venueId: string): Promise<PaymentLineItem[]> {
  const { data, error } = await client.from("payment_line_items").select("*")
    .eq("venue_id", venueId).order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data as ItemRow[]).map(mapItem);
}

export async function getSchedule(client: DbClient, venueId: string, id: string): Promise<PaymentScheduleWithDetails | null> {
  const [sRes, iRes, aRes] = await Promise.all([
    client.from("payment_schedules")
      .select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(event_date, booked_at)")
      .eq("id", id).eq("venue_id", venueId).maybeSingle<ScheduleRow>(),
    client.from("payment_line_items").select("*")
      .eq("schedule_id", id).eq("venue_id", venueId)
      .order("sort_order").order("due_date", { ascending: true, nullsFirst: false }),
    client.from("payment_activities").select("*")
      .eq("schedule_id", id).order("created_at", { ascending: false }),
  ]);
  if (sRes.error) throw sRes.error;
  if (iRes.error) throw iRes.error;
  if (aRes.error) throw aRes.error;
  if (!sRes.data) return null;
  const schedule = mapSchedule(sRes.data as unknown as ScheduleRow);
  const lineItems = (iRes.data as ItemRow[]).map(mapItem);
  const activities: PaymentActivity[] = (aRes.data as ActRow[]).map((r) => ({
    id: r.id, venueId: r.venue_id, scheduleId: r.schedule_id,
    type: r.type, title: r.title, description: r.description, createdAt: r.created_at,
  }));
  const totalPaid = computeTotalPaid(lineItems);
  return {
    ...schedule,
    lineItems,
    activities,
    totalPaid,
    balance: schedule.totalAmount - totalPaid,
    overdueCount: lineItems.filter((i) => i.status === "overdue").length,
    scheduleStatus: deriveScheduleStatus(lineItems),
  };
}

// ---- mutations --------------------------------------------------------------

export async function insertSchedule(client: DbClient, venueId: string, input: {
  title: string; clientId: string | null; eventId: string | null; totalAmount: number; notes: string;
  invoiceId: string;
}): Promise<string> {
  const { data, error } = await client.from("payment_schedules")
    .insert({
      venue_id: venueId, client_id: input.clientId || null, event_id: input.eventId || null,
      title: input.title.trim(), total_amount: input.totalAmount, notes: input.notes.trim() || null,
      invoice_id: input.invoiceId,
    }).select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

/**
 * Booking Financial Architecture Phase 1: a Payment Schedule's total is
 * always derived from its Invoice, never independently entered — this reads
 * the invoice's own total plus its client/event so insertSchedule never has
 * to trust a client-submitted number for any of the three. Scoped to
 * venueId the same way every other read here is.
 */
export async function getInvoiceSummaryForSchedule(
  client: DbClient, venueId: string, invoiceId: string,
): Promise<{
  total: number;
  clientId: string | null;
  eventId: string | null;
  eventDate: string | null;
  bookedAt: string | null;
} | null> {
  const { data } = await client.from("invoices")
    .select("total, client_id, event_id, events(event_date, booked_at)")
    .eq("id", invoiceId).eq("venue_id", venueId)
    .maybeSingle<{
      total: number;
      client_id: string | null;
      event_id: string | null;
      events: { event_date: string | null; booked_at: string | null } | null;
    }>();
  if (!data) return null;
  return {
    total: Number(data.total),
    clientId: data.client_id,
    eventId: data.event_id,
    eventDate: data.events?.event_date ?? null,
    bookedAt: data.events?.booked_at ?? null,
  };
}

/**
 * Booking Financial Architecture Phase 3c — "Keep Existing Schedule" and
 * "Collect Remaining Balance Manually" both resolve a Needs Review state
 * by recording which Invoice total was reviewed and accepted, exactly the
 * same "dismissal is scoped to what was reviewed" pattern Event Order
 * drift already uses one layer up — never a blanket "stop telling me."
 */
export async function setAcknowledgedInvoiceTotal(client: DbClient, venueId: string, scheduleId: string, total: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_schedules") as any).update({ acknowledged_invoice_total: total }).eq("id", scheduleId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Booking Financial Architecture Phase 3c — "Regenerate Schedule" and "Add
 * Additional Installment" both resolve a Needs Review state by making the
 * numbers genuinely agree again, so this is a real, legitimate caller for
 * updating total_amount (unlike the free-text field this same function
 * name used to back before Phase 1 removed it as dead code).
 */
export async function updateScheduleTotalAmount(client: DbClient, venueId: string, scheduleId: string, totalAmount: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_schedules") as any).update({ total_amount: totalAmount }).eq("id", scheduleId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Booking Financial Architecture Phase 3c — "Regenerate Schedule" clears
 * only the installments that haven't happened yet (pending/overdue).
 * Anything already collected, refunded, or explicitly cancelled is a real,
 * permanent decision and is never touched here.
 */
export async function deleteUnresolvedLineItems(client: DbClient, venueId: string, scheduleId: string): Promise<void> {
  const { error } = await client.from("payment_line_items").delete()
    .eq("schedule_id", scheduleId).eq("venue_id", venueId).in("status", ["pending", "overdue"]);
  if (error) throw error;
}

export async function insertLineItem(client: DbClient, venueId: string, scheduleId: string, input: LineItemInput, sortOrder: number): Promise<PaymentLineItem> {
  const { data, error } = await client.from("payment_line_items")
    .insert({
      venue_id: venueId, schedule_id: scheduleId,
      label: input.label.trim(),
      amount: parseFloat(input.amount.replace(/[$,]/g, "")),
      due_date: input.dueDate || null,
      sort_order: sortOrder,
      obligation_kind: input.obligationKind ?? null,
    }).select().single<ItemRow>();
  if (error) throw error;
  return mapItem(data);
}

/**
 * Work Package D5 — closes the exact gap named in the D5 research pass:
 * "updateLineItem has no status guard at all... a paid line item's label/
 * amount/due_date can be updated server-side unguarded." Mirrors
 * deleteLineItem's own guard immediately below (same table, same terminal
 * states) rather than inventing a new pattern — a payment that already
 * happened, or was already refunded, is historical record, not an editable
 * draft. Cancelled items stay editable (never money-moved, same as pending).
 */
export async function updateLineItem(client: DbClient, venueId: string, itemId: string, input: LineItemInput): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: item } = await client.from("payment_line_items")
    .select("status").eq("id", itemId).eq("venue_id", venueId).maybeSingle<{ status: string }>();
  if (item?.status && ["paid", "partially_refunded", "refunded"].includes(item.status)) {
    return { ok: false, message: "This payment has already been collected — its amount and due date are historical record and can't be edited." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, unknown> = {
    label: input.label.trim(),
    amount: parseFloat(input.amount.replace(/[$,]/g, "")),
    due_date: input.dueDate || null,
  };
  // Only overwrite kind when explicitly provided — never guess from label.
  if (input.obligationKind) patch.obligation_kind = input.obligationKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any)
    .update(patch).eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true };
}

export async function markItemPaid(
  client: DbClient,
  venueId: string,
  itemId: string,
  input: MarkPaidInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: item } = await client.from("payment_line_items")
    .select("status").eq("id", itemId).eq("venue_id", venueId).maybeSingle<{ status: string }>();
  if (item?.status === "paid") {
    return { ok: false, message: "This payment has already been marked as received." };
  }
  if (item?.status === "cancelled") {
    return { ok: false, message: "This payment was cancelled and can't be marked as received." };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any)
    .update({
      status: "paid",
      paid_at: input.paidDate ? new Date(input.paidDate).toISOString() : new Date().toISOString(),
      paid_amount: parseFloat(input.paidAmount.replace(/[$,]/g, "")),
      payment_method: input.paymentMethod || null,
      reference_number: input.referenceNumber.trim() || null,
      notes: input.notes.trim() || null,
    }).eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true };
}

/**
 * Stripe Connect (Sprint 4) — record that a Checkout Session was created
 * for this item, before the couple has even completed it. Lets the
 * webhook handler (and a retried/duplicate checkout attempt) find the
 * item by session id.
 */
export async function setCheckoutSession(
  client: DbClient,
  venueId: string,
  itemId: string,
  stripeCheckoutSessionId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any)
    .update({ stripe_checkout_session_id: stripeCheckoutSessionId })
    .eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Stripe Connect (Sprint 4) — ACH only. Hosted Checkout completing only
 * means the bank debit was *initiated*, not that funds landed (4-5
 * business days). Moves pending -> processing; never touches an item
 * that's already paid/cancelled/refunded (idempotent against a
 * redelivered webhook).
 */
export async function markItemProcessing(
  client: DbClient,
  venueId: string,
  itemId: string,
  input: { stripePaymentIntentId: string; stripePaymentMethodType: "card" | "us_bank_account" },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: item } = await client.from("payment_line_items")
    .select("status").eq("id", itemId).eq("venue_id", venueId).maybeSingle<{ status: string }>();
  if (!item) return { ok: false, message: "Payment not found." };
  if (item.status !== "pending" && item.status !== "overdue") {
    return { ok: true }; // already processing/paid/etc — idempotent no-op, not an error
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any)
    .update({
      status: "processing",
      stripe_payment_intent_id: input.stripePaymentIntentId,
      stripe_payment_method_type: input.stripePaymentMethodType,
    })
    .eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true };
}

/**
 * Stripe Connect (Sprint 4) — the webhook-driven equivalent of
 * markItemPaid(), used by app/api/webhooks/stripe-connect/route.ts (an
 * admin-client, no-session context, so it can't call the session-bound
 * lib/payments/service.ts version). Idempotent: a redelivered
 * checkout.session.completed / payment_intent.succeeded for an
 * already-paid item is a no-op, not an error.
 */
export async function markItemPaidFromStripe(
  client: DbClient,
  venueId: string,
  itemId: string,
  input: { paidAmount: number; stripePaymentIntentId: string; stripeCheckoutSessionId?: string; stripePaymentMethodType: "card" | "us_bank_account" },
): Promise<{ ok: true; alreadyPaid: boolean } | { ok: false; message: string }> {
  const { data: item } = await client.from("payment_line_items")
    .select("status").eq("id", itemId).eq("venue_id", venueId).maybeSingle<{ status: string }>();
  if (!item) return { ok: false, message: "Payment not found." };
  if (item.status === "paid") return { ok: true, alreadyPaid: true };
  if (item.status === "cancelled") return { ok: false, message: "This payment was cancelled and can't be marked as received." };

  const patch: Record<string, unknown> = {
    status: "paid",
    paid_at: new Date().toISOString(),
    paid_amount: input.paidAmount,
    payment_method: "stripe",
    reference_number: input.stripePaymentIntentId,
    stripe_payment_intent_id: input.stripePaymentIntentId,
    stripe_payment_method_type: input.stripePaymentMethodType,
  };
  if (input.stripeCheckoutSessionId) patch.stripe_checkout_session_id = input.stripeCheckoutSessionId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any)
    .update(patch).eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true, alreadyPaid: false };
}

/**
 * Stripe Connect (Sprint 4) — a failed ACH debit (e.g. insufficient
 * funds). Reverts processing -> pending, never a terminal "failed" state:
 * nothing was actually collected, so the couple can simply retry.
 */
export async function revertItemToPending(client: DbClient, venueId: string, itemId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any)
    .update({ status: "pending" })
    .eq("id", itemId).eq("venue_id", venueId).eq("status", "processing");
  if (error) throw error;
}

/**
 * After marking a payment paid, reconcile the linked invoice's balance_due.
 * Sums all paid amounts across every schedule linked to the same invoice,
 * then writes balance_due = invoice.total - totalPaid.
 * Auto-updates invoice status to "paid" when balance_due reaches zero.
 */
export async function reconcileInvoiceBalance(client: DbClient, venueId: string, invoiceId: string): Promise<void> {
  // Get invoice total
  const { data: inv } = await client.from("invoices").select("total").eq("id", invoiceId).eq("venue_id", venueId).maybeSingle<{ total: number }>();
  if (!inv) return;

  // Sum all paid line items across all schedules linked to this invoice
  const { data: schedules } = await client.from("payment_schedules").select("id").eq("invoice_id", invoiceId).eq("venue_id", venueId);
  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);
  if (scheduleIds.length === 0) return;

  const { data: paidItems } = await client.from("payment_line_items")
    .select("amount, paid_amount, refunded_amount")
    .in("schedule_id", scheduleIds).in("status", ["paid", "partially_refunded", "refunded"]);
  const totalPaid = (paidItems ?? []).reduce(
    (sum: number, item: { amount: number; paid_amount: number | null; refunded_amount: number | null }) =>
      sum + (item.paid_amount != null ? Number(item.paid_amount) : Number(item.amount)) - Number(item.refunded_amount ?? 0),
    0,
  );

  const invoiceTotal = Number(inv.total);
  const balanceDue = Math.max(0, invoiceTotal - totalPaid);
  const newStatus = balanceDue <= 0 ? "paid" : undefined;

  const patch: Record<string, unknown> = { balance_due: balanceDue };
  if (newStatus) patch.status = newStatus;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("invoices") as any).update(patch).eq("id", invoiceId).eq("venue_id", venueId);
}

/**
 * TR-M3: record a refund against a collected payment. Only 'paid' or
 * 'partially_refunded' items are eligible; the refund amount can't exceed
 * what's still refundable (collected minus any prior refund). Sets status
 * to 'refunded' once the full collected amount has been refunded, otherwise
 * 'partially_refunded' — getTotalPaidForInvoice/reconcileInvoiceBalance treat
 * both net of refunded_amount, so the invoice balance updates correctly
 * without a separate code path.
 */
export async function refundLineItem(
  client: DbClient,
  venueId: string,
  itemId: string,
  refundAmount: number,
  reason?: string,
): Promise<{ ok: true; newStatus: PaymentLineItem["status"] } | { ok: false; message: string }> {
  const { data: item } = await client.from("payment_line_items")
    .select("status, paid_amount, amount, refunded_amount")
    .eq("id", itemId).eq("venue_id", venueId)
    .maybeSingle<{ status: string; paid_amount: number | null; amount: number; refunded_amount: number | null }>();
  if (!item) return { ok: false, message: "Payment not found." };
  if (item.status !== "paid" && item.status !== "partially_refunded") {
    return { ok: false, message: "Only a collected payment can be refunded." };
  }
  const collected = item.paid_amount != null ? Number(item.paid_amount) : Number(item.amount);
  const alreadyRefunded = Number(item.refunded_amount ?? 0);
  const refundable = collected - alreadyRefunded;
  if (!(refundAmount > 0) || refundAmount > refundable + 0.001) {
    return { ok: false, message: `Refund amount must be between $0.01 and $${refundable.toFixed(2)}.` };
  }
  const newRefundedTotal = alreadyRefunded + refundAmount;
  const newStatus: PaymentLineItem["status"] = newRefundedTotal >= collected - 0.001 ? "refunded" : "partially_refunded";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any)
    .update({
      status: newStatus,
      refunded_amount: newRefundedTotal,
      refunded_at: new Date().toISOString(),
      refund_reason: reason?.trim() || null,
    })
    .eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
  return { ok: true, newStatus };
}

export async function cancelLineItem(client: DbClient, venueId: string, itemId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("payment_line_items") as any).update({ status: "cancelled" }).eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * Release Readiness Reconciliation remediation: `payment_line_items_delete`
 * (`20260716000000_tr_g1_permissions_enforcement.sql`) restricts DELETE to
 * Owner/Manager at the RLS layer, but blocks a disallowed delete by
 * matching zero rows, not by raising an error — this previously reported
 * `{ ok: true }` even when a Coordinator/Staff attempt silently deleted
 * nothing. `.select("id")` on the delete surfaces which row actually
 * matched, same fix shape already shipped for contracts/packages/playbooks.
 */
export async function deleteLineItem(
  client: DbClient,
  venueId: string,
  itemId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: item } = await client.from("payment_line_items")
    .select("status").eq("id", itemId).eq("venue_id", venueId).maybeSingle<{ status: string }>();
  if (item?.status === "paid") {
    return { ok: false, message: "This payment has already been collected and can't be deleted. Cancel it instead if it needs to be removed from the schedule." };
  }
  const { data, error } = await client.from("payment_line_items").delete().eq("id", itemId).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete a payment." };
  }
  return { ok: true };
}

export async function deleteSchedule(
  client: DbClient,
  venueId: string,
  scheduleId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: paidItems } = await client.from("payment_line_items")
    .select("id").eq("schedule_id", scheduleId).eq("venue_id", venueId).eq("status", "paid").limit(1);
  if (paidItems && paidItems.length > 0) {
    return { ok: false, message: "This schedule has at least one collected payment and can't be deleted, to preserve the financial record." };
  }
  const { data, error } = await client.from("payment_schedules").delete().eq("id", scheduleId).eq("venue_id", venueId).select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    return { ok: false, message: "Only an Owner or Manager can delete a payment schedule." };
  }
  return { ok: true };
}

export async function insertPaymentActivity(client: DbClient, venueId: string, scheduleId: string, type: string, title: string, description?: string): Promise<void> {
  const { error } = await client.from("payment_activities")
    .insert({ venue_id: venueId, schedule_id: scheduleId, type, title, description: description ?? null });
  if (error) throw error;
}
