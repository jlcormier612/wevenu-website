/**
 * Multiple active Date Holds for the same lead/date.
 * Hold = resource set + date + occupancy window. A second hold is a new row,
 * not an edit of the first. Conflict only when resources AND windows overlap.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import { holdsConflictWithEachOther } from "@/lib/availability/hold-occupancy";
import {
  placeHoldCtaLabel,
  shouldShowPlaceHoldCta,
} from "@/lib/availability/hold-presentation";

const SERVICE = readFileSync(resolve("lib/availability/service.ts"), "utf8");
const SECTION = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);
const REPO = readFileSync(resolve("lib/availability/repository.ts"), "utf8");
const CALENDAR = readFileSync(resolve("lib/calendar/service.ts"), "utf8");
const FOUNDATION = readFileSync(
  resolve("supabase/migrations/20260627060000_availability_foundation.sql"),
  "utf8",
);
const JUNCTION = readFileSync(
  resolve("supabase/migrations/20261411000000_date_hold_multi_space_time_aware.sql"),
  "utf8",
);

const BRIDGE = "bridge";
const BARN = "barn";
const DATE = "2027-09-04";

function hold(over: {
  spaceIds: string[];
  startTime: string | null;
  endTime: string | null;
  holdDate?: string;
}) {
  return {
    holdDate: over.holdDate ?? DATE,
    startTime: over.startTime,
    endTime: over.endTime,
    spaceIds: over.spaceIds,
  };
}

describe("same-lead multi-hold occupancy (A–F)", () => {
  it("A. same lead/date, different spaces, different windows → allowed", () => {
    const a = hold({ spaceIds: [BRIDGE], startTime: "10:00", endTime: "14:00" });
    const b = hold({ spaceIds: [BARN], startTime: "16:00", endTime: "22:00" });
    assert.equal(holdsConflictWithEachOther(a, b, 2), false);
  });

  it("B. same lead/date, same space, overlapping windows → blocked", () => {
    const a = hold({ spaceIds: [BRIDGE], startTime: "10:00", endTime: "15:00" });
    const b = hold({ spaceIds: [BRIDGE], startTime: "14:00", endTime: "18:00" });
    assert.equal(holdsConflictWithEachOther(a, b, 2), true);
  });

  it("C. same lead/date, same space, exact-boundary windows → allowed", () => {
    const a = hold({ spaceIds: [BRIDGE], startTime: "10:00", endTime: "14:00" });
    const b = hold({ spaceIds: [BRIDGE], startTime: "14:00", endTime: "18:00" });
    assert.equal(holdsConflictWithEachOther(a, b, 2), false);
  });

  it("D. same lead/date, different spaces, overlapping windows → allowed", () => {
    const a = hold({ spaceIds: [BRIDGE], startTime: "10:00", endTime: "14:00" });
    const b = hold({ spaceIds: [BARN], startTime: "10:00", endTime: "14:00" });
    assert.equal(holdsConflictWithEachOther(a, b, 2), false);
  });

  it("E. whole-venue hold conflicts with any overlapping space hold", () => {
    const whole = hold({ spaceIds: [], startTime: "10:00", endTime: "14:00" });
    const barn = hold({ spaceIds: [BARN], startTime: "12:00", endTime: "16:00" });
    assert.equal(holdsConflictWithEachOther(whole, barn, 2), true);
    const later = hold({ spaceIds: [BARN], startTime: "14:00", endTime: "18:00" });
    assert.equal(holdsConflictWithEachOther(whole, later, 2), false);
  });

  it("F. multi-space hold conflicts with an overlapping hold on one of its spaces", () => {
    const multi = hold({ spaceIds: [BRIDGE, BARN], startTime: "10:00", endTime: "18:00" });
    const barnOverlap = hold({ spaceIds: [BARN], startTime: "16:00", endTime: "22:00" });
    assert.equal(holdsConflictWithEachOther(multi, barnOverlap, 2), true);
    const garden = hold({ spaceIds: ["garden"], startTime: "16:00", endTime: "22:00" });
    assert.equal(holdsConflictWithEachOther(multi, garden, 2), false);
  });
});

describe("same-lead multi-hold persistence and release (G–I)", () => {
  it("G. releasing one hold is by hold id and does not rewrite sibling holds", () => {
    assert.match(SERVICE, /export async function releaseHold\(holdId: string\)/);
    assert.match(REPO, /updateHoldStatus[\s\S]*\.eq\("id", holdId\)/);
    assert.match(SECTION, /handleRelease\(hold\.id\)/);
    assert.doesNotMatch(SERVICE, /releaseHold[\s\S]{0,400}leadId/);
  });

  it("H. multiple active holds persist independently — no lead+date uniqueness", () => {
    assert.doesNotMatch(SERVICE, /An active hold already exists for this date/);
    assert.match(REPO, /insertHold[\s\S]*\.insert\(/);
    assert.doesNotMatch(FOUNDATION, /unique \(venue_id, lead_id, hold_date\)/);
    assert.doesNotMatch(FOUNDATION, /unique \(lead_id, hold_date\)/);
    assert.match(JUNCTION, /unique \(hold_id, space_id\)/);
    assert.equal(shouldShowPlaceHoldCta([{ status: "active" } as never]), true);
    assert.equal(placeHoldCtaLabel(DATE, true), "Place another hold");
    assert.match(SECTION, /Place another hold/);
    assert.match(SECTION, /This creates a new hold/);
  });

  it("I. calendar emits one item per hold with that hold's resource set", () => {
    assert.match(CALENDAR, /id: `hold-\$\{h\.id\}`/);
    assert.match(CALENDAR, /type: "date_hold"/);
    assert.match(CALENDAR, /from\("date_hold_spaces"\)/);
    assert.match(CALENDAR, /holdSpaceMap\.get\(h\.id\)/);
    assert.match(CALENDAR, /spaceIds/);
  });
});

describe("createHold uses overlap — not same-lead uniqueness", () => {
  it("createHold loops active-on-date holds through holdsConflictWithEachOther", () => {
    assert.match(SERVICE, /holdsConflictWithEachOther/);
    assert.match(SERVICE, /activeOnDate/);
    assert.match(SERVICE, /That space and time window overlaps another active hold/);
    assert.doesNotMatch(SERVICE, /Release it before placing another/);
  });
});
