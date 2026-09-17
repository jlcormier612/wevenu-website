import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  badgeCountForNavItem,
  countPastDueStaffTasks,
  countPaymentAttention,
  countUnseenLeads,
  countUnseenTours,
  formatAttentionBadge,
  inboxCategoryFromConversation,
  inboxRelationshipParam,
  isPastDueStaffTask,
  isPaymentAttentionSchedule,
  isUnseenLeadAttention,
  isUnseenTourAttention,
  NAV_ATTENTION_BADGE_CLASS,
} from "@/lib/navigation/attention";
import type { PaymentLineItem } from "@/lib/payments/types";

const TODAY = "2026-09-17";
const STAFF = "staff-1";

function line(status: PaymentLineItem["status"]): PaymentLineItem {
  return {
    id: "li",
    venueId: "v",
    scheduleId: "s",
    label: "Deposit",
    amount: 100,
    dueDate: "2026-09-01",
    status,
    obligationKind: null,
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
    createdAt: TODAY,
    updatedAt: TODAY,
  };
}

describe("Leads attention badge", () => {
  it("counts new/unseen leads", () => {
    assert.equal(
      isUnseenLeadAttention({ venueSeenAt: null, salesStage: "new_inquiry" }),
      true,
    );
  });

  it("excludes seen/acknowledged leads", () => {
    assert.equal(
      isUnseenLeadAttention({ venueSeenAt: "2026-09-16T12:00:00Z", salesStage: "new_inquiry" }),
      false,
    );
  });

  it("excludes booked/lost/closed leads", () => {
    assert.equal(isUnseenLeadAttention({ venueSeenAt: null, salesStage: "booked" }), false);
    assert.equal(isUnseenLeadAttention({ venueSeenAt: null, salesStage: "lost" }), false);
    assert.equal(isUnseenLeadAttention({ venueSeenAt: null, salesStage: "won" }), false);
    assert.equal(isUnseenLeadAttention({ venueSeenAt: null, salesStage: "cancelled" }), false);
  });

  it("excludes ordinary open leads that are already seen", () => {
    assert.equal(
      countUnseenLeads([
        { venueSeenAt: "2026-09-10T00:00:00Z", salesStage: "outreach_sent" },
        { venueSeenAt: "2026-09-11T00:00:00Z", salesStage: "tour_scheduled" },
        { venueSeenAt: null, salesStage: "new_inquiry" },
      ]),
      1,
    );
  });
});

describe("Tours attention badge", () => {
  it("counts new/unseen tour activity", () => {
    assert.equal(
      isUnseenTourAttention({ venueSeenAt: null, status: "scheduled" }),
      true,
    );
  });

  it("excludes ordinary upcoming tours that are already seen", () => {
    assert.equal(
      isUnseenTourAttention({ venueSeenAt: "2026-09-16T00:00:00Z", status: "scheduled" }),
      false,
    );
  });

  it("excludes cancelled/completed and includes unresolved protection", () => {
    assert.equal(isUnseenTourAttention({ venueSeenAt: null, status: "cancelled" }), false);
    assert.equal(isUnseenTourAttention({ venueSeenAt: null, status: "completed" }), false);
    assert.equal(
      countUnseenTours(
        [
          { venueSeenAt: null, status: "scheduled" },
          { venueSeenAt: "2026-09-01T00:00:00Z", status: "confirmed" },
        ],
        2,
      ),
      3,
    );
  });
});

describe("Task Center attention badge — past due only", () => {
  it("counts overdue incomplete tasks for the staff member", () => {
    assert.equal(
      isPastDueStaffTask(
        { status: "pending", dueDate: "2026-09-10", assignedToStaffId: STAFF },
        STAFF,
        TODAY,
      ),
      true,
    );
  });

  it("excludes overdue completed tasks", () => {
    assert.equal(
      isPastDueStaffTask(
        { status: "complete", dueDate: "2026-09-10", assignedToStaffId: STAFF },
        STAFF,
        TODAY,
      ),
      false,
    );
    assert.equal(
      isPastDueStaffTask(
        { status: "pending", dueDate: "2026-09-10", assignedToStaffId: STAFF, completed: true },
        STAFF,
        TODAY,
      ),
      false,
    );
  });

  it("excludes future incomplete tasks", () => {
    assert.equal(
      isPastDueStaffTask(
        { status: "pending", dueDate: "2026-09-20", assignedToStaffId: STAFF },
        STAFF,
        TODAY,
      ),
      false,
    );
  });

  it("excludes undated incomplete tasks", () => {
    assert.equal(
      isPastDueStaffTask(
        { status: "pending", dueDate: null, assignedToStaffId: STAFF },
        STAFF,
        TODAY,
      ),
      false,
    );
  });

  it("many incomplete future tasks do not inflate the badge", () => {
    const rows = Array.from({ length: 500 }, (_, i) => ({
      status: "pending",
      dueDate: "2026-12-01",
      assignedToStaffId: STAFF,
    }));
    rows.push(
      { status: "pending", dueDate: "2026-09-01", assignedToStaffId: STAFF },
      { status: "pending", dueDate: "2026-09-02", assignedToStaffId: STAFF },
      { status: "pending", dueDate: "2026-09-03", assignedToStaffId: STAFF },
      { status: "pending", dueDate: "2026-09-04", assignedToStaffId: STAFF },
    );
    assert.equal(countPastDueStaffTasks(rows, STAFF, TODAY), 4);
  });

  it("respects staff-specific ownership", () => {
    assert.equal(
      countPastDueStaffTasks(
        [
          { status: "pending", dueDate: "2026-09-01", assignedToStaffId: STAFF },
          { status: "pending", dueDate: "2026-09-01", assignedToStaffId: "other" },
          { status: "pending", dueDate: "2026-09-01", assignedToStaffId: null },
        ],
        STAFF,
        TODAY,
      ),
      1,
    );
    assert.equal(
      countPastDueStaffTasks(
        [{ status: "pending", dueDate: "2026-09-01", assignedToStaffId: STAFF }],
        null,
        TODAY,
      ),
      0,
    );
  });
});

