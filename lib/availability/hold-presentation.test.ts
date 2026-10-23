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
  canReactivateHold,
  currentProtectionSummary,
  historicalHoldLabel,
  historicalHolds,
  holdWindowLabel,
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
  const spaceId = over.spaceId ?? "space-1";
  const spaceName = over.spaceName ?? "Covered Bridge";
  return {
    venueId: "v1",
    leadId: "lead-1",
    spaceId,
    spaceIds: over.spaceIds ?? (spaceId ? [spaceId] : []),
    title: "Hold — Wilma",
    startTime: null,
    endTime: null,
    expiresAt: over.expiresAt ?? null,
    notes: null,
    createdAt: "2026-09-27T00:00:00Z",
    updatedAt: "2026-09-27T00:00:00Z",
    leadName: "Wilma Flintstone",
    spaceName,
    spaceNames: over.spaceNames ?? (spaceName ? [spaceName] : []),
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

  it("B. active hold → Held list plus Place another hold CTA", () => {
    const holds = [
      hold({
        id: "a1",
        holdDate: "2027-02-14",
        status: "active",
        spaceName: "Covered Bridge",
        expiresAt: "2099-12-31T23:59:59Z",
      }),
    ];
    assert.equal(isActiveHold(holds[0]), true);
    assert.equal(shouldShowPlaceHoldCta(holds), true);
    assert.equal(placeHoldCtaLabel("2027-02-14", true), "Place another hold");
    assert.equal(activeHolds(holds)[0]?.holdDate, "2027-02-14");
    assert.equal(activeHolds(holds)[0]?.spaceName, "Covered Bridge");
    assert.match(section, /Hold active/);
    assert.match(section, /Release hold/);
    assert.match(section, /data-testid="date-hold-active"/);
    assert.match(section, /data-testid="date-hold-release"/);
    assert.match(section, /data-testid="date-hold-active-list"/);
    assert.match(section, /data-testid="date-hold-protection-banner"/);
    assert.match(section, /Place another hold/);
    assert.match(section, /showPlaceHold \?/);
    assert.match(section, /shouldShowPlaceHoldCta/);
    assert.equal(
      currentProtectionSummary({ eventDate: "2027-02-14", holds }).headline,
      "DATE PROTECTED — HOLD ACTIVE",
    );
  });

  it("C. release moves hold into historical Released list", () => {
    const afterRelease = [
      hold({ id: "a1", holdDate: "2027-02-14", status: "released", spaceName: "Covered Bridge" }),
    ];
    assert.equal(shouldShowPlaceHoldCta(afterRelease), true);
    assert.equal(activeHolds(afterRelease).length, 0);
    assert.equal(historicalHolds(afterRelease).length, 1);
    assert.equal(
      historicalHoldLabel(afterRelease[0]!),
      "Feb 14, 2027 — Released (no longer protecting)",
    );
    assert.equal(
      currentProtectionSummary({ eventDate: "2027-02-14", holds: afterRelease }).headline,
      "DATE NOT CURRENTLY PROTECTED",
    );
    assert.match(section, /historicalHoldLabel/);
    assert.match(section, /Hold history \(not current protection\)/);
    assert.match(section, /date-hold-reactivate/);
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

  it("F. createHold allows a second same-lead/date hold unless resources and windows overlap", () => {
    assert.doesNotMatch(service, /An active hold already exists for this date/);
    assert.match(service, /holdsConflictWithEachOther/);
    assert.match(service, /That space and date range overlaps another active hold/);
  });

  it("Active Holds window uses HTC 12-hour formatTime, not raw HH:mm", () => {
    assert.equal(
      holdWindowLabel({ startTime: "16:00", endTime: "18:00" }),
      "4:00–6:00 PM",
    );
    assert.equal(
      holdWindowLabel({ startTime: "18:00", endTime: "23:00" }),
      "6:00–11:00 PM",
    );
    assert.equal(holdWindowLabel({ startTime: null, endTime: null }), null);
    assert.equal(holdWindowLabel({ startTime: "00:00", endTime: "12:00" }), "12:00 AM–12:00 PM");
    assert.equal(holdWindowLabel({ startTime: "12:00", endTime: "13:00" }), "12:00–1:00 PM");
    assert.equal(holdWindowLabel({ startTime: "09:00", endTime: "11:00" }), "9:00–11:00 AM");
    assert.equal(holdWindowLabel({ startTime: "10:00", endTime: "14:00" }), "10:00 AM–2:00 PM");
    assert.match(section, /holdWindowLabel\(hold\)/);
    assert.doesNotMatch(section, /function holdWindowLabel/);
    assert.doesNotMatch(section, /\$\{start\}–\$\{end\}/);
  });

  it("G. unexpired active holds stay Held; elapsed or closed statuses do not", () => {
    assert.equal(isActiveHold({ status: "active" }), true);
    assert.equal(isActiveHold({ status: "active", expiresAt: "2099-12-31T23:59:59Z" }), true);
    assert.equal(isActiveHold({ status: "active", expiresAt: "2020-01-01T00:00:00Z" }), false);
    assert.equal(isActiveHold({ status: "released" }), false);
    assert.equal(isActiveHold({ status: "expired" }), false);
    assert.equal(
      historicalHoldLabel(hold({ id: "e1", holdDate: "2027-02-14", status: "active", expiresAt: "2020-01-01T00:00:00Z" })),
      "Feb 14, 2027 — Expired (no longer protecting)",
    );
  });

  it("H. expired historical + separate active hold → date still protected", () => {
    const holds = [
      hold({
        id: "old",
        holdDate: "2027-10-16",
        status: "expired",
        expiresAt: "2020-01-01T00:00:00Z",
      }),
      hold({
        id: "new",
        holdDate: "2027-10-16",
        status: "active",
        expiresAt: "2099-10-29T23:59:59Z",
      }),
    ];
    assert.equal(activeHolds(holds).length, 1);
    assert.equal(historicalHolds(holds).length, 1);
    const summary = currentProtectionSummary({ eventDate: "2027-10-16", holds });
    assert.equal(summary.protected, true);
    assert.equal(summary.headline, "DATE PROTECTED — HOLD ACTIVE");
    assert.match(summary.detail ?? "", /Auto-release Oct 29, 2099/);
  });

  it("I. expired hold can be reactivated; converted cannot", () => {
    assert.equal(canReactivateHold({ status: "expired" }), true);
    assert.equal(canReactivateHold({ status: "released" }), true);
    assert.equal(canReactivateHold({ status: "active", expiresAt: "2020-01-01T00:00:00Z" }), true);
    assert.equal(canReactivateHold({ status: "active", expiresAt: "2099-01-01T00:00:00Z" }), false);
    assert.equal(canReactivateHold({ status: "converted" }), false);
    assert.match(service, /reactivat/);
    assert.match(service, /updateHoldStatus[\s\S]*active/);
    assert.match(section, /You're reactivating this Hold/);
  });
});
