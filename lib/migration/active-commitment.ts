/**
 * Active Event financial cutover — reconstructs the same canonical HTC
 * objects a native booking would create (Event Order → Invoice → Payment
 * Schedule / paid lines), plus an externally executed Contract and real
 * event/client Documents when provided.
 *
 * Never invents a parallel ledger. Never fabricates HTC e-signatures.
 * Couple visibility is an explicit share decision on the existing
 * is_couple_visible flags — the same publication axis native HTC uses.
 */

import type { createClient } from "@/integrations/supabase/server";
import * as eventOrdersRepo from "@/lib/event-orders/repository";
import * as invoicesRepo from "@/lib/invoices/repository";
import * as paymentsRepo from "@/lib/payments/repository";
import * as documentsRepo from "@/lib/documents/repository";
import { recordExternallyExecutedContract } from "@/lib/contracts/external-execution";
import { shareExternallyExecutedAgreementWithCouple } from "@/lib/contracts/external-share";
import { resolveClientIdByEmail } from "@/lib/migration/resolve-refs";
import type { DocumentCategory } from "@/lib/documents/types";
import type { PaymentObligationKind } from "@/lib/payments/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export const HISTORICAL_PAYMENT_PROVENANCE =
  "Migrated payment — collected outside Hello to Cheers; not processed by HTC.";

export type ActiveCommitmentLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  packageId?: string | null;
};

export type ActiveCommitmentScheduleLine = {
  label: string;
  amount: string;
  dueDate?: string | null;
  obligationKind?: PaymentObligationKind | null;
  alreadyPaid?: boolean;
  paidDate?: string | null;
  paymentMethod?: string | null;
  referenceNumber?: string | null;
};

export type ActiveCommitmentDocument = {
  name: string;
  fileName: string;
  storagePath: string;
  storageUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  category?: DocumentCategory;
  notes?: string | null;
  entityType?: "event" | "client";
};

export type NormalizedActiveCommitment = {
  eventId?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  eventDate?: string | null;
  contractedTotal: string;
  packageName?: string | null;
  lines?: ActiveCommitmentLine[];
  scheduleLines: ActiveCommitmentScheduleLine[];
  invoiceNotes?: string | null;
  scheduleTitle?: string | null;
  contractTitle?: string | null;
  contractContent?: string | null;
  contractSignedAt?: string | null;
  contractSignerName?: string | null;
  documents?: ActiveCommitmentDocument[];
  /**
   * Explicit venue decision: make the externally executed agreement (and
   * attached signed file + invoice) visible in the couple portal via the
   * same is_couple_visible flags native HTC already uses.
   */
  shareSignedAgreementWithCouple?: boolean;
  sourceId?: string | null;
};

export type ActiveCommitmentCommitResult =
  | {
      ok: true;
      eventId: string;
      eventOrderId: string;
      invoiceId: string;
      scheduleId: string;
      contractId: string | null;
      documentIds: string[];
      alreadyCommitted?: boolean;
    }
  | { ok: false; error: string };

type CreatedIds = {
  eventOrderId: string | null;
  createdNewEventOrder: boolean;
  invoiceId: string | null;
  scheduleId: string | null;
  contractId: string | null;
  createdNewContract: boolean;
  documentIds: string[];
};

function money(value: string | null | undefined): number {
  if (value == null || value === "") return NaN;
  return parseFloat(String(value).replace(/[$,]/g, ""));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function validateActiveCommitment(n: NormalizedActiveCommitment): string | null {
  const total = money(n.contractedTotal);
  if (!(total > 0)) return "Active commitments need a contracted total greater than zero.";
  if (!n.eventId && !(n.clientEmail || n.clientId) && !n.eventDate) {
    return "Active commitments need an Event id, or a client email/id plus event date.";
  }
  if (!n.scheduleLines?.length) {
    return "Active commitments need at least one payment schedule line (including already-paid amounts).";
  }
  const scheduleSum = round2(n.scheduleLines.reduce((sum, line) => sum + (money(line.amount) || 0), 0));
  if (Math.abs(scheduleSum - total) > 0.01) {
    return `Payment schedule lines ($${scheduleSum.toFixed(2)}) must equal the contracted total ($${total.toFixed(2)}).`;
  }
  for (const line of n.scheduleLines) {
    if (!(money(line.amount) > 0)) return "Every payment schedule line needs a positive amount.";
    if (!line.label?.trim()) return "Every payment schedule line needs a label.";
  }
  const orderLines = commitmentOrderLines(n);
  if (orderLines.length === 0) return "Active commitments need package or line-item contents.";
  const orderSum = round2(orderLines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 1;
    return sum + qty * (money(l.unitPrice) || 0);
  }, 0));
  if (Math.abs(orderSum - total) > 0.01) {
    return `Event Order lines ($${orderSum.toFixed(2)}) must equal the contracted total ($${total.toFixed(2)}).`;
  }
  return null;
}

