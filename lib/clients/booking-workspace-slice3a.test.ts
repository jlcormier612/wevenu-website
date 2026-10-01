/**
 * Performance Slice 3A — Client Workspace wiring regression.
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

describe("Slice 3A — Client Workspace contract scoping wiring", () => {
  const booked = bookedBranch(page);

  it("loads contracts via client|event scoped API (not venue-wide getContracts)", () => {
    assert.match(booked, /getContractsForClientOrEvent\(id, eventId\)/);
    assert.doesNotMatch(booked, /getContracts\(\)/);
  });

  it("loads contract templates via metadata helper (no full content list)", () => {
    assert.match(page, /getTemplatesMetadata as getContractTemplates/);
    assert.match(booked, /getContractTemplates\(\)/);
  });

  it("still passes contracts into readiness and EventDetail", () => {
    assert.match(booked, /contracts, invoices: eventInvoices/);
    assert.match(page, /contracts=\{contracts\}/);
    assert.match(page, /contractTemplates=\{contractTemplates\}/);
  });

  it("keeps Luv observation contractIds derived from scoped list", () => {
    assert.match(booked, /contractIds: contracts\.map\(\(c\) => c\.id\)/);
    assert.match(booked, /Promise\.all\(\[venuePromise, contractsPromise\]\)/);
  });
});
