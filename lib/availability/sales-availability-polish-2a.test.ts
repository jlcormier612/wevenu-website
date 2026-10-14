/**
 * Queue Item 2A — Sales owner / Date hold presentation polish.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

const holds = readFileSync(
  resolve("components/availability/date-holds-section.tsx"),
  "utf8",
);
const staff = readFileSync(
  resolve("components/team/staff-assignment-field.tsx"),
  "utf8",
);
const detail = readFileSync(resolve("components/leads/lead-detail.tsx"), "utf8");

describe("Sales & availability polish 2A", () => {
  it("Sales owner and Date hold labels share compact muted text treatment", () => {
    assert.match(staff, /text-xs font-medium text-muted-foreground/);
    assert.match(holds, /text-xs font-medium text-muted-foreground">Date hold</);
    const ownerHold = detail.slice(
      detail.indexOf('data-testid="lead-owner-hold-row"'),
      detail.indexOf('data-testid="lead-owner-hold-row"') + 900,
    );
    assert.match(ownerHold, /label="Sales owner"/);
    assert.match(ownerHold, /density="compact"/);
    assert.match(ownerHold, /items-center/);
  });

  it("compact owner select/save and Place hold match platform h-8; Place stays on the band at sm+", () => {
    // Matches Schedule Tour / relationship Edit (size=sm + h-8 ≈ 34px), not oversized h-11.
    assert.match(staff, /compact \? "h-8 w-\[9\.5rem\]/);
    assert.match(staff, /compact \? "h-8 shrink-0 whitespace-nowrap"/);
    assert.match(holds, /flex h-8 w-fit/);
    assert.match(holds, /sm:flex-nowrap/);
    assert.match(holds, /className="h-8 shrink-0 whitespace-nowrap"/);
  });

  it("expanded hold form spans the Sales & availability row via contents + basis-full", () => {
    assert.match(holds, /className=\{compact \? "contents" : "space-y-3"\}/);
    assert.match(holds, /data-testid="date-hold-form"/);
    assert.match(holds, /min-w-0 w-full max-w-full basis-full/);
    const formClass = holds.slice(
      holds.lastIndexOf("?", holds.indexOf('data-testid="date-hold-form"')),
      holds.indexOf('data-testid="date-hold-form"'),
    );
    assert.match(formClass, /max-w-full/);
    assert.doesNotMatch(formClass, /max-w-xl/);
    const ownerHold = detail.slice(
      detail.indexOf('data-testid="lead-owner-hold-row"'),
      detail.indexOf('data-testid="lead-owner-hold-row"') + 1200,
    );
    assert.match(ownerHold, /<DateHoldsSection/);
    assert.doesNotMatch(ownerHold, /flex-1 basis-full sm:basis-0/);
  });

  it("Place another hold uses filled primary Button (not outline)", () => {
    const placeStart = holds.indexOf('data-testid="date-hold-place"');
    assert.ok(placeStart > 0);
    const placeBlock = holds.slice(placeStart - 220, placeStart + 80);
    assert.match(placeBlock, /data-testid="date-hold-place"/);
    assert.doesNotMatch(placeBlock, /variant="outline"/);
    assert.match(placeBlock, /h-8 shrink-0 whitespace-nowrap/);
    // Default Button = primary fill (same as StaffAssignmentField save).
    assert.match(staff, /data-testid=\{`\$\{testId\}-save`\}/);
    assert.doesNotMatch(
      staff.slice(staff.indexOf("<Button"), staff.indexOf("data-testid={`${testId}-save`}")),
      /variant="outline"/,
    );
  });
});