export function commitmentOrderLines(n: NormalizedActiveCommitment): ActiveCommitmentLine[] {
  if (n.lines?.length) return n.lines;
  if (n.packageName?.trim()) {
    return [{
      description: n.packageName.trim(),
      quantity: "1",
      unitPrice: n.contractedTotal,
      packageId: null,
    }];
  }
  return [];
}

export function summarizeCommitmentForReview(n: NormalizedActiveCommitment) {
  const total = money(n.contractedTotal) || 0;
  const paid = round2(
    n.scheduleLines.filter((l) => l.alreadyPaid).reduce((sum, l) => sum + (money(l.amount) || 0), 0),
  );
  const remaining = round2(total - paid);
  return {
    contractedTotal: total,
    paid,
    remaining,
    lines: commitmentOrderLines(n),
    scheduleLines: n.scheduleLines,
    contractTitle: n.contractTitle ?? null,
    executionOrigin: n.contractTitle?.trim() ? ("external" as const) : null,
    documents: n.documents ?? [],
    shareSignedAgreementWithCouple: !!n.shareSignedAgreementWithCouple,
  };
}

async function resolveEventId(
  client: DbClient,
  venueId: string,
  n: NormalizedActiveCommitment,
): Promise<{ ok: true; eventId: string; clientId: string } | { ok: false; error: string }> {
  if (n.eventId) {
    const { data, error } = await client.from("events")
      .select("id, client_id")
      .eq("id", n.eventId)
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; client_id: string | null }>();
    if (error) throw error;
    if (!data) return { ok: false, error: "Event not found for this venue." };
    if (!data.client_id) return { ok: false, error: "Event has no client — attach a client before importing financials." };
    return { ok: true, eventId: data.id, clientId: data.client_id };
  }

  const clientRef = await resolveClientIdByEmail(client, venueId, n.clientId, n.clientEmail);
  if (!clientRef.ok) return clientRef;
  if (!n.eventDate) return { ok: false, error: "Provide eventDate when resolving by client." };

  const { data: events, error } = await client.from("events")
    .select("id, client_id, event_date")
    .eq("venue_id", venueId)
    .eq("client_id", clientRef.clientId)
    .eq("event_date", n.eventDate)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!events?.length) {
    return { ok: false, error: "No Event found for that client and date. Import the Event first, then the financial commitment." };
  }
  if (events.length > 1) {
    return { ok: false, error: "Multiple Events match that client and date — set eventId explicitly." };
  }
  const ev = events[0] as { id: string; client_id: string };
  return { ok: true, eventId: ev.id, clientId: ev.client_id };
}

