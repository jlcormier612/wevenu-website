import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  appendInvoiceReturnTo,
  invoiceRelationshipReturnPath,
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
    assert.equal(
      safeInvoiceReturnPath(`${LEAD}#booking-journey-payments`),
      `${LEAD}#booking-journey-payments`,
    );
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

  it("unbooked Lead fallback returns to the Lead payment section, not Invoices or Client", () => {
    const nav = resolveInvoiceBackNavigation({
      clientName: "Miss Piggy",
      leadId: "20e470d8-ab91-4db1-bbae-d75dad943b69",
      clientId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      relationshipBooked: false,
    });
    assert.equal(nav.href, "/leads/20e470d8-ab91-4db1-bbae-d75dad943b69#booking-journey-payments");
    assert.equal(nav.label, "Miss Piggy");
    assert.doesNotMatch(nav.href, /\/clients\//);
    assert.notEqual(nav.href, "/invoices");
  });

  it("booked Client fallback returns to the Client workspace", () => {
    const nav = resolveInvoiceBackNavigation({
      clientName: "Ivy Quinn",
      leadId: "20e470d8-ab91-4db1-bbae-d75dad943b69",
      clientId: "3c9ecc54-fe49-432a-b49e-9d68dee33575",
      relationshipBooked: true,
    });
    assert.equal(nav.href, "/clients/3c9ecc54-fe49-432a-b49e-9d68dee33575");
    assert.equal(nav.label, "Ivy Quinn");
  });

  it("explicit Invoices returnTo wins over relationship fallback", () => {
    const nav = resolveInvoiceBackNavigation({
      returnTo: "/invoices",
      leadId: "20e470d8-ab91-4db1-bbae-d75dad943b69",
      clientId: "3c9ecc54-fe49-432a-b49e-9d68dee33575",
      relationshipBooked: false,
    });
    assert.equal(nav.href, "/invoices");
    assert.equal(nav.label, "Invoices");
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

  it("Lead payment setup and Open invoice carry returnTo", () => {
    const sheet = readFileSync("components/booking-journey/setup-payments-sheet.tsx", "utf8");
    const facts = readFileSync("components/booking-journey/commercial-facts.tsx", "utf8");
    const panel = readFileSync("components/booking-journey/booking-journey-panel.tsx", "utf8");
    const lead = readFileSync("components/leads/lead-detail.tsx", "utf8");
    const page = readFileSync("app/(app)/invoices/[id]/page.tsx", "utf8");
    assert.match(sheet, /appendInvoiceReturnTo\(`\/invoices\/\$\{result\.invoiceId\}`, returnTo\)/);
    assert.match(facts, /appendInvoiceReturnTo\(`\/invoices\/\$\{selection\.invoiceId\}`, invoiceReturnTo\)/);
    assert.match(panel, /workspaceReturnTo/);
    assert.match(lead, /workspaceReturnTo=\{`\/leads\/\$\{lead\.id\}#booking-journey-payments`\}/);
    assert.match(page, /relationshipBooked/);
    assert.match(page, /leadId=\{leadId\}/);
  });
});

describe("invoiceRelationshipReturnPath", () => {
  it("keeps unbooked invoices on the Lead workspace", () => {
    assert.equal(
      invoiceRelationshipReturnPath({
        leadId: "20e470d8-ab91-4db1-bbae-d75dad943b69",
        clientId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        relationshipBooked: false,
      }),
      "/leads/20e470d8-ab91-4db1-bbae-d75dad943b69#booking-journey-payments",
    );
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
