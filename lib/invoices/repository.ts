import { createClient } from "@/integrations/supabase/server";
import { computeInvoiceTotals, generateInvoiceNumber } from "@/lib/invoices/constants";
import type {
  AddLineItemResult,
  Invoice,
  InvoiceActivity,
  InvoiceInput,
  InvoiceLineItem,
  InvoiceLineItemInput,
  InvoiceStatus,
  InvoiceWithLineItems,
} from "@/lib/invoices/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type InvoiceRow = {
  id: string; venue_id: string; client_id: string | null; event_id: string | null;
  invoice_number: string; status: InvoiceStatus;
  subtotal: number; discount_amount: number; tax_amount: number; total: number; balance_due: number;
  notes: string | null; due_date: string | null; issued_at: string | null;
  created_at: string; updated_at: string;
  clients?: { first_name: string; last_name: string; partner_first_name: string | null; partner_last_name: string | null } | null;
  events?: { name: string; event_date: string } | null;
};
type LineItemRow = { id: string; invoice_id: string; venue_id: string; package_id: string | null; type: InvoiceLineItem["type"]; description: string; quantity: number; unit_price: number; amount: number; sort_order: number; created_at: string; };
type ActivityRow = { id: string; venue_id: string; invoice_id: string; type: string; title: string; description: string | null; created_at: string; };

function mapInvoice(r: InvoiceRow): Invoice {
  const cn = r.clients ? [r.clients.first_name, r.clients.last_name, r.clients.partner_first_name, r.clients.partner_last_name].filter(Boolean).join(" / ") : null;
  return { id: r.id, venueId: r.venue_id, clientId: r.client_id, eventId: r.event_id, invoiceNumber: r.invoice_number, status: r.status, subtotal: Number(r.subtotal), discountAmount: Number(r.discount_amount), taxAmount: Number(r.tax_amount), total: Number(r.total), balanceDue: Number(r.balance_due), notes: r.notes, dueDate: r.due_date, issuedAt: r.issued_at, createdAt: r.created_at, updatedAt: r.updated_at, clientName: cn, eventDate: r.events?.event_date ?? null, eventName: r.events?.name ?? null };
}
const mapItem = (r: LineItemRow): InvoiceLineItem => ({ id: r.id, invoiceId: r.invoice_id, venueId: r.venue_id, packageId: r.package_id, type: r.type, description: r.description, quantity: Number(r.quantity), unitPrice: Number(r.unit_price), amount: Number(r.amount), sortOrder: r.sort_order, createdAt: r.created_at });
const mapActivity = (r: ActivityRow): InvoiceActivity => ({ id: r.id, venueId: r.venue_id, invoiceId: r.invoice_id, type: r.type, title: r.title, description: r.description, createdAt: r.created_at });

// ---- Invoices ---------------------------------------------------------------

export async function getInvoices(client: DbClient, venueId: string, filters?: { q?: string; status?: string }): Promise<Invoice[]> {
  let q = client.from("invoices")
    .select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(name, event_date)")
    .eq("venue_id", venueId);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.q) q = q.ilike("invoice_number", `%${filters.q}%`);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as InvoiceRow[]).map(mapInvoice);
}

export async function getInvoice(client: DbClient, venueId: string, id: string): Promise<InvoiceWithLineItems | null> {
  const [invRes, itemsRes] = await Promise.all([
    client.from("invoices").select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(name, event_date)").eq("id", id).eq("venue_id", venueId).maybeSingle<InvoiceRow>(),
    client.from("invoice_line_items").select("*").eq("invoice_id", id).order("sort_order").order("created_at"),
  ]);
  if (invRes.error) throw invRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (!invRes.data) return null;
  return { ...mapInvoice(invRes.data), lineItems: (itemsRes.data as LineItemRow[]).map(mapItem) };
}

export async function getInvoicesForClient(client: DbClient, venueId: string, clientId: string): Promise<Invoice[]> {
  const { data, error } = await client.from("invoices")
    .select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(name, event_date)")
    .eq("venue_id", venueId).eq("client_id", clientId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data as unknown as InvoiceRow[]).map(mapInvoice);
}

export async function insertInvoice(client: DbClient, venueId: string, input: InvoiceInput): Promise<string> {
  // Generate invoice number after getting the ID
  const { data, error } = await client.from("invoices")
    .insert({ venue_id: venueId, client_id: input.clientId || null, event_id: input.eventId || null, invoice_number: "PENDING", notes: input.notes.trim() || null, due_date: input.dueDate || null })
    .select("id").single<{ id: string }>();
  if (error) throw error;
  const invoiceNumber = generateInvoiceNumber(data.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("invoices") as any).update({ invoice_number: invoiceNumber }).eq("id", data.id);
  return data.id;
}

