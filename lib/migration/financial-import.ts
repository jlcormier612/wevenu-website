/**
 * Phase C financial import. One migration-record payload, one canonical write.
 * Does not send, charge, refund through Stripe, enqueue QuickBooks, or change booking status.
 */
import type { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { insertContractActivity } from "@/lib/contracts/repository";
import { computeInvoiceTotals } from "@/lib/invoices/constants";
import type { InvoiceLineItem } from "@/lib/invoices/types";
import { insertDocument } from "@/lib/documents/repository";
import { resolveClientIdByEmail } from "@/lib/migration/resolve-refs";
import {
  effectForKind,
  isMovementKind,
  parseMoney,
  reconcileInvoiceBalance,
  roundMoney,
  type BalanceEffect,
  type MovementKind,
} from "@/lib/migration/financial-activity";

type DbClient = Awaited<ReturnType<typeof createClient>>;

export const HELD_PREFIX = "HELD:";

export type FinancialRecordKind = "contract" | "vendor_agreement" | "invoice" | "installment" | "movement";

export type FinancialLine = {
  description: string;
  quantity?: string | null;
  unitPrice?: string | null;
  amount?: string | null;
  type?: string | null;
};

export type NormalizedFinancialRecord = {
  recordKind: FinancialRecordKind;
  sourceId: string;
  clientId?: string | null;
  clientEmail?: string | null;
  eventId?: string | null;
  sourceEventId?: string | null;
  eventDate?: string | null;
  eventSpace?: string | null;
  clientLevel?: boolean | null;
  contractTitle?: string | null;
  contractContent?: string | null;
  agreementValue?: string | null;
  signedAt?: string | null;
  signerName?: string | null;
  amendsSourceId?: string | null;
  executedFilePath?: string | null;
  fileName?: string | null;
  vendorId?: string | null;
  vendorName?: string | null;
  invoiceNumber?: string | null;
  issuedAt?: string | null;
  invoiceStatus?: string | null;
  subtotal?: string | null;
  discountAmount?: string | null;
  taxAmount?: string | null;
  invoiceTotal?: string | null;
  lines?: FinancialLine[] | null;
  notes?: string | null;
  statedRemaining?: string | null;
  movementKind?: string | null;
  amount?: string | null;
  occurredOn?: string | null;
  method?: string | null;
  reference?: string | null;
  invoiceSourceId?: string | null;
  counterInvoiceSourceId?: string | null;
  relatedSourceId?: string | null;
  adjustmentEffect?: string | null;
  installmentLabel?: string | null;
  dueDate?: string | null;
  installmentSourceId?: string | null;
};

export type FinancialCommitResult =
  | { ok: true; entityId: string; alreadyImported?: boolean }
  | { ok: false; error: string };

const PRIVATE_BUCKET = "contract-representations";

function held(message: string): { ok: false; error: string } {
  return { ok: false, error: `${HELD_PREFIX} ${message}` };
}

function day(value?: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

function noon(value?: string | null): string | null {
  const date = day(value);
  return date ? `${date}T12:00:00.000Z` : null;
}

async function privateFileExists(storagePath: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(PRIVATE_BUCKET).createSignedUrl(storagePath, 30);
  return !error && !!data?.signedUrl;
}

export async function resolveFinancialTarget(
  client: DbClient,
  venueId: string,
  input: Pick<NormalizedFinancialRecord, "clientId" | "clientEmail" | "eventId" | "sourceEventId" | "eventDate" | "eventSpace" | "clientLevel">,
  options: { eventRequired: boolean },
): Promise<{ ok: true; clientId: string; eventId: string | null } | { ok: false; error: string }> {
  const clientRef = await resolveClientIdByEmail(client, venueId, input.clientId, input.clientEmail);
  if (!clientRef.ok) return clientRef;
  const clientId = clientRef.clientId;

  if (input.eventId?.trim()) {
    const { data, error } = await client.from("events")
      .select("id, client_id")
      .eq("id", input.eventId.trim())
      .eq("venue_id", venueId)
      .maybeSingle<{ id: string; client_id: string | null }>();
    if (error) throw error;
    if (!data) return { ok: false, error: "Event was not found in this venue." };
    if (data.client_id !== clientId) {
      return held("That event belongs to a different client. Choose the event for this client.");
    }
    return { ok: true, clientId, eventId: data.id };
  }

  if (input.sourceEventId?.trim()) {
    const { data, error } = await client.from("migration_records")
      .select("created_entity_id, target_entity_type")
      .eq("venue_id", venueId)
      .eq("status", "committed")
      .filter("normalized_payload->>sourceId", "eq", input.sourceEventId.trim())
      .limit(5);
    if (error) throw error;
    const eventIds = ((data ?? []) as { created_entity_id: string | null; target_entity_type: string }[])
      .filter((row) => row.target_entity_type === "event" && row.created_entity_id)
      .map((row) => row.created_entity_id as string);
    if (eventIds.length === 1) {
      const { data: event, error: eventError } = await client.from("events")
        .select("id, client_id")
        .eq("id", eventIds[0])
        .eq("venue_id", venueId)
        .maybeSingle<{ id: string; client_id: string | null }>();
      if (eventError) throw eventError;
      if (event?.client_id === clientId) return { ok: true, clientId, eventId: event.id };
    }
    if (eventIds.length > 1) {
      return held("That source event id matches more than one imported event.");
    }
  }

  const eventDate = day(input.eventDate);
  if (eventDate) {
    const { data, error } = await client.from("events")
      .select("id, client_id, space_id")
      .eq("venue_id", venueId)
      .eq("client_id", clientId)
      .eq("event_date", eventDate);
    if (error) throw error;
    let matches = (data ?? []) as { id: string; space_id: string | null }[];
    const spaceName = input.eventSpace?.trim();
    if (spaceName && matches.length > 0) {
      const { data: spaces, error: spaceError } = await client.from("venue_spaces")
        .select("id, name")
        .eq("venue_id", venueId);
      if (spaceError) throw spaceError;
      const spaceIds = new Set(
        ((spaces ?? []) as { id: string; name: string }[])
          .filter((space) => space.name.trim().toLowerCase() === spaceName.toLowerCase())
          .map((space) => space.id),
      );
      matches = matches.filter((event) => event.space_id != null && spaceIds.has(event.space_id));
    }
    if (matches.length === 1) return { ok: true, clientId, eventId: matches[0].id };
    if (matches.length > 1) {
      return held("More than one event matches this client and date. Choose the event explicitly.");
    }
    return { ok: false, error: "No event matches this client and date. Import the event first, or choose one." };
  }

  if (input.clientLevel) {
    return { ok: true, clientId, eventId: null };
  }
  if (!options.eventRequired) {
    return held("This record does not name an event. Choose the event, or mark it as a client-level invoice.");
  }
  return held("Choose the event for this agreement. An import will not pick the client's only or earliest event.");
}

async function existingBySource(
  client: DbClient,
  table: "contracts" | "invoices" | "payment_line_items" | "financial_movements" | "documents",
  venueId: string,
  sourceId: string,
): Promise<string | null> {
  const column = table === "documents" ? "notes" : table === "financial_movements" ? "source_id" : "import_source_id";
  if (table === "documents") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from(table) as any)
    .select("id")
    .eq("venue_id", venueId)
    .eq(column, sourceId)
    .maybeSingle();
  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

/** Contracts and invoices commit before the activity that refers to them. Within one kind, file order wins over record id. */
export function financialCommitOrder(record: {
  sourceRowRef?: string | null;
  normalizedPayload?: Record<string, unknown> | null;
}): [number, number] {
  const kind = String(record.normalizedPayload?.recordKind ?? "");
  const rank: Record<string, number> = {
    contract: 0,
    vendor_agreement: 1,
    invoice: 2,
    installment: 3,
    movement: 4,
  };
  const match = /(\d+)/.exec(record.sourceRowRef ?? "");
  return [rank[kind] ?? 9, match ? Number(match[1]) : Number.MAX_SAFE_INTEGER];
}

/**
 * A refund or reallocation can be committed before the movement it names when
 * that movement is later in the same file. Fill the pair once both exist.
 * Never overwrites a relationship that is already stored.
 */
export async function linkImportedMovementRelationships(
  client: DbClient,
  venueId: string,
  records: { sourceId?: string | null; relatedSourceId?: string | null }[],
): Promise<void> {
  for (const record of records) {
    const sourceId = record.sourceId?.trim();
    const relatedSourceId = record.relatedSourceId?.trim();
    if (!sourceId || !relatedSourceId) continue;
    const id = await existingBySource(client, "financial_movements", venueId, sourceId);
    const relatedId = await existingBySource(client, "financial_movements", venueId, relatedSourceId);
    if (!id || !relatedId || id === relatedId) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("financial_movements") as any)
      .update({ related_movement_id: relatedId })
      .eq("id", id)
      .eq("venue_id", venueId)
      .is("related_movement_id", null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("financial_movements") as any)
      .update({ related_movement_id: id })
      .eq("id", relatedId)
      .eq("venue_id", venueId)
      .is("related_movement_id", null);
  }
}

export async function commitFinancialRecord(
  client: DbClient,
  venueId: string,
  record: NormalizedFinancialRecord,
): Promise<FinancialCommitResult> {
  const sourceId = record.sourceId?.trim();
  if (!sourceId) return { ok: false, error: "A source id is required so a retry does not create a second copy." };

  if (record.recordKind === "contract") return commitContract(client, venueId, record, sourceId);
  if (record.recordKind === "vendor_agreement") return commitVendorAgreement(client, venueId, record, sourceId);
  if (record.recordKind === "invoice") return commitInvoice(client, venueId, record, sourceId);
  if (record.recordKind === "installment") return commitInstallment(client, venueId, record, sourceId);
  if (record.recordKind === "movement") return commitMovement(client, venueId, record, sourceId);
  return { ok: false, error: "This financial row needs a record kind of contract, vendor_agreement, invoice, installment, or movement." };
}

async function commitContract(
  client: DbClient,
  venueId: string,
  record: NormalizedFinancialRecord,
  sourceId: string,
): Promise<FinancialCommitResult> {
  const existing = await existingBySource(client, "contracts", venueId, sourceId);
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };
  if (!record.contractTitle?.trim()) return { ok: false, error: "An executed agreement needs a title." };
  const target = await resolveFinancialTarget(client, venueId, record, { eventRequired: true });
  if (!target.ok) return target;
  if (!target.eventId) return held("A venue–client agreement has to be attached to an event.");

  const filePath = record.executedFilePath?.trim() || null;
  if (filePath && !(await privateFileExists(filePath))) {
    return { ok: false, error: "The executed agreement file was not found in private contract storage." };
  }

  let amendsId: string | null = null;
  if (record.amendsSourceId?.trim()) {
    amendsId = await existingBySource(client, "contracts", venueId, record.amendsSourceId.trim());
    if (!amendsId) return { ok: false, error: "Import the original agreement before its amendment." };
  }

  const value = parseMoney(record.agreementValue);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("contracts") as any)
    .insert({
      venue_id: venueId,
      client_id: target.clientId,
      event_id: target.eventId,
      template_id: null,
      title: record.contractTitle.trim(),
      content: record.contractContent?.trim()
        || "Executed outside Hello to Cheers. The original file is stored with this agreement.",
      status: "signed",
      execution_origin: "external",
      signer_name: record.signerName?.trim() || null,
      signed_at: noon(record.signedAt),
      sent_at: null,
      is_couple_visible: false,
      amends_contract_id: amendsId,
      agreement_value: value,
      import_source_id: sourceId,
      executed_file_path: filePath,
    })
    .select("id")
    .single();
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      return held("This event already has an executed agreement. Mark the next file as an amendment with amendsSourceId.");
    }
    throw error;
  }
  const contractId = (data as { id: string }).id;
  await insertContractActivity(
    client,
    venueId,
    contractId,
    "externally_executed",
    "Recorded as executed outside Hello to Cheers",
    "Imported historical agreement. Hello to Cheers did not request a signature.",
  );
  return { ok: true, entityId: contractId };
}

