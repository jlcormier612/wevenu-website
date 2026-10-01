import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { pickPaymentScheduleForBooking } from "@/lib/contracts/payment-schedule-merge";
import { formatBalanceRemaining } from "@/lib/contracts/merge-extras";
import { computePortalScheduleTotals } from "@/lib/portal/payment-totals";
import { MERGE_FIELDS, REMOVED_MERGE_FIELD_KEYS } from "@/lib/contracts/constants";

const GOLDI_LINES = [
  { label: "Initial Payment", amount: 4999.5, status: "overdue", paidAmount: 0 },
  { label: "Planning Payment", amount: 4999.5, status: "pending", paidAmount: 0 },
  { label: "Final Payment", amount: 5001, status: "pending", paidAmount: 0 },
];

describe("pickPaymentScheduleForBooking", () => {
  const eventLinked = { id: "sch-event", eventId: "evt-1", clientId: "c1" };
  const clientOnly = { id: "sch-client", eventId: null, clientId: "c1" };
  const otherClient = { id: "sch-other", eventId: null, clientId: "c2" };

  it("A. prefers the event-linked schedule when an Event exists", () => {
    const picked = pickPaymentScheduleForBooking(
      [clientOnly, eventLinked, otherClient],
      { eventId: "evt-1", clientId: "c1" },
    );
    assert.equal(picked?.id, "sch-event");
  });

  it("B. uses the client-linked schedule when event_id is NULL", () => {
    const picked = pickPaymentScheduleForBooking(
      [otherClient, clientOnly],
      { eventId: null, clientId: "c1" },
    );
    assert.equal(picked?.id, "sch-client");
  });

  it("B. still finds the client schedule when Event lookup is empty", () => {
    const picked = pickPaymentScheduleForBooking(
      [clientOnly],
      { eventId: "", clientId: "c1" },
    );
    assert.equal(picked?.id, "sch-client");
  });

  it("C. returns null when no payment schedule exists for the booking", () => {
    const picked = pickPaymentScheduleForBooking(
      [otherClient],
      { eventId: null, clientId: "c1" },
    );
    assert.equal(picked, null);
  });
});

describe("schedule remaining is authoritative once a plan exists", () => {
  it("Goldi unpaid $15,000 plan remaining is $15,000.00, not selection remaining", () => {
    const totals = computePortalScheduleTotals(GOLDI_LINES);
    assert.equal(totals.remaining, 15000);
    assert.equal(formatBalanceRemaining(totals.remaining), "$15,000.00");
    assert.notEqual(formatBalanceRemaining(totals.remaining), "$11,250.00");
  });
});

describe("contract service uses the booking picker, not event-only filter", () => {
  it("buildContractMergeData picks by client when no Event exists", () => {
    const service = readFileSync(resolve("lib/contracts/service.ts"), "utf8");
    const merge = service.slice(service.indexOf("export async function buildContractMergeData"));
    assert.match(merge, /pickPaymentScheduleForBooking/);
    assert.match(merge, /clientId: opts\.clientId/);
    assert.doesNotMatch(merge, /s\.eventId === event\.id/);
  });
});

describe("KEEP catalog unchanged by this source-path repair", () => {
  it("keeps 24 picker fields and the four removed keys", () => {
    assert.equal(MERGE_FIELDS.length, 24);
    assert.deepEqual(REMOVED_MERGE_FIELD_KEYS, [
      "venue_access_hours",
      "ceremony_summary",
      "reception_summary",
      "coordinator_name",
    ]);
  });
});
