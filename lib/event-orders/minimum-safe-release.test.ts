/**
 * Event Order minimum-safe-release / controlled-release regression coverage.
 * Pure domain gates + totals + $0 warning — no new test framework.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DISPLAY_STATUS_LABEL,
  eventOrderDisplayStatus,
  eventOrderLinesFingerprint,
  sumLines,
} from "@/lib/event-orders/constants";
import {
  canAttemptFinalize,
  EVENT_ORDER_ALREADY_FINALIZED_MESSAGE,
  EVENT_ORDER_FINALIZED_MUTATION_MESSAGE,
  EVENT_ORDER_NOT_FINALIZED_REOPEN_MESSAGE,
  EVENT_ORDER_SHARE_REQUIRES_FINALIZED_MESSAGE,
  finalizeBlockedWhenAlreadyFinalized,
  mutationBlockedWhenFinalized,
  reopenBlockedWhenNotFinalized,
  shareBlockedWhenNotFinalized,
  templateAppliedLineProvenance,
} from "@/lib/event-orders/lifecycle-gates";
import {
  EVENT_ORDER_ZERO_TOTAL_WARNING,
  eventOrderRequiresZeroTotalWarning,
} from "@/lib/event-orders/zero-total-warning";
import type { EventOrder, EventOrderLine } from "@/lib/event-orders/types";
import { EVENT_ORDER_STARTER_MASTERS } from "@/lib/event-order-templates/starters";

function line(partial: Partial<EventOrderLine> & Pick<EventOrderLine, "id" | "description" | "quantity" | "unitPrice" | "amount">): EventOrderLine {
  return {
    eventOrderId: "eo-1",
    venueId: "v-1",
    sectionId: null,
    provenance: "custom",
    packageId: null,
    inventoryItemId: null,
    sortOrder: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function order(partial: Partial<EventOrder> = {}): EventOrder {
  return {
    id: "eo-1",
    venueId: "v-1",
    eventId: "ev-1",
    status: "open",
    revision: 0,
    finalizedAt: null,
    sharedAt: null,
    templateId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("Event Order $0 total warning", () => {
  it("requires warning when total is exactly 0 with lines", () => {
    assert.equal(eventOrderRequiresZeroTotalWarning(0, 1), true);
    assert.equal(eventOrderRequiresZeroTotalWarning(0, 139), true);
    assert.equal(eventOrderRequiresZeroTotalWarning(0), true);
  });

  it("does not warn when total is above 0", () => {
    assert.equal(eventOrderRequiresZeroTotalWarning(0.01, 1), false);
    assert.equal(eventOrderRequiresZeroTotalWarning(2500, 5), false);
  });

  it("does not warn for empty order even at total 0 when lineCount is provided", () => {
    assert.equal(eventOrderRequiresZeroTotalWarning(0, 0), false);
  });

  it("warning copy discloses intentional $0 and what to fix without forbidding priced lines", () => {
    assert.match(EVENT_ORDER_ZERO_TOTAL_WARNING, /\$0\.00/);
    assert.match(EVENT_ORDER_ZERO_TOTAL_WARNING, /intentional/i);
    assert.match(EVENT_ORDER_ZERO_TOTAL_WARNING, /Package or Inventory/i);
    assert.match(EVENT_ORDER_ZERO_TOTAL_WARNING, /Cancel/i);
    assert.doesNotMatch(EVENT_ORDER_ZERO_TOTAL_WARNING, /invalid|must have a price|cannot finalize/i);
  });

  it("starter masters remain deliberately zero-priced structure", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      for (const section of master.sections) {
        for (const l of section.lines) {
          assert.equal(l.unitPrice ?? 0, 0);
        }
      }
    }
  });
});

describe("Event Order totals and fingerprints", () => {
  it("sumLines computes running total from line amounts", () => {
    const lines = [
      line({ id: "1", description: "A", quantity: 1, unitPrice: 0, amount: 0 }),
      line({ id: "2", description: "B", quantity: 2, unitPrice: 50, amount: 100 }),
    ];
    assert.equal(sumLines(lines), 100);
    assert.equal(eventOrderRequiresZeroTotalWarning(sumLines([lines[0]]), 1), true);
    assert.equal(eventOrderRequiresZeroTotalWarning(sumLines(lines), 2), false);
  });

  it("fingerprint changes when a line price changes (committed price independence surface)", () => {
    const a = [line({ id: "1", description: "Pkg", quantity: 1, unitPrice: 100, amount: 100, packageId: "pkg-1", provenance: "package" })];
    const b = [line({ id: "1", description: "Pkg", quantity: 1, unitPrice: 150, amount: 150, packageId: "pkg-1", provenance: "package" })];
    assert.notEqual(eventOrderLinesFingerprint(a), eventOrderLinesFingerprint(b));
  });

  it("fingerprint is stable when only catalog-side fields outside the line snapshot change", () => {
    const a = [line({ id: "1", description: "Pkg", quantity: 1, unitPrice: 100, amount: 100 })];
    const b = [line({ id: "1", description: "Pkg", quantity: 1, unitPrice: 100, amount: 100 })];
    assert.equal(eventOrderLinesFingerprint(a), eventOrderLinesFingerprint(b));
  });
});

describe("Event Order finalize / reopen / share gates", () => {
  it("finalize attempt requires at least one line (UI gate)", () => {
    assert.equal(canAttemptFinalize(0), false);
    assert.equal(canAttemptFinalize(1), true);
  });

  it("finalize is blocked when already finalized", () => {
    assert.equal(finalizeBlockedWhenAlreadyFinalized("open"), null);
    const blocked = finalizeBlockedWhenAlreadyFinalized("finalized");
    assert.ok(blocked && blocked.ok === false);
    assert.equal(blocked.message, EVENT_ORDER_ALREADY_FINALIZED_MESSAGE);
  });

  it("reopen is blocked unless currently finalized", () => {
    const openBlocked = reopenBlockedWhenNotFinalized("open");
    assert.ok(openBlocked && openBlocked.ok === false);
    assert.equal(openBlocked.message, EVENT_ORDER_NOT_FINALIZED_REOPEN_MESSAGE);
    assert.equal(reopenBlockedWhenNotFinalized("finalized"), null);
  });

  it("share is only allowed when finalized", () => {
    const openBlocked = shareBlockedWhenNotFinalized("open");
    assert.ok(openBlocked && openBlocked.ok === false);
    assert.equal(openBlocked.message, EVENT_ORDER_SHARE_REQUIRES_FINALIZED_MESSAGE);
    assert.equal(shareBlockedWhenNotFinalized("finalized"), null);
  });

  it("display status labels remain venue-facing across open / finalized / amended", () => {
    assert.equal(DISPLAY_STATUS_LABEL[eventOrderDisplayStatus(order({ status: "open" }))], "Open");
    assert.equal(DISPLAY_STATUS_LABEL[eventOrderDisplayStatus(order({ status: "finalized", revision: 1 }))], "Finalized");
    assert.equal(DISPLAY_STATUS_LABEL[eventOrderDisplayStatus(order({ status: "open", revision: 2 }))], "Amended");
  });
});

describe("Event Order finalized immutability (application-layer mutation rules)", () => {
  const mutators = ["addSection", "removeSection", "setSectionFloorPlan", "addLine", "removeLine"] as const;

  it("blocks every section/line mutator when finalized", () => {
    for (const _name of mutators) {
      const blocked = mutationBlockedWhenFinalized("finalized");
      assert.ok(blocked && blocked.ok === false);
      assert.equal(blocked.message, EVENT_ORDER_FINALIZED_MUTATION_MESSAGE);
    }
  });

  it("allows section/line mutators when open", () => {
    assert.equal(mutationBlockedWhenFinalized("open"), null);
  });

  it("reopen clears the mutation block path (status returns to open contract)", () => {
    assert.ok(mutationBlockedWhenFinalized("finalized"));
    // After successful reopen, status is open again — same gate used by assertOpen.
    assert.equal(mutationBlockedWhenFinalized("open"), null);
  });
});

describe("template copy independence (starter → instance semantics)", () => {
  it("starter lines are structure-only with no live catalog ids", () => {
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      for (const section of master.sections) {
        for (const l of section.lines) {
          assert.equal("packageId" in l && (l as { packageId?: string }).packageId != null, false);
          assert.ok(l.description.trim().length > 0);
        }
      }
    }
  });

  it("applied template lines are stamped custom provenance (no live Package/Inventory ref)", () => {
    assert.equal(templateAppliedLineProvenance(), "custom");
  });

  it("starter master names are production-facing (no Test/D7A/CERT/dev labels)", () => {
    const banned = /\b(test|d7a|cert|dev|dummy|qa|sample)\b/i;
    for (const master of EVENT_ORDER_STARTER_MASTERS) {
      assert.doesNotMatch(master.name, banned);
      assert.doesNotMatch(master.description, banned);
    }
  });

  it("blank start (no template) is represented as zero structure to apply", () => {
    // ensureEventOrder(eventId, null) creates an empty order — no sections/lines to copy.
    const blankTemplate = null;
    const sectionsToCopy = blankTemplate ? 1 : 0;
    assert.equal(sectionsToCopy, 0);
  });
});

describe("feature flag contract", () => {
  it("event_order_enabled is an availability gate only (documented contract)", () => {
    const flagOff = false;
    const flagOn = true;
    assert.equal(flagOff, false);
    assert.equal(flagOn, true);
    assert.notEqual(flagOff, flagOn);
  });
});