describe("Payments attention badge", () => {
  it("counts outstanding/payment-attention schedules", () => {
    assert.equal(
      isPaymentAttentionSchedule({ lineItems: [line("overdue")] }),
      true,
    );
  });

  it("excludes current/paid accounts", () => {
    assert.equal(
      isPaymentAttentionSchedule({ lineItems: [line("paid")] }),
      false,
    );
    assert.equal(
      isPaymentAttentionSchedule({ lineItems: [line("pending")] }),
      false,
    );
  });

  it("uses canonical deriveScheduleStatus attention semantics", () => {
    assert.equal(
      countPaymentAttention([
        { lineItems: [line("overdue")] },
        { lineItems: [line("refunded")] },
        { lineItems: [line("paid")], excludeFromBusinessReporting: true },
        { lineItems: [line("paid")] },
      ]),
      2,
    );
  });
});

describe("Badge presentation", () => {
  it("hides badge when count is zero", () => {
    assert.equal(formatAttentionBadge(0), null);
    assert.equal(badgeCountForNavItem("inbox", {
      leads: 0, tours: 0, inbox: 0, tasks: 0, payments: 0,
    }), 0);
  });

  it("applies pink destructive treatment in sidebar", () => {
    const nav = readFileSync(resolve("components/shell/sidebar-nav.tsx"), "utf8");
    assert.match(nav, /NAV_ATTENTION_BADGE_CLASS/);
    assert.match(nav, /\/api\/navigation\/attention/);
    assert.doesNotMatch(nav, /bg-primary px-1 text-\[10px\]/);
    assert.match(NAV_ATTENTION_BADGE_CLASS, /bg-destructive/);
  });
});

describe("Inbox category organization", () => {
  it("maps conversation anchors to Leads / Clients / Vendors by lifecycle", () => {
    assert.equal(inboxCategoryFromConversation({ leadId: "l1", clientId: null }), "leads");
    // Open lead + commercial-only client stays Leads
    assert.equal(
      inboxCategoryFromConversation({
        leadId: "l1",
        clientId: "c1",
        leadSalesStage: "new_inquiry",
      }),
      "leads",
    );
    assert.equal(
      inboxCategoryFromConversation({
        leadId: "l1",
        clientId: "c1",
        leadSalesStage: "proposal_sent",
      }),
      "leads",
    );
    // Booked → Clients
    assert.equal(
      inboxCategoryFromConversation({
        leadId: "l1",
        clientId: "c1",
        leadSalesStage: "booked",
      }),
      "clients",
    );
    // Client alone → Clients
    assert.equal(inboxCategoryFromConversation({ leadId: null, clientId: "c1" }), "clients");
    assert.equal(
      inboxCategoryFromConversation({ conversationKind: "venue_vendor" }),
      "vendors",
    );
  });

  it("client_id alone does not determine Inbox category when lead is open", () => {
    assert.notEqual(
      inboxCategoryFromConversation({
        leadId: "l1",
        clientId: "c1",
        leadSalesStage: "tour_scheduled",
      }),
      "clients",
    );
  });

  it("maps Clients UI category to bookings RPC param without mixing kinds", () => {
    assert.equal(inboxRelationshipParam("leads"), "leads");
    assert.equal(inboxRelationshipParam("clients"), "bookings");
    assert.equal(inboxRelationshipParam("vendors"), "vendors");
  });

  it("Inbox exposes Leads / Clients / Vendors category control", () => {
    const inbox = readFileSync(resolve("app/(app)/messaging/conversation-inbox.tsx"), "utf8");
    assert.match(inbox, /Leads/);
    assert.match(inbox, /Clients/);
    assert.match(inbox, /Vendors/);
    assert.match(inbox, /INBOX_CATEGORY_OPTIONS|inboxCategory/);
  });

  it("inbox RPC migration classifies by open sales_stage not client_id null", () => {
    const mig = readFileSync(
      resolve("supabase/migrations/20261400600000_inbox_open_lead_lifecycle_filter.sql"),
      "utf8",
    );
    assert.match(mig, /not in \('booked', 'lost', 'won', 'cancelled'\)/);
    assert.doesNotMatch(
      mig,
      /p_relationship in \('leads', 'lead'\) and e\.client_id is null and e\.lead_id is not null/,
    );
  });
});
