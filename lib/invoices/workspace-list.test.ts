/**
 * Performance Slice 3B — Client Workspace invoice client|event scoping.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  frozenEventOrderLineIds,
  packageBookingCommitmentInvoiceIds,
} from "@/lib/invoices/booking-commitment";
import { getInvoices, getInvoicesForClientOrEvent, listInvoiceLineMarkers } from "@/lib/invoices/repository";
import { computePaymentsReadiness } from "@/lib/readiness/compute";
import type { Invoice } from "@/lib/invoices/types";

const repoSrc = readFileSync(resolve("lib/invoices/repository.ts"), "utf8");
const serviceSrc = readFileSync(resolve("lib/invoices/service.ts"), "utf8");
const pageSrc = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");
const eoLinkSrc = readFileSync(resolve("components/event-orders/event-order-invoice-link.tsx"), "utf8");

type Call = { table: string; method: string; args: unknown[] };

function makeClient(opts: {
  invoiceRows?: Record<string, unknown>[];
  markerRows?: Record<string, unknown>[];
}) {
  const calls: Call[] = [];
  const invoiceRows = opts.invoiceRows ?? [];
  const markerRows = opts.markerRows ?? [];

  function chain(table: string, terminal: () => Promise<{ data: unknown; error: null }>) {
    const api: Record<string, (...a: unknown[]) => unknown> = {};
    const wrap = (method: string) => (...args: unknown[]) => {
      calls.push({ table, method, args });
      return api;
    };
    api.select = wrap("select");
    api.eq = wrap("eq");
    api.or = wrap("or");
    api.in = wrap("in");
    api.order = wrap("order");
    api.ilike = wrap("ilike");
    api.then = (...a: unknown[]) => {
      const resolveFn = a[0] as (v: unknown) => unknown;
      const rejectFn = a[1] as ((e: unknown) => unknown) | undefined;
      return terminal().then(resolveFn, rejectFn);
    };
    return api;
  }

  return {
    calls,
    from(table: string) {
      if (table === "invoices") {
        return chain(table, async () => ({ data: invoiceRows, error: null }));
      }
      if (table === "invoice_line_items") {
        return chain(table, async () => ({ data: markerRows, error: null }));
      }
      return chain(table, async () => ({ data: [], error: null }));
    },
  };
}

function invoiceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    venue_id: "v1",
    client_id: "client-a",
    event_id: "event-a",
    invoice_number: "INV-1",
    display_name: "Invoice",
    status: "sent",
    subtotal: 100,
    discount_amount: 0,
    tax_amount: 0,
    total: 100,
    balance_due: 50,
    notes: null,
    due_date: "2026-11-01",
    issued_at: "2026-09-01T00:00:00.000Z",
    event_order_id: null,
    event_order_dismissed_fingerprint: null,
    amends_invoice_id: null,
    event_order_revision_at_freeze: null,
    quickbooks_sync_status: "not_synced",
    branding_snapshot: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function asInvoice(partial: Partial<Invoice> & Pick<Invoice, "id" | "status">): Invoice {
  return {
    venueId: "v1",
    clientId: "client-a",
    eventId: "event-a",
    invoiceNumber: "INV",
    displayName: "Invoice",
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 100,
    balanceDue: 50,
    notes: null,
    dueDate: "2026-11-01",
    issuedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    clientName: null,
    eventDate: null,
    bookedAt: null,
    eventName: null,
    eventOrderId: null,
    eventOrderDismissedFingerprint: null,
    amendsInvoiceId: null,
    eventOrderRevisionAtFreeze: null,
    amendedByInvoiceId: null,
    amendedByInvoiceNumber: null,
    quickbooksSyncStatus: "not_synced",
    brandingSnapshot: null,
    ...partial,
  } as Invoice;
}

describe("Slice 3B — repository getInvoicesForClientOrEvent scope", () => {
  it("issues client|event OR filter under venue_id", async () => {
    const sb = makeClient({
      invoiceRows: [
        invoiceRow({ id: "client-only", client_id: "client-a", event_id: null }),
        invoiceRow({ id: "event-only", client_id: null, event_id: "event-a" }),
        invoiceRow({ id: "both", client_id: "client-a", event_id: "event-a" }),
      ],
    });
    const rows = await getInvoicesForClientOrEvent(sb as never, "v1", {
      clientId: "client-a",
      eventId: "event-a",
    });
    const orCall = sb.calls.find((c) => c.method === "or");
    assert.ok(orCall);
    assert.equal(orCall.args[0], "client_id.eq.client-a,event_id.eq.event-a");
    assert.ok(sb.calls.some((c) => c.table === "invoices" && c.method === "eq" && c.args[0] === "venue_id" && c.args[1] === "v1"));
    assert.deepEqual(rows.map((r) => r.id).sort(), ["both", "client-only", "event-only"]);
    assert.equal(rows.find((r) => r.id === "client-only")?.eventId, null);
    assert.equal(rows.find((r) => r.id === "event-only")?.clientId, null);
  });

  it("does not use client-only or event-only helpers for the workspace query", () => {
    const fn = repoSrc.slice(
      repoSrc.indexOf("export async function getInvoicesForClientOrEvent"),
      repoSrc.indexOf("export async function insertInvoice"),
    );
    assert.match(fn, /\.or\(`client_id\.eq\.\$\{scope\.clientId\},event_id\.eq\.\$\{scope\.eventId\}`\)/);
    assert.doesNotMatch(fn, /\.eq\("client_id", scope\.clientId\)\s*\.eq\("event_id"/);
  });
});

describe("Slice 3B — Client Workspace semantics preserved", () => {
  it("keeps EO-linked and client-only draft available; markers use scoped IDs", async () => {
    const scoped = [
      asInvoice({
        id: "eo-draft",
        status: "draft",
        eventOrderId: "eo-1",
        clientId: "client-a",
        eventId: "event-a",
        invoiceNumber: "INV-EO",
      }),
      asInvoice({
        id: "client-draft",
        status: "draft",
        eventOrderId: null,
        clientId: "client-a",
        eventId: null,
        invoiceNumber: "INV-DRAFT",
      }),
      asInvoice({
        id: "commitment",
        status: "sent",
        eventOrderId: null,
        clientId: "client-a",
        eventId: "event-a",
        invoiceNumber: "INV-PKG",
      }),
    ];

    // Event Order draft-link target: draft without eventOrderId (and not commitment).
    const linkableDraft = scoped.find(
      (inv) => inv.status === "draft" && !inv.eventOrderId && inv.id !== "commitment",
    );
    assert.equal(linkableDraft?.id, "client-draft");
    assert.match(eoLinkSrc, /inv\.status === "draft" && !inv\.eventOrderId/);

    const eoLinked =
      scoped.find((inv) => inv.eventOrderId === "eo-1" && inv.status === "draft") ??
      scoped.find((inv) => inv.eventOrderId === "eo-1" && inv.status !== "void");
    assert.equal(eoLinked?.id, "eo-draft");

    const sb = makeClient({
      markerRows: [
        { invoice_id: "commitment", type: "package", event_order_line_id: null },
        { invoice_id: "eo-draft", type: "item", event_order_line_id: "eol-1" },
      ],
    });
    const scopedIds = scoped.map((i) => i.id);
    const markers = await listInvoiceLineMarkers(sb as never, "v1", scopedIds);
    const inCall = sb.calls.find((c) => c.table === "invoice_line_items" && c.method === "in");
    assert.ok(inCall);
    assert.deepEqual(inCall.args[1], scopedIds);
    assert.deepEqual(
      packageBookingCommitmentInvoiceIds(markers),
      ["commitment"],
    );
    assert.deepEqual(
      frozenEventOrderLineIds(markers, scoped.filter((i) => i.status !== "void").map((i) => i.id)).sort(),
      ["eol-1"],
    );
  });

  it("payments readiness still works from scoped invoice fields", () => {
    const section = computePaymentsReadiness([
      asInvoice({ id: "a", status: "sent", balanceDue: 100, dueDate: "2099-01-01" }),
      asInvoice({ id: "b", status: "void", balanceDue: 999, dueDate: "2020-01-01" }),
    ]);
    assert.ok(section.status === "waiting" || section.status === "needs_attention" || section.status === "complete");
    assert.match(section.detail, /balance due|Paid|overdue|invoice/i);
  });
});

describe("Slice 3B — wiring + isolation", () => {
  it("Client Workspace uses scoped invoices; markers chain from that list", () => {
    assert.match(pageSrc, /getInvoicesForClientOrEvent\(id, eventId\)/);
    assert.match(pageSrc, /getInvoiceLineMarkers\(eventInvoices\.map\(\(inv\) => inv\.id\)\)/);
    assert.doesNotMatch(pageSrc, /getInvoices\(\{\}\)/);
    assert.doesNotMatch(pageSrc, /all\.filter\(\(inv\) => inv\.eventId === eventId \|\| inv\.clientId === id\)/);
  });

  it("service wrapper preserves getCurrentVenue; general getInvoices unchanged", () => {
    const scoped = serviceSrc.slice(
      serviceSrc.indexOf("export async function getInvoicesForClientOrEvent"),
      serviceSrc.indexOf("export async function getInvoice("),
    );
    assert.match(scoped, /getCurrentVenue/);
    assert.match(scoped, /repo\.getInvoicesForClientOrEvent/);

    const general = serviceSrc.slice(
      serviceSrc.indexOf("export async function getInvoices("),
      serviceSrc.indexOf("export async function getInvoicesForClientOrEvent"),
    );
    assert.match(general, /repo\.getInvoices/);
    assert.match(repoSrc, /export async function getInvoices\(/);
  });

  it("venue-wide getInvoices remains select * without OR scope", async () => {
    const sb = makeClient({ invoiceRows: [invoiceRow({ id: "any" })] });
    await getInvoices(sb as never, "v1", {});
    assert.ok(!sb.calls.some((c) => c.method === "or"));
    assert.ok(sb.calls.some((c) => c.method === "eq" && c.args[0] === "venue_id"));
  });
});
