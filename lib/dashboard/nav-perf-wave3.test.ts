import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";
import { selectFocusCandidateEventIds } from "@/lib/luv/focus-candidate-events";
import { computeContractsReadiness, computePaymentsReadiness, computeRequestsReadiness } from "@/lib/readiness/compute";
import type { Contract } from "@/lib/contracts/types";
import type { Invoice } from "@/lib/invoices/types";
import type { Request as PortalRequest } from "@/lib/requests/types";

const briefing = readFileSync(resolve("lib/luv/briefing-service.ts"), "utf8");
const invoicesRepo = readFileSync(resolve("lib/invoices/repository.ts"), "utf8");
const paymentsRepo = readFileSync(resolve("lib/payments/repository.ts"), "utf8");
const requestsService = readFileSync(resolve("lib/requests/service.ts"), "utf8");

function stubContract(partial: Partial<Contract> & Pick<Contract, "id" | "eventId" | "status">): Contract {
  return {
    venueId: "v",
    clientId: "c",
    templateId: null,
    title: "t",
    content: "",
    executionOrigin: "htc",
    signToken: "tok",
    signerName: null,
    signedAt: null,
    sentAt: null,
    expiresAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    amendsContractId: null,
    brandingSnapshot: null,
    clientName: null,
    clientEmail: null,
    eventDate: null,
    ...partial,
  };
}

function stubInvoice(partial: Partial<Invoice> & Pick<Invoice, "id" | "eventId" | "status" | "balanceDue" | "dueDate">): Invoice {
  return {
    venueId: "v",
    clientId: "c",
    invoiceNumber: "INV-1",
    displayName: null,
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,
    notes: null,
    issuedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
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
  };
}

function stubRequest(partial: Partial<PortalRequest> & Pick<PortalRequest, "id" | "eventId" | "status" | "dueDate">): PortalRequest {
  return {
    venueId: "v",
    clientId: "c",
    title: "r",
    description: null,
    requestType: "information",
    visibility: "shared",
    requestedByUserId: null,
    assignedToStaffId: null,
    sourceFeature: null,
    sourceId: null,
    responseText: null,
    responseFileUrl: null,
    clientActionEnabled: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    completedAt: null,
    reviewedAt: null,
    ...partial,
  };
}

