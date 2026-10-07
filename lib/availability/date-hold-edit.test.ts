/**
 * Date Hold in-place edit (K / P / U / C / R).
 * Edit updates the same date_holds row. Validation is the create assertion
 * with the current hold excluded by id only.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  holdsConflictWithEachOther,
  otherActiveHoldsForPlacement,
} from "@/lib/availability/hold-occupancy";

const SERVICE = readFileSync(resolve("lib/availability/service.ts"), "utf8");
const REPO = readFileSync(resolve("lib/availability/repository.ts"), "utf8");
const SECTION = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);
const ACTIONS = readFileSync(resolve("app/(app)/availability/actions.ts"), "utf8");
const TYPES = readFileSync(resolve("lib/availability/types.ts"), "utf8");
const OCCUPANCY = readFileSync(resolve("lib/availability/hold-occupancy.ts"), "utf8");
const CALENDAR = readFileSync(resolve("lib/calendar/service.ts"), "utf8");
const FOUNDATION = readFileSync(
  resolve("supabase/migrations/20260627060000_availability_foundation.sql"),
  "utf8",
);

const BARN = "barn";
const GARDEN = "garden-lawn";
const DEC22 = "2026-12-22";
const DEC23 = "2026-12-23";
const HOLD_ID = "hold-self";
const OTHER_ID = "hold-other";
const LEAD = "lead-a";
const OTHER_LEAD = "lead-b";

function row(over: {
  id?: string;
  leadId?: string | null;
  holdDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  spaceIds?: string[];
}) {
  return {
    id: over.id ?? HOLD_ID,
    leadId: over.leadId === undefined ? LEAD : over.leadId,
    holdDate: over.holdDate ?? DEC22,
    startTime: over.startTime === undefined ? "14:00" : over.startTime,
    endTime: over.endTime === undefined ? "18:00" : over.endTime,
    spaceIds: over.spaceIds ?? [BARN],
  };
}

function editConflicts(
  candidate: ReturnType<typeof row>,
  others: ReturnType<typeof row>[],
  excludeHoldId: string | undefined,
  effectiveMax: number,
): boolean {
  const activeOnDate = otherActiveHoldsForPlacement(others, candidate.holdDate, excludeHoldId);
  return activeOnDate.some((other) => holdsConflictWithEachOther(candidate, other, effectiveMax));
}

describe("K — edit placement engine", () => {
  it("K1. same values succeed because the current hold is excluded by id", () => {
    const current = row({ id: HOLD_ID });
    const candidate = row({ id: "candidate" });
    assert.equal(editConflicts(candidate, [current], HOLD_ID, 2), false);
    assert.equal(editConflicts(candidate, [current], undefined, 2), true);
  });

  it("K2. Barn → Garden Lawn is allowed when Garden Lawn is free", () => {
    const current = row({ id: HOLD_ID, spaceIds: [BARN] });
    const candidate = row({ id: "candidate", spaceIds: [GARDEN] });
    assert.equal(editConflicts(candidate, [current], HOLD_ID, 2), false);
  });

  it("K3. Barn → Barn + Garden Lawn is allowed when both are free", () => {
    const current = row({ id: HOLD_ID, spaceIds: [BARN] });
    const candidate = row({ id: "candidate", spaceIds: [BARN, GARDEN] });
    assert.equal(editConflicts(candidate, [current], HOLD_ID, 2), false);
  });

  it("K4. All day → 2:00–6:00 PM is allowed when free", () => {
    const current = row({ id: HOLD_ID, startTime: null, endTime: null });
    const candidate = row({ id: "candidate", startTime: "14:00", endTime: "18:00" });
    assert.equal(editConflicts(candidate, [current], HOLD_ID, 2), false);
  });

  it("K5. 2:00–6:00 PM → All day is allowed when free", () => {
    const current = row({ id: HOLD_ID, startTime: "14:00", endTime: "18:00" });
    const candidate = row({ id: "candidate", startTime: null, endTime: null });
    assert.equal(editConflicts(candidate, [current], HOLD_ID, 2), false);
  });

  it("K6. Dec 22 → Dec 23 is allowed; old-date holds do not matter", () => {
    const current = row({ id: HOLD_ID, holdDate: DEC22 });
    const otherOnOldDate = row({
      id: OTHER_ID,
      holdDate: DEC22,
      spaceIds: [BARN],
      startTime: "14:00",
      endTime: "18:00",
    });
    const candidate = row({ id: "candidate", holdDate: DEC23 });
    assert.equal(
      editConflicts(candidate, [current, otherOnOldDate], HOLD_ID, 2),
      false,
    );
  });

  it("K7. date + space + time are validated as one complete candidate", () => {
    const current = row({
      id: HOLD_ID,
      holdDate: DEC22,
      spaceIds: [BARN],
      startTime: "14:00",
      endTime: "18:00",
    });
    const blocking = row({
      id: OTHER_ID,
      holdDate: DEC23,
      spaceIds: [GARDEN],
      startTime: "10:00",
      endTime: "16:00",
    });
    const candidate = row({
      id: "candidate",
      holdDate: DEC23,
      spaceIds: [GARDEN],
      startTime: "12:00",
      endTime: "15:00",
    });
    assert.equal(editConflicts(candidate, [current, blocking], HOLD_ID, 2), true);
    const free = row({
      id: "candidate",
      holdDate: DEC23,
      spaceIds: [BARN],
      startTime: "12:00",
      endTime: "15:00",
    });
    assert.equal(editConflicts(free, [current, blocking], HOLD_ID, 2), false);
  });

  it("K8. overlap with another active hold, including same lead, uses the create message", () => {
    const current = row({ id: HOLD_ID, spaceIds: [BARN] });
    const sibling = row({
      id: OTHER_ID,
      leadId: LEAD,
      spaceIds: [GARDEN],
      startTime: "14:00",
      endTime: "18:00",
    });
    const candidate = row({ id: "candidate", spaceIds: [GARDEN] });
    assert.equal(editConflicts(candidate, [current, sibling], HOLD_ID, 2), true);
    const foreign = row({
      id: "hold-foreign",
      leadId: OTHER_LEAD,
      spaceIds: [GARDEN],
    });
    assert.equal(editConflicts(candidate, [current, foreign], HOLD_ID, 2), true);
    assert.match(SERVICE, /That space and time window overlaps another active hold/);
  });

  it("K9. booked-event overlap is rejected through checkAvailability, not a parallel hold helper", () => {
    const assertFn = SERVICE.slice(SERVICE.indexOf("async function assertHoldPlacement"));
    assert.match(assertFn, /repo\.checkAvailability/);
    assert.match(assertFn, /event_capacity_full/);
    assert.match(assertFn, /event_occupancy/);
    assert.match(assertFn, /space_booked/);
    assert.match(assertFn, /calendar_blocked/);
    assert.match(assertFn, /event_turnaround/);
    assert.doesNotMatch(SERVICE, /holdConflictsWithBookedEvent/);
    assert.doesNotMatch(REPO, /holdConflictsWithBookedEvent/);
  });

  it("K10. moving from a conflicting posture to a free space/time is allowed", () => {
    const current = row({ id: HOLD_ID, spaceIds: [BARN], startTime: "14:00", endTime: "18:00" });
    const other = row({ id: OTHER_ID, spaceIds: [BARN], startTime: "16:00", endTime: "20:00" });
    const stillConflict = row({ id: "candidate", spaceIds: [BARN], startTime: "15:00", endTime: "17:00" });
    const free = row({ id: "candidate", spaceIds: [GARDEN], startTime: "14:00", endTime: "18:00" });
    assert.equal(editConflicts(stillConflict, [current, other], HOLD_ID, 2), true);
    assert.equal(editConflicts(free, [current, other], HOLD_ID, 2), false);
  });

  it("K11. exact boundary is non-overlapping", () => {
    const current = row({ id: HOLD_ID, startTime: "10:00", endTime: "14:00" });
    const other = row({ id: OTHER_ID, startTime: "14:00", endTime: "18:00" });
    const candidate = row({ id: "candidate", startTime: "10:00", endTime: "14:00" });
    assert.equal(editConflicts(candidate, [current, other], HOLD_ID, 2), false);
  });

  it("K12. whole venue ↔ single space keeps existing collision semantics", () => {
    const current = row({ id: HOLD_ID, spaceIds: [BARN] });
    const otherGarden = row({ id: OTHER_ID, spaceIds: [GARDEN], startTime: "14:00", endTime: "18:00" });
    const toWhole = row({ id: "candidate", spaceIds: [] });
    assert.equal(editConflicts(toWhole, [current, otherGarden], HOLD_ID, 2), true);
    const currentWhole = row({ id: HOLD_ID, spaceIds: [] });
    const toBarn = row({ id: "candidate", spaceIds: [BARN] });
    assert.equal(editConflicts(toBarn, [currentWhole], HOLD_ID, 2), false);
    assert.equal(editConflicts(toBarn, [currentWhole, otherGarden], HOLD_ID, 2), false);
    const overlappingGarden = row({
      id: OTHER_ID,
      spaceIds: [GARDEN],
      startTime: "15:00",
      endTime: "17:00",
    });
    assert.equal(editConflicts(toBarn, [currentWhole, overlappingGarden], HOLD_ID, 2), false);
    const toWholeAgainstGarden = row({ id: "candidate", spaceIds: [] });
    assert.equal(
      editConflicts(toWholeAgainstGarden, [row({ id: HOLD_ID, spaceIds: [BARN] }), overlappingGarden], HOLD_ID, 2),
      true,
    );
  });

  it("K13. simple venue max < 2: different spaces, overlapping window → conflict", () => {
    const current = row({ id: HOLD_ID, spaceIds: [BARN] });
    const other = row({ id: OTHER_ID, spaceIds: [GARDEN] });
    const candidate = row({ id: "candidate", spaceIds: [BARN] });
    assert.equal(editConflicts(candidate, [current, other], HOLD_ID, 1), true);
  });

  it("K14. simultaneous venue max >= 2: different spaces, same window → allowed", () => {
    const current = row({ id: HOLD_ID, spaceIds: [BARN] });
    const other = row({ id: OTHER_ID, spaceIds: [GARDEN] });
    const candidate = row({ id: "candidate", spaceIds: [BARN] });
    assert.equal(editConflicts(candidate, [current, other], HOLD_ID, 2), false);
  });

  it("K15. booked-event turnaround still goes through checkAvailability", () => {
    const assertFn = SERVICE.slice(SERVICE.indexOf("async function assertHoldPlacement"));
    assert.match(assertFn, /purpose: spaceId \? "booking" : "preferred_date"/);
    assert.match(assertFn, /c\.type === "event_turnaround"/);
    assert.match(assertFn, /repo\.checkAvailability/);
  });

  it("K16. create without excludeHoldId keeps create behavior", () => {
    assert.match(SERVICE, /const asserted = await assertHoldPlacement\(supabase, venueId, resolved\);/);
    const createFn = SERVICE.slice(
      SERVICE.indexOf("export async function createHold"),
      SERVICE.indexOf("export async function updateHold"),
    );
    assert.doesNotMatch(createFn, /excludeHoldId/);
    const current = row({ id: HOLD_ID });
    const candidate = row({ id: "candidate" });
    assert.equal(editConflicts(candidate, [current], undefined, 2), true);
  });

  it("K17. shared assertion + existing overlap engine — no second implementation", () => {
    assert.match(SERVICE, /async function assertHoldPlacement/);
    assert.match(SERVICE, /otherActiveHoldsForPlacement/);
    assert.match(SERVICE, /holdsConflictWithEachOther/);
    assert.match(
      SERVICE,
      /assertHoldPlacement\(supabase, venueId, resolved, \{ excludeHoldId: holdId \}\)/,
    );
    assert.match(OCCUPANCY, /export function otherActiveHoldsForPlacement/);
    const excludeHelper = OCCUPANCY.slice(
      OCCUPANCY.indexOf("export function otherActiveHoldsForPlacement"),
      OCCUPANCY.indexOf("export function holdsConflictWithEachOther"),
    );
    assert.match(excludeHelper, /if \(exclude && h\.id === exclude\) return false/);
    assert.doesNotMatch(excludeHelper, /excludeLeadId/);
    assert.doesNotMatch(excludeHelper, /leadId/);
    assert.doesNotMatch(SERVICE, /holdConflictsWithBookedEvent/);
    const updateFn = SERVICE.slice(SERVICE.indexOf("export async function updateHold"));
    assert.doesNotMatch(updateFn.slice(0, 900), /windowsOverlap\(/);
  });
});

describe("P — persistence / identity", () => {
  it("P1. save preserves id, lead_id, status, created_at", () => {
    const updateFn = REPO.slice(
      REPO.indexOf("export async function updateHold"),
      REPO.indexOf("export async function updateHoldStatus"),
    );
    const holdWrite = updateFn.slice(0, updateFn.indexOf('from("date_hold_spaces")'));
    assert.match(holdWrite, /\.update\(patch\)/);
    assert.match(holdWrite, /\.eq\("id", holdId\)/);
    assert.doesNotMatch(holdWrite, /lead_id:/);
    assert.doesNotMatch(holdWrite, /status:/);
    assert.doesNotMatch(holdWrite, /created_at:/);
    assert.doesNotMatch(holdWrite, /\.insert\(/);
    assert.match(TYPES, /export type DateHoldUpdateInput/);
  });

  it("P2. updated_at is left to the existing trigger", () => {
    const updateFn = REPO.slice(REPO.indexOf("export async function updateHold"));
    assert.doesNotMatch(updateFn.slice(0, 1600), /updated_at:/);
    assert.match(FOUNDATION, /create trigger date_holds_updated_at/);
  });

  it("P3. junction is replaced for this hold only; space_id mirror stays synchronized", () => {
    const updateFn = REPO.slice(REPO.indexOf("export async function updateHold"));
    assert.match(updateFn, /legacySpaceId = spaces\.length === 1 \? spaces\[0]! : null/);
    assert.match(updateFn, /space_id: legacySpaceId/);
    assert.match(updateFn, /from\("date_hold_spaces"\)[\s\S]*\.delete\(\)[\s\S]*\.eq\("hold_id", holdId\)[\s\S]*\.eq\("venue_id", venueId\)/);
    assert.match(updateFn, /spaces\.map\(\(spaceId\) => \(\{ venue_id: venueId, hold_id: holdId, space_id: spaceId \}\)\)/);
  });

  it("P4. release remains status-only", () => {
    assert.match(SERVICE, /export async function releaseHold\(holdId: string\)/);
    assert.match(REPO, /updateHoldStatus[\s\S]*\.update\(\{ status \}\)[\s\S]*\.eq\("id", holdId\)/);
    const releaseFn = SERVICE.slice(
      SERVICE.indexOf("export async function releaseHold"),
      SERVICE.indexOf("export async function deleteHold_"),
    );
    assert.match(releaseFn, /updateHoldStatus/);
    assert.doesNotMatch(releaseFn, /repo\.updateHold\(/);
    assert.doesNotMatch(releaseFn, /insertHold/);
  });

  it("P5. non-active hold cannot be updated", () => {
    const updateFn = SERVICE.slice(SERVICE.indexOf("export async function updateHold"));
    assert.match(updateFn, /existing\.status !== "active"/);
    assert.match(updateFn, /Only an active hold can be edited/);
  });

  it("P6. wrong venue / wrong lead cannot be updated", () => {
    const updateFn = SERVICE.slice(SERVICE.indexOf("export async function updateHold"));
    assert.match(updateFn, /repo\.getHold\(supabase, venueId, holdId\)/);
    assert.match(updateFn, /existing\.leadId/);
    assert.match(updateFn, /That hold does not belong to this lead/);
    assert.match(REPO, /export async function getHold[\s\S]*\.eq\("id", holdId\)\.eq\("venue_id", venueId\)/);
  });

  it("P7. notes are preserved when the form does not send them", () => {
    const updateInput = TYPES.slice(
      TYPES.indexOf("export type DateHoldUpdateInput"),
      TYPES.indexOf("export type CalendarBlockInput"),
    );
    assert.doesNotMatch(updateInput, /notes/);
    const updateFn = REPO.slice(
      REPO.indexOf("export async function updateHold"),
      REPO.indexOf("export async function updateHoldStatus"),
    );
    assert.doesNotMatch(updateFn, /notes/);
  });

  it("P8. expires_at is preserved unless the shared form sends it; title same", () => {
    const updateFn = REPO.slice(REPO.indexOf("export async function updateHold"));
    assert.match(updateFn, /if \(input\.title !== undefined\) patch\.title = input\.title\.trim\(\)/);
    assert.match(updateFn, /if \(input\.expiresAt !== undefined\) patch\.expires_at = input\.expiresAt \|\| null/);
    assert.match(TYPES, /title\?: string/);
    assert.match(TYPES, /expiresAt\?: string/);
  });
});

describe("U — Date Hold overview UI", () => {
  it("U1. active card shows Edit + Release hold", () => {
    assert.match(SECTION, /data-testid="date-hold-edit"/);
    assert.match(SECTION, />\s*Edit\s*</);
    assert.match(SECTION, /Release hold/);
    assert.match(SECTION, /data-testid="date-hold-release"/);
  });

  it("U2. Edit opens the existing form populated from the hold itself", () => {
    assert.match(SECTION, /function openEdit\(hold: DateHold\)/);
    assert.match(SECTION, /setHoldDate\(hold\.holdDate\)/);
    assert.match(SECTION, /setSelectedSpaceIds\(hold\.spaceIds\)/);
    assert.match(SECTION, /setStartTime\(hold\.startTime \?\? ""\)/);
    assert.match(SECTION, /setEndTime\(hold\.endTime \?\? ""\)/);
    assert.match(SECTION, /setWholeVenue\(hold\.spaceIds\.length === 0\)/);
    const openEdit = SECTION.slice(
      SECTION.indexOf("function openEdit"),
      SECTION.indexOf("function toggleSpace"),
    );
    assert.doesNotMatch(openEdit, /desiredDefault/);
    assert.doesNotMatch(openEdit, /prefDefaults/);
    assert.doesNotMatch(openEdit, /defaultHoldDateFromDesiredEventDate/);
    assert.doesNotMatch(openEdit, /defaultHoldSpaceIdsFromPreferences/);
  });

  it("U3. Save updates the same hold; no second hold", () => {
    assert.match(SECTION, /updateHoldAction\(editingHoldId, input\)/);
    assert.match(SECTION, /p\.map\(\(h\) => h\.id !== editingHoldId/);
    assert.doesNotMatch(
      SECTION.slice(SECTION.indexOf("function handleSave"), SECTION.indexOf("async function handleRelease")),
      /\[\.\.\.p,/,
    );
  });

  it("U4. Cancel makes no mutation", () => {
    assert.match(SECTION, /function closeForm\(\)/);
    const closeFn = SECTION.slice(
      SECTION.indexOf("function closeForm"),
      SECTION.indexOf("function openForm"),
    );
    assert.match(closeFn, /setFormMode\(null\)/);
    assert.doesNotMatch(closeFn, /updateHoldAction|createHoldAction|releaseHoldAction/);
  });

  it("U5. historical rows have no Edit", () => {
    const history = SECTION.slice(
      SECTION.indexOf("date-hold-history"),
      SECTION.indexOf("Place hold / Place another hold"),
    );
    assert.doesNotMatch(history, /date-hold-edit/);
    assert.doesNotMatch(history, /openEdit/);
    assert.doesNotMatch(history, /Release hold/);
  });

  it("U6. Place another hold still inserts; Edit updates", () => {
    assert.match(SECTION, /formMode === "edit" \? handleSave : handleAdd/);
    assert.match(SECTION, /createHoldAction\(input\)/);
    assert.match(SECTION, /updateHoldAction\(editingHoldId, input\)/);
    const openForm = SECTION.slice(
      SECTION.indexOf("function openForm"),
      SECTION.indexOf("function openEdit"),
    );
    assert.match(openForm, /setFormMode\("create"\)/);
    assert.match(SECTION, /This creates a new hold/);
  });

  it("U7. inactive space already on the hold remains selectable during edit", () => {
    assert.match(SECTION, /!s\.isActive && selectedSpaceIds\.includes\(s\.id\)/);
    assert.match(SECTION, /formSpaces\.map/);
  });
});

describe("C — calendar / live readers", () => {
  it("C1. updateHoldAction revalidates calendar + leads", () => {
    assert.match(ACTIONS, /export async function updateHoldAction/);
    const action = ACTIONS.slice(
      ACTIONS.indexOf("export async function updateHoldAction"),
      ACTIONS.indexOf("export async function releaseHoldAction"),
    );
    assert.match(action, /revalidatePath\("\/calendar"\)/);
    assert.match(action, /revalidatePath\("\/leads", "layout"\)/);
  });

  it("C2. calendar item remains hold-{id}", () => {
    assert.match(CALENDAR, /id: `hold-\$\{h\.id\}`/);
    assert.doesNotMatch(SERVICE, /insertHold[\s\S]{0,80}updateHold/);
    const updateFn = SERVICE.slice(SERVICE.indexOf("export async function updateHold"));
    assert.match(updateFn, /repo\.updateHold\(supabase, venueId, holdId, resolved\)/);
    assert.doesNotMatch(updateFn.slice(0, 1200), /insertHold/);
    assert.doesNotMatch(updateFn.slice(0, 1200), /deleteHold/);
  });

  it("C3. readers keep using date_holds on the next read — no occupancy cache rebuild", () => {
    assert.doesNotMatch(SERVICE, /materialized view|hold occupancy cache|rebuildHold/i);
    assert.match(CALENDAR, /from\("date_holds"\)/);
  });
});

describe("R — permissions / write shape", () => {
  it("R1. updateHold uses the existing withVenue authorization pattern", () => {
    const updateFn = SERVICE.slice(SERVICE.indexOf("export async function updateHold"));
    assert.match(updateFn, /withVenue/);
  });

  it("R2. implementation is UPDATE, not DELETE + INSERT of date_holds", () => {
    const updateFn = REPO.slice(REPO.indexOf("export async function updateHold"));
    const holdWrite = updateFn.slice(0, updateFn.indexOf("from(\"date_hold_spaces\")"));
    assert.match(holdWrite, /\.update\(patch\)/);
    assert.doesNotMatch(holdWrite, /\.delete\(/);
    assert.doesNotMatch(holdWrite, /\.insert\(/);
  });

  it("R3. unauthenticated / no venue still fails through withVenue", () => {
    assert.match(SERVICE, /if \(!venue\) return \{ ok: false, message: "No venue found\." \}/);
    assert.match(SERVICE, /if \(!user\) return \{ ok: false, message: "Session expired\." \}/);
  });
});