async function commitVendorAgreement(
  client: DbClient,
  venueId: string,
  record: NormalizedFinancialRecord,
  sourceId: string,
): Promise<FinancialCommitResult> {
  const { data: existingDoc } = await client.from("documents")
    .select("id")
    .eq("venue_id", venueId)
    .contains("tags", [`import:${sourceId}`])
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existingDoc?.id) return { ok: true, entityId: existingDoc.id, alreadyImported: true };

  let vendorId = record.vendorId?.trim() || null;
  if (!vendorId && record.vendorName?.trim()) {
    const { data, error } = await client.from("venue_vendor_relationships")
      .select("vendor_id, vendors!inner(business_name)")
      .eq("venue_id", venueId);
    if (error) throw error;
    const name = record.vendorName.trim().toLowerCase();
    const matches = ((data ?? []) as { vendor_id: string; vendors: { business_name: string } | { business_name: string }[] | null }[])
      .map((row) => {
        const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
        return { id: row.vendor_id, businessName: vendor?.business_name ?? "" };
      })
      .filter((vendor) => vendor.businessName.trim().toLowerCase() === name);
    if (matches.length !== 1) {
      return held(matches.length === 0
        ? "No vendor matches that name. Import the vendor first."
        : "More than one vendor has that name. Choose the vendor explicitly.");
    }
    vendorId = matches[0].id;
  }
  if (!vendorId) return { ok: false, error: "A venue–vendor agreement needs a vendor." };
  const filePath = record.executedFilePath?.trim();
  if (!filePath) return { ok: false, error: "A venue–vendor agreement needs the original file in private storage." };
  if (!(await privateFileExists(filePath))) {
    return { ok: false, error: "The vendor agreement file was not found in private contract storage." };
  }

  const documentId = await insertDocument(client, venueId, {
    entityType: "vendor",
    entityId: vendorId,
    name: record.contractTitle?.trim() || record.fileName || "Venue–vendor agreement",
    fileName: record.fileName?.trim() || "agreement.pdf",
    fileSize: 0,
    mimeType: "application/pdf",
    storagePath: filePath,
    storageUrl: `private://${PRIVATE_BUCKET}/${filePath}`,
    category: "contract",
    notes: "Venue–vendor agreement imported from the prior system. This is not a client booking contract.",
    tags: `migration,venue-vendor-agreement,import:${sourceId}`,
    expiresAt: "",
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("documents") as any)
    .update({ is_couple_visible: false, shared_with_vendors: false })
    .eq("id", documentId)
    .eq("venue_id", venueId);
  return { ok: true, entityId: documentId };
}

