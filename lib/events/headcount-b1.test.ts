/**
 * Narrow B / B1 — new apply/seed uses Guaranteed ?? Estimated; no recalc.
 *
 * Run: npx tsx --test lib/events/headcount-b1.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { resolve } from "node:path";

import { boundHeadcountForApply, headcountRecalcEnabled } from "@/lib/events/headcount";
import { defaultApplySelections, startingQuantityForLine } from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";
import { seededInclusionQuantity } from "@/lib/event-orders/seed-package-inclusions";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

function line(id: string, over: Partial<EventOrderTemplateLine>): EventOrderTemplateLine {
  return {
    id, templateId: "t", venueId: "v", sectionId: null, description: id, descriptionDetail: null,
    quantity: 1, unitPrice: 10, pricingModel: "flat", unit: null, includedByDefault: true,
    offeringId: null, sortOrder: 0, createdAt: "", updatedAt: "", ...over,
  };
}

const dinner = line("dinner", { pricingModel: "per_person", unitPrice: 85, unit: "guest" });

describe("B1 bound headcount for new apply/seed", () => {
  it("prefers Guaranteed over Estimated for starting quantities", () => {
    const bound = boundHeadcountForApply(120, 100);
    assert.equal(bound, 100);
    assert.equal(startingQuantityForLine(dinner, bound), 100);
    assert.equal(defaultApplySelections([dinner], bound)[0]?.quantity, 100);
    assert.equal(seededInclusionQuantity({ quantity: 1, perGuest: true }, bound), 100);
  });

  it("falls back to Estimated when Guaranteed is unset", () => {
    assert.equal(boundHeadcountForApply(120, null), 120);
    assert.equal(startingQuantityForLine(dinner, boundHeadcountForApply(120, null)), 120);
  });

  it("B1 apply/seed path does not itself rewrite lines on headcount change", () => {
    // Recalc lives in headcount-recalc (B2), not in template apply/seed.
    const service = read("lib/event-orders/service.ts");
    assert.doesNotMatch(service, /recalculateBoundEventOrderLinesForEvent/);
    assert.equal(typeof headcountRecalcEnabled(), "boolean");
  });
});

describe("B1 wiring contracts", () => {
  it("server loadEventOrderGuestCount binds Guaranteed ?? Estimated from events", () => {
    const service = read("lib/event-orders/service.ts");
    assert.match(service, /select\("guest_count, guaranteed_guest_count"\)/);
    assert.match(service, /boundHeadcountForApply\(data\?\.guest_count, data\?\.guaranteed_guest_count\)/);
    assert.match(service, /from\("clients"\)[\s\S]*?select\("guest_count"\)/);
  });

  it("venue apply UI passes bound count into sheets", () => {
    const panel = read("components/event-orders/event-order-panel.tsx");
    assert.match(panel, /boundHeadcountForApply\(overview\.guestCount, overview\.guaranteedGuestCount\)/);
    assert.equal((panel.match(/guestCount=\{applyGuestCount\}/g) ?? []).length, 2);
    const detail = read("components/events/event-detail.tsx");
    assert.match(detail, /guaranteedGuestCount:\s*event\.guaranteedGuestCount/);
    const list = read("components/event-order-templates/event-order-template-list.tsx");
    assert.match(list, /boundHeadcountForApply\(ev\.guestCount, ev\.guaranteedGuestCount\)/);
    assert.match(list, /boundHeadcountForApply\(selected\?\.guestCount, selected\?\.guaranteedGuestCount\)/);
  });

  it("template apply targets load guaranteed_guest_count", () => {
    const svc = read("lib/library/template-apply-targets-service.ts");
    assert.match(svc, /guaranteed_guest_count/);
    assert.match(svc, /guaranteedGuestCount:\s*row\.guaranteed_guest_count/);
  });
});