describe("NAV-PERF Wave 3 — Focus briefing lean loaders", () => {
  it("Focus path uses lean invoice/schedule/line/request loaders", () => {
    assert.match(invoicesRepo, /export async function getInvoicesForDashboardBriefing/);
    assert.match(paymentsRepo, /export async function getSchedulesForDashboardBriefing/);
    assert.match(paymentsRepo, /export async function getLineItemsForDashboardBriefing/);
    assert.match(requestsService, /export async function getRequestsForDashboardBriefing/);
    const focusFn = briefing.slice(
      briefing.indexOf("async function loadFocusReadinessInputs"),
      briefing.indexOf("async function loadReadinessInputs"),
    );
    assert.match(focusFn, /getInvoicesForDashboardBriefing/);
    assert.match(focusFn, /getSchedulesForDashboardBriefing/);
    assert.match(focusFn, /getLineItemsForDashboardBriefing/);
    assert.match(focusFn, /getRequestsForDashboardBriefing/);
    assert.match(focusFn, /selectFocusCandidateEventIds/);
    assert.doesNotMatch(focusFn, /getInvoices\(/);
    assert.doesNotMatch(focusFn, /getSchedules\(/);
    assert.doesNotMatch(focusFn, /getAllLineItems\(/);
    assert.doesNotMatch(focusFn, /getRequestsForVenue\(/);
  });

  it("does not introduce an event-date cutoff on the Focus path", () => {
    const focusFn = briefing.slice(
      briefing.indexOf("async function loadFocusReadinessInputs"),
      briefing.indexOf("async function loadReadinessInputs"),
    );
    const candidate = readFileSync(resolve("lib/luv/focus-candidate-events.ts"), "utf8");
    assert.doesNotMatch(focusFn, /event_date\.(gte|lte|gt|lt)/);
    assert.doesNotMatch(focusFn, /\.gte\(["']event_date/);
    assert.doesNotMatch(candidate, /\.gte\(["']event_date/);
    assert.match(candidate, /No event-date cutoff/);
  });

  it("full Daily Briefing still uses fat venue-wide loaders", () => {
    const fatPath = briefing.slice(
      briefing.indexOf("async function loadReadinessInputs"),
      briefing.indexOf("export async function getFocusNeedsAttentionBriefing"),
    );
    assert.match(fatPath, /getContracts\(/);
    assert.match(fatPath, /getInvoices\(/);
    assert.match(fatPath, /getSchedules\(/);
    assert.match(fatPath, /getAllLineItems\(/);
    assert.match(fatPath, /getRequestsForVenue\(/);
  });
});

type FocusEvent = { id: string; name: string; event_date: string | null; client_id: string | null; status: string };

function buildFocusItems(input: {
  events: FocusEvent[];
  contracts: Contract[];
  invoices: Invoice[];
  requests: PortalRequest[];
  scheduleLinesByEventId: Map<string, Array<{ id: string; status: string; dueDate: string | null; amount: number }>>;
}) {
  const items: Array<{
    id: string;
    category: string;
    status: string;
    eventId: string;
    detail: string;
    linkKind: string;
  }> = [];
  const contractsByEvent = new Map<string, Contract[]>();
  for (const c of input.contracts) {
    if (!c.eventId) continue;
    const list = contractsByEvent.get(c.eventId) ?? [];
    list.push(c);
    contractsByEvent.set(c.eventId, list);
  }
  const invoicesByEvent = new Map<string, Invoice[]>();
  for (const i of input.invoices) {
    if (!i.eventId) continue;
    const list = invoicesByEvent.get(i.eventId) ?? [];
    list.push(i);
    invoicesByEvent.set(i.eventId, list);
  }
  const requestsByEvent = new Map<string, PortalRequest[]>();
  for (const r of input.requests) {
    if (!r.eventId) continue;
    const list = requestsByEvent.get(r.eventId) ?? [];
    list.push(r);
    requestsByEvent.set(r.eventId, list);
  }

  for (const event of input.events) {
    if (event.status === "cancelled" || !event.client_id) continue;
    const eventContracts = contractsByEvent.get(event.id) ?? [];
    const eventInvoices = invoicesByEvent.get(event.id) ?? [];
    const eventRequests = requestsByEvent.get(event.id) ?? [];
    const eventLines = input.scheduleLinesByEventId.get(event.id) ?? [];
    if (eventContracts.length > 0) {
      const section = computeContractsReadiness(eventContracts);
      if (section.status === "needs_attention") {
        items.push({
          id: `briefing-contract-${event.id}`,
          category: "contracts",
          status: section.status,
          eventId: event.id,
          detail: section.detail,
          linkKind: "contract",
        });
      }
    }
    if (eventInvoices.length > 0 || eventLines.length > 0) {
      const section = computePaymentsReadiness(eventInvoices, eventLines);
      if (section.status === "needs_attention") {
        items.push({
          id: `briefing-payments-${event.id}`,
          category: "payments",
          status: section.status,
          eventId: event.id,
          detail: section.detail,
          linkKind: "invoice",
        });
      }
    }
    if (eventRequests.length > 0) {
      const section = computeRequestsReadiness(eventRequests);
      if (section.status === "needs_attention") {
        items.push({
          id: `briefing-requests-${event.id}`,
          category: "requests",
          status: section.status,
          eventId: event.id,
          detail: section.detail,
          linkKind: "request",
        });
      }
    }
  }
  items.sort((a, b) => {
    const ea = input.events.find((e) => e.id === a.eventId)?.event_date ?? "9999";
    const eb = input.events.find((e) => e.id === b.eventId)?.event_date ?? "9999";
    return ea.localeCompare(eb);
  });
  return items;
}

describe("NAV-PERF Wave 3 — selectFocusCandidateEventIds parity rules", () => {
  it("includes draft-only contracts, overdue lines, and venue-waiting requests", () => {
    const scheduleLinesByEventId = new Map([
      ["pay-evt", [{ id: "l1", status: "overdue", dueDate: "2020-01-01", amount: 100 }]],
    ]);
    const ids = selectFocusCandidateEventIds({
      contracts: [stubContract({ id: "c1", eventId: "contract-evt", status: "draft" })],
      invoices: [stubInvoice({ id: "i1", eventId: "pay-evt", status: "sent", balanceDue: 100, dueDate: "2020-01-01" })],
      requests: [stubRequest({ id: "r1", eventId: "req-evt", status: "submitted", dueDate: null })],
      scheduleLinesByEventId,
    });
    assert.equal(ids.has("contract-evt"), true);
    assert.equal(ids.has("pay-evt"), true);
    assert.equal(ids.has("req-evt"), true);
  });

  it("excludes fully signed contracts, waiting-only payments, and client-waiting requests", () => {
    const scheduleLinesByEventId = new Map([
      ["waiting-pay", [{ id: "l1", status: "pending", dueDate: "2099-01-01", amount: 100 }]],
    ]);
    const contracts = [stubContract({ id: "c1", eventId: "signed-evt", status: "signed" })];
    const invoices = [stubInvoice({ id: "i1", eventId: "waiting-pay", status: "sent", balanceDue: 100, dueDate: "2099-01-01" })];
    const requests = [stubRequest({ id: "r1", eventId: "client-wait", status: "sent", dueDate: null })];

    assert.equal(computeContractsReadiness(contracts).status, "complete");
    assert.equal(
      computePaymentsReadiness(invoices, scheduleLinesByEventId.get("waiting-pay")!).status,
      "waiting",
    );
    assert.equal(computeRequestsReadiness(requests).status, "waiting");

    const ids = selectFocusCandidateEventIds({
      contracts,
      invoices,
      requests,
      scheduleLinesByEventId,
    });
    assert.equal(ids.has("signed-evt"), false);
    assert.equal(ids.has("waiting-pay"), false);
    assert.equal(ids.has("client-wait"), false);
  });

  it("keeps historical overdue payment events without a date cutoff", () => {
    const scheduleLinesByEventId = new Map([
      ["historical", [{ id: "l1", status: "pending", dueDate: "2019-06-01", amount: 50 }]],
    ]);
    const ids = selectFocusCandidateEventIds({
      contracts: [],
      invoices: [stubInvoice({ id: "i1", eventId: "historical", status: "sent", balanceDue: 50, dueDate: "2019-06-01" })],
      requests: [],
      scheduleLinesByEventId,
    });
    assert.equal(ids.has("historical"), true);
  });

  it("candidate-only Focus matches full-event Focus across representative fixtures", () => {
    const events: FocusEvent[] = [
      { id: "hist-overdue", name: "Historical overdue", event_date: "2020-05-01", client_id: "c1", status: "booked" },
      { id: "future-partial", name: "Future partial", event_date: "2027-06-01", client_id: "c2", status: "booked" },
      { id: "draft-contract", name: "Draft contract", event_date: "2027-07-01", client_id: "c3", status: "booked" },
      { id: "sent-contract", name: "Sent contract", event_date: "2027-08-01", client_id: "c4", status: "booked" },
      { id: "multi-attn", name: "Multi attention", event_date: "2027-09-01", client_id: "c5", status: "booked" },
      { id: "submitted-req", name: "Submitted request", event_date: "2027-10-01", client_id: "c6", status: "booked" },
      { id: "clean-future", name: "No obligations", event_date: "2027-11-01", client_id: "c7", status: "booked" },
      { id: "cancelled-evt", name: "Cancelled", event_date: "2027-12-01", client_id: "c8", status: "cancelled" },
      { id: "orphan-rows", name: "Incomplete records", event_date: "2028-01-01", client_id: "c9", status: "booked" },
      { id: "no-client", name: "Missing client", event_date: "2028-02-01", client_id: null, status: "booked" },
    ];
    const contracts = [
      stubContract({ id: "cd1", eventId: "draft-contract", status: "draft" }),
      stubContract({ id: "cs1", eventId: "sent-contract", status: "sent" }),
      stubContract({ id: "cm1", eventId: "multi-attn", status: "draft" }),
      stubContract({ id: "cc1", eventId: "cancelled-evt", status: "draft" }),
      stubContract({ id: "cn1", eventId: "no-client", status: "draft" }),
    ];
    const invoices = [
      stubInvoice({ id: "ih1", eventId: "hist-overdue", status: "sent", balanceDue: 200, dueDate: "2020-01-01" }),
      stubInvoice({ id: "ip1", eventId: "future-partial", status: "sent", balanceDue: 500, dueDate: "2027-05-01" }),
      stubInvoice({ id: "im1", eventId: "multi-attn", status: "sent", balanceDue: 100, dueDate: "2020-01-01" }),
      stubInvoice({ id: "ic1", eventId: "cancelled-evt", status: "sent", balanceDue: 50, dueDate: "2020-01-01" }),
      stubInvoice({ id: "io1", eventId: "orphan-rows", status: "void", balanceDue: 0, dueDate: null }),
    ];
    const requests = [
      stubRequest({ id: "rs1", eventId: "submitted-req", status: "submitted", dueDate: null }),
      stubRequest({ id: "rm1", eventId: "multi-attn", status: "reviewed", dueDate: null }),
      stubRequest({ id: "rc1", eventId: "cancelled-evt", status: "submitted", dueDate: null }),
    ];
    const scheduleLinesByEventId = new Map([
      ["hist-overdue", [{ id: "lh1", status: "overdue", dueDate: "2020-01-01", amount: 200 }]],
      ["future-partial", [
        { id: "lp1", status: "paid", dueDate: "2026-01-01", amount: 500 },
        { id: "lp2", status: "overdue", dueDate: "2026-06-01", amount: 500 },
      ]],
      ["multi-attn", [{ id: "lm1", status: "pending", dueDate: "2019-01-01", amount: 100 }]],
      ["cancelled-evt", [{ id: "lc1", status: "overdue", dueDate: "2020-01-01", amount: 50 }]],
      ["clean-future", [{ id: "lx1", status: "pending", dueDate: "2099-01-01", amount: 100 }]],
    ]);

    const data = { contracts, invoices, requests, scheduleLinesByEventId };
    const full = buildFocusItems({ events, ...data });
    const candidates = selectFocusCandidateEventIds(data);
    const candidateEvents = events.filter((e) => e.status !== "cancelled" && candidates.has(e.id));
    const filtered = buildFocusItems({ events: candidateEvents, ...data });

    assert.deepEqual(filtered, full);
    assert.equal(full.some((i) => i.eventId === "hist-overdue" && i.category === "payments"), true);
    assert.equal(full.some((i) => i.eventId === "future-partial" && i.category === "payments"), true);
    assert.equal(full.some((i) => i.eventId === "draft-contract" && i.category === "contracts"), true);
    assert.equal(full.some((i) => i.eventId === "sent-contract"), false);
    assert.equal(full.filter((i) => i.eventId === "multi-attn").length, 3);
    assert.equal(full.some((i) => i.eventId === "submitted-req" && i.category === "requests"), true);
    assert.equal(full.some((i) => i.eventId === "clean-future"), false);
    assert.equal(full.some((i) => i.eventId === "cancelled-evt"), false);
    assert.equal(full.some((i) => i.eventId === "orphan-rows"), false);
    assert.equal(full.some((i) => i.eventId === "no-client"), false);
    assert.equal(candidates.has("sent-contract"), false);
    assert.equal(candidates.has("clean-future"), false);
  });
});