function invoiceLines(record: NormalizedFinancialRecord): { type: InvoiceLineItem["type"]; description: string; quantity: number; unitPrice: number; amount: number }[] {
  const supplied = record.lines ?? [];
  if (supplied.length > 0) {
    return supplied.map((line) => {
      const quantity = Number.parseFloat(line.quantity || "1") || 1;
      const amount = parseMoney(line.amount) ?? roundMoney(quantity * (parseMoney(line.unitPrice) ?? 0));
      const type = (line.type || "item") as InvoiceLineItem["type"];
      return {
        type,
        description: line.description?.trim() || "Imported line",
        quantity,
        unitPrice: parseMoney(line.unitPrice) ?? amount,
        amount,
      };
    });
  }
  const subtotal = parseMoney(record.subtotal);
  const discount = parseMoney(record.discountAmount) ?? 0;
  const tax = parseMoney(record.taxAmount) ?? 0;
  const total = parseMoney(record.invoiceTotal) ?? 0;
  const lines: { type: InvoiceLineItem["type"]; description: string; quantity: number; unitPrice: number; amount: number }[] = [];
  const itemAmount = subtotal ?? roundMoney(total - tax + discount);
  if (itemAmount !== 0) {
    lines.push({ type: "item", description: "Imported invoice", quantity: 1, unitPrice: itemAmount, amount: itemAmount });
  }
  if (discount > 0) {
    lines.push({ type: "discount", description: "Discount", quantity: 1, unitPrice: discount, amount: discount });
  }
  if (tax > 0) {
    lines.push({ type: "tax", description: "Tax", quantity: 1, unitPrice: tax, amount: tax });
  }
  return lines;
}