export async function insertActivity(client: DbClient, venueId: string, invoiceId: string, type: string, title: string, description?: string): Promise<void> {
  await client.from("invoice_activities").insert({ venue_id: venueId, invoice_id: invoiceId, type, title, description: description ?? null });
}

export async function addLineItem(client: DbClient, venueId: string, invoiceId: string, input: InvoiceLineItemInput): Promise<InvoiceLineItem> {
  const isDiscount = input.type === "discount" || input.type === "deposit";
  const qty = parseFloat(input.quantity) || 1;
  let price = parseFloat(input.unitPrice.replace(/[$,]/g, "")) || 0;

  // For percentage discounts: compute dollar amount from current invoice subtotal
  if (isDiscount && input.discountType === "percent" && input.discountValue) {
    const pct = parseFloat(input.discountValue) || 0;
    const { data: inv } = await client.from("invoices").select("subtotal").eq("id", invoiceId).maybeSingle<{ subtotal: number }>();
    price = parseFloat(((Number(inv?.subtotal ?? 0) * pct) / 100).toFixed(2));
  }

  const amount = parseFloat((qty * price).toFixed(2));
  // Get current sort order max
  const { data: existing } = await client.from("invoice_line_items").select("sort_order").eq("invoice_id", invoiceId).order("sort_order", { ascending: false }).limit(1);
  const sortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
  const { data, error } = await client.from("invoice_line_items")
    .insert({ invoice_id: invoiceId, venue_id: venueId, package_id: input.packageId || null, type: input.type, description: input.description.trim(), quantity: qty, unit_price: price, amount, sort_order: sortOrder, discount_type: input.discountType ?? null, discount_value: input.discountValue ? parseFloat(input.discountValue) : null })
    .select().single<LineItemRow>();
  if (error) throw error;
  await recomputeInvoiceTotals(client, venueId, invoiceId);
  return mapItem(data);
}

export async function removeLineItem(client: DbClient, venueId: string, invoiceId: string, itemId: string): Promise<void> {
  const { error } = await client.from("invoice_line_items").delete().eq("id", itemId).eq("venue_id", venueId);
  if (error) throw error;
  await recomputeInvoiceTotals(client, venueId, invoiceId);
}

export async function updateInvoiceStatus(client: DbClient, venueId: string, invoiceId: string, status: InvoiceStatus): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "sent") patch.issued_at = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("invoices") as any).update(patch).eq("id", invoiceId).eq("venue_id", venueId);
  if (error) throw error;
}

/**
 * TR-M2 (Trust Risk Register): this used to unconditionally set
 * `balance_due = total`, silently erasing any payments already collected
 * every time a line item was added or removed — a couple could pay a
 * deposit, and a completely routine invoice edit later would reset the
 * displayed balance back to the full amount. Now payment-aware: subtracts
 * everything already paid toward this invoice, the same computation
 * `reconcileInvoiceBalance` (lib/payments/repository.ts) uses after a
 * payment is recorded, so the two can never disagree.
 */
async function recomputeInvoiceTotals(client: DbClient, venueId: string, invoiceId: string): Promise<void> {
  const { data } = await client.from("invoice_line_items").select("type, amount").eq("invoice_id", invoiceId);
  const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(
    (data ?? []) as { type: InvoiceLineItem["type"]; amount: number }[]
  );

  const totalPaid = await getTotalPaidForInvoice(client, venueId, invoiceId);
  const balanceDue = Math.max(0, total - totalPaid);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("invoices") as any).update({ subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total, balance_due: balanceDue }).eq("id", invoiceId).eq("venue_id", venueId);
}

/**
 * Sums every payment_line_item across every schedule linked to this invoice
 * that's been collected, net of any refund (TR-M3) — 'paid', 'partially_refunded',
 * and 'refunded' all contribute paid_amount - refunded_amount, so a full refund
 * naturally nets to zero without a separate branch.
 */
async function getTotalPaidForInvoice(client: DbClient, venueId: string, invoiceId: string): Promise<number> {
  const { data: schedules } = await client.from("payment_schedules").select("id").eq("invoice_id", invoiceId).eq("venue_id", venueId);
  const scheduleIds = (schedules ?? []).map((s: { id: string }) => s.id);
  if (scheduleIds.length === 0) return 0;

  const { data: paidItems } = await client.from("payment_line_items")
    .select("amount, paid_amount, refunded_amount")
    .in("schedule_id", scheduleIds).in("status", ["paid", "partially_refunded", "refunded"]);
  return (paidItems ?? []).reduce(
    (sum: number, item: { amount: number; paid_amount: number | null; refunded_amount: number | null }) =>
      sum + (item.paid_amount != null ? Number(item.paid_amount) : Number(item.amount)) - Number(item.refunded_amount ?? 0),
    0,
  );
}
