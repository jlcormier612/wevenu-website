/**
 * Performance Slice 3B — Client Workspace invoice wiring regression.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const page = readFileSync(resolve("app/(app)/clients/[id]/page.tsx"), "utf8");

function bookedBranch(src: string): string {
  const start = src.indexOf("const eventId = client.linkedEventId;");
  assert.ok(start > 0, "booked branch start");
  const end = src.indexOf("return (", start);
  assert.ok(end > start, "booked branch return");
  return src.slice(start, end);
}

describe("Slice 3B — Client Workspace invoice scoping wiring", () => {
  const booked = bookedBranch(page);

  it("loads invoices via client|event scoped API (not venue-wide getInvoices)", () => {
    assert.match(booked, /getInvoicesForClientOrEvent\(id, eventId\)/);
    assert.doesNotMatch(booked, /getInvoices\(\{\}\)/);
  });

  it("pipelines markers off scoped eventInvoicesPromise", () => {
    assert.match(booked, /eventInvoicesPromise\.then/);
    assert.match(booked, /getInvoiceLineMarkers\(eventInvoices\.map\(\(inv\) => inv\.id\)\)/);
  });

  it("still feeds invoices into readiness, EO linkage, and EventDetail", () => {
    assert.match(booked, /invoices: eventInvoices/);
    assert.match(booked, /packageBookingCommitmentInvoiceIds\(invoiceLineMarkers\)/);
    assert.match(booked, /frozenEventOrderLineIds\(/);
    assert.match(booked, /inv\.eventOrderId === eventOrder\.id/);
    assert.match(page, /invoices=\{eventInvoices\}/);
  });
});