async function commitInvoice(
  client: DbClient,
  venueId: string,
  record: NormalizedFinancialRecord,
  sourceId: string,
): Promise<FinancialCommitResult> {
  const existing = await existingBySource(client, "invoices", venueId, sourceId);
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };
  const invoiceNumber = record.invoiceNumber?.trim();
  if (!invoiceNumber) return { ok: false, error: "An invoice needs its original invoice number." };
  const status = (record.invoiceStatus || "sent").trim();
  if (!["draft", "sent", "partially_paid", "paid", "void"].includes(status)) {
    return { ok: false, error: "Invoice status must be draft, sent, partially_paid, paid, or void." };
  }
  const target = await resolveFinancialTarget(client, venueId, record, { eventRequired: false });
  if (!target.ok) return target;

  const lines = invoiceLines(record);
  if (lines.length === 0) return { ok: false, error: "An invoice needs a total or at least one line." };
  const totals = computeInvoiceTotals(lines.map((line) => ({ type: line.type, amount: line.amount })));
  const stated = parseMoney(record.invoiceTotal);
  if (stated != null && Math.abs(stated - totals.total) > 0.01) {
    return held(`Invoice ${invoiceNumber} total ${stated.toFixed(2)} does not match its lines (${totals.total.toFixed(2)}).`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("invoices") as any)
    .insert({
      venue_id: venueId,
      client_id: target.clientId,
      event_id: target.eventId,
      invoice_number: invoiceNumber,
      display_name: invoiceNumber,
      status: status === "void" ? "void" : status === "draft" ? "draft" : "sent",
      subtotal: totals.subtotal,
      discount_amount: totals.discountAmount,
      tax_amount: totals.taxAmount,
      total: totals.total,
      balance_due: status === "void" ? 0 : totals.total,
      notes: record.notes?.trim() || "Imported historical invoice. Not sent from Hello to Cheers.",
      issued_at: status === "draft" ? null : noon(record.issuedAt),
      is_couple_visible: false,
      import_source_id: sourceId,
    })
    .select("id")
    .single();
  if (error) throw error;
  const invoiceId = (data as { id: string }).id;

  let sort = 0;
  for (const line of lines) {
    const { error: lineError } = await client.from("invoice_line_items").insert({
      invoice_id: invoiceId,
      venue_id: venueId,
      type: line.type,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      amount: line.amount,
      sort_order: sort++,
    });
    if (lineError) throw lineError;
  }
  return { ok: true, entityId: invoiceId };
}

