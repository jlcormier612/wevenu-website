import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { isCommerciallyBooked } from "@/lib/booking-journey/model";
import { DEFAULT_COMMERCIAL_BOOKING_PREFS } from "@/lib/booking-journey/venue-prefs";
import { suggestDepositAmount } from "@/lib/commercial-selections/constants";
import type { CommercialSelection } from "@/lib/commercial-selections/types";

const read = (p: string) => readFileSync(resolve(p), "utf8");

function selection(overrides: Partial<CommercialSelection> = {}): CommercialSelection {
  return {
    id: "sel-1",
    venueId: "v1",
    leadId: "lead-1",
    clientId: "client-1",
    eventId: "event-1",
    sourcePackageId: "pkg-1",
    name: "Garden Package",
    totalAmount: 3200,
    depositAmount: 800,
    includedItems: [],
    status: "draft",
    version: 1,
    supersededById: null,
    offeredAt: null,
    acceptedAt: null,
    acceptToken: null,
    offerMessage: null,
    invoiceId: null,
    contractId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("Start booking file — workspace only", () => {
  it("does not mark lead booked or stamp lifecycle dates", () => {
    const convert = read("lib/clients/service.ts");
    const fn = convert.slice(convert.indexOf("export async function convertLeadToClient"));
    assert.match(fn, /insertClient/);
    assert.match(fn, /markConvertedClientAsBookingFile/);
    assert.doesNotMatch(fn, /updateLeadSalesStage/);
    assert.doesNotMatch(fn, /first_booked_at/);
    assert.doesNotMatch(fn, /lifecycle_booked_at/);
    assert.doesNotMatch(fn, /lifecycle_booking_origin/);
    const actions = read("app/(app)/booking-journey/actions.ts");
    const start = actions.slice(actions.indexOf("export async function startBookingFileAction"));
    assert.match(start, /convertLeadToClient/);
    assert.doesNotMatch(start, /updateLeadSalesStage/);
    assert.doesNotMatch(start, /recordLifecycleBooking/);
  });

  it("sets client status to booking file, not planning", () => {
    const src = read("lib/clients/service.ts");
    assert.match(src, /status: "booking"/);
    assert.match(src, /\.eq\("status", "planning"\)/);
    assert.match(src, /\.is\("lifecycle_booked_at", null\)/);
  });
});

describe("Commercial Booked transition", () => {
  it("agreement + required deposit is Booked", () => {
    assert.equal(
      isCommerciallyBooked({
        selection: selection({ status: "accepted" }),
        contract: { id: "c1", status: "signed" },
        paymentLines: [{ obligationKind: "deposit", status: "paid", amount: 800 }],
        prefs: DEFAULT_COMMERCIAL_BOOKING_PREFS,
      }),
      true,
    );
  });

  it("stamp helper does not book; bookClient is the relationship transaction", () => {
    const stamp = read("lib/booking-journey/stamp-commercial-booked-at.ts");
    const book = read("lib/booking-journey/book-client.ts");
    assert.doesNotMatch(stamp, /bookClient\(/);
    assert.match(stamp, /return null/);
    assert.match(book, /book_relationship/);
    assert.match(book, /recordLifecycleBooking/);
    assert.doesNotMatch(book, /status: "cancelled"/);
  });
});

describe("Variant F — initialPaymentRequired false", () => {
  it("does not autofill an $800 deposit", () => {
    assert.equal(
      suggestDepositAmount(3200, 800, { initialPaymentRequired: false }),
      0,
    );
    assert.equal(suggestDepositAmount(3200), 800);
  });

  it("create action forces deposit 0 when payment is not required", () => {
    const actions = read("app/(app)/booking-journey/actions.ts");
    assert.match(actions, /prefs\.initialPaymentRequired \? input\.depositAmount : 0/);
  });

  it("package sheet hides required-deposit UI", () => {
    const sheet = read("components/booking-journey/select-package-sheet.tsx");
    assert.match(sheet, /initialPaymentRequired/);
    assert.match(sheet, /No deposit is required to book/);
  });
});
