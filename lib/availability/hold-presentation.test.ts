/**
 * Date Hold active-state presentation — Held vs Place hold vs Released.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { defaultHoldDateFromDesiredEventDate } from "@/lib/availability/hold-defaults";
import {
  activeHolds,
  historicalHoldLabel,
  historicalHolds,
  isActiveHold,
  placeHoldCtaLabel,
  shouldShowPlaceHoldCta,
} from "@/lib/availability/hold-presentation";
import type { DateHold } from "@/lib/availability/types";

const section = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);
const service = readFileSync(resolve("lib/availability/service.ts"), "utf8");

function hold(over: Partial<DateHold> & Pick<DateHold, "id" | "holdDate" | "status">): DateHold {
  return {
    venueId: "v1",
    leadId: "lead-1",
    spaceId: over.spaceId ?? "space-1",
    title: "Hold — Wilma",
    startTime: null,
    endTime: null,
    expiresAt: over.expiresAt ?? null,
    notes: null,
    createdAt: "2026-09-27T00:00:00Z",
    updatedAt: "2026-09-27T00:00:00Z",
    leadName: "Wilma Flintstone",
    spaceName: over.spaceName ?? "Covered Bridge",
    ...over,
  };
}

describe("Date Hold active-state presentation", () => {
  it("A. no active hold → Place hold CTA uses desired date", () => {
    const holds = [hold({ id: "r1", holdDate: "2027-02-14", status: "released" })];
    assert.equal(shouldShowPlaceHoldCta(holds), true);
    assert.equal(activeHolds(holds).length, 0);
    assert.equal(
      placeHoldCtaLabel(defaultHoldDateFromDesiredEventDate("2027-02-14")),
      "Place hold on Feb 14, 2027",
    );
  });

  it("B. active hold → Held state; no Place hold CTA for that lead", () => {
    const holds = [
      hold({
        id: "a1",
        holdDate: "2027-02-14",
        status: "active",
        spaceName: "Covered Bridge",
        expiresAt: "2026-09-30T23:59:59Z",
      }),
    ];
    assert.equal(isActiveHold(holds[0]), true);
    assert.equal(shouldShowPlaceHoldCta(holds), false);
    assert.equal(activeHolds(holds)[0]?.holdDate, "2027-02-14");
    assert.equal(activeHolds(holds)[0]?.spaceName, "Covered Bridge");
    assert.match(section, />\s*Held\s*</);
    assert.match(section, /Release hold/);
    assert.match(section, /data-testid="date-hold-active"/);
    assert.match(section, /data-testid="date-hold-release"/);
    // Place hold CTA is gated — not rendered while an active hold exists
    assert.match(section, /showPlaceHold \?/);
    assert.match(section, /shouldShowPlaceHoldCta/);
    assert.doesNotMatch(
      section,
      /activeHolds\.length > 0[\s\S]*Place hold on \$\{formatDate\(desiredDefault\)\}/,
    );
  });

  it("C. release moves hold into historical Released list", () => {
    const afterRelease = [
      hold({ id: "a1", holdDate: "2027-02-14", status: "released", spaceName: "Covered Bridge" }),
    ];
    assert.equal(shouldShowPlaceHoldCta(afterRelease), true);
    assert.equal(activeHolds(afterRelease).length, 0);
    assert.equal(historicalHolds(afterRelease).length, 1);
    assert.equal(historicalHoldLabel(afterRelease[0]), "Feb 14, 2027 — Released");
    assert.match(section, /historicalHoldLabel/);
  });

  it("D. after release, Place hold again defaults to desired event date", () => {
    assert.equal(defaultHoldDateFromDesiredEventDate("2027-02-14"), "2027-02-14");
    assert.equal(
      placeHoldCtaLabel(defaultHoldDateFromDesiredEventDate("2027-02-14")),
      "Place hold on Feb 14, 2027",
    );
    assert.match(section, /defaultHoldDateFromDesiredEventDate/);
    assert.match(section, /setHoldDate\(desiredDefault\)/);
  });

  it("E. intentional date override still available on the create form", () => {
    assert.match(section, /data-testid="date-hold-hold-date"/);
    assert.match(section, /Change only if you intend to hold a different day/);
  });

  it("F. duplicate active hold for same lead+date is refused in createHold", () => {
    assert.match(service, /An active hold already exists for this date/);
    assert.match(service, /activeOnly:\s*true/);
    assert.match(service, /h\.holdDate === input\.holdDate/);
  });

  it("G. calendar/availability still keys off active status (unchanged contract)", () => {
    // Presentation helpers do not redefine calendar SoT — status === active.
    assert.equal(isActiveHold({ status: "active" }), true);
    assert.equal(isActiveHold({ status: "released" }), false);
    assert.equal(isActiveHold({ status: "expired" }), false);
  });
});
