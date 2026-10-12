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
import { contractDocumentBalanceRemaining } from "@/lib/contracts/balance-remaining";
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
  it("configured deposit is payment allocation; balance_remaining stays full until paid", () => {
    const total = 15000;
    const deposit = 3750;
    // Schedule allocation math (package section) — not money received.
    const afterDepositAllocation = remainingAmount(total, deposit);
    assert.equal(afterDepositAllocation, 11250);

    const packageSection = formatPackageSection("Garden Package", total, [], {
      packageAmount: total,
      depositAmount: deposit,
      finalTotal: total,
    });
    assert.match(packageSection, /Package price: \$15000\.00/);
    assert.match(packageSection, /Agreed total: \$15000\.00/);
    assert.match(packageSection, /Deposit \(payment allocation\): \$3750\.00/);
    assert.match(packageSection, /Remaining after deposit: \$11250\.00/);

    // Document balance remaining must not treat the configured deposit as received.
    const balance = formatBalanceRemaining(
      contractDocumentBalanceRemaining({ contractedTotal: total, paymentsReceived: 0 }),
    );
    assert.equal(balance, "$15,000");

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

    assert.equal(data.contract_total, "$15,000");
    assert.equal(data.balance_remaining, "$15,000");
    assert.notEqual(data.balance_remaining, "$11,250");
    assert.notEqual(data.balance_remaining, MISSING_BALANCE_REMAINING);

    const body = mergeContent(
      "{{package_section}}\n\nBALANCE\n{{balance_remaining}}\n\n{{payment_schedule_summary}}",
      data,
    );
    assert.match(body, /Remaining after deposit: \$11250\.00/);
    assert.match(body, /BALANCE\n\$15,000/);
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
    assert.equal(data.balance_remaining, "$5,000");
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
    assert.match(merged, /Balance remaining\n\$24,000/);
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
    assert.equal(
      starterContentNeedsSupportedSmartFieldRestore(
        "Ceremony\nAdd your venue's approved ceremony timing and location language here, or leave blank until those details are confirmed.\n{{event_spaces}}\n{{package_section}}\n{{included_items_summary}}\n{{additional_items_summary}}\n{{payment_schedule_summary}}\n{{contract_total}}\n{{balance_remaining}}",
      ),
      true,
    );
    assert.equal(starterContentNeedsSupportedSmartFieldRestore(WEDDING_VENUE_AGREEMENT_CONTENT), false);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{ceremony_space\}\}/);
    assert.match(WEDDING_VENUE_AGREEMENT_CONTENT, /\{\{reception_space\}\}/);
  });
});
