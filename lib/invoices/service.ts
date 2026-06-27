import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/invoices/repository";
import type {
  AddLineItemResult,
  CreateInvoiceResult,
  Invoice,
  InvoiceActionResult,
  InvoiceInput,
  InvoiceLineItemInput,
  InvoiceStatus,
  InvoiceWithLineItems,
} from "@/lib/invoices/types";
import { getCurrentVenue } from "@/lib/venue/service";

async function withVenue<T>(fn: (c: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>): Promise<T | InvoiceActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

export async function getInvoices(filters?: { q?: string; status?: string }): Promise<Invoice[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getInvoices(await createClient(), venue.id, filters);
}

export async function getInvoice(id: string): Promise<InvoiceWithLineItems | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  return repo.getInvoice(await createClient(), venue.id, id);
}

export async function getInvoicesForClient(clientId: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  return repo.getInvoicesForClient(await createClient(), venue.id, clientId);
}

export async function createInvoice(input: InvoiceInput): Promise<CreateInvoiceResult> {
  if (!input.clientId) return { ok: false, errors: { clientId: "Client is required." } };
  const result = await withVenue(async (c, venueId) => {
    const invoiceId = await repo.insertInvoice(c, venueId, input);
    await repo.insertActivity(c, venueId, invoiceId, "created", "Invoice created");
    return { ok: true, invoiceId } as CreateInvoiceResult;
  });
  return result as CreateInvoiceResult;
}

export async function addLineItem(invoiceId: string, input: InvoiceLineItemInput): Promise<AddLineItemResult> {
  if (!input.description.trim()) return { ok: false, errors: { description: "Description is required." } };
  const result = await withVenue(async (c, venueId) => {
    const item = await repo.addLineItem(c, venueId, invoiceId, input);
    await repo.insertActivity(c, venueId, invoiceId, "line_item_added", `Line item added: ${input.description.trim()}`);
    return { ok: true, item } as AddLineItemResult;
  });
  return result as AddLineItemResult;
}

export async function removeLineItem(invoiceId: string, itemId: string): Promise<InvoiceActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.removeLineItem(c, venueId, invoiceId, itemId);
    await repo.insertActivity(c, venueId, invoiceId, "line_item_removed", "Line item removed");
    return { ok: true } as InvoiceActionResult;
  });
  return result as InvoiceActionResult;
}

export async function updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<InvoiceActionResult> {
  const result = await withVenue(async (c, venueId) => {
    await repo.updateInvoiceStatus(c, venueId, invoiceId, status);
    await repo.insertActivity(c, venueId, invoiceId, "status_changed", `Status updated to ${status}`);
    return { ok: true } as InvoiceActionResult;
  });
  return result as InvoiceActionResult;
}