async function invoiceForSource(client: DbClient, venueId: string, sourceId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("invoices") as any)
    .select("id, client_id, event_id, total, status")
    .eq("venue_id", venueId)
    .eq("import_source_id", sourceId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; client_id: string | null; event_id: string | null; total: number; status: string } | null;
}

async function scheduleForInvoice(client: DbClient, venueId: string, invoice: { id: string; client_id: string | null; event_id: string | null; total: number }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (client.from("payment_schedules") as any)
    .select("id")
    .eq("venue_id", venueId)
    .eq("invoice_id", invoice.id)
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: created, error } = await (client.from("payment_schedules") as any)
    .insert({
      venue_id: venueId,
      client_id: invoice.client_id,
      event_id: invoice.event_id,
      invoice_id: invoice.id,
      title: "Imported payment schedule",
      total_amount: invoice.total,
      notes: "Obligations imported from the prior system. Receipts are stored as individual financial activity.",
    })
    .select("id")
    .single();
  if (error) throw error;
  return (created as { id: string }).id;
}

async function commitInstallment(
  client: DbClient,
  venueId: string,
  record: NormalizedFinancialRecord,
  sourceId: string,
): Promise<FinancialCommitResult> {
  const existing = await existingBySource(client, "payment_line_items", venueId, sourceId);
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };
  if (!record.invoiceSourceId?.trim()) return { ok: false, error: "An installment needs the source id of its invoice." };
  const invoice = await invoiceForSource(client, venueId, record.invoiceSourceId.trim());
  if (!invoice) return { ok: false, error: "Import the invoice before its payment schedule." };
  if (invoice.status === "void") return held("A void invoice cannot take a future installment.");
  const amount = parseMoney(record.amount);
  if (amount == null || amount <= 0) return { ok: false, error: "An installment needs a positive amount." };
  const scheduleId = await scheduleForInvoice(client, venueId, invoice);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("payment_line_items") as any)
    .insert({
      venue_id: venueId,
      schedule_id: scheduleId,
      label: record.installmentLabel?.trim() || "Installment",
      amount,
      due_date: day(record.dueDate),
      status: "pending",
      sort_order: 0,
      import_source_id: sourceId,
      notes: "Imported obligation. Nothing was collected for this row.",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { ok: true, entityId: (data as { id: string }).id };
}

async function refreshInvoiceStatus(client: DbClient, venueId: string, invoiceId: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invoice } = await (client.from("invoices") as any)
    .select("status, total, balance_due")
    .eq("id", invoiceId)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (!invoice || invoice.status === "void" || invoice.status === "draft") return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: movements } = await (client.from("financial_movements") as any)
    .select("kind, amount, effect")
    .eq("invoice_id", invoiceId)
    .eq("origin", "import");
  const drafts = ((movements ?? []) as { kind: MovementKind; amount: number; effect: BalanceEffect }[]);
  const reconciled = reconcileInvoiceBalance({
    invoiceTotal: Number(invoice.total),
    movements: drafts,
  });
  if (!reconciled.ok) return;
  const next = reconciled.remaining <= 0.009
    ? "paid"
    : netReduction(drafts) > 0
      ? "partially_paid"
      : "sent";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (client.from("invoices") as any)
    .update({ status: next, is_couple_visible: false })
    .eq("id", invoiceId)
    .eq("venue_id", venueId);
}

