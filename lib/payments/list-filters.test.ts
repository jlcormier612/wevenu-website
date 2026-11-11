import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_PAYMENT_LIST_FILTER,
  PAYMENT_LIST_FILTERS,
  isPartiallyPaidSchedule,
  isVenueActionRequiredSchedule,
  parsePaymentListFilter,
  paymentMatchesListFilter,
  paymentMatchesListSearch,
  paymentScheduleFilterKey,
} from "@/lib/payments/list-filters";
import type { PaymentScheduleSummary } from "@/lib/payments/types";

function schedule(
  overrides: Partial<PaymentScheduleSummary> = {},
): PaymentScheduleSummary {
  return {
    id: "s1",
    venueId: "v1",
    clientId: "c1",
    eventId: null,
    invoiceId: "i1",
    title: "Essential Wedding payments",
    totalAmount: 32000,
    currency: "USD",
    notes: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    clientName: "Minnie Mouse & Mickey Mouse",
    eventDate: "2027-10-01",
    bookedAt: null,
    acknowledgedInvoiceTotal: null,
    totalPaid: 0,
    balance: 32000,
    overdueCount: 0,
    refundedCount: 0,
    partiallyRefundedCount: 0,
    pendingCount: 4,
    scheduleStatus: "on_track",
    ...overrides,
  };
}

describe("payment list filters", () => {
  it("J/K — All is first; Action Required is second; default is All", () => {
    assert.equal(PAYMENT_LIST_FILTERS[0]?.value, "all");
    assert.equal(PAYMENT_LIST_FILTERS[0]?.label, "All");
    assert.equal(PAYMENT_LIST_FILTERS[1]?.value, "action_required");
    assert.equal(DEFAULT_PAYMENT_LIST_FILTER, "all");
    assert.equal(parsePaymentListFilter(undefined), "all");
    assert.equal(parsePaymentListFilter("attention"), "action_required");
  });

  it("J — All matches every schedule including paid and ordinary", () => {
    const rows = [
      schedule({ scheduleStatus: "complete", totalPaid: 32000, balance: 0 }),
      schedule({ scheduleStatus: "on_track" }),
      schedule({ scheduleStatus: "attention", overdueCount: 1 }),
      schedule({ scheduleStatus: "no_payments", pendingCount: 0, balance: 0, totalAmount: 0 }),
    ];
    assert.equal(rows.filter((s) => paymentMatchesListFilter(s, "all")).length, 4);
  });

  it("L — Action Required shows only attention schedules (not reporting-excluded)", () => {
    const overdue = schedule({ scheduleStatus: "attention", overdueCount: 1 });
    const excluded = schedule({
      id: "ex",
      scheduleStatus: "attention",
      overdueCount: 1,
      excludeFromBusinessReporting: true,
    });
    const onTrack = schedule({ scheduleStatus: "on_track" });
    assert.equal(isVenueActionRequiredSchedule(overdue), true);
    assert.equal(isVenueActionRequiredSchedule(excluded), false);
    assert.equal(paymentMatchesListFilter(overdue, "action_required"), true);
    assert.equal(paymentMatchesListFilter(excluded, "action_required"), false);
    assert.equal(paymentMatchesListFilter(onTrack, "action_required"), false);
  });

  it("M — lifecycle filters use authoritative scheduleStatus + paid/balance", () => {
    const unpaid = schedule({ scheduleStatus: "on_track", totalPaid: 0, balance: 32000 });
    const partial = schedule({
      scheduleStatus: "on_track",
      totalPaid: 8000,
      balance: 24000,
    });
    const paid = schedule({
      scheduleStatus: "complete",
      totalPaid: 32000,
      balance: 0,
    });
    const empty = schedule({
      scheduleStatus: "no_payments",
      totalPaid: 0,
      balance: 0,
      pendingCount: 0,
    });
    assert.equal(paymentScheduleFilterKey(unpaid), "on_track");
    assert.equal(paymentScheduleFilterKey(partial), "partially_paid");
    assert.equal(isPartiallyPaidSchedule(partial), true);
    assert.equal(paymentScheduleFilterKey(paid), "paid_in_full");
    assert.equal(paymentScheduleFilterKey(empty), "no_payments");
    assert.equal(paymentMatchesListFilter(partial, "partially_paid"), true);
    assert.equal(paymentMatchesListFilter(partial, "on_track"), false);
    assert.equal(paymentMatchesListFilter(paid, "paid_in_full"), true);
  });

  it("N — search works within filtered population", () => {
    const a = schedule({ clientName: "Minnie Mouse", title: "Garden payments" });
    const b = schedule({ id: "s2", clientName: "Wilma", title: "Essential Wedding payments" });
    const pool = [a, b].filter((s) => paymentMatchesListFilter(s, "all"));
    const found = pool.filter((s) => paymentMatchesListSearch(s, "minnie"));
    assert.equal(found.length, 1);
    assert.equal(found[0]?.id, "s1");
    assert.equal(paymentMatchesListSearch(b, "essential"), true);
  });

  it("On Track excludes overdue attention schedules", () => {
    const overdue = schedule({
      scheduleStatus: "attention",
      overdueCount: 1,
      totalPaid: 0,
      balance: 32000,
    });
    assert.equal(paymentMatchesListFilter(overdue, "on_track"), false);
    assert.equal(paymentMatchesListFilter(overdue, "action_required"), true);
    assert.equal(paymentMatchesListFilter(overdue, "all"), true);
    const future = schedule({ scheduleStatus: "on_track", totalPaid: 0, balance: 32000 });
    assert.equal(paymentMatchesListFilter(future, "on_track"), true);
    const partialOverdue = schedule({
      scheduleStatus: "attention",
      overdueCount: 1,
      totalPaid: 8000,
      balance: 24000,
    });
    assert.equal(paymentMatchesListFilter(partialOverdue, "partially_paid"), true);
    assert.equal(paymentMatchesListFilter(partialOverdue, "on_track"), false);
    assert.equal(paymentMatchesListFilter(partialOverdue, "paid_in_full"), false);
    assert.equal(paymentMatchesListFilter(partialOverdue, "action_required"), true);
  });

  it("G-compatible — $8k of $32k is Partially Paid, not Paid in Full", () => {
    const s = schedule({ totalPaid: 8000, balance: 24000, scheduleStatus: "on_track" });
    assert.equal(paymentMatchesListFilter(s, "partially_paid"), true);
    assert.equal(paymentMatchesListFilter(s, "paid_in_full"), false);
  });
});
