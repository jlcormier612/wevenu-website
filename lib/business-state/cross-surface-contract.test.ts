/**
 * Cross-surface business-state contract.
 *
 * One lifecycle rule must drive Leads, Lead Flow, and Inbox classification.
 * client_id alone must never move an open opportunity into Clients.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  computeOpenLeadFlow,
  LEAD_FLOW_OPEN_HREF,
} from "@/lib/dashboard/business-snapshot";
import {
  inboxCategoryFromLifecycle,
  isOpenLeadLifecycle,
} from "@/lib/leads/open-lifecycle";
import { inboxCategoryFromConversation } from "@/lib/navigation/attention";
import { computePaymentsReadiness } from "@/lib/readiness/compute";
import type { Invoice } from "@/lib/invoices/types";
import { deriveScheduleStatus } from "@/lib/payments/constants";
import type { PaymentLineItem } from "@/lib/payments/types";
import { isPaymentAttentionSchedule } from "@/lib/navigation/attention";

function inv(partial: Partial<Invoice>): Invoice {
  return {
    id: "i",
    venueId: "v",
    clientId: "c",
    eventId: "e",
    invoiceNumber: "INV",
    status: "sent",
    subtotal: 100,
    discountAmount: 0,
    taxAmount: 0,
    total: 100,
    balanceDue: 100,
    notes: null,
    dueDate: "2020-01-01",
    issuedAt: null,
    createdAt: "",
    updatedAt: "",
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

function line(partial: Partial<PaymentLineItem>): PaymentLineItem {
  return {
    id: "pli",
    venueId: "v",
    scheduleId: "s",
    label: "Deposit",
    amount: 100,
    dueDate: "2026-01-01",
    status: "pending",
    obligationKind: "deposit",
    paidAt: null,
    paidAmount: null,
    paymentMethod: null,
    referenceNumber: null,
    notes: null,
    sortOrder: 0,
    refundedAmount: 0,
    refundedAt: null,
    refundReason: null,
    quickbooksSyncStatus: "not_synced",
    stripePaymentIntentId: null,
    stripeCheckoutSessionId: null,
    stripePaymentMethodType: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("Cross-surface open-lead contract", () => {
  it("RECORD A: open lead, no client → Leads + Lead Flow", () => {
    assert.equal(isOpenLeadLifecycle("tour_scheduled"), true);
    assert.equal(
      inboxCategoryFromLifecycle({ hasLead: true, leadSalesStage: "tour_scheduled", hasClient: false }),
      "leads",
    );
    const flow = computeOpenLeadFlow(
      [{ sales_stage: "tour_scheduled", estimated_budget: 5000, created_at: "2026-09-01T00:00:00Z" }],
      "2026-09-01",
    );
    assert.equal(flow.count, 1);
  });

  it("RECORD B: open lead + commercial-only client → still Leads (Cindy rule)", () => {
    assert.equal(
      inboxCategoryFromConversation({
        leadId: "lead",
        clientId: "client",
        leadSalesStage: "new_inquiry",
      }),
      "leads",
    );
    assert.equal(
      inboxCategoryFromLifecycle({
        hasLead: true,
        leadSalesStage: "proposal_sent",
        hasClient: true,
      }),
      "leads",
    );
  });

  it("RECORD C: booked client → Clients, not Lead Flow", () => {
    assert.equal(isOpenLeadLifecycle("booked"), false);
    assert.equal(
      inboxCategoryFromLifecycle({ hasLead: true, leadSalesStage: "booked", hasClient: true }),
      "clients",
    );
    const flow = computeOpenLeadFlow(
      [{ sales_stage: "booked", estimated_budget: 12000, created_at: "2026-08-01T00:00:00Z" }],
      "2026-09-01",
    );
    assert.equal(flow.count, 0);
  });

  it("RECORD D: lost lead → not open; client-only row still Clients", () => {
    assert.equal(isOpenLeadLifecycle("lost"), false);
    assert.equal(
      inboxCategoryFromLifecycle({ hasLead: true, leadSalesStage: "lost", hasClient: false }),
      "leads",
    );
    assert.equal(
      inboxCategoryFromLifecycle({ hasLead: true, leadSalesStage: "lost", hasClient: true }),
      "clients",
    );
  });

  it("client_id alone does not determine Inbox category", () => {
    assert.notEqual(
      inboxCategoryFromConversation({
        leadId: "x",
        clientId: "y",
        leadSalesStage: "enrolled_in_sequence",
      }),
      "clients",
    );
  });

  it("Lead Flow click-through preserves open population filter", () => {
    assert.equal(LEAD_FLOW_OPEN_HREF, "/leads?attention=open");
    const page = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    assert.match(page, /attention === "open"/);
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.match(list, /isOpenLeadLifecycle/);
    assert.match(list, /attentionFilter === "open"/);
  });

  it("Dashboard Lead Flow and open-lifecycle share one terminal set", () => {
    const snap = readFileSync(resolve("lib/dashboard/business-snapshot.ts"), "utf8");
    assert.match(snap, /from "@\/lib\/leads\/open-lifecycle"/);
    const attn = readFileSync(resolve("lib/navigation/attention.ts"), "utf8");
    assert.match(attn, /from "@\/lib\/leads\/open-lifecycle"/);
  });
});

describe("Cross-surface payment attention contract", () => {
  it("RECORD F/G: draft and void invoices do not create overdue attention", () => {
    assert.notEqual(
      computePaymentsReadiness([inv({ status: "draft", balanceDue: 2400 })], []).status,
      "needs_attention",
    );
    assert.notEqual(
      computePaymentsReadiness([inv({ status: "void", balanceDue: 3200 })]).status,
      "needs_attention",
    );
  });

  it("RECORD H: overdue schedule line creates attention; Payments badge agrees", () => {
    const overdue = [line({ status: "overdue", dueDate: "2026-01-01" })];
    assert.equal(computePaymentsReadiness([inv({})], overdue).status, "needs_attention");
    assert.equal(deriveScheduleStatus(overdue), "attention");
    assert.equal(
      isPaymentAttentionSchedule({ excludeFromBusinessReporting: false, lineItems: overdue }),
      true,
    );
  });
});

describe("Cross-surface task / calendar wiring (source contract)", () => {
  it("lead tasks live in Task Center paths, not Calendar event sources", () => {
    const calendar = readFileSync(resolve("lib/calendar/service.ts"), "utf8");
    assert.doesNotMatch(calendar, /from\("lead_tasks"\)/);
    const tasksPage = readFileSync(resolve("app/(app)/tasks/page.tsx"), "utf8");
    assert.match(tasksPage, /lead_tasks|LeadTask|getLeadTasks|lead tasks/i);
  });
});
