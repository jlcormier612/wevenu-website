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

export async function getInvoices(client: DbClient, venueId: string): Promise<Invoice[]> {
  const { data, error } = await client.from("invoices")
    .select("*, clients(first_name, last_name, partner_first_name, partner_last_name), events(name, event_date)")
    .eq("venue_id", venueId).order("created_at", { ascending: false });
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
  const qty = parseFloat(input.quantity) || 1;
  const price = parseFloat(input.unitPrice.replace(/[$,]/g, "")) || 0;
  const amount = parseFloat((qty * price).toFixed(2));
  // Get current sort order max
  const { data: existing } = await client.from("invoice_line_items").select("sort_order").eq("invoice_id", invoiceId).order("sort_order", { ascending: false }).limit(1);
  const sortOrder = ((existing?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
  const { data, error } = await client.from("invoice_line_items")
    .insert({ invoice_id: invoiceId, venue_id: venueId, package_id: input.packageId || null, type: input.type, description: input.description.trim(), quantity: qty, unit_price: price, amount, sort_order: sortOrder })
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

async function recomputeInvoiceTotals(client: DbClient, venueId: string, invoiceId: string): Promise<void> {
  const { data } = await client.from("invoice_line_items").select("type, amount").eq("invoice_id", invoiceId);
  const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(
    (data ?? []) as { type: InvoiceLineItem["type"]; amount: number }[]
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("invoices") as any).update({ subtotal, discount_amount: discountAmount, tax_amount: taxAmount, total, balance_due: total }).eq("id", invoiceId).eq("venue_id", venueId);
}
