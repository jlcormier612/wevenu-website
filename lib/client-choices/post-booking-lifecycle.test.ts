import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  financialDeltaFromLines,
  resolveSelectedOptions,
} from "@/lib/client-choices/apply-to-event-order";
import {
  amendBlocked,
  amendReusesSameInstance,
  finalizeCreatesInvoice,
  firstSendBlocked,
  sendBlocked,
  submitMutatesFinancialSystems,
} from "@/lib/client-choices/lifecycle-gates";
import { isBillableEventOrderLineForInvoice } from "@/lib/client-choices/unbilled-delta";
import { financialImpactCopy } from "@/lib/client-choices/selections-billing";
import type { ChoicesDefinition } from "@/lib/client-choices/types";

const definition: ChoicesDefinition = {
  sections: [{ id: "s1", name: "Dinner", guidance: null, sortOrder: 0 }],
  groups: [{
    id: "g1",
    sectionId: "s1",
    name: "Entrée",
    instructions: null,
    selectionMode: "single",
    minSelect: 1,
    maxSelect: 1,
    allowQuantity: false,
    sortOrder: 0,
  }, {
    id: "g2",
    sectionId: "s1",
    name: "Bar",
    instructions: null,
    selectionMode: "single",
    minSelect: 0,
    maxSelect: 1,
    allowQuantity: false,
    sortOrder: 1,
  }],
  options: [
    {
      id: "o-beef", groupId: "g1", offeringId: "off-beef", label: "Beef",
      description: null, isIncluded: true, unitPrice: 0, sortOrder: 0,
    },
    {
      id: "o-veg", groupId: "g1", offeringId: "off-veg", label: "Vegetarian",
      description: null, isIncluded: true, unitPrice: 0, sortOrder: 1,
    },
    {
      id: "o-bar", groupId: "g2", offeringId: "off-bar", label: "Premium open bar",
      description: null, isIncluded: false, unitPrice: 750, sortOrder: 0,
    },
  ],
};

describe("post-booking commercial lifecycle", () => {
  it("A — included-only selection is locked with $0 and no invoice copy", () => {
    const lines = resolveSelectedOptions(definition, { g1: { optionIds: ["o-beef"] } });
    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.isIncluded, true);
    assert.equal(financialDeltaFromLines(lines), 0);
    assert.equal(financialImpactCopy(0, null), null);
    assert.equal(finalizeCreatesInvoice(), false);
    assert.equal(submitMutatesFinancialSystems(), false);
  });

  it("B — billable selection stays unbilled until invoice send", () => {
    const lines = resolveSelectedOptions(definition, { g2: { optionIds: ["o-bar"] } });
    assert.equal(financialDeltaFromLines(lines), 750);
    assert.match(
      financialImpactCopy(750, null) ?? "",
      /Nothing has been billed yet/,
    );
    const src = readFileSync("lib/client-choices/service.ts", "utf8");
    const finalize = src.slice(src.indexOf("export async function finalizeClientChoices"));
    assert.equal(finalize.includes("createInvoice"), false);
    assert.equal(finalize.includes("createPaymentSchedule"), false);
  });

  it("C — mixed selection keeps included lines and only bills extras", () => {
    const lines = resolveSelectedOptions(definition, {
      g1: { optionIds: ["o-veg"] },
      g2: { optionIds: ["o-bar"] },
    });
    assert.equal(lines.length, 2);
    assert.equal(lines.some((l) => l.description === "Vegetarian" && l.isIncluded), true);
    assert.equal(financialDeltaFromLines(lines), 750);
    const eoLines = lines.map((l, i) => ({
      id: `eo-${i}`,
      amount: l.amount,
      unitPrice: l.unitPrice,
      isIncluded: l.isIncluded,
    }));
    assert.deepEqual(
      eoLines.filter(isBillableEventOrderLineForInvoice).map((l) => l.amount),
      [750],
    );
  });

  it("D — payment plan is optional on a selections invoice", () => {
    const src = readFileSync("app/(app)/events/[id]/event-order-actions.ts", "utf8");
    assert.equal(src.includes("createPaymentSchedule"), false);
  });

  it("E — amend reuses the same instance so re-finalize replaces lines", () => {
    assert.equal(amendBlocked("finalized"), null);
    assert.equal(amendReusesSameInstance(), true);
    const src = readFileSync("lib/client-choices/service.ts", "utf8");
    const revise = src.slice(src.indexOf("export async function reviseClientChoices"));
    assert.match(revise, /amendBlocked/);
    assert.match(revise, /status: "draft"/);
    assert.equal(revise.includes("insertInstance"), false);
    assert.doesNotMatch(revise, /\(revision\)/);
  });

  it("F — amended draft is sendable again; finalized cannot be sent", () => {
    assert.equal(firstSendBlocked("draft"), null);
    assert.ok(sendBlocked("finalized"));
  });

  it("G — inventory handoff is operational feed, not a shopping cart", () => {
    const invSrc = readFileSync("lib/event-inventory/service.ts", "utf8");
    assert.match(invSrc, /eventInventoryItemsPendingForEventOrder/);
    assert.match(invSrc, /inventoryHandoffBillableTotal/);
    assert.doesNotMatch(invSrc, /floor_plan/);
    assert.equal(invSrc.includes("createInvoice"), false);
    const panel = readFileSync("components/event-inventory/event-inventory-panel.tsx", "utf8");
    assert.match(panel, /hasUnpushedItems/);
    assert.doesNotMatch(panel, /hasUnpushedBillable/);
  });

  it("H — booking invoice cannot be the Event Order invoice", () => {
    const src = readFileSync("lib/invoices/service.ts", "utf8");
    assert.match(src, /isPackageBookingCommitmentLines/);
  });

  it("I — billable freeze still excludes included priced lines", () => {
    assert.equal(
      isBillableEventOrderLineForInvoice({ amount: 3, unitPrice: 3, isIncluded: true }),
      false,
    );
    assert.equal(
      isBillableEventOrderLineForInvoice({ amount: 750, unitPrice: 750, isIncluded: false }),
      true,
    );
  });
});