async function findExistingScheduleForInvoice(
  client: DbClient, venueId: string, invoiceId: string,
): Promise<string | null> {
  const { data } = await client.from("payment_schedules")
    .select("id").eq("venue_id", venueId).eq("invoice_id", invoiceId).limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

async function findExistingDocumentByStoragePath(
  client: DbClient, venueId: string, eventId: string, storagePath: string,
): Promise<string | null> {
  const { data } = await client.from("documents")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", eventId)
    .eq("storage_path", storagePath)
    .limit(1)
    .maybeSingle<{ id: string }>();
  return data?.id ?? null;
}

async function compensate(
  client: DbClient,
  venueId: string,
  created: CreatedIds,
): Promise<void> {
  // Reverse order. Prefer deleting only what this attempt created.
  for (const documentId of [...created.documentIds].reverse()) {
    try { await documentsRepo.deleteDocument(client, venueId, documentId); } catch { /* best-effort */ }
  }
  if (created.createdNewContract && created.contractId) {
    try {
      await client.from("contracts").delete().eq("id", created.contractId).eq("venue_id", venueId);
    } catch { /* best-effort */ }
  }
  if (created.scheduleId) {
    try {
      await client.from("payment_line_items").delete().eq("schedule_id", created.scheduleId).eq("venue_id", venueId);
      await client.from("payment_schedules").delete().eq("id", created.scheduleId).eq("venue_id", venueId);
    } catch { /* best-effort */ }
  }
  if (created.invoiceId) {
    try {
      await client.from("invoice_line_items").delete().eq("invoice_id", created.invoiceId).eq("venue_id", venueId);
      await client.from("invoices").delete().eq("id", created.invoiceId).eq("venue_id", venueId);
    } catch { /* best-effort */ }
  }
  if (created.createdNewEventOrder && created.eventOrderId) {
    try {
      await client.from("event_orders").delete().eq("id", created.eventOrderId).eq("venue_id", venueId);
    } catch { /* best-effort */ }
  }
}

export type CommitActiveCommitmentOptions = {
  /**
   * Test-only: throw after a named step so compensation can be proven.
   * Never set in production Migration Center commits.
   */
  failAfter?: "event_order" | "invoice" | "schedule" | "payments" | "contract" | "document";
};

async function failAfterHook(
  opts: CommitActiveCommitmentOptions | undefined,
  step: NonNullable<CommitActiveCommitmentOptions["failAfter"]>,
): Promise<void> {
  if (opts?.failAfter === step) {
    throw new Error(`TEST_FAIL_AFTER_${step}`);
  }
}

/**
 * Commits one reviewed active commitment onto canonical HTC tables.
 * Compensates on failure so a partial write does not strand orphan money objects.
 * Idempotent when the Event already has a complete commitment (EO + invoice + schedule).
 */
export async function commitActiveCommitment(
  client: DbClient,
  venueId: string,
  n: NormalizedActiveCommitment,
  opts?: CommitActiveCommitmentOptions,
): Promise<ActiveCommitmentCommitResult> {
  const validationError = validateActiveCommitment(n);
  if (validationError) return { ok: false, error: validationError };

  const resolved = await resolveEventId(client, venueId, n);
  if (!resolved.ok) return resolved;

  const existingOrder = await eventOrdersRepo.getEventOrderByEvent(client, venueId, resolved.eventId);
  const { data: existingInvoices } = await client.from("invoices")
    .select("id")
    .eq("venue_id", venueId)
    .eq("event_id", resolved.eventId)
    .neq("status", "void")
    .limit(1);
  const existingInvoiceId = (existingInvoices?.[0] as { id: string } | undefined)?.id ?? null;

  // True idempotent success: EO with lines + invoice + schedule already present.
  if (existingOrder && existingOrder.lines.length > 0 && existingInvoiceId) {
    const scheduleId = await findExistingScheduleForInvoice(client, venueId, existingInvoiceId);
    if (scheduleId) {
      const { data: ext } = await client.from("contracts")
        .select("id").eq("venue_id", venueId).eq("event_id", resolved.eventId)
        .eq("execution_origin", "external").eq("status", "signed").limit(1)
        .maybeSingle<{ id: string }>();
      return {
        ok: true,
        eventId: resolved.eventId,
        eventOrderId: existingOrder.id,
        invoiceId: existingInvoiceId,
        scheduleId,
        contractId: ext?.id ?? null,
        documentIds: [],
        alreadyCommitted: true,
      };
    }
    return {
      ok: false,
      error: "This Event already has an Event Order and invoice but no payment schedule. Review the booking in HTC before importing again.",
    };
  }

  if (existingOrder && existingOrder.lines.length > 0) {
    return {
      ok: false,
      error: "This Event already has an Event Order with lines. Review it in HTC instead of importing a second commitment.",
    };
  }
  if (existingInvoiceId) {
    return {
      ok: false,
      error: "This Event already has an invoice. Review the existing financial records instead of duplicating them.",
    };
  }

  const created: CreatedIds = {
    eventOrderId: existingOrder?.id ?? null,
    createdNewEventOrder: !existingOrder,
    invoiceId: null,
    scheduleId: null,
    contractId: null,
    createdNewContract: false,
    documentIds: [],
  };

  try {
    let eventOrderId = existingOrder?.id ?? null;
    if (!eventOrderId) {
      eventOrderId = await eventOrdersRepo.insertEventOrder(client, venueId, resolved.eventId, null);
      created.eventOrderId = eventOrderId;
      created.createdNewEventOrder = true;
      await eventOrdersRepo.insertActivity(
        client, venueId, eventOrderId, "created",
        "Event Order created from migration",
        "Reconstructed from the venue's prior booking commitment — not a new proposal.",
      );
    }

    let sort = 0;
    for (const line of commitmentOrderLines(n)) {
      if (line.packageId) {
        await eventOrdersRepo.insertLineFromPackage(client, venueId, eventOrderId, {
          packageId: line.packageId,
          description: line.description,
          unitPrice: money(line.unitPrice),
          sectionId: null,
        }, sort++);
      } else {
        await eventOrdersRepo.insertCustomLine(client, venueId, eventOrderId, {
          description: line.description,
          quantity: line.quantity || "1",
          unitPrice: line.unitPrice,
          sectionId: null,
        }, sort++);
      }
    }

    const order = await eventOrdersRepo.getEventOrderByEvent(client, venueId, resolved.eventId);
    if (!order) throw new Error("Event Order was not created.");
    await failAfterHook(opts, "event_order");

    const invoiceNotes = [
      n.invoiceNotes?.trim() || "",
      "Migrated active booking — totals and payments recorded from the prior system after human review.",
    ].filter(Boolean).join("\n");

    const invoiceId = await invoicesRepo.insertInvoice(client, venueId, {
      clientId: resolved.clientId,
      eventId: resolved.eventId,
      notes: invoiceNotes,
      dueDate: "",
      eventOrderId,
    });
    created.invoiceId = invoiceId;

    await invoicesRepo.insertFrozenLinesFromEventOrder(
      client, venueId, invoiceId,
      order.lines.map((l) => ({
        eventOrderLineId: l.id,
        packageId: l.packageId,
        type: (l.provenance === "package" ? "package" : l.provenance === "inventory" ? "inventory" : "item") as
          "package" | "inventory" | "item",
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        amount: l.amount,
        sortOrder: l.sortOrder,
      })),
    );

    await invoicesRepo.updateInvoiceStatus(client, venueId, invoiceId, "sent", {
      eventOrderRevisionAtFreeze: order.revision,
    });
    // Default private; explicit share decision below may publish.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("invoices") as any)
      .update({ is_couple_visible: false })
      .eq("id", invoiceId)
      .eq("venue_id", venueId);
    await invoicesRepo.insertActivity(
      client, venueId, invoiceId, "status_changed",
      "Invoice recorded from migration",
      "Kept private from the couple until the venue shares the agreement. Balance reflects migrated payments.",
    );
    await failAfterHook(opts, "invoice");

    const invoiceSummary = await paymentsRepo.getInvoiceSummaryForSchedule(client, venueId, invoiceId);
    if (!invoiceSummary) throw new Error("Invoice totals were not available after freeze.");

    const scheduleId = await paymentsRepo.insertSchedule(client, venueId, {
      title: n.scheduleTitle?.trim() || "Payment plan",
      clientId: resolved.clientId,
      eventId: resolved.eventId,
      totalAmount: invoiceSummary.total,
      notes: "Migrated payment plan — historical paid lines were not processed by Hello to Cheers.",
      invoiceId,
    });
    created.scheduleId = scheduleId;
    await paymentsRepo.insertPaymentActivity(
      client, venueId, scheduleId, "schedule_created",
      "Payment schedule created from migration",
    );
    await failAfterHook(opts, "schedule");

    let lineSort = 0;
    for (const sched of n.scheduleLines) {
      const item = await paymentsRepo.insertLineItem(client, venueId, scheduleId, {
        label: sched.label.trim(),
        amount: sched.amount,
        dueDate: sched.dueDate ?? "",
        obligationKind: sched.obligationKind ?? (sched.alreadyPaid ? "deposit" : "installment"),
      }, lineSort++);

      if (sched.alreadyPaid) {
        const marked = await paymentsRepo.markItemPaid(client, venueId, item.id, {
          paidAmount: sched.amount,
          paymentMethod: sched.paymentMethod?.trim() || "other",
          referenceNumber: sched.referenceNumber?.trim() || "",
          paidDate: sched.paidDate || new Date().toISOString().slice(0, 10),
          notes: HISTORICAL_PAYMENT_PROVENANCE,
        });
        if (!marked.ok) throw new Error(marked.message);
        await paymentsRepo.insertPaymentActivity(
          client, venueId, scheduleId, "payment_received",
          `Historical payment recorded: $${money(sched.amount).toLocaleString()}`,
          HISTORICAL_PAYMENT_PROVENANCE,
        );
      }
    }
    await paymentsRepo.reconcileInvoiceBalance(client, venueId, invoiceId);
    await failAfterHook(opts, "payments");

    let contractId: string | null = null;
    if (n.contractTitle?.trim()) {
      const recorded = await recordExternallyExecutedContract(client, venueId, {
        clientId: resolved.clientId,
        eventId: resolved.eventId,
        title: n.contractTitle.trim(),
        content: n.contractContent?.trim()
          || `Externally executed agreement for this Event.\n\nContracted total: $${money(n.contractedTotal).toLocaleString()}.\nRecorded during Bring Your Business cutover — not signed inside Hello to Cheers.`,
        signedAt: n.contractSignedAt ?? null,
        signerName: n.contractSignerName ?? null,
      });
      if (!recorded.ok) throw new Error(recorded.message);
      contractId = recorded.contractId;
      created.contractId = contractId;
      created.createdNewContract = !recorded.alreadyExisted;
    }
    await failAfterHook(opts, "contract");

    const documentIds: string[] = [];
    for (const doc of n.documents ?? []) {
      if (!doc.storageUrl || !doc.storagePath || !doc.fileName) continue;
      const entityType = doc.entityType ?? "event";
      const entityId = entityType === "client" ? resolved.clientId : resolved.eventId;
      if (entityType === "event") {
        const existingDoc = await findExistingDocumentByStoragePath(client, venueId, resolved.eventId, doc.storagePath);
        if (existingDoc) {
          documentIds.push(existingDoc);
          continue;
        }
      }
      const documentId = await documentsRepo.insertDocument(client, venueId, {
        entityType,
        entityId,
        name: doc.name || doc.fileName,
        fileName: doc.fileName,
        fileSize: doc.fileSize ?? 0,
        mimeType: doc.mimeType ?? "application/pdf",
        storagePath: doc.storagePath,
        storageUrl: doc.storageUrl,
        category: doc.category ?? "contract",
        notes: doc.notes?.trim()
          || (contractId
            ? "Original signed agreement from the prior system (linked to externally executed HTC contract)."
            : "Imported business document from Bring Your Business cutover."),
        tags: "migration,active-commitment",
        expiresAt: "",
      });
      documentIds.push(documentId);
      created.documentIds.push(documentId);
    }
    await failAfterHook(opts, "document");

    if (n.shareSignedAgreementWithCouple && contractId) {
      const shared = await shareExternallyExecutedAgreementWithCouple(client, venueId, {
        contractId,
        documentIds,
        invoiceId,
      });
      if (!shared.ok) throw new Error(shared.message);
    }

    return {
      ok: true,
      eventId: resolved.eventId,
      eventOrderId: eventOrderId!,
      invoiceId,
      scheduleId,
      contractId,
      documentIds,
    };
  } catch (err) {
    await compensate(client, venueId, created);
    const message = err instanceof Error
      ? err.message
      : (typeof err === "object" && err && "message" in err && typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : "Could not commit the active commitment.");
    return { ok: false, error: message };
  }
}
