import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { requiredStatusNeedsAttention } from "@/lib/floor-plans/required-vs-placed";
import { offeredLayoutsView, preferenceReviewIsActionable } from "@/lib/floor-plans/workspace-status";
import type { EventFloorPlanOfferWithTemplate } from "@/lib/floor-plan-offers/types";

const offer = (id: string, templateId: string, sortOrder: number, extra: Partial<EventFloorPlanOfferWithTemplate> = {}) =>
  ({
    id, venueId: "v", eventId: "e", floorPlanTemplateId: templateId, sortOrder, isOffered: true,
    coupleLabel: null, coupleBlurb: null, createdAt: "", updatedAt: "",
    templateName: `Template ${templateId}`, templateArchived: false, templateSpaceId: null, objectCount: 0,
    ...extra,
  }) as EventFloorPlanOfferWithTemplate;

describe("Floor Plans tab — offered layouts and status", () => {
  it("lists offered layouts in order and marks the couple's pick by source template", () => {
    const view = offeredLayoutsView(
      [offer("o2", "t2", 2), offer("o1", "t1", 1, { coupleLabel: "Garden" }), offer("o3", "t3", 3, { isOffered: false })],
      [{ id: "plan-b", sourceTemplateId: "t2" }],
      "plan-b",
    );
    assert.deepEqual(view, [
      { id: "o1", label: "Garden", isCouplePick: false },
      { id: "o2", label: "Template t2", isCouplePick: true },
    ]);
    assert.equal(offeredLayoutsView([offer("o1", "t1", 1)], [], null)[0]?.isCouplePick, false);
  });

  it("shows the preference card only when there is a decision to make", () => {
    const base = { status: null, hasPreferred: false, multipleSeated: false, hasError: false };
    assert.equal(preferenceReviewIsActionable(base), false);
    assert.equal(preferenceReviewIsActionable({ ...base, status: "approved", hasPreferred: true }), false);
    assert.equal(preferenceReviewIsActionable({ ...base, status: "pending", hasPreferred: true }), true);
    assert.equal(preferenceReviewIsActionable({ ...base, multipleSeated: true }), true);
    assert.equal(preferenceReviewIsActionable({ ...base, hasError: true }), true);
  });

  it("shows the Event Order comparison only when something is short or unmatched", () => {
    assert.equal(requiredStatusNeedsAttention({ lines: [], unmatchedSections: [] }), false);
    assert.equal(requiredStatusNeedsAttention({ lines: [{ shortCount: 0 }], unmatchedSections: [] }), false);
    assert.equal(requiredStatusNeedsAttention({ lines: [{ shortCount: 2 }], unmatchedSections: [] }), true);
    assert.equal(requiredStatusNeedsAttention({ lines: [{ shortCount: 0 }], unmatchedSections: [{}] }), true);
  });

  it("booked tab has no duplicate intro, plain switches, and tools behind the card menu", () => {
    const workspace = readFileSync(resolve("components/events/floor-plan-workspace.tsx"), "utf8");
    const flags = readFileSync(resolve("components/events/floor-plan-review-flags-panel.tsx"), "utf8");
    assert.doesNotMatch(workspace, /Start with a layout, place furniture, then Share/);
    assert.doesNotMatch(workspace, /Couple visibility & seating|>Venue prep</);
    for (const label of ["Couple can see it", "Couple can seat guests", "Couple can add tables", "Vendors can see it"]) {
      assert.match(workspace, new RegExp(`label="${label}"`));
    }
    assert.match(workspace, /Organize wedding setups…/);
    assert.match(workspace, /Link before\/after layouts…/);
    assert.match(workspace, /hideWhenEmpty\n/);
    assert.match(flags, /if \(hideWhenEmpty && !loadError && \(loading \|\| flags\.length === 0\)\) return null;/);
    assert.doesNotMatch(workspace, /bg-amber-50\/40/);
    assert.doesNotMatch(workspace, /Open one and choose Set as working layout/);
    assert.match(workspace, /The couple is choosing from the layouts above\. When they pick one, you'll review it here\./);
  });
});
