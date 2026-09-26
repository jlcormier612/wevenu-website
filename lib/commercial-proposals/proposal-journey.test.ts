import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluatePackageEligibility,
  filterEligiblePackages,
} from "@/lib/packages/eligibility";
import {
  calculateProposalTotal,
  validateClientChoices,
} from "@/lib/commercial-proposals/types";
import { resolveAmountDueNow } from "@/lib/invoices/amount-due-now";
import { formatPackageSection } from "@/lib/commercial-selections/constants";

describe("package eligibility", () => {
  const base = {
    isActive: true,
    basePrice: 1000,
    offerRole: "primary" as const,
    eligibleEventTypes: null as string[] | null,
    minGuestCount: null as number | null,
    maxGuestCount: null as number | null,
    eligibleSpaceIds: null as string[] | null,
  };

  it("requires active + priced", () => {
    assert.equal(evaluatePackageEligibility({ ...base, isActive: false }).eligible, false);
    assert.equal(evaluatePackageEligibility({ ...base, basePrice: null }).eligible, false);
    assert.equal(evaluatePackageEligibility(base).eligible, true);
  });

  it("filters by event type when configured", () => {
    const pkg = { ...base, eligibleEventTypes: ["wedding"] };
    assert.equal(evaluatePackageEligibility(pkg, { eventType: "wedding" }).eligible, true);
    assert.equal(evaluatePackageEligibility(pkg, { eventType: "corporate" }).eligible, false);
    assert.equal(evaluatePackageEligibility(pkg, {}).eligible, false);
  });

  it("filters by guest count when known", () => {
    const pkg = { ...base, minGuestCount: 50, maxGuestCount: 150 };
    assert.equal(evaluatePackageEligibility(pkg, { guestCount: 80 }).eligible, true);
    assert.equal(evaluatePackageEligibility(pkg, { guestCount: 20 }).eligible, false);
    assert.equal(evaluatePackageEligibility(pkg, {}).eligible, true);
  });

  it("filters by space when configured", () => {
    const space = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const pkg = { ...base, eligibleSpaceIds: [space] };
    assert.equal(evaluatePackageEligibility(pkg, { spaceId: space }).eligible, true);
    assert.equal(evaluatePackageEligibility(pkg, { spaceId: "other" }).eligible, false);
  });

  it("filterEligiblePackages drops ineligible", () => {
    const list = filterEligiblePackages(
      [
        { ...base, basePrice: 100 },
        { ...base, isActive: false, basePrice: 200 },
        { ...base, basePrice: null },
      ],
      {},
    );
    assert.equal(list.length, 1);
  });
});

describe("proposal client choices", () => {
  const options = [
    { id: "p1", offerRole: "primary" as const, unitPrice: 32000 },
    { id: "p2", offerRole: "primary" as const, unitPrice: 24000 },
    { id: "a1", offerRole: "addon" as const, unitPrice: 2500 },
  ];

  it("requires exactly one primary", () => {
    assert.equal(validateClientChoices(options, []).ok, false);
    assert.equal(validateClientChoices(options, [{ optionId: "a1" }]).ok, false);
    assert.equal(
      validateClientChoices(options, [{ optionId: "p1" }, { optionId: "p2" }]).ok,
      false,
    );
    assert.equal(validateClientChoices(options, [{ optionId: "p1" }]).ok, true);
  });

  it("calculates total from frozen unit prices", () => {
    assert.equal(
      calculateProposalTotal(options, [
        { optionId: "p1", quantity: 1 },
        { optionId: "a1", quantity: 1 },
      ]),
      34500,
    );
  });

  it("rejects unknown options", () => {
    const r = validateClientChoices(options, [{ optionId: "nope" }]);
    assert.equal(r.ok, false);
  });
});

describe("L2 contract package section includes priced lines", () => {
  it("formats add-on line totals", () => {
    const section = formatPackageSection("Signature Wedding", 34500, [
      {
        description: "Signature Wedding",
        quantity: 1,
        unit: "package",
        unitPrice: 32000,
        lineTotal: 32000,
        offerRole: "primary",
      },
      {
        description: "Ceremony Package",
        quantity: 1,
        unit: "add-on",
        unitPrice: 2500,
        lineTotal: 2500,
        offerRole: "addon",
      },
    ], { depositAmount: 8000 });
    assert.match(section, /Signature Wedding/);
    assert.match(section, /Ceremony Package/);
    assert.match(section, /\$34,500\.00/);
    assert.match(section, /\$32,000\.00/);
    assert.match(section, /Deposit: \$8,000\.00/);
  });
});

describe("deposit amount due now (email gate)", () => {
  it("uses schedule deposit line not invoice total", () => {
    const r = resolveAmountDueNow({
      balanceDue: 32000,
      scheduleLines: [
        { amount: 8000, dueDate: "2026-10-01", status: "pending", label: "Initial Payment", obligationKind: "deposit" },
        { amount: 24000, dueDate: "2027-05-01", status: "pending", label: "Remaining", obligationKind: "final" },
      ],
    });
    assert.equal(r.kind, "next_installment");
    if (r.kind === "next_installment") {
      assert.equal(r.amount, 8000);
      assert.equal(r.obligationKind, "deposit");
    }
  });
});
