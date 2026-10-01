import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  appendInvoiceReturnTo,
  resolveInvoiceBackNavigation,
  safeInvoiceReturnPath,
} from "@/lib/invoices/return-path";

const LEAD = "/leads/54fb2e7d-d429-4701-afe1-ea4a39cb03b4";
const CLIENT = "/clients/bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";

describe("safeInvoiceReturnPath", () => {
  it("allows lead, client, invoices, and documents origins", () => {
    assert.equal(safeInvoiceReturnPath(LEAD), LEAD);
    assert.equal(safeInvoiceReturnPath(CLIENT), CLIENT);
    assert.equal(safeInvoiceReturnPath("/invoices"), "/invoices");
    assert.equal(safeInvoiceReturnPath("/documents"), "/documents");
  });

  it("rejects open redirects and payment-module paths (those stay schedule handoff)", () => {
    assert.equal(safeInvoiceReturnPath("https://evil.example/invoices"), null);
    assert.equal(safeInvoiceReturnPath("/payments/abc"), null);
    assert.equal(safeInvoiceReturnPath("/settings"), null);
    assert.equal(safeInvoiceReturnPath(null), null);
  });
});

describe("resolveInvoiceBackNavigation", () => {
  it("Lead Documents origin returns to the lead overview", () => {
    const nav = resolveInvoiceBackNavigation({
      returnTo: LEAD,
      clientName: "Lucy Peanut & Charlie Brown",
    });
    assert.equal(nav.href, LEAD);
    assert.equal(nav.label, "Lucy Peanut & Charlie Brown");
  });

  it("Client Workspace origin returns to Client Workspace", () => {
    const nav = resolveInvoiceBackNavigation({
      returnTo: CLIENT,
      clientName: "Lucy Peanut & Charlie Brown",
    });
    assert.equal(nav.href, CLIENT);
    assert.equal(nav.label, "Lucy Peanut & Charlie Brown");
  });

  it("Global Invoices origin returns to Invoices", () => {
    const nav = resolveInvoiceBackNavigation({
      returnTo: "/invoices",
      clientName: "Someone",
    });
    assert.equal(nav.href, "/invoices");
    assert.equal(nav.label, "Invoices");
  });

  it("direct/no-origin invoice falls back to Invoices", () => {
    assert.deepEqual(
      resolveInvoiceBackNavigation({ clientName: "Couple" }),
      { href: "/invoices", label: "Invoices" },
    );
  });

  it("ignores unsafe returnTo and falls back to Invoices", () => {
    const nav = resolveInvoiceBackNavigation({
      returnTo: "https://evil.example",
      clientName: "A",
    });
    assert.equal(nav.href, "/invoices");
    assert.equal(nav.label, "Invoices");
  });
});

describe("invoice detail and Documents wiring", () => {
  it("Invoice Detail uses originating back nav and does not hard-code Invoices", () => {
    const detail = readFileSync("components/invoices/invoice-detail.tsx", "utf8");
    assert.match(detail, /resolveInvoiceBackNavigation/);
    assert.match(detail, /backHref=\{backNav\.href\}/);
    assert.match(detail, /backLabel=\{backNav\.label\}/);
    assert.doesNotMatch(detail, /backHref="\/invoices"/);
    assert.doesNotMatch(detail, /Open in Payments/);
  });

  it("Documents workspace appends invoice returnTo alongside contracts", () => {
    const workspace = readFileSync("components/document-workspace/document-workspace.tsx", "utf8");
    assert.match(workspace, /appendInvoiceReturnTo/);
    assert.match(workspace, /appendContractReturnTo/);
  });
});

describe("appendInvoiceReturnTo", () => {
  it("appends only to invoice producer hrefs", () => {
    assert.equal(
      appendInvoiceReturnTo("/invoices/i1", LEAD),
      `/invoices/i1?returnTo=${encodeURIComponent(LEAD)}`,
    );
    assert.equal(appendInvoiceReturnTo("/contracts/c1", LEAD), "/contracts/c1");
    assert.equal(appendInvoiceReturnTo("/invoices/i1", "https://evil"), "/invoices/i1");
  });
});
