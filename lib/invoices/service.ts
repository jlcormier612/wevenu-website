import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import * as repo from "@/lib/invoices/repository";
import { computeInvoiceTotals } from "@/lib/invoices/constants";
import type {
  AddLineItemResult,
  CreateInvoiceResult,
  EventOrderDrift,
  EventOrderLineChange,
  EventOrderLineSnapshot,
  EventOrderPriceChange,
  Invoice,
  InvoiceActionResult,
  InvoiceInput,
  InvoiceLineItem,
  InvoiceLineItemInput,
  InvoiceLineItemType,
  InvoiceStatus,
  InvoiceWithLineItems,
} from "@/lib/invoices/types";
import { getEventOrder } from "@/lib/event-orders/service";
import { eventOrderLinesFingerprint } from "@/lib/event-orders/constants";
import type { EventOrderLine } from "@/lib/event-orders/types";
import { getCurrentVenue } from "@/lib/venue/service";

/**
 * Booking Financial Architecture Phase 3a — a Draft Invoice linked to an
 * Event Order is a live projection of it, not a synchronized copy
 * (docs/booking-financial-architecture-phase3-trust-design.md). This maps
 * Event Order's provenance vocabulary onto Invoice's own line-item type
 * vocabulary; nothing here writes to invoice_line_items — these lines
 * simply don't exist as stored rows until Phase 3b's freeze-on-send.
 */
const PROVENANCE_TO_INVOICE_TYPE: Record<string, InvoiceLineItemType> = {
  package: "package", inventory: "inventory", custom: "item",
};

function projectEventOrderLines(eventOrderLines: EventOrderLine[]): InvoiceLineItem[] {
  return eventOrderLines.map((l) => ({
    id: l.id, invoiceId: "", venueId: l.venueId, packageId: l.packageId,
    type: PROVENANCE_TO_INVOICE_TYPE[l.provenance] ?? "item",
    description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount,
    sortOrder: l.sortOrder, createdAt: l.createdAt, eventOrderLineId: l.id,
  }));
}

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
  const invoice = await repo.getInvoice(await createClient(), venue.id, id);
  if (!invoice) return null;

  // Phase 3a: a draft Invoice linked to an Event Order is a live
  // projection — its Event-Order-sourced lines are computed here, never
  // stored, so there is nothing that can go stale while draft. Ad hoc
  // lines a coordinator added directly (tax, fees, one-offs) are real,
  // stored rows either way and are simply concatenated after the
  // projected ones.
  if (invoice.status === "draft" && invoice.eventOrderId) {
    const eventOrder = await getEventOrder(invoice.eventId ?? "");
    if (eventOrder) {
      const projectedLines = projectEventOrderLines(eventOrder.lines);
      const lineItems = [...projectedLines, ...invoice.lineItems];
      const { subtotal, discountAmount, taxAmount, total } = computeInvoiceTotals(lineItems);
      // Whatever's already been paid against this invoice (rare but
      // possible while still draft — Phase 1's retainer flow doesn't
      // require "sent" first) is derived from the stored figures, which
      // already account for it correctly; only the total itself grows to
      // include the live Event Order projection.
      const alreadyPaid = invoice.total - invoice.balanceDue;
      return { ...invoice, lineItems, subtotal, discountAmount, taxAmount, total, balanceDue: Math.max(0, total - alreadyPaid) };
    }
  }
  return invoice;
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
    if (status === "sent") {
      const invoice = await repo.getInvoice(c, venueId, invoiceId);
      if (!invoice) return { ok: false, message: "Invoice not found." } as InvoiceActionResult;
      if (invoice.status === "draft" && invoice.eventOrderId) {
        // Phase 3b: the commitment moment. Event Order's currently-live-
        // projected lines get copied into real, permanent invoice_line_items
        // rows for the first time — Copy at Commitment, recognized one
        // layer up from where Event Order already applies it to
        // Package/Inventory. From this instant on, nothing here changes
        // again without a human's explicit decision.
        const eventOrder = await getEventOrder(invoice.eventId ?? "");
        if (eventOrder) {
          await repo.insertFrozenLinesFromEventOrder(c, venueId, invoiceId, eventOrder.lines.map((l) => ({
            eventOrderLineId: l.id, packageId: l.packageId, type: PROVENANCE_TO_INVOICE_TYPE[l.provenance] ?? "item",
            description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount, sortOrder: l.sortOrder,
          })));
          // Booking Financial Architecture Phase 3c — a permanent trace of
          // which Event Order revision produced this invoice, independent
          // of whatever revision Event Order has moved to since.
          await repo.updateInvoiceStatus(c, venueId, invoiceId, status, { eventOrderRevisionAtFreeze: eventOrder.revision });
          await repo.insertActivity(c, venueId, invoiceId, "status_changed", `Status updated to ${status}`);
          return { ok: true } as InvoiceActionResult;
        }
      }
    }
    await repo.updateInvoiceStatus(c, venueId, invoiceId, status);
    await repo.insertActivity(c, venueId, invoiceId, "status_changed", `Status updated to ${status}`);
    return { ok: true } as InvoiceActionResult;
  });
  return result as InvoiceActionResult;
}

