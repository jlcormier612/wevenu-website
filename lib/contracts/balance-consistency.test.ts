/**
 * Financial SoT consistency for legacy balance / package Remaining.
 * package_section Remaining and balance_remaining must agree when both
 * derive from commercial selection totals (no payment schedule).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatPackageSection,
  remainingAmount,
} from "@/lib/commercial-selections/constants";
import { buildMergeData, mergeContent } from "@/lib/contracts/merge";
import {
  formatBalanceRemaining,
  formatContractTotalAmount,
  MISSING_BALANCE_REMAINING,
  MISSING_PAYMENT_SCHEDULE,
} from "@/lib/contracts/merge-extras";
import {
  starterContentHasRemovedSmartFields,
  starterContentNeedsSupportedSmartFieldRestore,
} from "@/lib/contracts/provision";
import { WEDDING_VENUE_AGREEMENT_CONTENT } from "@/lib/contracts/starters";

describe("balance / package Remaining consistency", () => {
  it("selection total + deposit → same currency for Remaining and balance_remaining", () => {
    const total = 15000;
    const deposit = 3750;
    const remaining = remainingAmount(total, deposit);
    assert.equal(remaining, 11250);

    const packageSection = formatPackageSection("Garden Package", total, [], {
      depositAmount: deposit,
    });
    assert.match(packageSection, /Package total: \$15000\.00/);
    assert.match(packageSection, /Deposit: \$3750\.00/);
    assert.match(packageSection, /Remaining: \$11250\.00/);

    const balance = formatBalanceRemaining(remaining);
    assert.equal(balance, "$11,250.00");

    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Wilma",
      clientLastName: "Flintstone",
      eventDate: "2027-02-14",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Wedding Venue Agreement",
      packageSection,
      contractTotal: formatContractTotalAmount(total)!,
      balanceRemaining: balance,
      paymentScheduleSummary: MISSING_PAYMENT_SCHEDULE,
    });

    assert.equal(data.contract_total, "$15,000.00");
    assert.equal(data.balance_remaining, "$11,250.00");
    assert.notEqual(data.balance_remaining, MISSING_BALANCE_REMAINING);

    const body = mergeContent(
      "{{package_section}}\n\nBALANCE\n{{balance_remaining}}\n\n{{payment_schedule_summary}}",
      data,
    );
    assert.match(body, /Remaining: \$11250\.00/);
    assert.match(body, /\$11,250\.00/);
    assert.doesNotMatch(body, /Balance remaining is not listed yet/);
    assert.doesNotMatch(body, /\{\{/);
  });

  it("no selection / no schedule → honest balance fallback (not invented)", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      eventDate: null,
      eventType: null,
      guestCount: null,
      contractTitle: "Agreement",
    });
    assert.equal(data.balance_remaining, MISSING_BALANCE_REMAINING);
    assert.equal(data.payment_schedule_summary, MISSING_PAYMENT_SCHEDULE);
  });

  it("payment schedule remaining overrides selection projection when provided", () => {
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Ada",
      clientLastName: "Lovelace",
      eventDate: "2027-06-12",
      eventType: "wedding",
      guestCount: 80,
      contractTitle: "Agreement",
      packageSection: formatPackageSection("Garden", 15000, [], { depositAmount: 3750 }),
      balanceRemaining: formatBalanceRemaining(5000), // schedule says more paid
    });
    assert.equal(data.balance_remaining, "$5,000.00");
  });
});

describe("starter catalog hygiene", () => {
  it("canonical starter has no removed Smart Fields", () => {
    assert.equal(starterContentHasRemovedSmartFields(WEDDING_VENUE_AGREEMENT_CONTENT), false);
  });

  it("renders exactly one customer-facing Balance remaining label", () => {
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\nBalance remaining\n\{\{balance_remaining\}\}\n/);
    assert.equal(
      (WEDDING_VENUE_AGREEMENT_CONTENT.match(/^Balance remaining$/gm) ?? []).length,
      1,
    );
    assert.doesNotMatch(WEDDING_VENUE_AGREEMENT_CONTENT, /Balance remaining \(confirmation\)/);
    const data = buildMergeData({
      venueName: "Jen's Fancy Venue",
      clientFirstName: "Lorelei",
      clientLastName: "Gilmore",
      eventDate: "2027-06-01",
      eventType: "wedding",
      guestCount: 100,
      contractTitle: "Venue Rental Agreement",
      contractTotal: formatContractTotalAmount(32000)!,
      balanceRemaining: formatBalanceRemaining(24000),
      paymentScheduleSummary: MISSING_PAYMENT_SCHEDULE,
    });
    const merged = mergeContent(WEDDING_VENUE_AGREEMENT_CONTENT, data);
    assert.equal((merged.match(/^Balance remaining$/gm) ?? []).length, 1);
    assert.doesNotMatch(merged, /Balance remaining \(confirmation\)/);
    assert.match(merged, /Balance remaining\n\$24,000\.00/);
  });

  it("detects polluted starter content", () => {
    assert.equal(
      starterContentHasRemovedSmartFields("Hours {{venue_access_hours}}\n{{ceremony_summary}}"),
      true,
    );
  });

  it("detects the stripped 078 starter that is missing booking-backed tokens", () => {
    assert.equal(
      starterContentNeedsSupportedSmartFieldRestore("Venue {{venue_name}}\nClient {{client_name}}"),
      true,
    );
    assert.equal(starterContentNeedsSupportedSmartFieldRestore(WEDDING_VENUE_AGREEMENT_CONTENT), false);
  });
});
