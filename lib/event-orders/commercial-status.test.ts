import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  buildCommercialStatusChips,
  commercialChoicesDisplayKey,
} from "@/lib/event-orders/commercial-status";

describe("buildCommercialStatusChips", () => {
  it("maps missing inventory and choices to Not started without inventing completion", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [],
      eventOrder: null,
      invoices: [],
      eventOrderId: null,
      linkedScheduleId: null,
    });
    assert.equal(chips.find((c) => c.id === "inventory")?.status, "Not started");
    assert.equal(chips.find((c) => c.id === "choices")?.status, "Not started");
    assert.equal(chips.find((c) => c.id === "event_order")?.status, "Not started");
    assert.equal(chips.find((c) => c.id === "invoice")?.status, "Not created");
    assert.equal(chips.find((c) => c.id === "payment_plan"), undefined);
  });

  it("does not treat shared inventory as venue confirmation", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: { status: "shared" },
      clientChoices: [],
      eventOrder: null,
      invoices: [],
      eventOrderId: null,
      linkedScheduleId: null,
    });
    assert.equal(chips.find((c) => c.id === "inventory")?.status, "Awaiting client");
    assert.equal(chips.find((c) => c.id === "inventory")?.nav.kind, "tab");
  });

  it("maps submitted inventory to needs venue review", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: { status: "submitted" },
      clientChoices: [],
      eventOrder: { status: "open", sharedAt: null },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
    });
    assert.equal(chips.find((c) => c.id === "inventory")?.status, "Needs venue review");
  });

  it("keeps finalize distinct from share on Event Order", () => {
    const finalized = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: null },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
      showInventory: false,
    });
    assert.equal(finalized.find((c) => c.id === "event_order")?.status, "Finalized — not shared");

    const shared = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: "2026-01-01" },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
      showInventory: false,
    });
    assert.equal(shared.find((c) => c.id === "event_order")?.status, "Shared");
  });

  it("does not infer invoice from Event Order share alone", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: "2026-01-01" },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
      showInventory: false,
    });
    assert.equal(chips.find((c) => c.id === "invoice")?.status, "Not created");
  });

  it("does not infer payment plan from invoice existence alone", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: null },
      invoices: [{ id: "inv-1", status: "draft", eventOrderId: "eo-1" }],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
      showInventory: false,
    });
    assert.equal(chips.find((c) => c.id === "invoice")?.status, "Draft");
    assert.equal(chips.find((c) => c.id === "payment_plan")?.status, "Not created");
    assert.deepEqual(chips.find((c) => c.id === "payment_plan")?.nav, {
      kind: "href",
      href: "/invoices/inv-1",
    });
  });

  it("links payment plan when schedule id is present", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "finalized", sharedAt: null },
      invoices: [{ id: "inv-1", status: "sent", eventOrderId: "eo-1" }],
      eventOrderId: "eo-1",
      linkedScheduleId: "sched-1",
      showInventory: false,
    });
    assert.equal(chips.find((c) => c.id === "payment_plan")?.status, "Created");
    assert.deepEqual(chips.find((c) => c.id === "payment_plan")?.nav, {
      kind: "href",
      href: "/payments/sched-1",
    });
  });

  it("aggregates choices with venue-review priority over awaiting client", () => {
    assert.equal(
      commercialChoicesDisplayKey([{ status: "sent" }, { status: "submitted" }]),
      "client_submitted",
    );
    const chips = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [{ status: "sent" }, { status: "submitted" }],
      eventOrder: { status: "open", sharedAt: null },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
      showInventory: false,
    });
    assert.equal(chips.find((c) => c.id === "choices")?.status, "Client Submitted");
    assert.deepEqual(chips.find((c) => c.id === "choices")?.nav, {
      kind: "tab",
      tab: "event-order",
      anchor: "event-order-choices",
    });
  });

  it("deep-links inventory to inventory tab and order to order anchor", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: { status: "draft" },
      clientChoices: [],
      eventOrder: { status: "open", sharedAt: null },
      invoices: [],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
    });
    assert.deepEqual(chips.find((c) => c.id === "inventory")?.nav, { kind: "tab", tab: "inventory" });
    assert.deepEqual(chips.find((c) => c.id === "event_order")?.nav, {
      kind: "tab",
      tab: "event-order",
      anchor: "event-order-order",
    });
  });

  it("ignores booking-commitment invoices when picking EO-linked invoice", () => {
    const chips = buildCommercialStatusChips({
      eventInventory: null,
      clientChoices: [],
      eventOrder: { status: "open", sharedAt: null },
      invoices: [
        { id: "book-1", status: "sent", eventOrderId: "eo-1" },
        { id: "eo-inv", status: "draft", eventOrderId: "eo-1" },
      ],
      eventOrderId: "eo-1",
      linkedScheduleId: null,
      bookingCommitmentInvoiceIds: ["book-1"],
      showInventory: false,
    });
    assert.equal(chips.find((c) => c.id === "invoice")?.status, "Draft");
    assert.deepEqual(chips.find((c) => c.id === "invoice")?.nav, {
      kind: "href",
      href: "/invoices/eo-inv",
    });
  });
});

describe("C3 strip seams — no duplicate authoritative actions", () => {
  it("strip component is deep-link only (no Share/Finalize/Send handlers)", () => {
    const src = readFileSync(
      resolve("components/event-orders/event-commercial-status-strip.tsx"),
      "utf8",
    );
    assert.match(src, /data-testid="event-commercial-status-strip"/);
    assert.doesNotMatch(src, /sendClientChoices|shareEventOrder|createInvoice|finalizeEventOrder/);
    assert.match(src, /onNavigate/);
  });

  it("event-order tab id remains event-order with commercial strip and anchors", () => {
    const detail = readFileSync(resolve("components/events/event-detail.tsx"), "utf8");
    assert.match(detail, /TabsContent value="event-order"/);
    assert.match(detail, /TabsTrigger value="event-order"/);
    assert.match(detail, /EventCommercialStatusStrip/);
    assert.match(detail, /id="event-order-choices"/);
    assert.match(detail, /id="event-order-order"/);
    const invoiceLink = readFileSync(
      resolve("components/event-orders/event-order-invoice-link.tsx"),
      "utf8",
    );
    assert.match(invoiceLink, /id="event-order-invoice"/);
  });
});