/**
 * Booking Financial Architecture Phase 3c — "Update Draft Invoice." Only
 * safe once nothing has been collected against this invoice — retroactively
 * changing figures money has already moved against is exactly the failure
 * shape this whole trust migration exists to prevent, arriving from a new
 * direction. Structurally disabled here, not just discouraged: the guard
 * lives in the one function that can actually perform the reversal, not in
 * a UI affordance that could be bypassed.
 */
export async function revertInvoiceToDraft(invoiceId: string): Promise<InvoiceActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const invoice = await repo.getInvoice(c, venueId, invoiceId);
    if (!invoice) return { ok: false, message: "Invoice not found." } as InvoiceActionResult;
    if (invoice.status !== "sent") return { ok: false, message: "Only a sent invoice can be reverted to draft." } as InvoiceActionResult;
    if (invoice.balanceDue < invoice.total) {
      return { ok: false, message: "A payment has already been recorded against this invoice — it can no longer be reverted. Create an amended invoice instead." } as InvoiceActionResult;
    }
    await repo.revertToDraft(c, venueId, invoiceId);
    await repo.insertActivity(c, venueId, invoiceId, "reverted_to_draft", "Reopened as Draft to reflect Event Order changes.");
    return { ok: true } as InvoiceActionResult;
  });
  return result as InvoiceActionResult;
}

/**
 * Booking Financial Architecture Phase 3c — "Create Amended Invoice." The
 * new invoice starts in Draft, linked to the same Event Order, and is
 * nothing more than a normal Draft invoice from that point on — Phase 3a's
 * live projection is exactly what makes it correct from the moment it's
 * created. The original stays exactly as it was, sent or paid, untouched
 * and immutable, and remains the active financial record until this one is
 * itself explicitly reviewed and sent — creating this never changes what
 * the original says, what it's owed, or its status.
 */
export async function createAmendedInvoice(originalInvoiceId: string): Promise<CreateInvoiceResult> {
  const result = await withVenue(async (c, venueId) => {
    const original = await repo.getInvoice(c, venueId, originalInvoiceId);
    if (!original) return { ok: false, message: "Invoice not found." } as CreateInvoiceResult;
    if (!original.eventOrderId) return { ok: false, message: "Only an Event-Order-linked invoice can be amended." } as CreateInvoiceResult;
    if (original.status !== "sent" && original.status !== "paid") {
      return { ok: false, message: "Only a sent or paid invoice can be amended." } as CreateInvoiceResult;
    }
    if (original.amendedByInvoiceId) {
      return { ok: false, message: `An amended invoice (${original.amendedByInvoiceNumber}) already exists for this one. Review or send that one first.` } as CreateInvoiceResult;
    }
    const newInvoiceId = await repo.insertInvoice(c, venueId, {
      clientId: original.clientId ?? "", eventId: original.eventId ?? "", notes: original.notes ?? "",
      dueDate: original.dueDate ?? "", eventOrderId: original.eventOrderId, amendsInvoiceId: original.id,
    });
    await repo.copyAdHocLineItems(c, venueId, newInvoiceId, original.lineItems);
    await repo.insertActivity(c, venueId, newInvoiceId, "created", `Amends ${original.invoiceNumber} — starts as a live Draft, not active until sent.`);
    await repo.insertActivity(c, venueId, originalInvoiceId, "amended", `An amended invoice was created. This invoice remains the active financial record until the amendment is sent.`);
    return { ok: true, invoiceId: newInvoiceId } as CreateInvoiceResult;
  });
  return result as CreateInvoiceResult;
}

/** Booking Financial Architecture Phase 3a — link an already-existing Draft invoice to an Event Order. */
export async function linkInvoiceToEventOrder(invoiceId: string, eventOrderId: string): Promise<InvoiceActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const outcome = await repo.linkEventOrder(c, venueId, invoiceId, eventOrderId);
    if (!outcome.ok) return { ok: false, message: outcome.message } as InvoiceActionResult;
    await repo.insertActivity(c, venueId, invoiceId, "event_order_linked", "Linked to Event Order — now a live projection of it while in Draft.");
    return { ok: true } as InvoiceActionResult;
  });
  return result as InvoiceActionResult;
}

