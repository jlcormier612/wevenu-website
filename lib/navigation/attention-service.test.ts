import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { countPaymentAttention, isPaymentAttentionSchedule } from "@/lib/navigation/attention";
import type { PaymentLineItem } from "@/lib/payments/types";

/**
 * Mirrors countPaymentAttentionSchedules in attention-service:
 * distinct schedule ids with attention line statuses, minus excluded schedules.
 */
function countPaymentAttentionFromNarrow(
  attentionLineScheduleIds: string[],
  excludedScheduleIds: string[],
): number {
  const excluded = new Set(excludedScheduleIds);
  const ids = new Set<string>();
  for (const id of attentionLineScheduleIds) {
    if (excluded.has(id)) continue;
    ids.add(id);
  }
  return ids.size;
}

function line(
  scheduleId: string,
  status: PaymentLineItem["status"],
): PaymentLineItem {
  return {
    id: `li-${scheduleId}-${status}`,
    venueId: "v",
    scheduleId,
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
    createdAt: "2026-09-01",
    updatedAt: "2026-09-01",
  };
}

describe("nav attention payment count — narrow query equivalence", () => {
  it("matches countPaymentAttention for overdue/refunded schedules", () => {
    const schedules = [
      { excludeFromBusinessReporting: false, lineItems: [line("s1", "overdue"), line("s1", "paid")] },
      { excludeFromBusinessReporting: false, lineItems: [line("s2", "pending")] },
      { excludeFromBusinessReporting: true, lineItems: [line("s3", "overdue")] },
      { excludeFromBusinessReporting: false, lineItems: [line("s4", "refunded")] },
      { excludeFromBusinessReporting: false, lineItems: [line("s5", "partially_refunded")] },
    ];
    const classic = countPaymentAttention(schedules);
    const narrow = countPaymentAttentionFromNarrow(
      ["s1", "s3", "s4", "s5"],
      ["s3"],
    );
    assert.equal(classic, 3);
    assert.equal(narrow, classic);
    assert.equal(isPaymentAttentionSchedule(schedules[0]), true);
    assert.equal(isPaymentAttentionSchedule(schedules[1]), false);
    assert.equal(isPaymentAttentionSchedule(schedules[2]), false);
  });
});

describe("attention-service fetch shape", () => {
  const src = readFileSync(resolve("lib/navigation/attention-service.ts"), "utf8");

  it("does not load full payment catalogs or contract list helpers for badges", () => {
    assert.doesNotMatch(src, /\bgetAllLineItems\b/);
    assert.doesNotMatch(src, /\bgetSchedules\s*\(/);
    assert.doesNotMatch(src, /\bgetContracts\s*\(/);
    assert.match(src, /countPaymentAttentionSchedules/);
    assert.match(src, /countActionRequiredContracts/);
  });

  it("scopes task queries to the current staff member when present", () => {
    assert.match(src, /assigned_to_staff_id/);
    assert.match(src, /due_date\.lt\.\$\{today\}|lt\("due_date"/);
  });

  it("uses head counts for unseen tours + protection", () => {
    assert.match(src, /tour_appointments[\s\S]*count: "exact"[\s\S]*head: true/);
    assert.match(src, /paid_unbooked/);
  });

  it("does not select contract content for badge rollup", () => {
    assert.match(src, /id, status, expires_at, created_at, amends_contract_id, title/);
    assert.doesNotMatch(src, /select\("\*"\)/);
    assert.doesNotMatch(src, /content,/);
  });
});
