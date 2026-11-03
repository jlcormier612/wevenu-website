/**
 * Phase 11A — shared record-name interaction (Pattern 13).
 * Structural seams only; does not change routing or business logic.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

function read(rel: string) {
  return readFileSync(resolve(rel), "utf8");
}

describe("Phase 11A — shared .htc-record-link", () => {
  const css = read("app/globals.css");

  it("defines charcoal record-link with underline hover and inset focus-visible", () => {
    assert.match(css, /\.htc-staff \.htc-record-link \{/);
    const start = css.indexOf(".htc-staff .htc-record-link {");
    const end = css.indexOf(".htc-staff .htc-hospitality-table {", start);
    const block = css.slice(start, end);
    assert.match(block, /color:\s*var\(--foreground\)/);
    assert.match(block, /text-decoration:\s*none/);
    assert.match(block, /\.htc-record-link:hover[\s\S]*text-decoration:\s*underline/);
    assert.match(block, /\.htc-record-link:focus-visible[\s\S]*outline:\s*2px solid/);
    assert.match(block, /outline-offset:\s*-2px/);
    assert.doesNotMatch(block, /hover:text-primary|color:\s*var\(--primary\)/);
  });

  it("defines whole-card record focus treatment for invoice-style cards", () => {
    assert.match(css, /\.htc-staff \.htc-record-card-link/);
    assert.match(css, /\.htc-record-card-link:focus-visible/);
  });

  it("preserves Clients soft-rose attention inset (not full blush wash)", () => {
    const rule = css.slice(
      css.indexOf('tr[data-attention="true"] {'),
      css.indexOf(".htc-staff .htc-hospitality-table [data-slot=\"table-body\"] tr:hover"),
    );
    assert.match(rule, /box-shadow:\s*inset 3px 0 0 0 var\(--htc-soft-rose\)/);
    assert.match(rule, /background:\s*var\(--card\)/);
    assert.doesNotMatch(rule, /background:\s*var\(--htc-soft-blush\)/);
  });
});

describe("Phase 11A — record lists adopt shared link class", () => {
  const clients = read("components/clients/client-list.tsx");
  const leads = read("components/leads/lead-list.tsx");
  const contracts = read("components/contracts/contract-list.tsx");
  const vendors = read("components/vendors/vendor-list.tsx");
  const payments = read("components/payments/payment-schedule-list.tsx");
  const events = read("components/events/event-list.tsx");
  const requests = read("components/requests/request-manager.tsx");
  const documents = read("components/document-workspace/document-card.tsx");
  const messaging = read("components/messaging/message-history-list.tsx");
  const invoices = read("app/(app)/invoices/page.tsx");
  const tours = read("components/tours/tour-list.tsx");

  it("Clients record names use htc-record-link and keep attention + View actions", () => {
    assert.match(clients, /href=\{`\/clients\/\$\{client\.id\}`\} className="htc-record-link"/);
    assert.doesNotMatch(clients, /href=\{`\/clients\/\$\{client\.id\}`\}[^>]*hover:text-primary/);
    assert.match(clients, /data-attention=\{!portalMode && needsAttention \? "true" : undefined\}/);
    assert.match(clients, /View →/);
    assert.match(clients, /PortalActivationRowActions/);
  });

  it("Leads record names use htc-record-link without botanical hover", () => {
    assert.match(leads, /href=\{`\/leads\/\$\{lead\.id\}`\} className="htc-record-link truncate"/);
    assert.doesNotMatch(leads, /href=\{`\/leads\/\$\{lead\.id\}`\}[^>]*hover:text-primary/);
    assert.match(leads, /View →/);
    assert.doesNotMatch(leads, /onClick=\{[^}]*router\.push\(`\/leads/);
  });

  it("Contracts desktop and mobile titles use htc-record-link and preserve returnTo", () => {
    assert.match(contracts, /htc-record-link block text-sm font-medium/);
    assert.match(contracts, /htc-record-link/);
    assert.match(contracts, /returnTo=\$\{encodeURIComponent\("\/contracts"\)\}/);
    assert.doesNotMatch(contracts, /hover:text-primary/);
  });

  it("Vendors, Payments, and Events record names use htc-record-link", () => {
    assert.match(vendors, /href=\{`\/vendors\/\$\{vendor\.id\}`\} className="htc-record-link"/);
    assert.match(payments, /href=\{`\/payments\/\$\{s\.id\}`\} className="htc-record-link"/);
    assert.match(events, /href=\{`\/events\/\$\{ev\.id\}`\} className="htc-record-link"/);
    assert.doesNotMatch(vendors, /hover:text-primary/);
    assert.doesNotMatch(payments, /hover:text-primary/);
    assert.doesNotMatch(events, /hover:text-primary/);
  });

  it("EventList preserves dual navigation and no whole-row click (legacy unreachable list)", () => {
    const eventsPage = read("app/(app)/events/page.tsx");
    assert.match(eventsPage, /redirect\("\/clients"\)/);
    assert.match(eventsPage, /standalone Events list is retired/);
    assert.match(events, /export function EventList/);
    assert.match(events, /href=\{`\/events\/\$\{ev\.id\}`\} className="htc-record-link"/);
    assert.match(events, /render=\{<Link href=\{`\/events\/\$\{ev\.id\}`\} \/>\}/);
    assert.match(events, /View →/);
    assert.doesNotMatch(events, /<TableRow[^>]*onClick=/);
    assert.doesNotMatch(events, /hover:text-primary/);
    assert.doesNotMatch(events, /router\.push/);
  });

  it("Requests title link drops permanent underline and keeps in-row selects", () => {
    assert.match(requests, /href=\{`\/requests\/\$\{r\.id\}`\} className="htc-record-link font-medium"/);
    assert.doesNotMatch(requests, /className="font-medium underline"/);
    assert.match(requests, /handleStatusChange/);
    assert.match(requests, /handleAssign/);
    assert.doesNotMatch(requests, /<tr[^>]*onClick=/);
    assert.doesNotMatch(requests, /<tr[^>]*href=/);
  });

  it("Documents title uses htc-record-link and preserves Phase 10 mobile actions", () => {
    assert.match(documents, /htc-record-link/);
    assert.match(documents, /data-testid="workspace-doc-title"/);
    assert.match(documents, /data-htc-doc-actions="mobile"/);
    assert.match(documents, /data-htc-doc-actions="desktop"/);
    assert.doesNotMatch(documents, /hover:text-primary/);
  });

  it("Messaging name wrappers and invoice cards use shared treatments", () => {
    assert.match(messaging, /className="htc-record-link flex min-w-0 flex-1"/);
    assert.doesNotMatch(messaging, /hover:text-primary/);
    assert.match(invoices, /htc-record-card-link/);
    assert.match(invoices, /returnTo=\$\{encodeURIComponent\("\/invoices"\)\}/);
  });

  it("Tours keep action-dense non-clickable rows (name is not a record link)", () => {
    assert.match(tours, /data-tours-name="/);
    assert.match(tours, /htc-tours-lead-link/);
    assert.match(tours, /href=\{`\/leads\/\$\{appt\.leadId\}`\}/);
    assert.doesNotMatch(tours, /data-tours-name="[^"]*"[^>]*>[\s\S]{0,40}htc-record-link/);
    assert.doesNotMatch(tours, /htc-tours-row"[^>]*onClick=/);
  });
});
