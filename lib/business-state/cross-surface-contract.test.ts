/**
 * Inbox ownership contract — conversation owner/source, not open-lead / sales_stage.
 *
 * Dashboard Lead Flow remains a separate open-lifecycle calculation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  computeOpenLeadFlow,
  LEAD_FLOW_OPEN_HREF,
} from "@/lib/dashboard/business-snapshot";
import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";
import {
  inboxCategoryFromConversation,
  inboxCategoryFromOwnership,
} from "@/lib/conversations/inbox-ownership";
import { inboxCategoryFromConversation as attnInbox } from "@/lib/navigation/attention";
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

describe("Inbox ownership classification (A–F)", () => {
  it("A: Lead conversation + open lead → Leads", () => {
    assert.equal(
      inboxCategoryFromOwnership({
        inboxOwnerKind: "lead",
        hasLead: true,
        hasClient: false,
      }),
      "leads",
    );
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "lead",
        leadId: "l1",
      }),
      "leads",
    );
  });

  it("B: Lead conversation + Booked lead → Leads (stage irrelevant)", () => {
    assert.equal(
      inboxCategoryFromOwnership({
        inboxOwnerKind: "lead",
        hasLead: true,
        hasClient: true,
      }),
      "leads",
    );
    // sales_stage must not flip a lead-owned conversation into Clients
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "lead",
        leadId: "l1",
        clientId: "c1",
      }),
      "leads",
    );
  });

  it("C: Lead conversation + Lost lead → Leads", () => {
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "lead",
        leadId: "l1",
      }),
      "leads",
    );
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "lead",
        leadId: "l1",
        clientId: "c1",
      }),
      "leads",
    );
  });

  it("D: Client conversation + client → Clients", () => {
    assert.equal(
      inboxCategoryFromOwnership({
        inboxOwnerKind: "client",
        hasClient: true,
        hasLead: false,
      }),
      "clients",
    );
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "client",
        clientId: "c1",
      }),
      "clients",
    );
  });

  it("E: Dual lead+client, conversation belongs to lead → Leads (Cindy)", () => {
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "lead",
        leadId: "cindy-lead",
        clientId: "cindy-client",
      }),
      "leads",
    );
    assert.equal(
      attnInbox({
        inboxOwnerKind: "lead",
        leadId: "cindy-lead",
        clientId: "cindy-client",
      }),
      "leads",
    );
  });

  it("F: Dual lead+client, conversation belongs to client → Clients (Ellie)", () => {
    assert.equal(
      inboxCategoryFromConversation({
        inboxOwnerKind: "client",
        leadId: "ellie-lead",
        clientId: "ellie-client",
      }),
      "clients",
    );
  });

  it("does not use open-lead / sales_stage as the Inbox criterion", () => {
    const own = readFileSync(resolve("lib/conversations/inbox-ownership.ts"), "utf8");
    assert.doesNotMatch(own, /isOpenLeadLifecycle|TERMINAL_LEAD|leadSalesStage/);
    const open = readFileSync(resolve("lib/leads/open-lifecycle.ts"), "utf8");
    assert.doesNotMatch(open, /inboxCategoryFromLifecycle/);
    assert.match(open, /Dashboard Lead Flow/);
  });
});

describe("Dashboard Lead Flow remains separate", () => {
  it("open-lead metric unchanged and unused by Inbox ownership", () => {
    assert.equal(isOpenLeadLifecycle("tour_scheduled"), true);
    assert.equal(isOpenLeadLifecycle("booked"), false);
    const flow = computeOpenLeadFlow(
      [
        { sales_stage: "new_inquiry", estimated_budget: 5000, created_at: "2026-09-01T00:00:00Z" },
        { sales_stage: "booked", estimated_budget: 12000, created_at: "2026-08-01T00:00:00Z" },
      ],
      "2026-09-01",
    );
    assert.equal(flow.count, 1);
    assert.equal(LEAD_FLOW_OPEN_HREF, "/leads?attention=open");
  });

  it("Lead Flow click-through still uses open population", () => {
    const page = readFileSync(resolve("app/(app)/leads/page.tsx"), "utf8");
    assert.match(page, /attention === "open"/);
    const list = readFileSync(resolve("components/leads/lead-list.tsx"), "utf8");
    assert.match(list, /isOpenLeadLifecycle/);
  });

  it("ownership migration filters by inbox_owner_kind, not open sales_stage", () => {
    const mig = readFileSync(
      resolve("supabase/migrations/20261400700000_inbox_conversation_ownership.sql"),
      "utf8",
    );
    assert.match(mig, /inbox_owner_kind/);
    assert.match(mig, /coalesce\(e\.inbox_owner_kind, 'lead'\) = 'lead'/);
    assert.match(mig, /e\.inbox_owner_kind = 'client'/);
    assert.doesNotMatch(mig, /not in \('booked', 'lost', 'won', 'cancelled'\)/);
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
    const tasks = readFileSync(resolve("app/(app)/tasks/page.tsx"), "utf8");
    assert.match(tasks, /lead/i);
  });
});
