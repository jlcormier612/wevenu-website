/**
 * Hello to Cheers-branded payment notifications — Sprint 4, Venue Payment
 * Processing, decision §6.4: delivered through the existing Conversation
 * (sender_type: 'system', mirrors lib/tours/communication.ts's
 * findOrCreateConversation() shape exactly), alongside Stripe's own
 * automatic receipt as a redundant processor-level confirmation. Required
 * content: payment amount, invoice reference, remaining balance, next
 * payment due (when the schedule has one) — permanently recorded in
 * Conversation history, not a transient toast.
 */
function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findOrCreateConversation(admin: any, venueId: string, relationshipId: string): Promise<string | null> {
  const { data: existing } = await admin.from("conversations")
    .select("id").eq("relationship_id", relationshipId).maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await admin.from("conversations")
    .insert({ venue_id: venueId, relationship_id: relationshipId })
    .select("id").single();
  return created?.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postSystemMessage(admin: any, venueId: string, clientId: string, body: string): Promise<void> {
  const { data: client } = await admin.from("clients")
    .select("relationship_id").eq("id", clientId).maybeSingle();
  const relationshipId = client?.relationship_id;
  if (!relationshipId) return;

  const conversationId = await findOrCreateConversation(admin, venueId, relationshipId);
  if (!conversationId) return;

  await admin.from("conversation_messages").insert({
    conversation_id: conversationId,
    venue_id: venueId,
    sender_type: "system",
    channel: "internal_note",
    body,
    status: "accepted",
  });
}

type ReceiptContext = {
  paidAmount: number;
  invoiceNumber: string | null;
  balanceDue: number | null;
  nextDueLabel: string | null;
  nextDueDate: string | null;
  nextDueAmount: number | null;
  method: "card" | "us_bank_account";
};

function buildReceiptBody(ctx: ReceiptContext): string {
  const lines = [
    `Payment received: ${formatMoney(ctx.paidAmount)} via ${ctx.method === "us_bank_account" ? "ACH bank transfer" : "card"}.`,
  ];
  if (ctx.invoiceNumber) lines.push(`Invoice: ${ctx.invoiceNumber}`);
  if (ctx.balanceDue != null) {
    lines.push(ctx.balanceDue > 0 ? `Remaining balance: ${formatMoney(ctx.balanceDue)}` : "This invoice is now paid in full.");
  }
  if (ctx.nextDueAmount != null && ctx.nextDueDate) {
    lines.push(`Next payment due: ${formatMoney(ctx.nextDueAmount)} (${ctx.nextDueLabel ?? "installment"}) on ${formatDate(ctx.nextDueDate)}`);
  }
  return lines.join("\n");
}

/** Posted on checkout.session.completed / a settled ACH payment. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function postPaymentReceivedReceipt(admin: any, venueId: string, clientId: string, scheduleId: string, paidAmount: number, method: "card" | "us_bank_account"): Promise<void> {
  const { data: sch } = await admin.from("payment_schedules").select("invoice_id").eq("id", scheduleId).maybeSingle();
  let invoiceNumber: string | null = null;
  let balanceDue: number | null = null;
  if (sch?.invoice_id) {
    const { data: inv } = await admin.from("invoices").select("invoice_number, balance_due").eq("id", sch.invoice_id).maybeSingle();
    invoiceNumber = inv?.invoice_number ?? null;
    balanceDue = inv?.balance_due != null ? Number(inv.balance_due) : null;
  }

  const { data: next } = await admin.from("payment_line_items")
    .select("label, amount, due_date")
    .eq("schedule_id", scheduleId)
    .in("status", ["pending", "overdue"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const body = buildReceiptBody({
    paidAmount,
    invoiceNumber,
    balanceDue,
    nextDueLabel: next?.label ?? null,
    nextDueDate: next?.due_date ?? null,
    nextDueAmount: next?.amount != null ? Number(next.amount) : null,
    method,
  });

  await postSystemMessage(admin, venueId, clientId, body);
}

/** Posted on payment_intent.payment_failed (an ACH debit that failed after initiating). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function postPaymentFailedMessage(admin: any, venueId: string, clientId: string, label: string, reason: string | null): Promise<void> {
  const body = `Payment failed: ${label}${reason ? ` — ${reason}` : ""}. The payment was not collected; you can try again from your payment schedule.`;
  await postSystemMessage(admin, venueId, clientId, body);
}