function buildDriftSummary(addedCount: number, removedCount: number, changedCount: number, priceChangedCount: number): string {
  const parts: string[] = [];
  if (addedCount > 0) parts.push(`${addedCount} item${addedCount === 1 ? "" : "s"} added`);
  if (removedCount > 0) parts.push(`${removedCount} item${removedCount === 1 ? "" : "s"} removed`);
  if (changedCount > 0) parts.push(`${changedCount} ${changedCount === 1 ? "line" : "lines"} changed`);
  if (priceChangedCount > 0) parts.push(`${priceChangedCount} price change${priceChangedCount === 1 ? "" : "s"}`);
  return parts.join(", ");
}

/**
 * Booking Financial Architecture Phase 3b — the observe step. Diffs a sent
 * Invoice's frozen, Event-Order-sourced lines directly against Event
 * Order's current lines (never a revision counter or timestamp proxy — the
 * real data is the source of truth for the real data). Returns null when
 * there is nothing new to show a coordinator: no drift at all, or drift
 * that was already reviewed and dismissed at this exact Event Order state
 * ("dismissal is scoped to what was reviewed, not permanent" — if Event
 * Order changes again, the fingerprint no longer matches and this starts
 * returning a result again).
 */
export async function getEventOrderDrift(invoiceId: string): Promise<EventOrderDrift | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const invoice = await repo.getInvoice(supabase, venue.id, invoiceId);
  if (!invoice || invoice.status === "draft" || !invoice.eventOrderId) return null;

  const eventOrder = await getEventOrder(invoice.eventId ?? "");
  if (!eventOrder) return null;

  const currentFingerprint = eventOrderLinesFingerprint(eventOrder.lines);
  if (invoice.eventOrderDismissedFingerprint === currentFingerprint) return null;

  const frozenLines = invoice.lineItems.filter((l): l is InvoiceLineItem & { eventOrderLineId: string } => !!l.eventOrderLineId);
  const frozenByEoId = new Map(frozenLines.map((l) => [l.eventOrderLineId, l]));
  const currentEoIds = new Set(eventOrder.lines.map((l) => l.id));

  const added: EventOrderLineSnapshot[] = [];
  const changed: EventOrderLineChange[] = [];
  const priceChanged: EventOrderPriceChange[] = [];

  for (const line of eventOrder.lines) {
    const frozen = frozenByEoId.get(line.id);
    if (!frozen) {
      added.push({ description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, amount: line.amount });
      continue;
    }
    if (frozen.quantity !== line.quantity || frozen.description !== line.description) {
      changed.push({
        description: line.description,
        fromQuantity: frozen.quantity, toQuantity: line.quantity,
        fromDescription: frozen.description, toDescription: line.description,
      });
    }
    if (frozen.unitPrice !== line.unitPrice) {
      priceChanged.push({ description: line.description, fromUnitPrice: frozen.unitPrice, toUnitPrice: line.unitPrice });
    }
  }
  const removed: EventOrderLineSnapshot[] = frozenLines
    .filter((l) => !currentEoIds.has(l.eventOrderLineId))
    .map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount }));

  if (added.length + removed.length + changed.length + priceChanged.length === 0) return null;

  return {
    added, removed, changed, priceChanged,
    summary: buildDriftSummary(added.length, removed.length, changed.length, priceChanged.length),
  };
}

/**
 * Booking Financial Architecture Phase 3b — "Dismiss for now." Records the
 * exact Event Order line-state a coordinator just reviewed, not a
 * permanent "never show me this again." The calm banner disappears until
 * Event Order changes again, at which point it's honestly new information.
 */
export async function dismissEventOrderDrift(invoiceId: string): Promise<InvoiceActionResult> {
  const result = await withVenue(async (c, venueId) => {
    const invoice = await repo.getInvoice(c, venueId, invoiceId);
    if (!invoice || !invoice.eventOrderId) return { ok: false, message: "Invoice not found or not linked to an Event Order." } as InvoiceActionResult;
    const eventOrder = await getEventOrder(invoice.eventId ?? "");
    if (!eventOrder) return { ok: false, message: "Event Order not found." } as InvoiceActionResult;
    await repo.setDismissedFingerprint(c, venueId, invoiceId, eventOrderLinesFingerprint(eventOrder.lines));
    await repo.insertActivity(c, venueId, invoiceId, "drift_dismissed", "Event Order changes reviewed and dismissed for now.");
    return { ok: true } as InvoiceActionResult;
  });
  return result as InvoiceActionResult;
}