function netReduction(movements: { amount: number; effect: BalanceEffect }[]): number {
  return movements.reduce((sum, movement) => sum + (movement.effect === "reduces_balance" ? Number(movement.amount) : -Number(movement.amount)), 0);
}

async function commitMovement(
  client: DbClient,
  venueId: string,
  record: NormalizedFinancialRecord,
  sourceId: string,
): Promise<FinancialCommitResult> {
  const existing = await existingBySource(client, "financial_movements", venueId, sourceId);
  if (existing) return { ok: true, entityId: existing, alreadyImported: true };
  const kindRaw = record.movementKind?.trim() || "";
  if (!isMovementKind(kindRaw)) return { ok: false, error: "Activity kind must be payment, refund, reallocation_out, reallocation_in, credit, adjustment, or write_off." };
  const effect = effectForKind(kindRaw, record.adjustmentEffect);
  if (!effect) return { ok: false, error: "An adjustment must say whether it reduces or increases the balance." };
  const amount = parseMoney(record.amount);
  if (amount == null || amount < 0) return { ok: false, error: "Activity needs an amount." };
  if (!record.invoiceSourceId?.trim()) return { ok: false, error: "Activity needs the source id of its invoice." };
  const invoice = await invoiceForSource(client, venueId, record.invoiceSourceId.trim());
  if (!invoice) return { ok: false, error: "Import the invoice before its payments and adjustments." };
  if (invoice.status === "void") return held("Activity cannot be applied to a void invoice.");

  let counterInvoiceId: string | null = null;
  if (record.counterInvoiceSourceId?.trim()) {
    const counter = await invoiceForSource(client, venueId, record.counterInvoiceSourceId.trim());
    if (!counter) return { ok: false, error: "Import both invoices before this reallocation." };
    counterInvoiceId = counter.id;
  }
  if ((kindRaw === "reallocation_out" || kindRaw === "reallocation_in") && !counterInvoiceId) {
    return { ok: false, error: "A reallocation needs the other invoice's source id." };
  }

  let relatedId: string | null = null;
  if (record.relatedSourceId?.trim()) {
    relatedId = await existingBySource(client, "financial_movements", venueId, record.relatedSourceId.trim());
  }
  let lineItemId: string | null = null;
  if (record.installmentSourceId?.trim()) {
    lineItemId = await existingBySource(client, "payment_line_items", venueId, record.installmentSourceId.trim());
    if (!lineItemId) return { ok: false, error: "Import the installment before activity allocated to it." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prior } = await (client.from("financial_movements") as any)
    .select("kind, amount, effect")
    .eq("invoice_id", invoice.id)
    .eq("origin", "import");
  const drafts = [
    ...((prior ?? []) as { kind: MovementKind; amount: number; effect: BalanceEffect }[]),
    { kind: kindRaw, amount, effect },
  ];
  const stated = parseMoney(record.statedRemaining);
  const reconciled = reconcileInvoiceBalance({
    invoiceTotal: Number(invoice.total),
    movements: drafts,
    statedRemaining: stated,
  });
  if (!reconciled.ok) return held(reconciled.reason);

  const scheduleId = await scheduleForInvoice(client, venueId, invoice);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.from("financial_movements") as any)
    .insert({
      venue_id: venueId,
      client_id: invoice.client_id,
      event_id: invoice.event_id,
      invoice_id: invoice.id,
      schedule_id: scheduleId,
      line_item_id: lineItemId,
      related_movement_id: relatedId,
      counter_invoice_id: counterInvoiceId,
      kind: kindRaw,
      amount,
      effect,
      occurred_on: day(record.occurredOn),
      method: record.method?.trim() || null,
      reference_number: record.reference?.trim() || null,
      notes: record.notes?.trim() || null,
      source_id: sourceId,
      origin: "import",
    })
    .select("id")
    .single();
  if (error) throw error;
  const movementId = (data as { id: string }).id;
  if (relatedId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client.from("financial_movements") as any)
      .update({ related_movement_id: movementId })
      .eq("id", relatedId)
      .eq("venue_id", venueId)
      .is("related_movement_id", null);
  }
  await refreshInvoiceStatus(client, venueId, invoice.id);
  return { ok: true, entityId: movementId };
}

export async function recordLegacyPaidMovement(
  client: DbClient,
  venueId: string,
  input: {
    sourceId: string;
    invoiceId: string;
    clientId: string | null;
    eventId: string | null;
    scheduleId: string;
    lineItemId: string;
    amount: number;
    occurredOn: string | null;
    method: string | null;
    reference: string | null;
  },
): Promise<void> {
  const existing = await existingBySource(client, "financial_movements", venueId, input.sourceId);
  if (existing) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("financial_movements") as any).insert({
    venue_id: venueId,
    client_id: input.clientId,
    event_id: input.eventId,
    invoice_id: input.invoiceId,
    schedule_id: input.scheduleId,
    line_item_id: input.lineItemId,
    kind: "payment",
    amount: input.amount,
    effect: "reduces_balance",
    occurred_on: input.occurredOn,
    method: input.method,
    reference_number: input.reference,
    notes: "Migrated payment — collected outside Hello to Cheers; not processed by HTC.",
    source_id: input.sourceId,
    origin: "import",
  });
  if (error) throw error;
}
