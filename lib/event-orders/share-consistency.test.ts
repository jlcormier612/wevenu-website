/**
 * Shared Event Order vs live EO consistency (Buffet/Plated class).
 * Run: npx tsx --test lib/event-orders/share-consistency.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import {
  coupleVisibleLineNotes,
  coupleVisibleLineUnit,
  EVENT_ORDER_SHARE_STALE_INVOICE_MESSAGE,
  fingerprintShareCommitmentLines,
  invoiceBlockedWhenSharedCommitmentStale,
  isInternalChoicesProvenanceNote,
  shareCommitmentContentDiffers,
} from "@/lib/event-orders/share-consistency";

describe("share commitment fingerprints (Buffet vs Plated)", () => {
  it("treats Buffet $72 snapshot as different from live Plated $85", () => {
    const snapshot = [
      {
        description: "Buffet dinner",
        quantity: 100,
        unitPrice: 72,
        amount: 7200,
        isIncluded: false,
      },
    ];
    const live = [
      {
        description: "Plated dinner",
        quantity: 100,
        unitPrice: 85,
        amount: 8500,
        isIncluded: false,
      },
    ];
    assert.notEqual(
      fingerprintShareCommitmentLines(live),
      fingerprintShareCommitmentLines(snapshot),
    );
    assert.equal(shareCommitmentContentDiffers(live, snapshot), true);
  });

  it("ignores line order when content matches", () => {
    const a = [
      { description: "Cake", quantity: 1, unitPrice: 10, amount: 10, isIncluded: true },
      { description: "Plated", quantity: 2, unitPrice: 85, amount: 170, isIncluded: false },
    ];
    const b = [
      { description: "Plated", quantity: 2, unitPrice: 85, amount: 170, isIncluded: false },
      { description: "Cake", quantity: 1, unitPrice: 10, amount: 10, isIncluded: true },
    ];
    assert.equal(shareCommitmentContentDiffers(a, b), false);
  });

  it("blocks original invoice when shared commitment is stale", () => {
    const blocked = invoiceBlockedWhenSharedCommitmentStale({
      hasBeenShared: true,
      isAmendingInvoice: false,
      liveDiffersFromLastShare: true,
    });
    assert.ok(blocked);
    assert.equal(blocked!.ok, false);
    assert.equal(blocked!.message, EVENT_ORDER_SHARE_STALE_INVOICE_MESSAGE);
  });

  it("does not block incremental amending invoices when share is stale", () => {
    assert.equal(
      invoiceBlockedWhenSharedCommitmentStale({
        hasBeenShared: true,
        isAmendingInvoice: true,
        liveDiffersFromLastShare: true,
      }),
      null,
    );
  });

  it("does not block when never shared or content matches", () => {
    assert.equal(
      invoiceBlockedWhenSharedCommitmentStale({
        hasBeenShared: false,
        isAmendingInvoice: false,
        liveDiffersFromLastShare: true,
      }),
      null,
    );
    assert.equal(
      invoiceBlockedWhenSharedCommitmentStale({
        hasBeenShared: true,
        isAmendingInvoice: false,
        liveDiffersFromLastShare: false,
      }),
      null,
    );
  });
});

describe("couple-facing provenance sanitizers", () => {
  it("hides choices:uuid:uuid notes and units", () => {
    const token = "choices:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee:11111111-2222-3333-4444-555555555555";
    assert.equal(isInternalChoicesProvenanceNote(token), true);
    assert.equal(coupleVisibleLineNotes(token), null);
    assert.equal(coupleVisibleLineUnit(token), null);
    assert.equal(coupleVisibleLineNotes("Ask about dietary needs"), "Ask about dietary needs");
    assert.equal(coupleVisibleLineUnit("per guest"), "per guest");
  });
});

describe("wiring", () => {
  it("invoice service gates original EO create/send on stale share", () => {
    const src = readFileSync(resolve("lib/invoices/service.ts"), "utf8");
    assert.match(src, /gateOriginalEoInvoiceWhenShareStale/);
    assert.match(src, /isAmendingInvoice/);
  });

  it("portal Event Order view sanitizes units/notes", () => {
    const src = readFileSync(resolve("components/portal/event-order-view.tsx"), "utf8");
    assert.match(src, /coupleVisibleLineUnit/);
    assert.match(src, /coupleVisibleLineNotes/);
    assert.match(src, /not a Contracts signature/);
    assert.match(src, /not a legal e-signature/);
  });
});
