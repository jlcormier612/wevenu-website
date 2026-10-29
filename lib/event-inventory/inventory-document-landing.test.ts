import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { inventoryPortalStatusCopy } from "@/lib/event-inventory/inventory-portal-status";
import { inventoryReviewUrl } from "@/lib/event-inventory/inventory-portal-link";
import { eventOrderReviewUrl } from "@/lib/event-orders/event-order-portal-link";
import { documentPortalReturnPath } from "@/lib/portal/document-return";

const shell = readFileSync(resolve("components/portal/portal-shell.tsx"), "utf8");
const page = readFileSync(resolve("app/(portal)/p/[token]/page.tsx"), "utf8");
const eoShare = readFileSync(resolve("lib/event-orders/representation.ts"), "utf8");

describe("document email landing", () => {
  it("view-only inventory does not ask the couple to submit choices", () => {
    const copy = inventoryPortalStatusCopy("shared", false);
    assert.equal(copy.label, "Shared for review");
    assert.match(copy.hint, /read-only/);
    assert.doesNotMatch(copy.label, /Ready for your choices/);
    assert.doesNotMatch(copy.hint, /Submit/);
  });

  it("selection inventory still offers choices", () => {
    const copy = inventoryPortalStatusCopy("shared", true);
    assert.equal(copy.label, "Ready for your choices");
    assert.match(copy.hint, /Submit/);
  });

  it("inventory and event order email URLs keep the document in the query", () => {
    const inv = inventoryReviewUrl("https://app.sandbox.hellotocheers.com", "tok");
    const eo = eventOrderReviewUrl("https://app.sandbox.hellotocheers.com", "tok");
    assert.match(inv, /\?view=inventory#inventory$/);
    assert.match(eo, /\?view=event-order#event-order$/);
  });

  it("legal return keeps the document view instead of the portal home", () => {
    assert.equal(
      documentPortalReturnPath("tok", "inventory"),
      "/p/tok?view=inventory#inventory",
    );
    assert.equal(
      documentPortalReturnPath("tok", "event-order"),
      "/p/tok?view=event-order#event-order",
    );
    assert.equal(documentPortalReturnPath("tok", "overview"), "/p/tok");
  });

  it("portal hides planning navigation on a document deep link", () => {
    assert.match(shell, /isDocumentPortalSection\(initialSection\)/);
    assert.match(shell, /documentFocus \? null : \(/);
    assert.match(shell, /data-portal-document=\{documentFocus \? "focus"/);
    assert.match(page, /isEventOrderPortalView/);
    assert.match(eoShare, /eventOrderReviewUrl/);
    assert.match(eoShare, /pickEventOrderPortalSession/);
    assert.doesNotMatch(eoShare, /\$\{appUrl\}\/p\/\$\{session\.accessToken\}#event-order/);
  });
});
