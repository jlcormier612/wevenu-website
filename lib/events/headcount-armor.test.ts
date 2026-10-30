/**
 * Narrow B armor — flag-off characterization + Save notices.
 *
 * Run: npx tsx --test lib/events/headcount-armor.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";
import { resolve } from "node:path";

import { headcountRecalcEnabled } from "@/lib/events/headcount";
import {
  recalculateBoundEventOrderLinesForEvent,
  venueNoticeForHeadcountSkip,
} from "@/lib/events/headcount-recalc";
import { startingQuantityForLine } from "@/lib/event-order-templates/offerings";
import type { EventOrderTemplateLine } from "@/lib/event-order-templates/types";

const read = (rel: string) => readFileSync(resolve(rel), "utf8");

const prevFlag = process.env.HEADCOUNT_RECALC_ENABLED;
afterEach(() => {
  if (prevFlag === undefined) delete process.env.HEADCOUNT_RECALC_ENABLED;
  else process.env.HEADCOUNT_RECALC_ENABLED = prevFlag;
});

function dinnerLine(): EventOrderTemplateLine {
  return {
    id: "dinner",
    templateId: "t",
    venueId: "v",
    sectionId: null,
    description: "dinner",
    descriptionDetail: null,
    quantity: 1,
    unitPrice: 85,
    pricingModel: "per_person",
    unit: "guest",
    includedByDefault: true,
    offeringId: null,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
  };
}

describe("Armor — legacy apply quantities still freeze without living recalc", () => {
  it("null guests → qty 1; 120 → 120 (pre-Narrow-B apply contract)", () => {
    assert.equal(startingQuantityForLine(dinnerLine(), null), 1);
    assert.equal(startingQuantityForLine(dinnerLine(), 120), 120);
  });

  it("flag off kills recalc before any DB work (one switch, no schema revert)", async () => {
    process.env.HEADCOUNT_RECALC_ENABLED = "false";
    assert.equal(headcountRecalcEnabled(), false);

    let touched = false;
    const supabase = new Proxy(
      {},
      {
        get() {
          touched = true;
          throw new Error("flag-off path must not touch the database");
        },
      },
    );

    const result = await recalculateBoundEventOrderLinesForEvent(
      supabase as never,
      "venue",
      "event",
      120,
      110,
    );
    assert.equal(result.skippedReason, "flag_off");
    assert.equal(result.attempted, false);
    assert.equal(result.updated, 0);
    assert.equal(touched, false);
  });

  it("flag on remains the sandbox/test default when env unset", () => {
    delete process.env.HEADCOUNT_RECALC_ENABLED;
    assert.equal(headcountRecalcEnabled(), true);
  });
});

describe("Armor — venue Save notices", () => {
  it("maps skip reasons the venue must see", () => {
    assert.match(venueNoticeForHeadcountSkip("flag_off") ?? "", /turned off/i);
    assert.match(venueNoticeForHeadcountSkip("approved") ?? "", /Approved Event Order/i);
    assert.match(venueNoticeForHeadcountSkip("eo_invoice_draft") ?? "", /draft Event Order invoice/i);
    assert.match(venueNoticeForHeadcountSkip("eo_invoice_issued") ?? "", /never reprice/i);
    assert.equal(venueNoticeForHeadcountSkip("not_open"), null);
    assert.equal(venueNoticeForHeadcountSkip("no_event_order"), null);
    assert.equal(venueNoticeForHeadcountSkip(undefined), null);
  });

  it("updateEvent_ returns headcountNotice; edit form toasts it; approved writes activity", () => {
    const svc = read("lib/events/service.ts");
    assert.match(svc, /venueNoticeForHeadcountSkip/);
    assert.match(svc, /headcountNotice/);
    const form = read("components/events/event-edit-form.tsx");
    assert.match(form, /result\.headcountNotice/);
    assert.match(form, /toast\.warning\(result\.headcountNotice\)/);
    const recalc = read("lib/events/headcount-recalc.ts");
    assert.match(recalc, /gate === "approved"/);
    assert.match(recalc, /already approved this Event Order/);
  });

  it("decision lock documents HEADCOUNT_RECALC_ENABLED as narrow_headcount_v1 kill switch", () => {
    const lock = read("docs/qa/narrow-headcount/DECISION-LOCK.md");
    assert.match(lock, /narrow_headcount_v1/);
    assert.match(lock, /HEADCOUNT_RECALC_ENABLED/);
  });
});
